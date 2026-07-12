import { useEffect, useRef, useState } from 'react'
import { setTravelPoint } from '../lib/trips.js'
import { searchPlaces } from '../lib/transport.js'
import { api } from '../lib/api.js'
import { useAffiliates } from '../lib/affiliates.js'
import { ISO, skyscannerUrl } from '../lib/bookingLinks.js'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// Airport picker, styled to sit inside the plan form. Curated per-country list
// first, with a map-search fallback for airports that aren't listed.
function AirportForm({ trip, which, onDone }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)
  const [airports, setAirports] = useState(null)   // null=loading, []=none
  const [otherMode, setOtherMode] = useState(false)

  useEffect(() => {
    let on = true
    setAirports(null); setOtherMode(false); setQ('')
    api.airports.list(trip.countryId || 'italy').then((r) => {
      if (!on) return
      setAirports(r || [])
      if (!r || r.length === 0) setOtherMode(true)
    }).catch(() => { if (on) { setAirports([]); setOtherMode(true) } })
    return () => { on = false }
  }, [trip.countryId]) // the destination can change mid-plan — reload the list

  const airportHits = (airports || []).filter((a) => {
    const t = q.trim().toLowerCase()
    if (!t) return true
    return a.name.toLowerCase().includes(t) || a.city.toLowerCase().includes(t) || a.iata.toLowerCase().includes(t)
  })

  const pickAirport = (a) => {
    setTravelPoint(trip.id, which, { name: `${a.city} (${a.iata})`, fullName: a.name, type: 'airport', iata: a.iata, lat: a.lat, lng: a.lng, address: a.address })
    onDone()
  }

  const search = (text) => {
    clearTimeout(timer.current)
    if (!text.trim() || !TOKEN) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setBusy(true)
      const anchor = trip.places.find((p) => p.lat && p.lng)
      const biased = /airport|aeroport|aeropuerto|flughafen/i.test(text) ? text : `${text} airport`
      setResults(await searchPlaces(biased, {
        ...(anchor ? { proximity: anchor } : {}),
        ...(ISO[trip.countryId] ? { country: ISO[trip.countryId] } : {}),
      }))
      setBusy(false)
    }, 450)
  }

  const pickMap = (r) => {
    setTravelPoint(trip.id, which, { name: r.name || r.label, type: 'airport', lat: r.lat, lng: r.lng })
    onDone()
  }

  return (
    <div className="planflights__form">
      {!otherMode ? (
        <>
          <input className="planform__input" autoFocus value={q} placeholder="Search airport — city or code (e.g. FCO)"
            onChange={(e) => setQ(e.target.value)} />
          {airports === null && <p className="planflights__hint">Loading airports…</p>}
          {airports !== null && (
            <ul className="planflights__results">
              {airportHits.map((a) => (
                <li key={a.id}>
                  <button onClick={() => pickAirport(a)}>
                    <b>{a.city} <em>{a.iata}</em></b>
                    <small>{a.name}</small>
                  </button>
                </li>
              ))}
              {airportHits.length === 0 && <li className="planflights__hint">No match — try the option below.</li>}
              <li>
                <button className="planflights__other" onClick={() => { setOtherMode(true); setQ(''); setResults([]) }}>
                  Other — my airport isn’t listed
                </button>
              </li>
            </ul>
          )}
        </>
      ) : (
        <>
          <input className="planform__input" autoFocus value={q} placeholder="Search any airport on the map"
            onChange={(e) => { setQ(e.target.value); search(e.target.value) }} />
          {busy && <p className="planflights__hint">Searching…</p>}
          {results.length > 0 && (
            <ul className="planflights__results">
              {results.map((r, i) => <li key={i}><button onClick={() => pickMap(r)}>{r.label}</button></li>)}
            </ul>
          )}
          {!TOKEN && <p className="planflights__hint">Add a Mapbox token to search the map.</p>}
          {airports && airports.length > 0 && (
            <button className="planflights__other" onClick={() => setOtherMode(false)}>← Back to the airport list</button>
          )}
        </>
      )}
      <button className="planflights__cancel" onClick={onDone}>Cancel</button>
    </div>
  )
}

// Saved home airport — remembered across trips (people rarely change theirs).
const HOME_KEY = 'planHero.homeAirport'
const loadHome = () => { try { return JSON.parse(localStorage.getItem(HOME_KEY) || 'null') } catch { return null } }
const saveHome = (pt) => { try { localStorage.setItem(HOME_KEY, JSON.stringify(pt)) } catch { /* ignore */ } }

