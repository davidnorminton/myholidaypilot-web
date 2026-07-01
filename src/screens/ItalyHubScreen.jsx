import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { getHub } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import { useSeo } from '../lib/seo.js'

const EMOJI = { regions: '🗺️', festivals: '🎭', history: '🏛️', food: '🍝', transport: '🚆', plan: '🧭' }

export default function ItalyHubScreen() {
  const [sections, setSections] = useState(null)
  useSeo({ title: 'Italy travel guide', description: 'Everything to plan an Italy trip — the regions, festivals, food and how to get around.', path: '/italy' })
  useEffect(() => { getHub().then((d) => setSections(d.sections || [])).catch(() => setSections([])) }, [])

  return (
    <div className="page">
      <header className="hero">
        <div className="wrap hero__inner">
          <p className="eyebrow"><Link to={paths.destinations()} className="eyebrow__link">Destinations</Link> · Italy</p>
          <h1 className="hero__title">Italy</h1>
          <p className="hero__sub">Everything you need to plan it — the regions, the festivals, the food, and how to get around.</p>
        </div>
      </header>

      <main className="wrap">
        <div className="hub-grid">
          {(sections || []).map((s) => (
            <Link key={s.id} to={s.link} className="hub-card">
              <span className="hub-card__media" data-emoji={EMOJI[s.id] || '🇮🇹'}>
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
