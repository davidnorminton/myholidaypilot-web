import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, MapPin, Compass, UtensilsCrossed, CalendarRange } from 'lucide-react'
import { getRegion } from '../lib/data.js'
import { useTrips, setPlaceDate, togglePlaceItem } from '../lib/trips.js'

export default function PlacePlanner({ tripId, regionId, placeId, range, onClose }) {
  const snap = useTrips()
  const trip = snap.trips.find((t) => t.id === tripId)
  const place = trip?.places.find((p) => p.regionId === regionId && p.placeId === placeId)
  const [region, setRegion] = useState(null)

  useEffect(() => { getRegion(regionId).then(setRegion).catch(() => setRegion(false)) }, [regionId])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const src = region && region.places ? region.places.find((p) => p.id === placeId) : null
  const activities = src?.activities || []
  const lat = src?.lat ?? place?.lat
  const lng = src?.lng ?? place?.lng

  const restaurants = useMemo(() => {
    if (!region || !region.restaurants) return []
    const arr = [...region.restaurants]
    if (lat && lng) {
      const d = (r) => (r.lat - lat) ** 2 + (r.lng - lng) ** 2
      arr.sort((a, b) => d(a) - d(b))
    }
    return arr
  }, [region, lat, lng])

  const days = useMemo(() => daysInRange(range?.start, range?.end), [range])
  const [tab, setTab] = useState('do')

  // The day being VIEWED/EDITED (chips switch this); the place's own visit day
  // (place.date) is separate, so browsing days never moves picks or the place.
  const [viewDay, setViewDay] = useState(null)
  const day = viewDay ?? (place?.date || '')
  const dayOf = (x) => (x.date === undefined ? (place?.date || '') : (x.date || ''))
  const dayLabel = (d) => {
    if (!d) return 'Anytime'
    const i = days.indexOf(d)
    return i >= 0 ? `Day ${i + 1}` : fmtChip(d).split(' ').slice(0, 2).join(' ')
  }
  const pickedOn = (kind, id) =>
    [...new Set((place?.[kind] || []).filter((x) => x.id === id).map(dayOf))].sort()
  const selA = new Set((place?.attractions || []).filter((x) => dayOf(x) === day).map((x) => x.id))
  const selR = new Set((place?.restaurants || []).filter((x) => dayOf(x) === day).map((x) => x.id))

  if (!place) return null

  return createPortal(
    <div className="wiz-backdrop" onMouseDown={onClose}>
      <div className="wiz" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="wiz__head">
          <div>
            <h2 className="wiz__title">{place.name}</h2>
            <p className="wiz__sub">{place.regionName} — choose a day, the sights you want, and where to eat.</p>
          </div>
          <button className="wiz__x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="wiz__body">
          {/* Date */}
          <section className="pp-sec">
            <h3 className="pp-h"><CalendarRange size={16} /> Which day?</h3>
            {days.length > 0 ? (
              <div className="pp-days">
                {days.map((d, i) => (
                  <button key={d}
                    className={`pp-day ${day === d ? 'pp-day--on' : ''} ${place.date === d ? 'pp-day--visit' : ''}`}
                    onClick={() => {
                      setViewDay(d === day ? '' : d)
                      if (!place.date) setPlaceDate(tripId, regionId, placeId, d)   // first pick schedules the place
                    }}>
                    <span className="pp-day__n">Day {i + 1}{place.date === d ? ' · visit' : ''}</span>
                    <span className="pp-day__d">{fmtChip(d)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="pp-dateline">
                <input type="date" value={place.date || ''} onChange={(e) => setPlaceDate(tripId, regionId, placeId, e.target.value)} />
                <span className="pp-hint">Set your trip’s dates to plan day by day.</span>
              </div>
            )}
            {days.length > 0 && place.date && day !== (place.date || '') && (
              <p className="pp-visitline">
                Visiting on <b>{dayLabel(place.date)}</b> — you’re picking for <b>{dayLabel(day)}</b>.
                <button className="pp-visitmove" onClick={() => setPlaceDate(tripId, regionId, placeId, day)}>Make {dayLabel(day)} the visit day</button>
              </p>
            )}
          </section>

          {(activities.length > 0 || restaurants.length > 0) && (
            <div className="pp-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'do'} className={`pp-tab ${tab === 'do' ? 'is-on' : ''}`} onClick={() => setTab('do')}>
                <Compass size={15} /> Things to do {selA.size > 0 && <span className="pp-tab__n">{selA.size}</span>}
              </button>
              <button role="tab" aria-selected={tab === 'eat'} className={`pp-tab ${tab === 'eat' ? 'is-on' : ''}`} onClick={() => setTab('eat')}>
                <UtensilsCrossed size={15} /> Where to eat {selR.size > 0 && <span className="pp-tab__n">{selR.size}</span>}
              </button>
              <span className="pp-tabs__day">{dayLabel(day)}</span>
            </div>
          )}

          {/* Attractions */}
          {tab === 'do' && activities.length > 0 && (
            <section className="pp-sec">
              <ul className="pp-list">
                {activities.map((a) => (
                  <li key={a.id} className={`pp-item ${selA.has(a.id) ? 'pp-item--on' : ''}`}
                    onClick={() => togglePlaceItem(tripId, regionId, placeId, 'attractions',
                      { id: a.id, text: a.text, lat: a.lat, lng: a.lng }, day)}>
                    <span className="pp-check">{selA.has(a.id) && <Check size={13} />}</span>
                    <span className="pp-item__text">
                      <span className="pp-item__title">{a.text}</span>
                      {a.detail && <span className="pp-item__sub">{a.detail}</span>}
                    </span>
                    <OtherDays days={pickedOn('attractions', a.id).filter((d) => d !== day)} label={dayLabel} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Restaurants */}
          {tab === 'eat' && restaurants.length > 0 && (
            <section className="pp-sec">
              <p className="pp-note">Nearest to {place.name} first.</p>
              <ul className="pp-list">
                {restaurants.slice(0, 12).map((r) => (
                  <li key={r.id} className={`pp-item ${selR.has(r.id) ? 'pp-item--on' : ''}`}
                    onClick={() => togglePlaceItem(tripId, regionId, placeId, 'restaurants',
                      { id: r.id, name: r.name, cuisine: r.cuisine, priceRange: r.priceRange, mustOrder: r.mustOrder, lat: r.lat, lng: r.lng }, day)}>
                    <span className="pp-check">{selR.has(r.id) && <Check size={13} />}</span>
                    <span className="pp-item__text">
                      <span className="pp-item__title">{r.name} {r.priceRange && <em className="pp-price">{r.priceRange}</em>}</span>
                      <span className="pp-item__sub">{r.cuisine}{r.neighbourhood ? ` · ${r.neighbourhood}` : ''}</span>
                      {r.mustOrder && <span className="pp-item__order">Must order: {r.mustOrder}</span>}
                    </span>
                    <OtherDays days={pickedOn('restaurants', r.id).filter((d) => d !== day)} label={dayLabel} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'do' && region && activities.length === 0 && restaurants.length > 0 && (
            <p className="pp-note">No listed activities for this place yet.</p>
          )}
          {tab === 'eat' && region && restaurants.length === 0 && activities.length > 0 && (
            <p className="pp-note">No restaurants in the guide for this region yet.</p>
          )}
          {region && activities.length === 0 && restaurants.length === 0 && (
            <div className="wiz-hint"><MapPin size={18} /> <span>Pick a day above. Things to do and restaurants come from the guide — this place doesn’t have them yet.</span></div>
          )}
          {region === false && (
            <div className="wiz-hint"><MapPin size={18} /> <span>This is your own place, so just set a day. Add a note on the trip for the details.</span></div>
          )}
        </div>

        <footer className="wiz__foot">
          <span className="wiz__count">
            {dayLabel(day)}: {selA.size} to do · {selR.size} to eat
            {((place.attractions?.length || 0) + (place.restaurants?.length || 0)) > (selA.size + selR.size) &&
              <em className="wiz__count-more"> · more on other days</em>}
          </span>
          <button className="btn btn--primary" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function OtherDays({ days, label }) {
  if (!days.length) return null
  return (
    <span className="pp-ind" title={`Also picked: ${days.map(label).join(', ')}`}>
      {days.slice(0, 3).map((d) => <span key={d || 'any'} className="pp-ind__chip">{label(d)}</span>)}
      {days.length > 3 && <span className="pp-ind__chip">+{days.length - 3}</span>}
    </span>
  )
}

function daysInRange(start, end) {
  if (!start) return []
  const s = new Date(start)
  const e = end ? new Date(end) : s
  if (isNaN(s) || isNaN(e) || e < s) return []
  const out = []
  const d = new Date(s)
  while (d <= e && out.length < 31) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
  return out
}
function fmtChip(d) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
