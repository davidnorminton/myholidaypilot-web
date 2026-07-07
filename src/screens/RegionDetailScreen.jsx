import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, CalendarRange, Navigation } from 'lucide-react'
import { getRegion } from '../lib/data.js'
import { COUNTRIES } from '../lib/countries.js'
import { regionColour, mapsQuery } from '../lib/format.js'
import { paths } from '../lib/paths.js'
import { imgUrl } from '../lib/imgUrl.js'
import MapView from '../components/MapView.jsx'
import PlaceCard from '../components/PlaceCard.jsx'
import { PageLoader } from '../components/Loading.jsx'
import AffiliateSection from '../components/AffiliateSection.jsx'
import CommentsSection from '../components/CommentsSection.jsx'
import { useSeo } from '../lib/seo.js'
import { useSettings } from '../lib/settings.js'
import BeenHereButton from '../components/BeenHereButton.jsx'
import TripDetails from '../components/TripDetails.jsx'
import { useAffiliates, regionOffers } from '../lib/affiliates.js'

const TABS = [
  { id: 'places', label: 'Places to visit' },
  { id: 'eat', label: 'Where to eat' },
  { id: 'about', label: 'About' },
]

export default function RegionDetailScreen() {
  const site = useSettings()
  const { country = 'italy', regionId } = useParams()
  const countryName = (COUNTRIES.find((c) => c.slug === country) || {}).name || ''
  const navigate = useNavigate()
  const aff = useAffiliates()
  const [region, setRegion] = useState(null)
  const [tab, setTab] = useState('places')

  useEffect(() => {
    let live = true
    // Region file now carries each place's image (baked at build time) and the
    // region's own hero — so the place cards render from this single fetch, no
    // separate whole-country image download.
    getRegion(regionId, country).then((d) => live && setRegion(d)).catch(() => live && setRegion(false))
    return () => { live = false }
  }, [regionId, country])

  const accent = useMemo(() => regionColour(region?.colour), [region])

  // Region hero image: explicit admin override, else the first place in the
  // region that has an image (baked into place.image at build time).
  const heroImage = useMemo(() => {
    if (!region) return null
    return site[`regionHero.${regionId}`]
      || region.heroImage?.url
      || (region.places || []).map((p) => p.image).find(Boolean)
      || null
  }, [region, site, regionId])

  useSeo({
    title: region ? `Things to do in ${region.name} — places, food & trip ideas` : undefined,
    description: region ? `${region.name}${region.nameIt && region.nameIt !== region.name ? ` (${region.nameIt})` : ''} — towns, restaurants and things to do across ${region.places?.length || 0} places.` : undefined,
    path: `/${country}/${regionId}`,
    image: heroImage || undefined,
  })

  if (region === null) return <PageLoader label="Opening region" />
  if (region === false) return <NotFound />

  return (
    <div className="page" style={{ '--accent': accent }}>
      <div className={`rd-hero ${heroImage ? 'rd-hero--img' : ''}`}>
        {heroImage && <>
          <img className="rd-hero__bg" src={imgUrl(heroImage, 1600)} alt={region.name} loading="eager" fetchPriority="high" decoding="async" />
          <div className="rd-hero__veil" />
        </>}
        <div className="wrap">
          <Link to={paths.country(country)} className="back"><ArrowLeft size={17} /> All regions</Link>
          <div className="rd-hero__head">
            <div>
              <h1 className="rd-hero__name">{region.name} <BeenHereButton regionId={regionId} /></h1>
              <p className="rd-hero__meta">
                <span><MapPin size={14} /> {region.capital}</span>
                {region.bestTimeToVisit && (
                  <span className="rd-hero__when"><CalendarRange size={14} /> {shortBestTime(region.bestTimeToVisit)}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={heroImage ? 'rd-sheet' : ''}>
      <div className="wrap"><TripDetails details={region.details} title={`Plan your trip to ${region.name}`} /></div>
      <nav className="tabs wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'tab--on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'places' && <span className="tab__count">{region.places?.length || 0}</span>}
            {t.id === 'eat' && <span className="tab__count">{region.restaurants?.length || 0}</span>}
          </button>
        ))}
      </nav>

      <main className="wrap rd-body">
        {tab === 'places' && (
          <>
            {region.places?.some((p) => p.lat && p.lng) && (
              <MapView
                height={300}
                center={[region.lng, region.lat]}
                zoom={8}
                markers={(region.places || [])
                  .map((p, i) => ({ ...p, n: i + 1 }))
                  .filter((p) => p.lat && p.lng)
                  .map((p) => ({
                    lng: p.lng, lat: p.lat, number: p.n, label: `${p.n}. ${p.name}`, color: accent,
                    onClick: () => navigate(paths.place(regionId, p.id, country)),
                  }))}
              />
            )}
            <div className="grid grid--places">
              {(region.places || []).map((p, i) => (
                <PlaceCard key={p.id} regionId={regionId} country={country} place={p} image={p.image} number={i + 1} index={i} />
              ))}
            </div>
          </>
        )}

        {tab === 'eat' && (
          <>
            {region.restaurants?.some((r) => r.lat && r.lng) && (
              <MapView
                height={300}
                center={[region.lng, region.lat]}
                zoom={8}
                markers={(region.restaurants || [])
                  .map((r, i) => ({ ...r, n: i + 1 }))
                  .filter((r) => r.lat && r.lng)
                  .map((r) => ({ lng: r.lng, lat: r.lat, number: r.n, label: `${r.n}. ${r.name}`, color: accent }))}
              />
            )}
            <div className="eat">
              {(region.restaurants || []).map((r, i) => (
                <article key={r.id} className="resto">
                  <div className="resto__top">
                    <h3 className="resto__name">{r.name}</h3>
                    <div className="resto__tr">
                      {r.priceRange && <span className="resto__price">{r.priceRange}</span>}
                      <span className="resto__num" aria-hidden>{i + 1}</span>
                    </div>
                  </div>
                  <p className="resto__meta">{r.cuisine}{r.neighbourhood ? ` · ${r.neighbourhood}` : ''}</p>
                  <p className="resto__desc">{r.description}</p>
                  {r.mustOrder && <p className="resto__order"><b>Must order</b> — {r.mustOrder}</p>}
                  <a className="resto__map" href={mapsQuery([r.name, r.address || r.neighbourhood, region.name, countryName])}
                     target="_blank" rel="noreferrer">
                    <Navigation size={13} /> Directions
                  </a>
                </article>
              ))}
              {(!region.restaurants || region.restaurants.length === 0) && (
                <p className="empty">No restaurants listed for {region.name} yet.</p>
              )}
            </div>
          </>
        )}

        {tab === 'about' && (
          <div className="about">
            <AboutBlock title="History" text={region.history} />
            <AboutBlock title="Culture & traditions" text={region.culturalNotes} />
            <AboutBlock title="Language & dialect" text={region.languageNotes} />
            <AboutBlock title="Best time to visit" text={region.bestTimeToVisit} />
            {aff && (
              <AffiliateSection
                title={`Plan your trip to ${region.name}`}
                offers={regionOffers(aff, { regionId, regionName: region.name, capital: region.capital })}
              />
            )}
          </div>
        )}

        <CommentsSection countryId={country} targetType="region" regionId={regionId} areaName={region.name} />
      </main>
      </div>
    </div>
  )
}

function AboutBlock({ title, text }) {
  if (!text) return null
  return (
    <section className="about__block">
      <h3 className="about__title">{title}</h3>
      <p className="about__text">{text}</p>
    </section>
  )
}

function shortBestTime(t) {
  const m = t.match(/(?:Visit from |Visit )?([A-Z][a-z]+(?: to [A-Z][a-z]+)?(?: or [A-Z][a-z]+(?: to [A-Z][a-z]+)?)?)/)
  return m ? m[1] : t.split('.')[0]
}

function NotFound() {
  return (
    <div className="page wrap">
      <Link to="/" className="back" style={{ marginTop: 24 }}><ArrowLeft size={17} /> All regions</Link>
      <p className="empty">That region could not be found.</p>
    </div>
  )
}
