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
  const selA = new Set((place?.attractions || []).map((x) => x.id))
  const selR = new Set((place?.restaurants || []).map((x) => x.id))

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
                  <button key={d} className={`pp-day ${place.date === d ? 'pp-day--on' : ''}`}
                    onClick={() => setPlaceDate(tripId, regionId, placeId, place.date === d ? '' : d)}>
                    <span className="pp-day__n">Day {i + 1}</span>
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
          </section>

          {/* Attractions */}
          {activities.length > 0 && (
            <section className="pp-sec">
              <h3 className="pp-h"><Compass size={16} /> Things to do <span className="pp-count">{selA.size}/{activities.length}</span></h3>
              <ul className="pp-list">
                {activities.map((a) => (
                  <li key={a.id} className={`pp-item ${selA.has(a.id) ? 'pp-item--on' : ''}`}
                    onClick={() => togglePlaceItem(tripId, regionId, placeId, 'attractions',
                      { id: a.id, text: a.text, lat: a.lat, lng: a.lng })}>
                    <span className="pp-check">{selA.has(a.id) && <Check size={13} />}</span>
                    <span className="pp-item__text">
                      <span className="pp-item__title">{a.text}</span>
                      {a.detail && <span className="pp-item__sub">{a.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Restaurants */}
          {restaurants.length > 0 && (
            <section className="pp-sec">
              <h3 className="pp-h"><UtensilsCrossed size={16} /> Where to eat <span className="pp-count">{selR.size} picked</span></h3>
              <p className="pp-note">Nearest to {place.name} first.</p>
              <ul className="pp-list">
                {restaurants.slice(0, 12).map((r) => (
                  <li key={r.id} className={`pp-item ${selR.has(r.id) ? 'pp-item--on' : ''}`}
                    onClick={() => togglePlaceItem(tripId, regionId, placeId, 'restaurants',
                      { id: r.id, name: r.name, cuisine: r.cuisine, priceRange: r.priceRange, mustOrder: r.mustOrder, lat: r.lat, lng: r.lng })}>
                    <span className="pp-check">{selR.has(r.id) && <Check size={13} />}</span>
                    <span className="pp-item__text">
                      <span className="pp-item__title">{r.name} {r.priceRange && <em className="pp-price">{r.priceRange}</em>}</span>
                      <span className="pp-item__sub">{r.cuisine}{r.neighbourhood ? ` · ${r.neighbourhood}` : ''}</span>
                      {r.mustOrder && <span className="pp-item__order">Must order: {r.mustOrder}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
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
            {(place.attractions?.length || 0)} to do · {(place.restaurants?.length || 0)} to eat
          </span>
          <button className="btn btn--primary" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>,
    document.body,
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
