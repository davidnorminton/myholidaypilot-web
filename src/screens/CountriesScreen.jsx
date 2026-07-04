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
        <p className="sub-hero__sub">Pick where to wander — every country mapped region by region.</p>
      </header>
      <main className="wrap">
        <div className="grid grid--dest">
          {COUNTRIES.filter((c) => c.available).map((c) => (
            <Link key={c.slug} to={paths.country(c.slug)} className="ccard ccard--on">
              <span className="ccard__flag">{c.flag}</span>
              <h2 className="ccard__name">{c.name}</h2>
              <p className="ccard__blurb">{c.blurb}</p>
              <span className="ccard__go">Explore <ArrowRight size={16} /></span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
