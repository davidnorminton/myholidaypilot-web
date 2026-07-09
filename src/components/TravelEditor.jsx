import { useEffect, useRef, useState } from 'react'
import { Globe2 } from 'lucide-react'
import { setTravelPoint } from '../lib/trips.js'
import { searchPlaces } from '../lib/transport.js'
import { api } from '../lib/api.js'
import { useAffiliates, buildUrl, REGION_IATA } from '../lib/affiliates.js'
import { COUNTRIES } from '../lib/countries.js'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
// ISO codes for Mapbox's country filter, keyed by our country slugs.
const ISO = { italy: 'it', spain: 'es', portugal: 'pt', france: 'fr', germany: 'de', greece: 'gr',
  japan: 'jp', netherlands: 'nl', norway: 'no', poland: 'pl', singapore: 'sg', south_korea: 'kr',
  sweden: 'se', switzerland: 'ch', thailand: 'th', turkey: 'tr', united_kingdom: 'gb', united_states: 'us' }

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
    api.airports.list(trip.countryId || 'italy').then((r) => {
      if (!on) return
      setAirports(r || [])
      if (!r || r.length === 0) setOtherMode(true)
    }).catch(() => { if (on) { setAirports([]); setOtherMode(true) } })
    return () => { on = false }
  }, [])

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

// Flights — incoming / outgoing airports (optional), with a "Book flights"
// affiliate link once an airport is chosen.
export default function TravelEditor({ trip }) {
  const affCfg = useAffiliates()
  const base = trip.places.find((p) => p.regionName && !p.isCustom)
  const country = COUNTRIES.find((c) => c.slug === trip.countryId)
  const [editing, setEditing] = useState(null)   // 'arrive' | 'depart' | null
  const slots = [
    { which: 'arrive', label: 'Incoming flight' },
    { which: 'depart', label: 'Outgoing flight' },
  ]
  const iataFor = (pt) => pt?.iata || (base && REGION_IATA[base.regionId]) || null

  return (
    <div className="planflights">
      <span className="planform__optlabel">Flights - optional</span>

      {slots.map(({ which, label }) => {
        const pt = trip.travel?.[which]
        const ia = iataFor(pt)
        return (
          <div key={which} className="planflights__slot">
            <span className="planform__label">{label}</span>
            {editing === which ? (
              <AirportForm trip={trip} which={which} onDone={() => setEditing(null)} />
            ) : pt ? (
              <>
                <div className="planflights__picked">
                  <span>{pt.name}</span>
                  <button className="planflights__change" onClick={() => setEditing(which)}>Change</button>
                  <button className="planflights__clear" onClick={() => setTravelPoint(trip.id, which, null)} aria-label={`Clear ${label}`}>×</button>
                </div>
                {ia && affCfg && (
                  <a className="planflights__book" href={buildUrl(affCfg.skyscanner, { iata: ia })}
                    target="_blank" rel="noreferrer sponsored">
                    Book flights to {pt.name}<span className="planflights__ad">ad</span>
                  </a>
                )}
              </>
            ) : (
              <button className="planflights__add" onClick={() => setEditing(which)}>+ Add airport</button>
            )}
          </div>
        )
      })}

      {country && (
        <span className="planform__chip planflights__country"><Globe2 size={14} /> {country.name}</span>
      )}
    </div>
  )
}
