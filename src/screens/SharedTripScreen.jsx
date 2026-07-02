import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CalendarRange, MapPin, Utensils, Compass, Download, ArrowRight, BedDouble } from 'lucide-react'
import { decodeTrip } from '../lib/tripShare.js'
import { importTrip } from '../lib/trips.js'
import { downloadTripPdf } from '../lib/tripPdf.js'
import MapView from '../components/MapView.jsx'
import { paths } from '../lib/paths.js'
import { useSeo } from '../lib/seo.js'
import { useAuth } from '../lib/auth.jsx'

const fmtLong = (d) => new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShort = (d) => new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const itemDay = (x, p) => (x.date === undefined ? (p.date || '') : (x.date || ''))

export default function SharedTripScreen() {
  const { code } = useParams()
  const navigate = useNavigate()
  const trip = useMemo(() => decodeTrip(code), [code])
  const { user } = useAuth()
  useSeo({ title: trip ? `${trip.name} (shared trip)` : 'Shared trip', path: '/plan' })

  if (!trip) {
    return (
      <div className="page wrap">
        <p className="empty" style={{ marginTop: 60 }}>This trip link is broken or incomplete — ask for it to be shared again.</p>
      </div>
    )
  }

  const days = useMemo(() => {
    const by = new Map()
    for (const p of trip.places) {
      const k = p.date || ''
      if (!by.has(k)) by.set(k, [])
      by.get(k).push(p)
    }
    return [...by.entries()].sort(([a], [b]) => (a || '9999').localeCompare(b || '9999'))
  }, [trip])

  const hasMapbox = !!import.meta.env.VITE_MAPBOX_TOKEN
  const stayFor = (key) => (key ? (trip.stays || []).find((x) => x.from && x.to && x.from <= key && key <= x.to) : null)
  const markersFor = (key, places) => {
    const out = []
    const st = stayFor(key)
    if (st?.lat && st?.lng) out.push({ lng: st.lng, lat: st.lat, label: `Stay: ${st.name}`, color: '#3a3733' })
    for (const p of places) if (p.lat && p.lng) out.push({ lng: p.lng, lat: p.lat, label: p.name, color: '#a9762a' })
    for (const p of trip.places) {
      for (const a of (p.attractions || [])) if (itemDay(a, p) === key && a.lat && a.lng) out.push({ lng: a.lng, lat: a.lat, label: a.text, color: '#1f6f54' })
      for (const r of (p.restaurants || [])) if (itemDay(r, p) === key && r.lat && r.lng) out.push({ lng: r.lng, lat: r.lat, label: r.name, color: '#bb3a2c' })
    }
    return out
  }

  const save = () => {
    if (!user) { alert('Sign in (top right) to save this trip to your account.'); return }
    importTrip(trip); navigate(paths.plan())
  }
  const regions = new Set(trip.places.map((p) => p.regionName).filter(Boolean))

  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow">A shared trip</p>
        <h1 className="sub-hero__title">{trip.name}</h1>
        <p className="sub-hero__sub">
          {trip.startDate ? `${fmtShort(trip.startDate)} – ${fmtShort(trip.endDate || trip.startDate)} · ` : ''}
          {trip.places.length} place{trip.places.length === 1 ? '' : 's'}
          {regions.size > 0 && <> across {regions.size} region{regions.size === 1 ? '' : 's'}</>}
        </p>
      </header>

      <main className="wrap" style={{ paddingBottom: 50 }}>
        <div className="admin__bar" style={{ marginBottom: 24 }}>
          <button className="btn btn--primary" onClick={save}>Save a copy to my trips <ArrowRight size={16} /></button>
          <button className="btn btn--soft" onClick={() => downloadTripPdf(trip)}><Download size={15} /> PDF</button>
        </div>

        {days.map(([key, places]) => {
          const markers = hasMapbox ? markersFor(key, places) : []
          return (
            <section key={key || 'any'} className="iday iday--open" style={{ marginBottom: 22 }}>
              <header className="iday__head">
                <span className="iday__num">{key ? fmtLong(key) : 'Anytime'}</span>
                {stayFor(key) && <span className="iday__stay"><BedDouble size={12} /> {stayFor(key).name}</span>}
              </header>
              {markers.length > 0 && (
                <div className="iday__map"><MapView height={210} center={[markers[0].lng, markers[0].lat]} zoom={10} markers={markers} /></div>
              )}
              {places.map((p, i) => (
                <article key={i} className="shared-place">
                  <h3 className="shared-place__name"><MapPin size={15} /> {p.name} <span className="shared-place__region">{p.regionName}</span></h3>
                  {(p.attractions || []).filter((a) => itemDay(a, p) === key).length > 0 && (
                    <ul className="ip__list">
                      {(p.attractions || []).filter((a) => itemDay(a, p) === key).map((a) => <li key={a.id}><Compass size={12} /> {a.text}</li>)}
                    </ul>
                  )}
                  {(p.restaurants || []).filter((r) => itemDay(r, p) === key).length > 0 && (
                    <ul className="ip__list">
                      {(p.restaurants || []).filter((r) => itemDay(r, p) === key).map((r) => <li key={r.id}><Utensils size={12} /> {r.name}{r.mustOrder ? ` — ${r.mustOrder}` : ''}</li>)}
                    </ul>
                  )}
                  {p.note && <p className="shared-place__note">“{p.note}”</p>}
                </article>
              ))}
            </section>
          )
        })}

        <p className="admin-note">
          This is a read-only view. <b>Save a copy</b> puts it in your own <Link to={paths.trips()} style={{ color: 'var(--gold)' }}>trips</Link> to edit freely.
        </p>
      </main>
    </div>
  )
}
