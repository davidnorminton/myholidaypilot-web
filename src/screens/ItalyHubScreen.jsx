import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { getHub } from '../lib/data.js'
import { COUNTRIES, isAvailableCountry } from '../lib/countries.js'
import NotFoundScreen from './NotFoundScreen.jsx'
import { paths } from '../lib/paths.js'
import { useSeo } from '../lib/seo.js'

const EMOJI = { regions: '🗺️', festivals: '🎭', history: '🏛️', food: '🍝', transport: '🚆', plan: '🧭' }

export default function ItalyHubScreen() {
  const { country = 'italy' } = useParams()
  const meta = COUNTRIES.find((c) => c.slug === country)
  const [sections, setSections] = useState(null)
  useSeo({ title: `${meta?.name || 'Travel'} travel guide`, description: `Everything to plan a ${meta?.name || ''} trip — the regions, festivals, food and how to get around.`, path: `/${country}` })
  useEffect(() => {
    if (!isAvailableCountry(country)) return
    getHub(country).then((d) => setSections(d.sections || [])).catch(() => setSections([]))
  }, [country])

  if (!isAvailableCountry(country)) return <NotFoundScreen />

  return (
    <div className="page">
      <header className="hero">
        <div className="wrap hero__inner">
          <p className="eyebrow"><Link to={paths.destinations()} className="eyebrow__link">Destinations</Link> · {meta?.name}</p>
          <h1 className="hero__title">{meta?.name}</h1>
          <p className="hero__sub">Everything you need to plan it — the regions, the festivals, the food, and how to get around.</p>
        </div>
      </header>

      <main className="wrap">
        <div className="hub-grid">
          {(sections || []).map((s) => (
            <Link key={s.id} to={s.link} className="hub-card">
              <span className="hub-card__media" data-emoji={EMOJI[s.id] || meta?.flag || '🌍'}>
                {s.image && <img src={s.image} alt={s.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
              </span>
              <span className="hub-card__body">
                <span className="hub-card__title">{s.title}</span>
                <span className="hub-card__blurb">{s.blurb}</span>
                <span className="hub-card__go">Open <ArrowRight size={15} /></span>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