// Picker for the traveller's home airport — worldwide map search (no country
// filter), with the remembered airport as a one-tap first row.
function HomeAirportForm({ onPick, onDone }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)
  const savedPt = loadHome()

  const search = (text) => {
    clearTimeout(timer.current)
    if (!text.trim() || !TOKEN) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setBusy(true)
      const biased = /airport|aeroport|aeropuerto|flughafen/i.test(text) ? text : `${text} airport`
      setResults(await searchPlaces(biased, {}))
      setBusy(false)
    }, 450)
  }
  const pickMap = async (r) => {
    const m = /\(([A-Za-z]{3})\)/.exec(r.label || r.name || '')
    let pt = { name: (r.name || r.label || '').split(',')[0], type: 'airport', lat: r.lat, lng: r.lng, ...(m ? { iata: m[1].toUpperCase() } : {}) }
    if (!pt.iata) {
      // No code in the label — snap to the nearest curated airport for a real
      // IATA (makes the Skyscanner link airport-precise instead of country-level).
      const hit = (await api.airports.near(r.lat, r.lng).catch(() => []))[0]
      if (hit) pt = { name: `${hit.city} (${hit.iata})`, fullName: hit.name, type: 'airport', iata: hit.iata, lat: hit.lat, lng: hit.lng, address: hit.address }
    }
    onPick(pt); onDone()
  }

  return (
    <div className="planflights__form">
      <input className="planform__input" autoFocus value={q} placeholder="Search your home airport — city or code"
        onChange={(e) => { setQ(e.target.value); search(e.target.value) }} />
      {savedPt && !q.trim() && (
        <ul className="planflights__results">
          <li><button onClick={() => { onPick(savedPt); onDone() }}><b>Use {savedPt.name}</b><small>your saved airport</small></button></li>
        </ul>
      )}
      {busy && <p className="planflights__hint">Searching…</p>}
      {results.length > 0 && (
        <ul className="planflights__results">
          {results.map((r, i) => <li key={i}><button onClick={() => pickMap(r)}>{r.label}</button></li>)}
        </ul>
      )}
      {!TOKEN && <p className="planflights__hint">Add a Mapbox token to search airports.</p>}
      <button className="planflights__cancel" onClick={onDone}>Cancel</button>
    </div>
  )
}

// Flights — one From → To line per direction. The destination-side airports
// live on travel.arrive / travel.depart (unchanged shape, so the itinerary,
// PDF and share all keep working); the home airport is a single shared
// travel.home, which is what mirrors the two directions automatically.
export default function TravelEditor({ trip }) {
  const affCfg = useAffiliates()
  const [editing, setEditing] = useState(null)   // 'arrive' | 'depart' | 'home:arrive' | 'home:depart'
  const home = trip.travel?.home || null
  const short = (pt) => (pt?.name || '').split(',')[0]

  const setHome = (pt) => { setTravelPoint(trip.id, 'home', pt); if (pt) saveHome(pt) }
  const linkFor = (which) => skyscannerUrl(affCfg, trip, which)

  const rows = [
    { which: 'arrive', label: 'Incoming flight', from: { pt: home, kind: 'home' }, to: { pt: trip.travel?.arrive, kind: 'dest' } },
    { which: 'depart', label: 'Outgoing flight', from: { pt: trip.travel?.depart, kind: 'dest' }, to: { pt: home, kind: 'home' } },
  ]

  const cell = (which, side, { pt, kind }) => {
    const editKey = kind === 'home' ? `home:${which}` : which
    if (pt) return (
      <div className="planflights__picked planflights__cell">
        <span>{pt.name}</span>
        <button className="planflights__change" onClick={() => setEditing(editKey)}>Change</button>
        <button className="planflights__clear" onClick={() => (kind === 'home' ? setTravelPoint(trip.id, 'home', null) : setTravelPoint(trip.id, which, null))} aria-label="Clear airport">×</button>
      </div>
    )
    return (
      <button className="planflights__add planflights__cell" onClick={() => setEditing(editKey)}>
        + {side === 'from' ? 'From' : 'To'} airport
      </button>
    )
  }

  return (
    <div className="planflights">
      <span className="planform__optlabel">Flights - optional</span>

      {rows.map(({ which, label, from, to }) => {
        const destPt = which === 'arrive' ? to.pt : from.pt
        return (
          <div key={which} className="planflights__slot">
            <span className="planform__label">{label}</span>
            <div className="planflights__row">
              {cell(which, 'from', from)}
              <span className="planflights__arrow" aria-hidden>→</span>
              {cell(which, 'to', to)}
            </div>
            {editing === which && <AirportForm trip={trip} which={which} onDone={() => setEditing(null)} />}
            {editing === `home:${which}` && <HomeAirportForm onPick={setHome} onDone={() => setEditing(null)} />}
          </div>
        )
      })}
    </div>
  )
}
