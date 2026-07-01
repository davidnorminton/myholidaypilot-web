import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Compass, UtensilsCrossed, Pencil, CalendarRange, GripVertical } from 'lucide-react'
import { paths } from '../lib/paths.js'
import { typeLabel } from '../lib/format.js'
import { movePlaceTo } from '../lib/trips.js'
import MapView from './MapView.jsx'

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

  const markers = useMemo(() => {
    const out = []
    const src = dayFilter ? trip.places.filter((p) => p.date === dayFilter) : trip.places
    for (const p of src) {
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
        const sib = card.nextElementSibling
        if (sib && sib.hasAttribute('data-key')) return { date, beforeKey: parseKey(sib.getAttribute('data-key')) }
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
      <div className="itin__top">
        <h2 className="itin__name">{trip.name}</h2>
        <p className="itin__meta">
          <CalendarRange size={15} /> {rangeLabel(trip.startDate, trip.endDate)}
          {totalDays > 0 && ` · ${totalDays} ${totalDays === 1 ? 'day' : 'days'}`}
          {` · ${trip.places.length} ${trip.places.length === 1 ? 'place' : 'places'}`}
        </p>
      </div>

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
          <div key={d.date} data-day={d.date}
            className={`iday iday--open ${over && over.date === d.date ? 'is-over' : ''}`}>
            <span className="iday__num">Day {d.n}</span>
            <span className="iday__date">{fmtLong(d.date)}</span>
            <span className="iday__open">{drag ? 'Drop here' : 'Open — nothing planned yet'}</span>
          </div>
        ) : (
          <section key={d.date} data-day={d.date}
            className={`iday ${over && over.date === d.date ? 'is-over' : ''}`}>
            <header className="iday__head">
              <span className="iday__num">Day {d.n}</span>
              <span className="iday__date">{fmtLong(d.date)}</span>
              <span className="iday__where">{whereLabel(d.places)}</span>
            </header>
            <div className="iday__places">
              {d.places.map((p) => <ItinPlace key={keyOf(p)} p={p} onPlan={onPlan} {...cardState(p, d.date)} />)}
            </div>
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

function ItinPlace({ p, onPlan, dragging, dropBefore, onGrip }) {
  const nothing = !(p.attractions?.length) && !(p.restaurants?.length)
  return (
    <article data-key={keyOf(p)} data-day={p.date || ''}
      className={`ip ${dragging ? 'is-dragging' : ''} ${dropBefore ? 'drop-before' : ''}`}>
      <div className="ip__head">
        <span className="ip__grip" onPointerDown={onGrip} role="button" aria-label="Drag to reorder"><GripVertical size={16} /></span>
        {p.isCustom
          ? <span className="ip__name">{p.name}</span>
          : <Link to={paths.place(p.regionId, p.placeId)} className="ip__name" draggable={false}>{p.name}</Link>}
        <span className="ip__type">{typeLabel(p.type)} · {p.regionName || 'Your own'}</span>
        <button className="ip__edit" onClick={() => onPlan(p)}><Pencil size={13} /> Edit</button>
      </div>
      {p.attractions?.length > 0 && (
        <div className="ip__group">
          <h4 className="ip__gh"><Compass size={14} /> Things to do</h4>
          <ul className="ip__list">{p.attractions.map((a) => <li key={a.id}>{a.text}</li>)}</ul>
        </div>
      )}
      {p.restaurants?.length > 0 && (
        <div className="ip__group">
          <h4 className="ip__gh"><UtensilsCrossed size={14} /> Where to eat</h4>
          <ul className="ip__list">{p.restaurants.map((r) => (
            <li key={r.id}>{r.name}{r.cuisine ? <span className="ip__sub"> · {r.cuisine}</span> : ''}</li>
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
