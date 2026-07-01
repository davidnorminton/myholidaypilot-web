import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { COUNTRIES } from '../lib/countries.js'
import { paths } from '../lib/paths.js'

export default function CountriesScreen() {
  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow">myholidaypilot</p>
        <h1 className="sub-hero__title">Destinations</h1>
        <p className="sub-hero__sub">One country today, more on the way. Pick where to wander.</p>
      </header>
      <main className="wrap">
        <div className="grid grid--dest">
          {COUNTRIES.map((c) =>
            c.available ? (
              <Link key={c.slug} to={paths.country(c.slug)} className="ccard ccard--on">
                <span className="ccard__flag">{c.flag}</span>
                <h2 className="ccard__name">{c.name}</h2>
                <p className="ccard__blurb">{c.blurb}</p>
                <span className="ccard__go">Explore <ArrowRight size={16} /></span>
              </Link>
            ) : (
              <div key={c.slug} className="ccard ccard--soon">
                <span className="ccard__flag">{c.flag}</span>
                <h2 className="ccard__name">{c.name}</h2>
                <span className="ccard__badge">Coming soon</span>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  )
}
