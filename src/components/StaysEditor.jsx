import { useEffect, useRef, useState } from 'react'
import { BedDouble, Plus, Trash2, MapPin, Search, Check } from 'lucide-react'
import { addStay, updateStay, removeStay } from '../lib/trips.js'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const TYPES = ['hotel', 'B&B', 'apartment', 'agriturismo', 'villa', 'hostel', 'camping', 'friends & family']

const fmtShort = (d) => (d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')

// Mapbox forward geocoding — quiet null on failure or without a token.
async function geocode(query) {
  if (!TOKEN || !query.trim()) return []
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&limit=4&types=poi,address,place&language=en`
    const res = await fetch(url)
    if (!res.ok) return []
    const j = await res.json()
    return (j.features || []).map((f) => ({
      label: f.place_name, lat: f.center[1], lng: f.center[0],
    }))
  } catch { return [] }
}

function StayForm({ trip, initial, onDone }) {
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState(initial?.type || 'hotel')
  const [from, setFrom] = useState(initial?.from || trip.startDate || '')
  const [to, setTo] = useState(initial?.to || trip.endDate || '')
  const [coords, setCoords] = useState(initial?.lat ? { lat: initial.lat, lng: initial.lng, label: initial.address } : null)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const timer = useRef(null)

  const search = (q) => {
    clearTimeout(timer.current)
    if (!q.trim() || !TOKEN) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setSearching(true)
      setResults(await geocode(q))
      setSearching(false)
    }, 450)
  }

  const save = () => {
    if (!name.trim()) return
    const stay = { name: name.trim(), type, from, to, lat: coords?.lat, lng: coords?.lng, address: coords?.label }
    if (initial?.id) updateStay(trip.id, initial.id, stay)
    else addStay(trip.id, stay)
    onDone()
  }

  return (
    <div className="stayform">
      <div className="stayform__row">
        <label className="stayform__field stayform__field--grow">
          <span>Name / search</span>
          <input value={name} placeholder="e.g. Hotel Brunelleschi, Florence"
            onChange={(e) => { setName(e.target.value); setCoords(null); search(e.target.value) }} />
        </label>
        <label className="stayform__field">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {searching && <p className="stayform__hint"><Search size={12} /> Searching…</p>}
      {!coords && results.length > 0 && (
        <ul className="stayform__results">
          {results.map((r, i) => (
            <li key={i}>
              <button onClick={() => { setCoords(r); setResults([]) }}><MapPin size={13} /> {r.label}</button>
            </li>
          ))}
        </ul>
      )}
      {coords && <p className="stayform__found"><Check size={13} /> {coords.label || 'Pinned on the map'}</p>}
      {!TOKEN && <p className="stayform__hint">Add a Mapbox token to pin stays on the map — saved as a note otherwise.</p>}

      <div className="stayform__row">
        <label className="stayform__field"><span>First night</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="stayform__field"><span>Last night</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <div className="stayform__actions">
          <button className="btn btn--primary" onClick={save} disabled={!name.trim()}>Save stay</button>
          <button className="btn btn--soft" onClick={onDone}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function StaysEditor({ trip }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const stays = [...(trip.stays || [])].sort((a, b) => (a.from || '').localeCompare(b.from || ''))

  return (
    <section className="stays">
      <h3 className="stays__h"><BedDouble size={16} /> Where you're staying</h3>

      {stays.length === 0 && !adding && (
        <p className="stays__empty">Add your hotel, B&amp;B or apartment — each day's route will start and end there.</p>
      )}

      {stays.map((s) => (
        editing === s.id ? (
          <StayForm key={s.id} trip={trip} initial={s} onDone={() => setEditing(null)} />
        ) : (
          <div key={s.id} className="stay">
            <BedDouble size={15} className="stay__ic" />
            <div className="stay__main">
              <span className="stay__name">{s.name}</span>
              <span className="stay__meta">
                {s.type}{s.from && <> · {fmtShort(s.from)} – {fmtShort(s.to)}</>}
                {s.lat ? <span className="stay__pin"> · <MapPin size={11} /> on the map</span> : ' · no pin'}
              </span>
            </div>
            <button className="stay__act" onClick={() => setEditing(s.id)}>Edit</button>
            <button className="stay__act stay__act--del" onClick={() => removeStay(trip.id, s.id)} aria-label="Remove stay"><Trash2 size={14} /></button>
          </div>
        )
      ))}

      {adding ? (
        <StayForm trip={trip} onDone={() => setAdding(false)} />
      ) : (
        <button className="btn btn--soft stays__add" onClick={() => setAdding(true)}><Plus size={15} /> Add a stay</button>
      )}
    </section>
  )
}
