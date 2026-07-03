import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, CalendarRange, Navigation } from 'lucide-react'
import { getRegion, getImages } from '../lib/data.js'
import { regionColour, mapsQuery } from '../lib/format.js'
import { paths, COUNTRY } from '../lib/paths.js'
import MapView from '../components/MapView.jsx'
import PlaceCard from '../components/PlaceCard.jsx'
import { PageLoader } from '../components/Loading.jsx'
import AffiliateSection from '../components/AffiliateSection.jsx'
import AdSlot from '../components/AdSlot.jsx'
import CommentsSection from '../components/CommentsSection.jsx'
import { useSeo } from '../lib/seo.js'
import { useSettings } from '../lib/settings.js'
import BeenHereButton from '../components/BeenHereButton.jsx'
import { useAffiliates, regionOffers } from '../lib/affiliates.js'

const TABS = [
  { id: 'places', label: 'Places to visit' },
  { id: 'eat', label: 'Where to eat' },
  { id: 'about', label: 'About' },
]

export default function RegionDetailScreen() {
  const site = useSettings()
  const { regionId } = useParams()
  const navigate = useNavigate()
  const aff = useAffiliates()
  const [region, setRegion] = useState(null)
  const [images, setImages] = useState({})
  const [tab, setTab] = useState('places')

  useEffect(() => {
    let live = true
    getRegion(regionId).then((d) => live && setRegion(d)).catch(() => live && setRegion(false))
    getImages().then((d) => live && setImages(d?.[regionId] || {})).catch(() => {})
    return () => { live = false }
  }, [regionId])

  const accent = useMemo(() => regionColour(region?.colour), [region])

  useSeo({
    title: region ? region.name : undefined,
    description: region ? `${region.name}${region.nameIt && region.nameIt !== region.name ? ` (${region.nameIt})` : ''} — towns, restaurants and things to do across ${region.places?.length || 0} places.` : undefined,
    path: `/italy/${regionId}`,
    image: region ? (site[`regionHero.${regionId}`] || (region.places || []).map((pl) => images[pl.id]?.[0]?.url).find(Boolean)) : undefined,
  })

  if (region === null) return <PageLoader label="Opening region" />
  if (region === false) return <NotFound />

  return (
    <div className="page" style={{ '--accent': accent }}>
      <div className={`rd-hero ${site[`regionHero.${regionId}`] ? 'rd-hero--img' : ''}`}>
        {site[`regionHero.${regionId}`] && <>
          <img className="rd-hero__bg" src={site[`regionHero.${regionId}`]} alt="" />
          <div className="rd-hero__veil" />
        </>}
        <div className="wrap">
          <Link to={paths.country()} className="back"><ArrowLeft size={17} /> All regions</Link>
          <div className="rd-hero__head">
            <span className="rd-hero__emoji" aria-hidden>{region.emoji}</span>
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
                    onClick: () => navigate(paths.place(regionId, p.id)),
                  }))}
              />
            )}
            <div className="grid grid--places">
              {(region.places || []).map((p, i) => (
                <PlaceCard key={p.id} regionId={regionId} place={p} image={images[p.id]?.[0]?.url} number={i + 1} />
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
                  <a className="resto__map" href={mapsQuery([r.name, r.address || r.neighbourhood, region.name, 'Italy'])}
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

        <AdSlot format="leaderboard" slot="region-leaderboard" />

        <CommentsSection countryId={COUNTRY} targetType="region" regionId={regionId} areaName={region.name} />
      </main>
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
