import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { MapPin, Copy, Compass, Utensils, BedDouble, ArrowLeft, Star,  } from 'lucide-react'
import { api } from '../lib/api.js'
import { getImages } from '../lib/data.js'
import { COUNTRIES } from '../lib/countries.js'
import { importGalleryTrip } from '../lib/trips.js'
import { useAuth, GoogleSignInButton } from '../lib/auth.jsx'
import MapView from '../components/MapView.jsx'
import SmartImage from '../components/SmartImage.jsx'
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
  useSeo({
    title: 'Trip ideas — real itineraries to copy',
    description: 'Real trips, planned day by day by real travellers — browse by region and length, then copy one into your own planner.',
    path: '/trip-ideas',
  })
  const [country, setCountry] = useState('all')
  const [rows, setRows] = useState(null)
  const [images, setImages] = useState({})
  const [region, setRegion] = useState('all')
  const [len, setLen] = useState('any')

  useEffect(() => {
    setRows(null)
    api.gallery.list(country === 'all' ? undefined : country).then(async (list) => {
      setRows(list)
      // Cover images come from each country's images.json (regionId → placeId
      // → [{url}]), the same source place pages use. The places-index doesn't
      // carry images, so it can't be the lookup.
      const slugs = country === 'all'
        ? [...new Set((list || []).map((r) => r.countryId).filter(Boolean))]
        : [country]
      slugs.forEach((slug) => getImages(slug).then((all) => {
        const m = {}
        for (const [regionId, places] of Object.entries(all || {})) {
          for (const [placeId, arr] of Object.entries(places || {})) {
            const u = arr?.[0]?.url
            if (u) m[`${regionId}/${placeId}`] = u
          }
        }
        setImages((prev) => ({ ...prev, ...m }))
      }).catch(() => {}))
    }).catch(() => setRows([]))
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
        <div className="gq__row gq__row--inline">
          <label className="gq__select gq__select--bare">
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="all">🌍 All destinations</option>
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
      </header>

      <div className="gal__filters">
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
          <Link key={r.id} to={`/trip-ideas/${r.slug}`} className="gal__card">
            <div className="gal__media">
              {coverOf(r)
                ? <SmartImage src={coverOf(r)} alt="" width={300} />
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
    path: `/trip-ideas/${slug}`,
  })

  const snap = pub?.data
  // A place belongs to every day it has dated picks on (the planner's
  // day-by-day model hangs a whole trip off one base place), plus its own day.
  const days = useMemo(() => {
    if (!snap) return []
    const itemsFor = (p, d) => ({
      attractions: (p.attractions || []).filter((a) => a.day === d || (!a.day && (p.day || null) === d)),
      restaurants: (p.restaurants || []).filter((r) => r.day === d || (!r.day && (p.day || null) === d)),
    })
    const total = Math.min(60, Math.max(1, snap.days || 1, ...snap.places.map((p) => p.day || 0)))
    const out = []
    for (let d = 1; d <= total; d++) {
      const entries = snap.places
        .map((p) => ({ p, it: itemsFor(p, d) }))
        .filter(({ p, it }) => p.day === d || it.attractions.length || it.restaurants.length)
      out.push([d, entries])
    }
    const anytime = snap.places
      .map((p) => ({ p, it: itemsFor(p, null) }))
      .filter(({ p, it }) => !p.day && (it.attractions.length || it.restaurants.length ||
        ((p.attractions || []).length === 0 && (p.restaurants || []).length === 0)))
    if (anytime.length) out.push([0, anytime])
    return out
  }, [snap])

  const markers = (snap?.places || []).filter((p) => p.lat && p.lng)
    .map((p) => ({ lng: p.lng, lat: p.lat, label: p.name }))
  const hasMapbox = !!import.meta.env.VITE_MAPBOX_TOKEN

  const copy = async () => {
    setCopying(true)
    try {
      importGalleryTrip(snap)
      api.gallery.copied(slug).catch(() => {})   // best-effort counter
      navigate(paths.plan())
    } finally { setCopying(false) }
  }

  if (pub === undefined) return <div className="page wrap"><p className="account__empty" style={{ marginTop: 60 }}>Loading trip…</p></div>
  if (pub === null) return (
    <div className="page wrap">
      <p className="account__empty" style={{ marginTop: 60 }}>
        That trip isn't in the gallery (it may have been unpublished). <Link to="/trip-ideas">Browse trip ideas</Link>.
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
              {snap.dayNotes?.[dayN] && <p className="galtrip__daynote">“{snap.dayNotes[dayN]}”</p>}
              {places.length === 0 && <p className="galtrip__free">Free day — nothing planned.</p>}
              {places.map(({ p, it }) => (
                <div key={`${p.regionId}/${p.placeId}`} className="gplan__place">
                  <h3><MapPin size={14} /> <Link to={paths.place(p.regionId, p.placeId, pub?.countryId || 'italy')}>{p.name}</Link>
                    <span className="galtrip__region">{p.regionName}</span></h3>
                  {p.note && <p className="galtrip__note">"{p.note}"</p>}
                  <ul>
                    {it.attractions.map((a) => (
                      <li key={a.id}><Compass size={12} /> {a.text}</li>
                    ))}
                    {it.restaurants.map((r) => (
                      <li key={r.id}><Utensils size={12} /> {r.name}{r.mustOrder ? ` — try the ${r.mustOrder}` : ''}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          ))}
        </div>

        <p className="galtrip__back"><Link to="/trip-ideas"><ArrowLeft size={15} /> More trip ideas</Link></p>
      </div>
    </div>
  )
}
