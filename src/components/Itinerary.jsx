import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Compass, UtensilsCrossed, Pencil, CalendarRange, GripVertical, Route, Navigation, Sparkles, PartyPopper, ExternalLink, BedDouble, Plane, TrainFront, ChevronRight } from 'lucide-react'
import { paths } from '../lib/paths.js'
import { typeLabel, mapsUrl } from '../lib/format.js'
import TripStory from './TripStory.jsx'
import TripReview from './TripReview.jsx'
import { movePlaceTo, addPlace, setPlaceDate, stayForDay } from '../lib/trips.js'
import MapView from './MapView.jsx'
import { bestRoute, kmBetween as legKm } from '../lib/route.js'
import { dayWeather } from '../lib/weather.js'
import { nearestStation } from '../lib/transport.js'
import { getPlacesIndex } from '../lib/data.js'
import { useAffiliates, regionOffers } from '../lib/affiliates.js'

const keyOf = (p) => `${p.regionId}/${p.placeId}`
const parseKey = (k) => { const i = k.indexOf('/'); return { regionId: k.slice(0, i), placeId: k.slice(i + 1) } }
const sameOver = (a, b) =>
  (!a && !b) || (a && b && a.date === b.date &&
    ((!a.beforeKey && !b.beforeKey) ||
      (a.beforeKey && b.beforeKey && a.beforeKey.regionId === b.beforeKey.regionId && a.beforeKey.placeId === b.beforeKey.placeId)))

