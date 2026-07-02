import { Link, useNavigate } from 'react-router-dom'
import { Plus, MapPin, CalendarRange, Trash2, ArrowRight, FileDown, Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTrips, createTrip, deleteTrip, setActiveTrip, duplicateTrip } from '../lib/trips.js'
import { getImages } from '../lib/data.js'
import { downloadTripPdf } from '../lib/tripPdf.js'
import { paths } from '../lib/paths.js'
import { useSeo } from '../lib/seo.js'

const fmt = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''

export default function TripsScreen() {
  useSeo({ title: 'My trips', description: 'All your saved trips in one place.', path: '/trips' })
  const snap = useTrips()
  const navigate = useNavigate()
  const [images, setImages] = useState({})
  useEffect(() => { getImages().then(setImages).catch(() => {}) }, [])
  const coverOf = (t) => {
    for (const p of t.places) {
      const u = images[p.regionId]?.[p.placeId]?.[0]?.url
      if (u) return u
    }
    return null
  }

  const open = (id) => { setActiveTrip(id); navigate(paths.plan()) }
  const newTrip = () => { const id = createTrip(`Trip ${snap.trips.length + 1}`); setActiveTrip(id); navigate(paths.plan()) }

  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow">Trip planner</p>
        <h1 className="sub-hero__title">My trips</h1>
        <p className="sub-hero__sub">Every trip you’ve started, in one place. Open one to keep planning, or download it as a PDF to take with you.</p>
      </header>

      <main className="wrap">
        <div className="admin__bar" style={{ marginBottom: 22 }}>
          <button className="btn btn--primary" onClick={newTrip}><Plus size={16} /> New trip</button>
        </div>

        {snap.trips.length === 0 ? (
          <div className="saved-empty">
            <CalendarRange size={30} />
            <p>No trips yet. Start one, then add places as you browse — every place page has an “Add to trip” button.</p>
          </div>
        ) : (
          <div className="trips-grid">
            {snap.trips.map((t) => {
              const regions = new Set(t.places.map((p) => p.regionName).filter(Boolean))
              const done = t.places.filter((p) => p.done).length
              return (
                <article key={t.id} className={`tripcard ${t.id === snap.activeTripId ? 'tripcard--on' : ''}`}>
                  {coverOf(t) && <div className="tripcard__cover"><img src={coverOf(t)} alt="" loading="lazy" onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }} /></div>}
                  <button className="tripcard__main" onClick={() => open(t.id)}>
                    <h2 className="tripcard__name">{t.name}</h2>
                    <p className="tripcard__dates">
                      <CalendarRange size={13} />
                      {t.startDate ? `${fmt(t.startDate)} – ${fmt(t.endDate || t.startDate)}` : 'No dates yet'}
                    </p>
                    <p className="tripcard__meta">
                      <MapPin size={13} /> {t.places.length} place{t.places.length === 1 ? '' : 's'}
                      {regions.size > 0 && <> · {regions.size} region{regions.size === 1 ? '' : 's'}</>}
                      {done > 0 && <span className="tripcard__done"><Check size={12} /> {done} visited</span>}
                    </p>
                    <span className="tripcard__open">Open <ArrowRight size={14} /></span>
                  </button>
                  <div className="tripcard__actions">
                    <button onClick={() => downloadTripPdf(t)} title="Download PDF" aria-label="Download PDF"><FileDown size={15} /></button>
                    <button onClick={() => { duplicateTrip(t.id); }} title="Duplicate" aria-label="Duplicate trip"><Copy size={15} /></button>
                    <button className="tripcard__del" onClick={() => { if (confirm(`Delete “${t.name}”?`)) deleteTrip(t.id) }} title="Delete" aria-label="Delete trip"><Trash2 size={15} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <p className="admin-note" style={{ marginTop: 26 }}>
          Trips are saved in this browser. Add places from any region or place page, or from the <Link to={paths.plan()} style={{ color: 'var(--gold)', fontWeight: 600 }}>planner</Link>.
        </p>
      </main>
    </div>
  )
}
