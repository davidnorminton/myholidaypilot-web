import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { getHub, getIndex } from '../lib/data.js'
import { COUNTRIES, isAvailableCountry } from '../lib/countries.js'
import { createTrip, setActiveTrip } from '../lib/trips.js'
import NotFoundScreen from './NotFoundScreen.jsx'
import { paths } from '../lib/paths.js'
import { useSeo } from '../lib/seo.js'
import TripDetails from '../components/TripDetails.jsx'

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
  const { country = 'italy' } = useParams()
  const meta = COUNTRIES.find((c) => c.slug === country)
  const navigate = useNavigate()
  const [sections, setSections] = useState(null)
  const [details, setDetails] = useState(null)
  useSeo({ title: `${meta?.name || 'Travel'} travel guide`, description: `Everything to plan a ${meta?.name || ''} trip — the regions, festivals, food and how to get around.`, path: `/${country}` })
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

  return (
    <div className="page">
      <header className="hero">
        <div className="wrap">
          <p className="eyebrow"><Link to={paths.destinations()} className="eyebrow__link">Destinations</Link> · {meta?.name}</p>
          <h1 className="hero__title">{meta?.name}</h1>
          <p className="hero__sub">Everything you need to plan it — the regions, the festivals, the food, and how to get around.</p>
        </div>
      </header>

      <main className="wrap">
        <TripDetails details={details} title={`Plan your trip to ${meta?.name || ''}`} />
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
                <span className="hub-card__go">View all <ArrowRight size={15} /></span>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
