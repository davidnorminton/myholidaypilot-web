import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { getHub, getIndex } from '../lib/data.js'
import { COUNTRIES, isAvailableCountry } from '../lib/countries.js'
import { createTrip, setActiveTrip } from '../lib/trips.js'
import NotFoundScreen from './NotFoundScreen.jsx'
import { paths } from '../lib/paths.js'
import { useSettings } from '../lib/settings.js'
import { imgUrl } from '../lib/imgUrl.js'
import PlacePlaceholder from '../components/PlacePlaceholder.jsx'
import { useSeo } from '../lib/seo.js'
import TripDetails from '../components/TripDetails.jsx'
import BlogCarousel from '../components/BlogCarousel.jsx'

// Solid card colours (David's design). Falls back to the cycle for any extra
// or custom hub ids.
const CARD_BG = { regions: '#fe9ee8', festivals: '#fecf1e', history: '#87d2fe', food: '#9ee8a4', transport: '#fec89e', plan: '#c3a9fe' }
const BG_CYCLE = ['#fe9ee8', '#fecf1e', '#87d2fe', '#9ee8a4', '#fec89e', '#c3a9fe']

// If a country's hub.json is missing (or empty), fall back to the standard
// six cards so the page never renders blank.
const defaultSections = (country) => ([
  { id: 'regions', title: 'Regions', blurb: 'Every region — their towns, tables and stories.', link: `/${country}/regions`, image: '' },
  { id: 'festivals', title: 'Festivals & events', blurb: 'Celebrations and events, month by month.', link: `/${country}/festivals`, image: '' },
  { id: 'history', title: 'History', blurb: 'How the country came to be.', link: `/${country}/history`, image: '' },
  { id: 'food', title: 'Food & wine', blurb: 'What to order, region by region.', link: `/${country}/food`, image: '' },
  { id: 'transport', title: 'Getting around', blurb: 'Trains, driving and how to move around.', link: `/${country}/transport`, image: '' },
  { id: 'plan', title: 'Plan a trip', blurb: 'Save places and build a day-by-day itinerary.', link: '/plan', image: '' },
])

export default function ItalyHubScreen() {
  const site = useSettings()
  const { country = 'italy' } = useParams()
  const meta = COUNTRIES.find((c) => c.slug === country)
  const navigate = useNavigate()
  const [sections, setSections] = useState(null)
  const [details, setDetails] = useState(null)
  const [top10, setTop10] = useState(null)
  useSeo({ title: `${meta?.name || 'Travel'} travel guide`, description: `Everything to plan a ${meta?.name || ''} trip — the regions, festivals, food and how to get around.`, path: `/${country}` })
  useEffect(() => {
    let live = true
    getIndex(country).then((idx) => { if (live && Array.isArray(idx?.top10) && idx.top10.length) setTop10(idx.top10) }).catch(() => {})
    return () => { live = false }
  }, [country])

  useEffect(() => {
    if (!isAvailableCountry(country)) return
    getHub(country).then((d) => {
      const secs = d.sections || []
      setSections(secs.length ? secs : defaultSections(country))
    }).catch(() => setSections(defaultSections(country)))
    getIndex(country).then((d) => setDetails(d?.details || null)).catch(() => setDetails(null))
  }, [country])

  if (!isAvailableCountry(country)) return <NotFoundScreen />

  // The "Plan a trip" card starts a fresh trip based here — named for the
  // country — and drops you straight into the planner.
  const startPlanning = () => {
    const id = createTrip(`My trip to ${meta?.name || 'my destination'}`, country)
    setActiveTrip(id)
    navigate(paths.plan())
  }

  const countryHero = site[`countryHero.${country}`] || ''
  const facts = (() => {
    try { return JSON.parse(site[`countryFacts.${country}`] || 'null') } catch { return null }
  })()
  const FACT_ORDER = [['capital', 'Capital'], ['languages', 'Languages'], ['currency', 'Currency'],
    ['timezone', 'Timezone'], ['plugs', 'Plugs'], ['emergency', 'Emergency']]
  const factRows = FACT_ORDER.filter(([k]) => (facts?.[k] || '').trim())

  return (
    <div className="page">
      <header className={`sub-hero wrap plan-hero plan-hero--bleed place-hero ${factRows.length ? 'place-hero--flush' : ''} ${countryHero ? '' : 'place-hero--noimg'}`}>
        <div className="plan-hero__text">
          <Link to={paths.destinations()} className="place-hero__crumb"><ArrowLeft size={15} /> All destinations</Link>
          <h1 className="sub-hero__title">{meta?.name}</h1>
          <p className="sub-hero__sub">Everything you need to plan it — the regions, the festivals, the food, and how to get around.</p>
        </div>
        <div className="plan-hero__media">
          {countryHero ? (
            <img src={imgUrl(countryHero, 800)} alt={meta?.name} loading="eager" fetchpriority="high" decoding="async"
              onError={(e) => { const m = e.currentTarget.closest('.plan-hero__media'); if (m) m.remove() }} />
          ) : (
            <PlacePlaceholder iconSize={56} />
          )}
        </div>
      </header>

      {factRows.length > 0 && (
        <section className="cfacts-band">
          <dl className="cfacts wrap">
            {factRows.map(([k, label]) => (
              <div key={k} className="cfacts__item">
                <dt>{label}</dt>
                <dd>{facts[k]}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <BlogCarousel countryName={meta?.name || ''} title={`Reading about ${meta?.name || 'this country'}`} />

      <main className="wrap">
        <div className="hub-grid">
          {(sections || []).map((s, i) => (
            <Link
              key={s.id}
              to={s.id === 'plan' ? paths.plan() : s.link}
              onClick={s.id === 'plan' ? (e) => { e.preventDefault(); startPlanning() } : undefined}
              className="hub-card"
              style={{ background: CARD_BG[s.id] || BG_CYCLE[i % BG_CYCLE.length] }}
            >
              <span className="hub-card__body">
                <span className="hub-card__title">{s.title}</span>
                <span className="hub-card__blurb">{s.blurb}</span>
                <span className="hub-card__go">{s.id === 'plan' ? 'Plan your trip' : 'View all'} <ArrowRight size={15} /></span>
              </span>
            </Link>
          ))}
        </div>
        {top10 && (
          <section className="top10">
            <h2 className="top10__title">Top 10 places in {meta?.name || 'this country'}</h2>
            <p className="top10__sub">The most visited — ranked.</p>
            <ol className="top10__list">
              {top10.map((t) => (
                <li key={t.rank}>
                  <Link className="top10__item" to={paths.place(t.regionId, t.placeId, country)}>
                    <span className="top10__rank">{t.rank}</span>
                    {t.image && <img className="top10__img" src={imgUrl(t.image, 400)} alt="" loading="lazy" />}
                    <span className="top10__body">
                      <span className="top10__name">{t.name}</span>
                      <span className="top10__region">{t.regionName}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <TripDetails details={details} title={`Plan your trip to ${meta?.name || ''}`} />
      </main>
    </div>
  )
}
