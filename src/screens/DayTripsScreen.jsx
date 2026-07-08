import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapPin, Search, TrainFront, Car, ArrowRight } from 'lucide-react'
import { getPlacesIndex } from '../lib/data.js'
import { useSettings } from '../lib/settings.js'
import { kmBetween } from '../lib/route.js'
import { nearestStation } from '../lib/transport.js'
import { typeLabel } from '../lib/format.js'
import { COUNTRIES } from '../lib/countries.js'
import AddToTrip from '../components/AddToTrip.jsx'
import { paths } from '../lib/paths.js'
import { useSeo } from '../lib/seo.js'

const RANGES = [
  { max: 50, label: '≤ 50 km' },
  { max: 100, label: '≤ 100 km' },
  { max: 160, label: '≤ 160 km' },
  { max: 9999, label: 'Any distance' },
]
const TYPE_FILTERS = ['ALL', 'TOWN', 'CITY', 'COAST', 'MOUNTAIN', 'LAKE', 'LANDMARK']
const driveMins = (km) => Math.round((km / 55) * 60)

export default function DayTripsScreen() {
  const site = useSettings()
  useSeo({
    title: 'Day-trip finder',
    description: 'Pick your base and see every worthwhile day trip within reach — ranked by distance, with drive times.',
    path: '/day-trips',
  })
  const [params] = useSearchParams()
  const [country, setCountry] = useState('italy')
  const [places, setPlaces] = useState(null)
  const [q, setQ] = useState('')
  const [base, setBase] = useState(null)
  const [range, setRange] = useState(100)
  const [type, setType] = useState('ALL')

  useEffect(() => {
    setPlaces(null); setBase(null)
    getPlacesIndex(country).then(setPlaces).catch(() => setPlaces([]))
  }, [country])

  // deep link: /#/day-trips?from=regionId/placeId
  useEffect(() => {
    const from = params.get('from')
    if (from && places?.length && !base) {
      const [regionId, placeId] = from.split('/')
      const hit = places.find((p) => p.regionId === regionId && p.placeId === placeId)
      if (hit) setBase(hit)
    }
  }, [params, places, base])

  const baseHits = useMemo(() => {
    if (!places || !q.trim()) return []
    const t = q.trim().toLowerCase()
    return places.filter((p) => p.name.toLowerCase().includes(t) || p.regionName.toLowerCase().includes(t)).slice(0, 8)
  }, [places, q])

  const results = useMemo(() => {
    if (!base || !places) return []
    return places
      .filter((p) => !(p.regionId === base.regionId && p.placeId === base.placeId) && p.lat && p.lng)
      .map((p) => ({ ...p, km: kmBetween(base, p) }))
      .filter((p) => p.km <= range && (type === 'ALL' || p.type === type))
      .sort((a, b) => a.km - b.km)
      .slice(0, 24)
  }, [base, places, range, type])

  const [station, setStation] = useState(null)
  useEffect(() => {
    let on = true
    setStation(null)
    if (base?.lat) nearestStation(base.lat, base.lng).then((r) => { if (on) setStation(r) })
    return () => { on = false }
  }, [base?.lat, base?.lng])

  const imgOf = (p) => p.image || null

  return (
    <div className="page wrap dtf">
      <header className="dtf__head plan-hero">
        <div className="plan-hero__text">
          <p className="eyebrow">Day-trip finder</p>
          <h1 className="dtf__title">Where can I get to from here?</h1>
          <p className="dtf__sub">
            Pick your base — a hotel town, a city, anywhere — and see every place worth a day trip,
            ranked by distance.
          </p>
        </div>
        <div className="plan-hero__media" data-emoji="🚗">
          {site['page.daytrips'] && <img src={site['page.daytrips']} alt="" />}
        </div>
      </header>

      <div className="dtf__countries">
        <label className="gq__select">
          <span className="gq__selectlabel">Destination</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.filter((c) => c.available).map((c) => (
              <option key={c.slug} value={c.slug}>{c.flag} {c.name}</option>
            ))}
          </select>
        </label>
      </div>

      {!base ? (
        <div className="dtf__pick">
          <div className="dtf__search">
            <Search size={17} />
            <input autoFocus placeholder="Where are you based? e.g. Florence, Pescara…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {places === null && <p className="account__empty">Loading places…</p>}
          {baseHits.length > 0 && (
            <ul className="dtf__hits">
              {baseHits.map((p) => (
                <li key={`${p.regionId}/${p.placeId}`}>
                  <button onClick={() => { setBase(p); setQ('') }}>
                    <MapPin size={14} /> <b>{p.name}</b> <span>{p.regionName} · {typeLabel(p.type)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="dtf__base">
            <span className="dtf__basefrom">From</span>
            <b>{base.name}</b>
            <span className="dtf__basemeta">{base.regionName}</span>
            {station && (
              <span className="dtf__station"><TrainFront size={13} /> {station.name} · {station.km < 10 ? station.km.toFixed(1) : Math.round(station.km)} km</span>
            )}
            <button className="dtf__change" onClick={() => setBase(null)}>Change</button>
          </div>

          <div className="dtf__filters">
            <div className="gq__chips">
              {RANGES.map((r) => (
                <button key={r.max} className={`gq__chip ${range === r.max ? 'is-on' : ''}`} onClick={() => setRange(r.max)}>{r.label}</button>
              ))}
            </div>
            <div className="gq__chips">
              {TYPE_FILTERS.map((t) => (
                <button key={t} className={`gq__chip ${type === t ? 'is-on' : ''}`} onClick={() => setType(t)}>
                  {t === 'ALL' ? 'All types' : typeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          {results.length === 0 ? (
            <p className="account__empty">Nothing in that range — widen the distance or change the type.</p>
          ) : (
            <div className="dtf__grid">
              {results.map((p) => (
                <article key={`${p.regionId}/${p.placeId}`} className="dtf__card">
                  <Link to={paths.place(p.regionId, p.placeId)} className="dtf__media">
                    {imgOf(p)
                      ? <img src={imgOf(p)} alt={p.name} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                      : <span className="dtf__ph"><MapPin size={18} /></span>}
                    <span className="dtf__km"><Car size={12} /> {p.km < 10 ? p.km.toFixed(1) : Math.round(p.km)} km · ~{driveMins(p.km)} min</span>
                  </Link>
                  <div className="dtf__body">
                    <Link to={paths.place(p.regionId, p.placeId)} className="dtf__name">{p.name}</Link>
                    <span className="dtf__meta">{typeLabel(p.type)}{p.regionId !== base.regionId ? ` · ${p.regionName}` : ''}</span>
                    <AddToTrip place={{ regionId: p.regionId, regionName: p.regionName, placeId: p.placeId, name: p.name, type: p.type, lat: p.lat, lng: p.lng }} countryId={country} compact />
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="dtf__note">Distances are straight-line; drive times are rough estimates at touring pace.</p>
        </>
      )}
    </div>
  )
}
