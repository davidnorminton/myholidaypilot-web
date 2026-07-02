import { useRef, useState } from 'react'
import { Plane, TrainFront, Bus, Ship, Search, Check, X } from 'lucide-react'
import { setTravelPoint } from '../lib/trips.js'
import { searchPlaces } from '../lib/transport.js'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const TYPES = [
  { id: 'airport', label: 'Airport', icon: Plane },
  { id: 'train', label: 'Train station', icon: TrainFront },
  { id: 'bus', label: 'Bus station', icon: Bus },
  { id: 'port', label: 'Port', icon: Ship },
]
const iconFor = (type) => (TYPES.find((t) => t.id === type) || TYPES[0]).icon

function PointForm({ trip, which, onDone }) {
  const [type, setType] = useState('airport')
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)

  const search = (text) => {
    clearTimeout(timer.current)
    if (!text.trim() || !TOKEN) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setBusy(true)
      const anchor = trip.places.find((p) => p.lat && p.lng)
      setResults(await searchPlaces(text, anchor ? { proximity: anchor } : {}))
      setBusy(false)
    }, 450)
  }

  const pick = (r) => {
    setTravelPoint(trip.id, which, { name: r.name || r.label, type, lat: r.lat, lng: r.lng })
    onDone()
  }

  return (
    <div className="travelform">
      <div className="travelform__types">
        {TYPES.map((t) => (
          <button key={t.id} className={`travelform__type ${type === t.id ? 'is-on' : ''}`} onClick={() => setType(t.id)}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      <input autoFocus value={q} placeholder={type === 'airport' ? 'e.g. Rome Fiumicino airport' : 'e.g. Pescara Centrale'}
        onChange={(e) => { setQ(e.target.value); search(e.target.value) }} />
      {busy && <p className="stayform__hint"><Search size={12} /> Searching…</p>}
      {results.length > 0 && (
        <ul className="stayform__results">
          {results.map((r, i) => <li key={i}><button onClick={() => pick(r)}><Check size={13} /> {r.label}</button></li>)}
        </ul>
      )}
      {!TOKEN && <p className="stayform__hint">Add a Mapbox token to search for airports and stations.</p>}
      <button className="btn btn--soft" style={{ marginTop: 8 }} onClick={onDone}>Cancel</button>
    </div>
  )
}

// "Arriving at / Leaving from" — trip endpoints that anchor the first and
// last day's routes.
export default function TravelEditor({ trip }) {
  const [editing, setEditing] = useState(null)   // 'arrive' | 'depart' | null
  const slots = [
    { which: 'arrive', label: 'Arriving at', hint: 'Day one\u2019s route starts here.' },
    { which: 'depart', label: 'Leaving from', hint: 'The last day ends here.' },
  ]

  return (
    <section className="travel">
      <h3 className="stays__h"><Plane size={16} /> Getting there &amp; back</h3>
      <div className="travel__slots">
        {slots.map(({ which, label, hint }) => {
          const pt = trip.travel?.[which]
          const Icon = pt ? iconFor(pt.type) : Plane
          return (
            <div key={which} className="travel__slot">
              <span className="travel__label">{label}</span>
              {editing === which ? (
                <PointForm trip={trip} which={which} onDone={() => setEditing(null)} />
              ) : pt ? (
                <span className="travel__pt">
                  <Icon size={14} /> {pt.name}
                  <button className="travel__clear" onClick={() => setTravelPoint(trip.id, which, null)} aria-label={`Clear ${label}`}><X size={13} /></button>
                </span>
              ) : (
                <button className="travel__add" onClick={() => setEditing(which)}>+ Add airport or station</button>
              )}
              <span className="travel__hint">{hint}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
