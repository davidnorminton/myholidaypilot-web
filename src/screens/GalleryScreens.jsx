import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  MapPin, CalendarRange, Copy, Compass, Utensils, BedDouble, Check, ArrowLeft, Star,
} from 'lucide-react'
import { api } from '../lib/api.js'
import { useSettings } from '../lib/settings.js'
import { getPlacesIndex } from '../lib/data.js'
import { COUNTRIES } from '../lib/countries.js'
import { importGalleryTrip } from '../lib/trips.js'
import { useAuth, GoogleSignInButton } from '../lib/auth.jsx'
import MapView from '../components/MapView.jsx'
import { paths } from '../lib/paths.js'
import { useSeo } from '../lib/seo.js'

const LENGTHS = [
  { id: 'any', label: 'Any length', test: () => true },
  { id: 'short', label: '2–3 days', test: (d) => d <= 3 },
  { id: 'mid', label: '4–6 days', test: (d) => d >= 4 && d <= 6 },
  { id: 'week', label: 'A week +', test: (d) => d >= 7 },
]

// ── the gallery grid ──────────────────────────────────────────────────────────
export function GalleryScreen() {
  const site = useSettings()
  useSeo({
    title: 'Trip ideas — real itineraries to copy',
    description: 'Real trips, planned day by day by real travellers — browse by region and length, then copy one into your own planner.',
    path: '/gallery',
  })
  const [country, setCountry] = useState('italy')
  const [rows, setRows] = useState(null)
  const [images, setImages] = useState({})
  const [region, setRegion] = useState('all')
  const [len, setLen] = useState('any')

  useEffect(() => {
    setRows(null)
    api.gallery.list(country).then(setRows).catch(() => setRows([]))
    getPlacesIndex(country).then((list) => {
      const m = {}
      for (const pl of (list || [])) if (pl.image) m[`${pl.regionId}/${pl.placeId}`] = pl.image
      setImages(m)
    }).catch(() => {})
  }, [country])

  const regions = useMemo(() => {
    const all = new Set()
    for (const r of rows || []) for (const n of r.regionNames || []) all.add(n)
    return ['all', ...[...all].sort()]
  }, [rows])

  const shown = useMemo(() => (rows || []).filter((r) =>
    (region === 'all' || (r.regionNames || []).includes(region)) &&
    LENGTHS.find((l) => l.id === len).test(r.days)
  ), [rows, region, len])

  const coverOf = (r) => images[`${r.coverRegionId}/${r.coverPlaceId}`] || null

  return (
    <div className="page wrap gal">
      <header className="gal__head gal__head--plain">
        <h1 className="gal__title">Trip ideas</h1>
      </header>

      <div className="gal__filters">
        <div className="gq__row">
          <label className="gq__select">
            <span className="gq__selectlabel">Destination</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.filter((c) => c.available).map((c) => (
                <option key={c.slug} value={c.slug}>{c.flag} {c.name}</option>
              ))}
            </select>
          </label>
          <div className="gq__chips">
            {LENGTHS.map((l) => (
              <button key={l.id} className={`gq__chip ${len === l.id ? 'is-on' : ''}`} onClick={() => setLen(l.id)}>{l.label}</button>
            ))}
          </div>
        </div>
        {regions.length > 2 && (
          <div className="gq__chips">
            {regions.map((r) => (
              <button key={r} className={`gq__chip ${region === r ? 'is-on' : ''}`} onClick={() => setRegion(r)}>
                {r === 'all' ? 'All regions' : r}
              </button>
            ))}
          </div>
        )}
      </div>

      {rows === null && <p className="account__empty">Loading trips…</p>}
      {rows !== null && shown.length === 0 && (
        <p className="account__empty">
          Nothing here yet for those filters. Planned something good?{' '}
          <Link to={paths.plan()}>Publish your trip</Link> and be the first.
        </p>
      )}

      <div className="gal__grid">
        {shown.map((r) => {
          const flag = COUNTRIES.find((c) => c.slug === r.countryId)?.flag
          return (
          <Link key={r.id} to={`/gallery/${r.slug}`} className="gal__card">
            <div className="gal__media">
              {coverOf(r)
                ? <img src={coverOf(r)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                : <span className="gal__ph"><MapPin size={20} /></span>}
              <span className="gal__badge">{r.placeCount} place{r.placeCount === 1 ? '' : 's'} · {r.days} day{r.days === 1 ? '' : 's'}</span>
              {flag && <span className="gal__flag" aria-hidden>{flag}</span>}
              {!!r.featured && <span className="gal__feat"><Star size={11} /> Featured</span>}
            </div>
            <div className="gal__body">
              <h2 className="gal__name">{r.title}</h2>
              <p className="gal__loc"><MapPin size={14} /> {r.regionNames?.length ? r.regionNames.slice(0, 2).join(', ') : 'Multiple regions'}</p>
              <p className="gal__foot">
                <span className="gal__avatar" aria-hidden>{(r.authorName || 'T').charAt(0)}</span>
                {r.authorName || 'a traveller'}
                {r.copies > 0 && <span className="gal__copies"> · copied {r.copies}×</span>}
              </p>
            </div>
          </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── a single published trip ───────────────────────────────────────────────────
export function GalleryTripScreen() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, configured, isDev, devSignIn } = useAuth()
  const [pub, setPub] = useState(undefined)   // undefined=loading, null=missing
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    let on = true
    api.gallery.get(slug).then((r) => on && setPub(r)).catch(() => on && setPub(null))
    return () => { on = false }
  }, [slug])

  useSeo({
    title: pub ? `${pub.title} — a ${pub.days}-day trip to copy` : 'Trip idea',
    description: pub?.story ? pub.story.slice(0, 155) : 'A real itinerary, planned day by day — copy it into your own planner.',
    path: `/gallery/${slug}`,
  })

  const snap = pub?.data
  const days = useMemo(() => {
    if (!snap) return []
    const by = new Map()
    for (const p of snap.places) {
      const k = p.day || 0
      if (!by.has(k)) by.set(k, [])
      by.get(k).push(p)
    }
    return [...by.entries()].sort(([a], [b]) => a - b)
  }, [snap])

  const markers = (snap?.places || []).filter((p) => p.lat && p.lng)
    .map((p) => ({ lng: p.lng, lat: p.lat, label: p.name }))
  const hasMapbox = !!import.meta.env.VITE_MAPBOX_TOKEN

  const copy = async () => {
    setCopying(true)
    try {
      const id = importGalleryTrip(snap)
      api.gallery.copied(slug).catch(() => {})   // best-effort counter
      navigate(paths.plan())
    } finally { setCopying(false) }
  }

  if (pub === undefined) return <div className="page wrap"><p className="account__empty" style={{ marginTop: 60 }}>Loading trip…</p></div>
  if (pub === null) return (
    <div className="page wrap">
      <p className="account__empty" style={{ marginTop: 60 }}>
        That trip isn't in the gallery (it may have been unpublished). <Link to="/gallery">Browse trip ideas</Link>.
      </p>
    </div>
  )

  return (
    <div className="page galtrip">
      <header className="sub-hero wrap">
        <p className="eyebrow">Trip idea · {pub.days} day{pub.days === 1 ? '' : 's'}</p>
        <h1 className="sub-hero__title">{pub.title}</h1>
        <p className="sub-hero__sub">
          {pub.placeCount} places · {(pub.regionNames || []).join(', ')} ·{' '}
          {pub.authorName ? `planned by ${pub.authorName}` : 'planned by a traveller'}
          {pub.copies > 0 && ` · copied ${pub.copies}×`}
        </p>
      </header>

      <div className="wrap">
        {pub.story && (
          <div className="story story--shared"><p className="story__text">{pub.story}</p></div>
        )}

        <div className="galtrip__cta">
          {user ? (
            <button className="btn btn--primary" onClick={copy} disabled={copying}>
              <Copy size={16} /> {copying ? 'Copying…' : 'Use this trip — copy it to my planner'}
            </button>
          ) : (
            <div className="gplan__signin">
              <p>Sign in to copy this trip into your own planner — dates, picks and all.</p>
              {configured ? <GoogleSignInButton />
                : isDev ? <button className="btn btn--primary" onClick={devSignIn}>Continue in dev mode</button>
                : null}
            </div>
          )}
          <span className="galtrip__hint">Copies start three weeks from today — shift the dates once it's yours.</span>
        </div>

        {hasMapbox && markers.length > 0 && (
          <div className="galtrip__map"><MapView height={320} markers={markers} /></div>
        )}

        <div className="gplan__days" style={{ marginTop: 20 }}>
          {days.map(([dayN, places]) => (
            <article key={dayN} className="gplan__day">
              <header>
                <b>{dayN === 0 ? 'Anytime' : `Day ${dayN}`}</b>
                {dayN !== 0 && snap.stays?.some((s) => s.fromDay && dayN >= s.fromDay && dayN <= (s.toDay || s.fromDay)) && (
                  <span className="galtrip__stay">
                    <BedDouble size={12} /> {snap.stays.find((s) => s.fromDay && dayN >= s.fromDay && dayN <= (s.toDay || s.fromDay)).name}
                  </span>
                )}
              </header>
              {places.map((p) => (
                <div key={`${p.regionId}/${p.placeId}`} className="gplan__place">
                  <h3><MapPin size={14} /> <Link to={paths.place(p.regionId, p.placeId, pub?.countryId || 'italy')}>{p.name}</Link>
                    <span className="galtrip__region">{p.regionName}</span></h3>
                  {p.note && <p className="galtrip__note">"{p.note}"</p>}
                  <ul>
                    {p.attractions.filter((a) => (a.day || null) === (p.day || null) || a.day === dayN).map((a) => (
                      <li key={a.id}><Compass size={12} /> {a.text}</li>
                    ))}
                    {p.restaurants.filter((r) => (r.day || null) === (p.day || null) || r.day === dayN).map((r) => (
                      <li key={r.id}><Utensils size={12} /> {r.name}{r.mustOrder ? ` — try the ${r.mustOrder}` : ''}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          ))}
        </div>

        <p className="galtrip__back"><Link to="/gallery"><ArrowLeft size={15} /> More trip ideas</Link></p>
      </div>
    </div>
  )
}