export default function Itinerary({ trip, onPlan }) {
  const [drag, setDrag] = useState(null)       // { regionId, placeId, name }
  const [over, setOver] = useState(null)       // { date, beforeKey }
  const [dayFilter, setDayFilter] = useState(null)

  const dragRef = useRef(null)
  const overRef = useRef(null)
  const ghostRef = useRef(null)
  const posRef = useRef({ x: 0, y: 0 })
  const edgeRef = useRef(0)
  const rafRef = useRef(0)

  const days = useMemo(() => {
    const byDate = new Map()
    for (const p of trip.places) {
      if (p.date) { if (!byDate.has(p.date)) byDate.set(p.date, []); byDate.get(p.date).push(p) }
    }
    let dateList = []
    if (trip.startDate) {
      const s = new Date(trip.startDate)
      const e = trip.endDate ? new Date(trip.endDate) : s
      if (!isNaN(s) && !isNaN(e) && e >= s) {
        const d = new Date(s)
        while (d <= e && dateList.length < 60) { dateList.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
      }
    }
    if (dateList.length === 0) dateList = [...byDate.keys()].sort()
    return dateList.map((date, i) => ({ n: i + 1, date, places: byDate.get(date) || [] }))
  }, [trip])

  const unscheduled = useMemo(() => trip.places.filter((p) => !p.date), [trip])

  // Effective day of a pick: its own date, or (legacy items) its place's date.
  const itemDay = (x, p) => (x.date === undefined ? (p.date || '') : (x.date || ''))

  // Markers for one day ('' = unscheduled): places scheduled that day, plus any
  // picks (from any place) that belong to that day.
  const markersForDay = (date) => {
    const out = []
    const arr = trip.travel?.arrive, dep = trip.travel?.depart
    if (date && date === trip.startDate && arr?.lat && arr?.lng)
      out.push({ lng: arr.lng, lat: arr.lat, label: `Arrive: ${arr.name}`, color: '#1565c0', arrive: true })
    const stay = stayForDay(trip, date)
    if (stay?.lat && stay?.lng) out.push({ lng: stay.lng, lat: stay.lat, label: `Stay: ${stay.name}`, color: '#3a3733', stay: true })
    if (date && date === trip.endDate && dep?.lat && dep?.lng)
      out.push({ lng: dep.lng, lat: dep.lat, label: `Depart: ${dep.name}`, color: '#1565c0', depart: true })
    for (const p of trip.places) {
      if ((p.date || '') === date && p.lat && p.lng)
        out.push({ lng: p.lng, lat: p.lat, label: p.name, color: '#a9762a' })
      for (const a of (p.attractions || [])) if (itemDay(a, p) === date && a.lat && a.lng)
        out.push({ lng: a.lng, lat: a.lat, label: a.text, color: '#1f6f54' })
      for (const r of (p.restaurants || [])) if (itemDay(r, p) === date && r.lat && r.lng)
        out.push({ lng: r.lng, lat: r.lat, label: r.name, color: '#bb3a2c' })
    }
    return out
  }

  // Picks that belong to this day but whose place is scheduled on another day
  // (or unscheduled) — shown in the day section so a moved pick is never invisible.
  const visitingPicks = (date) => {
    const out = []
    for (const p of trip.places) {
      if ((p.date || '') === date) continue
      for (const a of (p.attractions || [])) if (itemDay(a, p) === date) out.push({ kind: 'do', text: a.text, from: p.name })
      for (const r of (p.restaurants || [])) if (itemDay(r, p) === date) out.push({ kind: 'eat', text: r.name, from: p.name })
    }
    return out
  }

  const [routedDays, setRoutedDays] = useState(() => new Set())
  const toggleRoute = (date) => setRoutedDays((prev) => {
    const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n
  })

  const hasMapbox = !!import.meta.env.VITE_MAPBOX_TOKEN

  const todayIso = new Date().toISOString().slice(0, 10)
  const isLive = trip.startDate && trip.endDate && todayIso >= trip.startDate && todayIso <= trip.endDate
  const isOver = trip.endDate && todayIso > trip.endDate
  const todayRef = useRef(null)
  useEffect(() => {
    if (isLive && todayRef.current) {
      const t = setTimeout(() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
      return () => clearTimeout(t)
    }
  }, [isLive])

  // places index for empty-day suggestions
  const [pindex, setPindex] = useState(null)
  useEffect(() => { getPlacesIndex().then(setPindex).catch(() => setPindex([])) }, [])
  const inTrip = new Set(trip.places.map((p) => keyOf(p)))
  const suggestionsFor = (date) => {
    if (!pindex?.length) return []
    // anchor: previous day's last place, else any place in the trip
    const di = days.findIndex((x) => x.date === date)
    const anchor = [...(days[di - 1]?.places || []), ...trip.places].find((p) => p.lat && p.lng)
    if (!anchor) return []
    return pindex
      .filter((p) => p.regionId === anchor.regionId && !inTrip.has(`${p.regionId}/${p.placeId}`) && p.lat && p.lng)
      .map((p) => ({ ...p, d: legKm(anchor, p) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
  }
  const addSuggestion = (sug, date) => {
    addPlace(trip.id, { regionId: sug.regionId, regionName: sug.regionName, placeId: sug.placeId,
      name: sug.name, type: sug.type, lat: sug.lat, lng: sug.lng })
    setPlaceDate(trip.id, sug.regionId, sug.placeId, date)
  }

  // recap numbers (uses the same per-day optimised routes)
  const recap = useMemo(() => {
    if (!isOver) return null
    let km = 0
    for (const d of days) {
      const ms = markersForDay(d.date)
      if (ms.length < 2) continue
      const start = ms.findIndex((m) => m.color === '#a9762a')
      km += bestRoute(ms, start >= 0 ? start : 0).km
    }
    const regions = new Set(trip.places.map((p) => p.regionName).filter(Boolean))
    return { places: trip.places.length, regions: regions.size, days: days.length, km: Math.round(km) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOver, trip])

  const markers = useMemo(() => {
    if (dayFilter) return markersForDay(dayFilter)
    const out = []
    for (const p of trip.places) {
      if (p.lat && p.lng) out.push({ lng: p.lng, lat: p.lat, label: p.name, color: '#a9762a' })
      for (const a of (p.attractions || [])) if (a.lat && a.lng) out.push({ lng: a.lng, lat: a.lat, label: a.text, color: '#1f6f54' })
      for (const r of (p.restaurants || [])) if (r.lat && r.lng) out.push({ lng: r.lng, lat: r.lat, label: r.name, color: '#bb3a2c' })
    }
    return out
  }, [trip, dayFilter])

  const glance = days.filter((d) => d.places.length > 0)
  const totalDays = days.length

  // -------- pointer-based drag (works on mouse + touch) --------
  const moveGhost = (x, y) => {
    posRef.current = { x, y }
    const g = ghostRef.current
    if (g) g.style.transform = `translate(${x + 14}px, ${y + 18}px)`
  }
  useEffect(() => { if (drag) moveGhost(posRef.current.x, posRef.current.y) }, [drag])

  const computeOver = (x, y) => {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    const card = el.closest('[data-key]')
    if (card) {
      const date = card.getAttribute('data-day')
      const rect = card.getBoundingClientRect()
      const after = y > rect.top + rect.height / 2
      if (after) {
        let sib = card.nextElementSibling
        while (sib && !sib.hasAttribute('data-key')) sib = sib.nextElementSibling
        if (sib) return { date, beforeKey: parseKey(sib.getAttribute('data-key')) }
        return { date, beforeKey: null }
      }
      return { date, beforeKey: parseKey(card.getAttribute('data-key')) }
    }
    const zone = el.closest('[data-day]')
    if (zone) return { date: zone.getAttribute('data-day'), beforeKey: null }
    return null
  }

  const onMove = (e) => {
    if (!dragRef.current) return
    e.preventDefault()
    const x = e.clientX, y = e.clientY
    moveGhost(x, y)
    const h = window.innerHeight
    edgeRef.current = y < 90 ? -1 : y > h - 90 ? 1 : 0
    const next = computeOver(x, y)
    if (!sameOver(next, overRef.current)) { overRef.current = next; setOver(next) }
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    cancelAnimationFrame(rafRef.current)
    edgeRef.current = 0
    document.body.classList.remove('dragging-noselect')
    const d = dragRef.current, o = overRef.current
    if (d && o && o.date !== null && o.date !== undefined) {
      let before = o.beforeKey
      if (before && before.regionId === d.regionId && before.placeId === d.placeId) before = null
      movePlaceTo(trip.id, d.regionId, d.placeId, o.date, before?.regionId || null, before?.placeId || null)
    }
    dragRef.current = null; overRef.current = null
    setDrag(null); setOver(null)
  }

  const autoScroll = () => {
    if (edgeRef.current) window.scrollBy(0, edgeRef.current * 10)
    rafRef.current = requestAnimationFrame(autoScroll)
  }

  const startDrag = (p, e) => {
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { regionId: p.regionId, placeId: p.placeId, name: p.name }
    overRef.current = null
    setDrag(dragRef.current)
    setOver(null)
    moveGhost(e.clientX, e.clientY)
    document.body.classList.add('dragging-noselect')
    rafRef.current = requestAnimationFrame(autoScroll)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    cancelAnimationFrame(rafRef.current)
    document.body.classList.remove('dragging-noselect')
  }, [])

  const cardState = (p, dayDate) => ({
    dayDate,
    dragging: drag && drag.regionId === p.regionId && drag.placeId === p.placeId,
    dropBefore: over && over.date === dayDate && over.beforeKey &&
      over.beforeKey.regionId === p.regionId && over.beforeKey.placeId === p.placeId,
    onGrip: (e) => startDrag(p, e),
  })

  return (
    <div className="itin">
      <TripStory trip={trip} />
      <TripReview trip={trip} />

      {isLive && days.some((d) => d.date === todayIso) && (
        <button className="itin-today" onClick={() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <Navigation size={15} /> You're on this trip — jump to today
        </button>
      )}

      {recap && (
        <div className="itin-recap">
          <PartyPopper size={18} />
          <p>
            <b>Trip complete.</b> {recap.places} place{recap.places === 1 ? '' : 's'} across {recap.regions} region{recap.regions === 1 ? '' : 's'},
            {' '}{recap.days} day{recap.days === 1 ? '' : 's'}{recap.km > 0 && <> and ≈ {recap.km} km on the ground</>}. Nicely done.
          </p>
        </div>
      )}

      {glance.length > 0 && (
        <div className="glance">
          {glance.map((d) => (
            <div key={d.date} className="glance__day">
              <span className="glance__n">Day {d.n}</span>
              <span className="glance__date">{fmtShort(d.date)}</span>
              <span className="glance__where">{whereLabel(d.places)}</span>
            </div>
          ))}
        </div>
      )}

      {markers.length > 0 && (
        <>
          {days.some((d) => d.places.length > 0) && (
            <div className="dayfilter">
              <button className={`dayfilter__chip ${!dayFilter ? 'is-on' : ''}`} onClick={() => setDayFilter(null)}>All days</button>
              {days.filter((d) => d.places.length > 0).map((d) => (
                <button key={d.date} className={`dayfilter__chip ${dayFilter === d.date ? 'is-on' : ''}`} onClick={() => setDayFilter(d.date)}>
                  Day {d.n}
                </button>
              ))}
            </div>
          )}
          <MapView height={300} center={[markers[0].lng, markers[0].lat]} zoom={dayFilter ? 9 : 6} markers={markers} />
        </>
      )}

      <p className="itin-draghint"><GripVertical size={14} /> Drag a place by its handle to move it between days or reorder — works on touch too.</p>

      {days.map((d) =>
        d.places.length === 0 ? (
          <div key={d.date} data-day={d.date} ref={d.date === todayIso ? todayRef : undefined}
            className={`iday iday--open ${d.date === todayIso && isLive ? 'iday--today' : ''} ${over && over.date === d.date ? 'is-over' : ''}`}>
            <header className="iday__head">
              <span className="iday__num">Day {d.n}{d.date === todayIso && isLive ? ' · today' : ''}</span>
              <span className="iday__date">{fmtLong(d.date)}</span>
              {stayForDay(trip, d.date) && <span className="iday__stay"><BedDouble size={12} /> {stayForDay(trip, d.date).name}</span>}
              <DayWeather date={d.date} anchor={markersForDay(d.date)[0] || trip.places.find((p) => p.lat)} />
              <DayKm markers={markersForDay(d.date)} />
            </header>
            <span className="iday__open">
              {drag ? 'Drop here' : visitingPicks(d.date).length ? 'No base here — but plans below' : 'Open — nothing planned yet'}
            </span>
            <VisitingPicks items={visitingPicks(d.date)} />
            <DayMap markers={hasMapbox ? markersForDay(d.date) : []} routed={routedDays.has(d.date)} first={d.n === 1} />
            <DaySuggestions items={suggestionsFor(d.date)} onAdd={(sug) => addSuggestion(sug, d.date)} from={trip.places.find((p) => p.regionId && p.placeId && p.lat) || null} />
          </div>
        ) : (
          <section key={d.date} data-day={d.date} ref={d.date === todayIso ? todayRef : undefined}
            className={`iday ${d.date === todayIso && isLive ? 'iday--today' : ''} ${over && over.date === d.date ? 'is-over' : ''}`}>
            <header className="iday__head">
              <span className="iday__num">Day {d.n}{d.date === todayIso && isLive ? ' · today' : ''}</span>
              <span className="iday__date">{fmtLong(d.date)}</span>
              {stayForDay(trip, d.date) && <span className="iday__stay"><BedDouble size={12} /> {stayForDay(trip, d.date).name}</span>}
              <DayWeather date={d.date} anchor={markersForDay(d.date)[0]} />
              <span className="iday__where">{whereLabel(d.places)}</span>
              <DayKm markers={markersForDay(d.date)} />
              {hasMapbox && markersForDay(d.date).length >= 3 && (
                <button className={`iday__route ${routedDays.has(d.date) ? 'is-on' : ''}`} onClick={() => toggleRoute(d.date)}>
                  <Route size={14} /> Best route
                </button>
              )}
            </header>
            <DayMap markers={hasMapbox ? markersForDay(d.date) : []} routed={routedDays.has(d.date)} first={d.n === 1} />
            <DayTransit anchor={(stayForDay(trip, d.date) || d.places.find((p) => p.lat)) || null} />
            <VisitingPicks items={visitingPicks(d.date)} />
            <div className="iday__places">
              {d.places.map((p, i) => (
                <Fragment key={keyOf(p)}>
                  {i > 0 && <Hop from={d.places[i - 1]} to={p} />}
                  <ItinPlace p={p} onPlan={onPlan} live={isLive && d.date === todayIso} {...cardState(p, d.date)} />
                </Fragment>
              ))}
            </div>
            <DayBooking places={d.places} />
          </section>
        )
      )}

      {unscheduled.length > 0 && (
        <section data-day="" className={`iday iday--unsched ${over && over.date === '' ? 'is-over' : ''}`}>
          <header className="iday__head">
            <span className="iday__num">Not on a day yet</span>
            <span className="iday__where">{unscheduled.length} {unscheduled.length === 1 ? 'place' : 'places'} — drag onto a day, or open one to pick</span>
          </header>
          <div className="iday__places">
            {unscheduled.map((p) => <ItinPlace key={keyOf(p)} p={p} onPlan={onPlan} {...cardState(p, '')} />)}
          </div>
        </section>
      )}

      {drag && unscheduled.length === 0 && (
        <div data-day="" className={`iday iday--dropunsched ${over && over.date === '' ? 'is-over' : ''}`}>
          Drop here to unschedule
        </div>
      )}

      {drag && (
        <div ref={ghostRef} className="drag-ghost">
          <GripVertical size={14} /> {drag.name}
        </div>
      )}
    </div>
  )
}

function ItinPlace({ p, onPlan, dragging, dropBefore, onGrip, live = false }) {
  const nothing = !(p.attractions?.length) && !(p.restaurants?.length)
  return (
    <article data-key={keyOf(p)} data-day={p.date || ''}
      className={`ip ${dragging ? 'is-dragging' : ''} ${dropBefore ? 'drop-before' : ''}`}>
      <div className="ip__head">
        <span className="ip__grip" onPointerDown={onGrip} role="button" aria-label="Drag to reorder"><GripVertical size={16} /></span>
        {p.isCustom
          ? <span className="ip__name">{p.name}</span>
          : <Link to={paths.place(p.regionId, p.placeId)} className="ip__name" draggable={false}>{p.name}</Link>}
        <span className="ip__type">{typeLabel(p.type)} · {p.regionName || 'Your own'}
          {p.done && p.visitedAt && <span className="ip__visited"> · visited {new Date(p.visitedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
        </span>
        {live && p.lat && p.lng && (
          <a className="ip__nav" href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noreferrer" draggable={false}>
            <Navigation size={13} /> Navigate
          </a>
        )}
        <button className="ip__edit" onClick={() => onPlan(p)}><Pencil size={13} /> Edit</button>
      </div>
      {p.attractions?.length > 0 && (
        <div className="ip__group">
          <h4 className="ip__gh"><Compass size={14} /> Things to do</h4>
          <ul className="ip__list">{p.attractions.map((a) => (
            <li key={a.id + (a.date || '')}>{a.text}{itemDayTag(a, p)}</li>
          ))}</ul>
        </div>
      )}
      {p.restaurants?.length > 0 && (
        <div className="ip__group">
          <h4 className="ip__gh"><UtensilsCrossed size={14} /> Where to eat</h4>
          <ul className="ip__list">{p.restaurants.map((r) => (
            <li key={r.id + (r.date || '')}>{r.name}{r.cuisine ? <span className="ip__sub"> · {r.cuisine}</span> : ''}{itemDayTag(r, p)}</li>
          ))}</ul>
        </div>
      )}
      {nothing && (
        <p className="ip__none">No sights or food picked yet — <button onClick={() => onPlan(p)}>add some</button></p>
      )}
      {p.note && <p className="ip__note"><MapPin size={12} /> {p.note}</p>}
    </article>
  )
}

function whereLabel(places) {
  return [...new Set(places.map((p) => p.name))].join(' · ')
}
function fmtShort(d) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtLong(d) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
function rangeLabel(start, end) {
  if (!start) return 'Dates not set'
  const f = (x) => new Date(x).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  if (end && end !== start) return `${f(start)} – ${f(end)} ${new Date(end).getFullYear()}`
  return `${f(start)} ${new Date(start).getFullYear()}`
}

// The day's route total, shown in the day header.
function DayKm({ markers }) {
  if (markers.length < 2) return null
  const { seq, km, loop } = dayRoute(markers)
  const total = km + (loop && seq.length > 1 ? legKm(seq[seq.length - 1], seq[0]) : 0)
  return <span className="iday__km">≈ {fmtKm(total)} km</span>
}

// Nearest train station to the day's base — one cached lookup per area.
function DayTransit({ anchor }) {
  const [st, setSt] = useState(null)
  useEffect(() => {
    let on = true
    if (anchor?.lat && anchor?.lng) nearestStation(anchor.lat, anchor.lng).then((r) => { if (on) setSt(r) })
    else setSt(null)
    return () => { on = false }
  }, [anchor?.lat, anchor?.lng])
  if (!st) return null
  return (
    <p className="iday__transit">
      <TrainFront size={13} /> Nearest station: <b>{st.name}</b> · {st.km < 10 ? st.km.toFixed(1) : Math.round(st.km)} km
      <a href={mapsUrl(st.lat, st.lng)} target="_blank" rel="noreferrer">map</a>
    </p>
  )
}

// Forecast chip for a day header (renders nothing outside the forecast window).
function DayWeather({ date, anchor }) {
  const [w, setW] = useState(null)
  useEffect(() => {
    let on = true
    if (anchor?.lat && anchor?.lng) dayWeather(anchor.lat, anchor.lng, date).then((r) => { if (on) setW(r) })
    return () => { on = false }
  }, [date, anchor?.lat, anchor?.lng])
  if (!w) return null
  return (
    <span className="iday__wx" title={w.label}>
      <span aria-hidden>{w.icon}</span> {w.max}°{w.min != null && <span className="iday__wxmin">/{w.min}°</span>}
    </span>
  )
}

// One-tap nearby ideas for an empty day, plus a door into the day-trip finder.
function DaySuggestions({ items, onAdd, from }) {
  if (!items.length && !from) return null
  return (
    <div className="iday__sugs">
      <span className="iday__sugslabel"><Sparkles size={13} /> Nearby ideas:</span>
      {items.map((sug) => (
        <button key={`${sug.regionId}/${sug.placeId}`} className="iday__sug" onClick={() => onAdd(sug)}>
          + {sug.name} <em>{sug.d < 10 ? sug.d.toFixed(1) : Math.round(sug.d)} km</em>
        </button>
      ))}
      {from && (
        <Link className="iday__sug iday__sug--more" to={`/day-trips?from=${from.regionId}/${from.placeId}`}>
          More day trips →
        </Link>
      )}
    </div>
  )
}

// Quiet, clearly-marked booking links for the day's area.
function DayBooking({ places }) {
  const cfg = useAffiliates()
  const base = places.find((p) => p.regionName && !p.isCustom)
  if (!cfg || !base) return null
  const offers = regionOffers(cfg, { regionId: base.regionId, regionName: base.regionName, capital: base.name })
  const stay = offers?.find((o) => o.id === 'booking')
  const tours = offers?.find((o) => ['getyourguide', 'viator', 'civitatis'].includes(o.id))
  if (!stay && !tours) return null
  return (
    <p className="iday__book">
      {stay && <a href={stay.url} target="_blank" rel="noreferrer sponsored">Book a stay in {base.name} <ExternalLink size={11} /></a>}
      {stay && tours && ' · '}
      {tours && <a href={tours.url} target="_blank" rel="noreferrer sponsored">Tours in {base.name} <ExternalLink size={11} /></a>}
      <span className="iday__bookad">ad</span>
    </p>
  )
}

// Picks visiting this day from places scheduled elsewhere.
function VisitingPicks({ items }) {
  if (!items.length) return null
  return (
    <ul className="iday__visiting">
      {items.map((it, i) => (
        <li key={i}>
          <span className={`iday__vk iday__vk--${it.kind}`}>{it.kind === 'eat' ? 'Eat' : 'Do'}</span>
          {it.text} <em>· from {it.from}</em>
        </li>
      ))}
    </ul>
  )
}

// Straight-line distance between two points, km.
function kmBetween(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function Hop({ from, to }) {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null
  const km = kmBetween(from, to)
  if (km < 0.3) return null
  const mins = Math.round((km / 55) * 60)   // rough drive at 55 km/h
  return (
    <div className="ip-hop" aria-hidden>
      <span className="ip-hop__line" />
      <span className="ip-hop__label">≈ {km < 10 ? km.toFixed(1) : Math.round(km)} km{km > 2 ? ` · ~${mins} min drive` : ''}</span>
      <span className="ip-hop__line" />
    </div>
  )
}

// Shared per-day route: departure pinned last, start at arrival/stay/place,
// everything else optimised; `loop` marks a plain stay day that returns home.
function dayRoute(markers) {
  const depart = markers.find((m) => m.depart)
  const routable = depart ? markers.filter((m) => !m.depart) : markers
  const arriveIdx = routable.findIndex((m) => m.arrive)
  const stayIdx = routable.findIndex((m) => m.stay)
  const placeIdx = routable.findIndex((m) => m.color === '#a9762a')
  const start = arriveIdx >= 0 ? arriveIdx : stayIdx >= 0 ? stayIdx : placeIdx
  let { order, km } = bestRoute(routable, start >= 0 ? start : 0)
  let seq = order.map((i) => routable[i])
  if (depart) { km += seq.length ? legKm(seq[seq.length - 1], depart) : 0; seq = [...seq, depart] }
  const loop = stayIdx >= 0 && arriveIdx < 0 && !depart && seq.length > 1
  return { seq, km, loop }
}

// Compact map of one day's places + picks. Renders nothing without markers.
// With `routed`, stops are ordered by proximity (starting from the day's place),
// pins numbered in visiting order, the path drawn, and the legs listed.
function DayMap({ markers, routed = false, first = false }) {
  if (!markers.length) return null
  const { seq, km, loop } = dayRoute(markers)

  if (!routed || markers.length < 3) {
    return (
      <>
        <div className="iday__map">
          <MapView height={210} center={[markers[0].lng, markers[0].lat]} zoom={10} markers={markers} />
        </div>
        <RouteSummary seq={seq} km={km} loop={loop} defaultOpen={first} />
      </>
    )
  }

  const numbered = seq.map((m, i) => ({ ...m, number: i + 1, label: `${i + 1}. ${m.label}` }))
  const line = seq.map((m) => [m.lng, m.lat])
  if (loop) line.push([seq[0].lng, seq[0].lat])
  return (
    <>
      <div className="iday__map">
        <MapView height={230} center={[seq[0].lng, seq[0].lat]} zoom={10} markers={numbered} route={line} />
      </div>
      <RouteSummary seq={seq} km={km} loop={loop} defaultOpen={first} />
    </>
  )
}

const fmtKm = (n) => (n < 10 ? n.toFixed(1) : String(Math.round(n)))

// The vertical stop-by-stop timeline (shared by day summaries and the trip digest).
function RouteTimeline({ seq, loop = false, back = 0 }) {
  return (
    <ol className="rs__timeline">
      {seq.map((m, i) => (
        <Fragment key={i}>
          <li className="rs__stop">
            <i className="rs__dot" style={{ background: m.color }} />
            <span className="rs__name">{m.label}</span>
          </li>
          {i < seq.length - 1 && <li className="rs__leg">{fmtKm(legKm(m, seq[i + 1]))} km</li>}
        </Fragment>
      ))}
      {loop && (
        <>
          <li className="rs__leg">{fmtKm(back)} km</li>
          <li className="rs__stop"><i className="rs__dot" style={{ background: '#3a3733' }} /><span className="rs__name">Back to your stay</span></li>
        </>
      )}
    </ol>
  )
}

// Collapsible "Recommended route" under each day map — same style as the trip digest.
function RouteSummary({ seq, km, loop = false, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  if (seq.length < 2) return null
  const back = loop ? legKm(seq[seq.length - 1], seq[0]) : 0
  return (
    <div className="rs__day rs__day--inline">
      <button className="rs__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ChevronRight size={15} className={`rs__chev ${open ? 'is-open' : ''}`} />
        <span className="rs__title">Recommended route</span>
        <span className="rs__stops">{seq.length + (loop ? 1 : 0)} stops</span>
        <span className="rs__km">≈ {fmtKm(km + back)} km</span>
      </button>
      {open && <RouteTimeline seq={seq} loop={loop} back={back} />}
    </div>
  )
}

// Small tag when a pick belongs to a different day than the place's own day.
function itemDayTag(item, place) {
  const itemDay = item.date === undefined ? (place.date || '') : (item.date || '')
  if (itemDay === (place.date || '')) return null
  const label = itemDay
    ? new Date(itemDay + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
    : 'Anytime'
  return <span className="ip__daytag">{label}</span>
}
