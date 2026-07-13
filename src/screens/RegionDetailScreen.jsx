import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, CalendarRange, Navigation } from 'lucide-react'
import { getRegion } from '../lib/data.js'
import { COUNTRIES } from '../lib/countries.js'
import { regionColour, mapsQuery } from '../lib/format.js'
import { paths } from '../lib/paths.js'
import { imgUrl } from '../lib/imgUrl.js'
import MapView from '../components/MapView.jsx'
import PlaceCard from '../components/PlaceCard.jsx'
import PlacePlaceholder from '../components/PlacePlaceholder.jsx'
import { PageLoader } from '../components/Loading.jsx'
import AffiliateSection from '../components/AffiliateSection.jsx'
import CommentsSection from '../components/CommentsSection.jsx'
import { useSeo } from '../lib/seo.js'
import BeenHereButton from '../components/BeenHereButton.jsx'
import TripDetails from '../components/TripDetails.jsx'
import ViatorTours from '../components/ViatorTours.jsx'
import { useAffiliates, regionOffers } from '../lib/affiliates.js'

const TABS = [
  { id: 'places', label: 'Places to visit' },
  { id: 'do', label: 'Things to do' },
  { id: 'plan', label: 'Plan your trip' },
  { id: 'eat', label: 'Where to eat' },
  { id: 'about', label: 'About' },
]

export default function RegionDetailScreen() {
  const { country = 'italy', regionId } = useParams()
  const countryName = (COUNTRIES.find((c) => c.slug === country) || {}).name || ''
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
    return region.heroImage?.url
      || (region.places || []).map((p) => p.image).find(Boolean)
      || null
  }, [region, regionId])

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
      <header className={`sub-hero wrap plan-hero plan-hero--bleed place-hero ${heroImage ? '' : 'place-hero--noimg'}`}>
        <div className="plan-hero__text">
          <Link to={paths.country(country)} className="place-hero__crumb">
            <ArrowLeft size={15} /> All {countryName} regions
          </Link>
          <h1 className="sub-hero__title">{region.name}</h1>
          {region.nameIt && region.nameIt !== region.name && <p className="place-hero__alt">{region.nameIt}</p>}
          <p className="place-hero__meta">
            <span><MapPin size={15} /> {region.capital}</span>
            {region.bestTimeToVisit && <span><CalendarRange size={15} /> {shortBestTime(region.bestTimeToVisit)}</span>}
          </p>
          {region.details?.intro && <p className="sub-hero__sub">{region.details.intro}</p>}
          <div className="place-hero__actions">
            <BeenHereButton regionId={regionId} countryId={country} className="pd-action" />
          </div>
        </div>
        <div className="plan-hero__media">
          {heroImage ? (
            <img src={imgUrl(heroImage, 800)} alt={region.name} loading="eager" fetchpriority="high" decoding="async"
              onError={(e) => { const m = e.currentTarget.closest('.plan-hero__media'); if (m) m.remove() }} />
          ) : (
            <PlacePlaceholder iconSize={56} />
          )}
        </div>
      </header>

      <div className="pd-sheet">
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
          <div className="grid grid--places">
            {(region.places || []).map((p, i) => (
              <PlaceCard key={p.id} regionId={regionId} country={country} place={p} image={p.image} index={i} />
            ))}
          </div>
        )}

        {tab === 'do' && (
          <ViatorTours country={country} regionId={regionId} name={region.name} embedded />
        )}

        {tab === 'plan' && (
          <TripDetails details={region.details} title={`Plan your trip to ${region.name}`} />
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
            {[
              { title: 'History', text: region.history },
              { title: 'Culture & traditions', text: region.culturalNotes },
              { title: 'Language & dialect', text: region.languageNotes },
              { title: 'Best time to visit', text: region.bestTimeToVisit },
            ].filter((b) => b.text).map((b, i) => (
              <AboutBlock key={b.title} title={b.title} text={b.text} index={i} />
            ))}
          </div>
        )}

        {aff && (
          <AffiliateSection
            title={`Plan your trip to ${region.name}`}
            offers={regionOffers(aff, { regionId, regionName: region.name, capital: region.capital })}
          />
        )}

        <CommentsSection countryId={country} targetType="region" regionId={regionId} areaName={region.name} />
      </main>
      </div>
    </div>
  )
}

// Hub-card palette, reused for the About title panels.
const ABOUT_BG = ['#fe9ee8', '#fecf1e', '#87d2fe', '#9ee8a4', '#fec89e', '#c3a9fe']

function AboutBlock({ title, text, index = 0 }) {
  if (!text) return null
  return (
    <section className={`about__block ${index % 2 === 1 ? 'about__block--flip' : ''}`}>
      <div className="about__panel" style={{ background: ABOUT_BG[index % ABOUT_BG.length] }}>
        <h3 className="about__title">{title}</h3>
      </div>
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
