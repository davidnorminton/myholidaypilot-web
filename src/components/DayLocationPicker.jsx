import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Check, Compass, BedDouble, MapPin, CalendarCheck, Plus, Trash2, Ticket, ChevronRight, UtensilsCrossed, GripVertical } from 'lucide-react'
import { getPlacesIndex, getRegion, getViatorPlaceTours, getViatorTours } from '../lib/data.js'
import { useTrips, addPlace, setPlaceDate, togglePlaceItem, setPlaceAllDays, addStay, updateStay, removeStay, reorderPlaceItems } from '../lib/trips.js'
import { detectCurrency, displayPrice } from '../lib/currency.js'
import { useAffiliates } from '../lib/affiliates.js'
import { bookingUrl } from '../lib/bookingLinks.js'
import AffLink from './AffLink.jsx'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const STAY_TYPES = ['hotel', 'B&B', 'apartment', 'agriturismo', 'villa', 'hostel', 'camping', 'friends & family']

// Mapbox forward geocoding — quiet null on failure or without a token.
async function geocode(query) {
  if (!TOKEN || !query.trim()) return []
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&limit=4&types=poi,address,place&language=en`
    const res = await fetch(url)
    if (!res.ok) return []
    const j = await res.json()
    return (j.features || []).map((f) => ({ label: f.place_name, lat: f.center[1], lng: f.center[0] }))
  } catch { return [] }
}

// Accommodation for one day: shows the stay covering this day, or a search to
// add one. "Use for the rest of the trip" extends it to the last night.
function DayStay({ trip, tripId, day, lastDay, placeName, regionName }) {
  const affCfg = useAffiliates()
  const stay = (trip.stays || []).find((s) => s.from && s.from <= day && (s.to || s.from) >= day)
  const [name, setName] = useState('')
  const [type, setType] = useState('hotel')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState(null)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const timer = useRef(null)

  const search = (q) => {
    clearTimeout(timer.current)
    if (!q.trim() || !TOKEN) { setResults([]); return }
    timer.current = setTimeout(async () => { setSearching(true); setResults(await geocode(q)); setSearching(false) }, 450)
  }
  const save = () => {
    if (!name.trim()) return
    addStay(tripId, { name: name.trim(), type, from: day, to: day, address: address.trim() || coords?.label, lat: coords?.lat, lng: coords?.lng })
    setName(''); setCoords(null); setResults([]); setAddress('')
  }

  const bookingLink = affCfg && placeName
    ? bookingUrl(affCfg, { location: `${placeName} ${regionName || ''}`.trim(), checkin: day, checkout: lastDay && lastDay > day ? lastDay : '' })
    : null
  const coversRest = stay && (!lastDay || (stay.to || stay.from) >= lastDay)

  return (
    <div className="daystay">
      {stay ? (
        <>
          <div className="daystay__current">
            <BedDouble size={16} />
            <div className="daystay__cbody">
              <span className="daystay__name">{stay.name}</span>
              <span className="daystay__addrline">{stay.type}{stay.address ? ` · ${stay.address}` : ''}</span>
            </div>
            <button className="daystay__del" onClick={() => removeStay(tripId, stay.id)} aria-label="Remove stay"><Trash2 size={14} /></button>
          </div>
          {!coversRest && (
            <button className="setloc__alldays" onClick={() => updateStay(tripId, stay.id, { ...stay, to: lastDay })}>
              <CalendarCheck size={15} /> Use {stay.name} for the rest of the trip
            </button>
          )}
        </>
      ) : (
        <>
          <div className="daystay__row">
            <div className="setloc__search daystay__search">
              <Search size={16} />
              <input value={name} placeholder="Search a hotel, B&amp;B or apartment"
                onChange={(e) => { setName(e.target.value); setCoords(null); search(e.target.value) }} />
            </div>
            <select className="planform__select daystay__typesel" value={type} onChange={(e) => setType(e.target.value)}>
              {STAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {searching && <p className="setloc__hint">Searching…</p>}
          {!coords && results.length > 0 && (
            <ul className="setloc__results">
              {results.map((r, i) => (
                <li key={i}><button onClick={() => { setName(r.label.split(',')[0]); setCoords(r); setResults([]) }}><MapPin size={13} /> {r.label}</button></li>
              ))}
            </ul>
          )}
          {coords && <p className="setloc__hint"><Check size={13} /> {coords.label || 'Pinned on the map'}</p>}
          <label className="daystay__addr">
            <span>Address (optional)</span>
            <input className="planform__input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city…" />
          </label>
          {!TOKEN && <p className="setloc__hint">Add a Mapbox token to pin stays on the map.</p>}
          <button className="setloc__alldays" onClick={save} disabled={!name.trim()}><Plus size={15} /> Save stay</button>
        </>
      )}
      {bookingLink && <AffLink href={bookingLink}>Find hotels in {placeName} on Booking.com</AffLink>}
    </div>
  )
}

// Inline (non-modal) day picker: search a region/place, then plan the day —
// things to do, Viator experiences, and accommodation.
export default function DayLocationPicker({ tripId, countryId, day, dayNumber, dayLabel, saved, setSaved, nextDay, onNext, onReview }) {
  const snap = useTrips()
  const trip = snap.trips.find((t) => t.id === tripId)
  const base = trip?.places.find((p) => p.allDays) || null
  const ccy = useMemo(() => detectCurrency(), [])
  const [places, setPlaces] = useState(null)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(base ? { regionId: base.regionId, placeId: base.placeId, name: base.name, regionName: base.regionName, countryId: base.countryId || countryId } : null)
  const [region, setRegion] = useState(null)
  const [viator, setViator] = useState(null)
  const [tab, setTab] = useState('do')
  const [dragId, setDragId] = useState(null)   // id being dragged in the saved list

  useEffect(() => { getPlacesIndex(countryId).then(setPlaces).catch(() => setPlaces([])) }, [countryId])
  useEffect(() => {
    if (!selected) { setRegion(null); setViator(null); return }
    // The place knows which country its guide lives in — the trip's destination
    // may have changed since it was added.
    const cc = selected.countryId || countryId
    let on = true
    setViator(null)
    getRegion(selected.regionId, cc).then((r) => on && setRegion(r)).catch(() => on && setRegion(false))
    getViatorPlaceTours(selected.placeId, cc)
      .then((d) => (d.tours.length ? d : getViatorTours(selected.regionId, cc)))
      .then((d) => on && setViator(d.tours))
      .catch(() => on && setViator([]))
    return () => { on = false }
  }, [selected, countryId])

  const results = useMemo(() => {
    if (!places) return []
    const s = q.trim().toLowerCase()
    if (!s) return []
    return places
      .filter((p) => (p.name || '').toLowerCase().includes(s) || (p.regionName || '').toLowerCase().includes(s))
      .slice(0, 8)
  }, [places, q])

  const pick = (p) => {
    addPlace(tripId, { regionId: p.regionId, placeId: p.placeId, name: p.name, regionName: p.regionName, type: p.type, lat: p.lat, lng: p.lng, countryId })
    setPlaceDate(tripId, p.regionId, p.placeId, day)
    setSelected({ regionId: p.regionId, placeId: p.placeId, name: p.name, regionName: p.regionName, countryId })
    setQ('')
  }

  const place = trip?.places.find((pp) => selected && pp.regionId === selected.regionId && pp.placeId === selected.placeId)
  const src = region && region.places ? region.places.find((pp) => pp.id === selected?.placeId) : null
  const activities = src?.activities || []
  const selA = new Set((place?.attractions || []).filter((x) => (x.date || '') === day).map((x) => x.id))
  const dayAttractions = (place?.attractions || []).filter((x) => (x.date || '') === day)
  const selR = new Set((place?.restaurants || []).filter((x) => (x.date || '') === day).map((x) => x.id))
  const dayRestaurants = (place?.restaurants || []).filter((x) => (x.date || '') === day)
  const restaurants = (region && region.restaurants) || []
  const dayStay = (trip?.stays || []).find((s) => s.from && s.from <= day && (s.to || s.from) >= day)

  const addViator = (t) => togglePlaceItem(tripId, selected.regionId, selected.placeId, 'attractions',
    { id: `viator-${t.code}`, text: t.title, image: t.image, url: t.url,
      ...(Number.isFinite(t.lat) && Number.isFinite(t.lng) ? { lat: t.lat, lng: t.lng } : {}) }, day)

  return (
    <div className="setloc">
      <h3 className="setloc__title">Day {dayNumber}{dayLabel ? ` · ${dayLabel}` : ''}</h3>

      {!selected && (
        <>
          <div className="setloc__search">
            <Search size={16} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a region or place" />
          </div>
          {results.length > 0 && (
            <ul className="setloc__results">
              {results.map((p) => (
                <li key={`${p.regionId}/${p.placeId}`}>
                  <button onClick={() => pick(p)}><b>{p.name}</b> <small>{p.regionName}</small></button>
                </li>
              ))}
            </ul>
          )}
          {q.trim() && results.length === 0 && places && <p className="setloc__hint">No match — try another name.</p>}
        </>
      )}

      {selected && (
        <div className="setloc__picked">
          <div className="setloc__pickedhead">
            <h4>{selected.name}</h4>
            <span className="setloc__pickedsub">{selected.regionName}</span>
            <button className="setloc__change" onClick={() => { setSelected(null); setQ(''); setSaved(false) }}>Change</button>
          </div>

          <button className={`setloc__alldays ${place?.allDays ? 'is-on' : ''}`}
            onClick={() => setPlaceAllDays(tripId, selected.regionId, selected.placeId, !place?.allDays)}>
            <CalendarCheck size={15} /> {place?.allDays ? `${selected.name} is set for all days` : `Set ${selected.name} for rest of days`}
          </button>

          <button className="setloc__save" disabled={!saved && dayAttractions.length === 0} onClick={() => setSaved(!saved)}>
            {saved ? <><Compass size={15} /> Show activities</> : <><Check size={15} /> Save activities</>}
          </button>

          {saved ? (
            <div className="setloc__saved">
              <p className="setloc__savedlabel">Planned for this day{dayAttractions.length > 1 ? ' — drag to set the order' : ''}</p>
              {dayAttractions.length === 0 && dayRestaurants.length === 0 && !dayStay && <p className="pp-note">Nothing selected yet.</p>}
              <ul className="setloc__savedlist">
                {dayAttractions.map((a, i) => (
                  <li key={a.id} draggable={dayAttractions.length > 1}
                    className={a.id === dragId ? 'is-dragging' : ''}
                    onDragStart={(e) => { setDragId(a.id); try { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move' } catch { /* ignore */ } }}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const fromId = dragId || e.dataTransfer.getData('text/plain')
                      setDragId(null)
                      if (!fromId || fromId === a.id) return
                      const ids = dayAttractions.map((x) => x.id).filter((id) => id !== fromId)
                      ids.splice(i, 0, fromId)
                      reorderPlaceItems(tripId, selected.regionId, selected.placeId, 'attractions', day, ids)
                    }}>
                    {dayAttractions.length > 1 && <GripVertical size={14} className="setloc__grip" aria-hidden />}
                    {a.image && <img src={a.image} alt="" className="setloc__savedimg" draggable={false} />}
                    <span>{a.text}</span>
                  </li>
                ))}
              </ul>
              {dayRestaurants.length > 0 && (
                <ul className="setloc__savedlist setloc__savedlist--eat">
                  {dayRestaurants.map((r) => (
                    <li key={r.id}><UtensilsCrossed size={14} className="setloc__grip" aria-hidden /> <span>{r.name}{r.cuisine ? ` · ${r.cuisine}` : ''}</span></li>
                  ))}
                </ul>
              )}
              {dayStay && (
                <div className="setloc__savedstay">
                  <BedDouble size={15} />
                  <div className="setloc__savedstaybody">
                    <span className="setloc__savedstayname">{dayStay.name}</span>
                    <span className="setloc__savedstaymeta">{dayStay.type}{dayStay.address ? ` · ${dayStay.address}` : ''}</span>
                  </div>
                </div>
              )}
              {onNext && nextDay && (
                <button className="setloc__next" onClick={onNext}>
                  Next: Day {nextDay.n} · {nextDay.label} <ChevronRight size={15} />
                </button>
              )}
              {!nextDay && onReview && (
                <button className="setloc__next" onClick={onReview}>
                  Review &amp; book your trip <ChevronRight size={15} />
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="pp-tabs" role="tablist">
                <button role="tab" aria-selected={tab === 'do'} className={`pp-tab ${tab === 'do' ? 'is-on' : ''}`} onClick={() => setTab('do')}>
                  <Compass size={15} /> Things to do {selA.size > 0 && <span className="pp-tab__n">{selA.size}</span>}
                </button>
                <button role="tab" aria-selected={tab === 'viator'} className={`pp-tab ${tab === 'viator' ? 'is-on' : ''}`} onClick={() => setTab('viator')}>
                  <Ticket size={15} /> Experiences
                </button>
                <button role="tab" aria-selected={tab === 'eat'} className={`pp-tab ${tab === 'eat' ? 'is-on' : ''}`} onClick={() => setTab('eat')}>
                  <UtensilsCrossed size={15} /> Eat {selR.size > 0 && <span className="pp-tab__n">{selR.size}</span>}
                </button>
                <button role="tab" aria-selected={tab === 'stay'} className={`pp-tab ${tab === 'stay' ? 'is-on' : ''}`} onClick={() => setTab('stay')}>
                  <BedDouble size={15} /> Accommodation
                </button>
              </div>

              {tab === 'do' && (
                <ul className="pp-list">
                  {activities.map((a) => (
                    <li key={a.id} className={`pp-item ${selA.has(a.id) ? 'pp-item--on' : ''}`}
                      onClick={() => togglePlaceItem(tripId, selected.regionId, selected.placeId, 'attractions', { id: a.id, text: a.text, lat: a.lat, lng: a.lng }, day)}>
                      <span className="pp-check">{selA.has(a.id) && <Check size={13} />}</span>
                      <span className="pp-item__text">
                        <span className="pp-item__title">{a.text}</span>
                        {a.detail && <span className="pp-item__sub">{a.detail}</span>}
                      </span>
                    </li>
                  ))}
                  {activities.length === 0 && region && <li className="pp-note">No listed things to do for this place yet.</li>}
                  {region === false && <li className="pp-note">Couldn't load the guide for this place.</li>}
                </ul>
              )}

              {tab === 'viator' && (
                <div className="setloc__viator" data-nosnippet>
                  {viator === null && <p className="setloc__hint">Loading experiences…</p>}
                  {viator && viator.length === 0 && <p className="pp-note">No Viator experiences for this place yet.</p>}
                  <ul className="setloc__vlist">
                    {(viator || []).map((t) => {
                      const added = selA.has(`viator-${t.code}`)
                      return (
                        <li key={t.code} className="setloc__vitem">
                          {t.image
                            ? <img src={t.image} alt="" className="setloc__vimg" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                            : <span className="setloc__vimg setloc__vimg--blank" />}
                          <div className="setloc__vbody">
                            <span className="setloc__vtitle">{t.title}</span>
                            {t.price != null && <span className="setloc__vprice">from {displayPrice(t.price, t.currency || 'EUR', ccy)}</span>}
                          </div>
                          <button className={`setloc__vadd ${added ? 'is-on' : ''}`} onClick={() => addViator(t)}>
                            {added ? <><Check size={13} /> Added</> : 'Add to trip'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {viator && viator.length > 0 && (
                    <p className="setloc__vnote">Experiences by Viator — booking through the trip may earn us a commission.</p>
                  )}
                </div>
              )}

              {tab === 'eat' && (
                <ul className="pp-list">
                  {restaurants.slice(0, 14).map((r) => (
                    <li key={r.id} className={`pp-item ${selR.has(r.id) ? 'pp-item--on' : ''}`}
                      onClick={() => togglePlaceItem(tripId, selected.regionId, selected.placeId, 'restaurants', { id: r.id, name: r.name, cuisine: r.cuisine, priceRange: r.priceRange, mustOrder: r.mustOrder, lat: r.lat, lng: r.lng }, day)}>
                      <span className="pp-check">{selR.has(r.id) && <Check size={13} />}</span>
                      <span className="pp-item__text">
                        <span className="pp-item__title">{r.name} {r.priceRange && <em className="pp-price">{r.priceRange}</em>}</span>
                        <span className="pp-item__sub">{r.cuisine}{r.neighbourhood ? ` · ${r.neighbourhood}` : ''}</span>
                      </span>
                    </li>
                  ))}
                  {restaurants.length === 0 && region && <li className="pp-note">No places to eat in the guide for this region yet.</li>}
                  {region === false && <li className="pp-note">Couldn't load the guide for this place.</li>}
                </ul>
              )}

              {tab === 'stay' && trip && (
                <DayStay trip={trip} tripId={tripId} day={day} lastDay={trip.endDate || day} placeName={selected.name} regionName={selected.regionName} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
