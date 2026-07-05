import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { COUNTRIES } from '../lib/countries.js'
import { paths } from '../lib/paths.js'
import PageHero from '../components/PageHero.jsx'

// Continent grouping for the filter — a country not listed falls under "Other".
const CONTINENT = {
  italy: 'Europe', spain: 'Europe', portugal: 'Europe', france: 'Europe', greece: 'Europe',
  united_kingdom: 'Europe', germany: 'Europe', netherlands: 'Europe', norway: 'Europe',
  poland: 'Europe', sweden: 'Europe', switzerland: 'Europe', ireland: 'Europe', austria: 'Europe',
  belgium: 'Europe', denmark: 'Europe', finland: 'Europe', iceland: 'Europe', croatia: 'Europe',
  united_states: 'Americas', canada: 'Americas', mexico: 'Americas', brazil: 'Americas', argentina: 'Americas',
  japan: 'Asia', china: 'Asia', thailand: 'Asia', vietnam: 'Asia', south_korea: 'Asia', india: 'Asia',
  indonesia: 'Asia', singapore: 'Asia', malaysia: 'Asia',
  australia: 'Oceania', new_zealand: 'Oceania',
  morocco: 'Africa', egypt: 'Africa', south_africa: 'Africa', kenya: 'Africa', tanzania: 'Africa',
}
const continentOf = (slug) => CONTINENT[slug] || 'Other'

export default function CountriesScreen() {
  const live = useMemo(() => COUNTRIES.filter((c) => c.available).sort((a, b) => a.name.localeCompare(b.name)), [])
  const continents = useMemo(() => {
    const set = [...new Set(live.map((c) => continentOf(c.slug)))]
    const order = ['Europe', 'Americas', 'Asia', 'Oceania', 'Africa', 'Other']
    return set.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }, [live])
  const [filter, setFilter] = useState('all')

  const shown = filter === 'all' ? live : live.filter((c) => continentOf(c.slug) === filter)

  return (
    <div className="page">
      <PageHero id="destinations" eyebrow="myholidaypilot" title="Destinations" emoji="🗺️"
        sub="Pick where to wander — every country mapped region by region." />
      <main className="wrap">
        {continents.length > 1 && (
          <div className="dest-filter">
            <label className="gq__select">
              <span className="gq__selectlabel">Region</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All destinations ({live.length})</option>
                {continents.map((cont) => (
                  <option key={cont} value={cont}>{cont}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="dest-grid">
          {shown.map((c) => (
            <Link key={c.slug} to={paths.country(c.slug)} className="dcard">
              <span className="dcard__flag">{c.flag}</span>
              <span className="dcard__name">{c.name}</span>
              <ArrowRight size={17} className="dcard__go" />
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
