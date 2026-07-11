import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { COUNTRIES } from '../lib/countries.js'
import { paths } from '../lib/paths.js'
import PageHero from '../components/PageHero.jsx'
import SmartImage from '../components/SmartImage.jsx'
import PlacePlaceholder from '../components/PlacePlaceholder.jsx'
import { useSettings } from '../lib/settings.js'

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


// Ordered by international tourist arrivals (most-visited first) — same basis
// as the landing page's top destinations. Unlisted countries sort last.
const VISIT_RANK = {
  france: 1, spain: 2, united_states: 3, italy: 4, united_kingdom: 6,
  germany: 7, greece: 9, japan: 11, portugal: 14, netherlands: 15,
  poland: 16, switzerland: 18, sweden: 22, norway: 24, south_korea: 25,
}
const visitRank = (slug) => VISIT_RANK[slug] ?? 999

export default function CountriesScreen() {
  const site = useSettings()
  const live = useMemo(() => COUNTRIES.filter((c) => c.available).sort((a, b) => a.name.localeCompare(b.name)), [])
  const continents = useMemo(() => {
    const set = [...new Set(live.map((c) => continentOf(c.slug)))]
    const order = ['Europe', 'Americas', 'Asia', 'Oceania', 'Africa', 'Other']
    return set.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }, [live])
  const [filter, setFilter] = useState('all')
  const top10 = live.slice().sort((a, b) => visitRank(a.slug) - visitRank(b.slug)).slice(0, 10)

  const shown = filter === 'all' ? live : live.filter((c) => continentOf(c.slug) === filter)

  // Hero mosaic: the top destinations that have a country image set. Falls
  // back to the page's static hero image until at least 4 exist.
  const mosaic = useMemo(() => {
    const ordered = live.slice().sort((a, b) => visitRank(a.slug) - visitRank(b.slug))
    return ordered.filter((c) => site[`countryHero.${c.slug}`]).slice(0, 5)
  }, [live, site])

  return (
    <div className="page">
      <PageHero id="destinations" eyebrow="myholidaypilot" title="Destinations" emoji="🗺️" bleed
        sub="Pick where to wander — every country mapped region by region."
        media={mosaic.length >= 4 ? (
          <div className={`destmosaic ${mosaic.length >= 5 ? 'is-5' : 'is-4'}`} aria-label="Explore top destinations">
            {mosaic.map((c, i) => (
              <Link key={c.slug} to={paths.country(c.slug)} className="destmosaic__tile" style={{ gridArea: 'abcde'[i] }}>
                <SmartImage src={site[`countryHero.${c.slug}`]} alt={c.name} width={i === 0 ? 500 : 300} priority={i < 3} />
                <span className="destmosaic__name">{c.flag} {c.name}</span>
              </Link>
            ))}
          </div>
        ) : null} />
      <main className="wrap">
        {top10.length >= 4 && (
          <section className="desttop">
            <h2 className="desttop__title">Top destinations</h2>
            <div className="desttop__cols">
              <ol className="desttop__list" start={1}>
                {top10.slice(0, 5).map((c, i) => (
                  <li key={c.slug}>
                    <Link to={paths.country(c.slug)} className="desttop__row">
                      <span className="desttop__rank">{i + 1}</span>
                      <span className="desttop__flag">{c.flag}</span>
                      <span className="desttop__name">{c.name}</span>
                      <ArrowRight size={16} className="desttop__go" />
                    </Link>
                  </li>
                ))}
              </ol>
              <ol className="desttop__list" start={6}>
                {top10.slice(5, 10).map((c, i) => (
                  <li key={c.slug}>
                    <Link to={paths.country(c.slug)} className="desttop__row">
                      <span className="desttop__rank">{i + 6}</span>
                      <span className="desttop__flag">{c.flag}</span>
                      <span className="desttop__name">{c.name}</span>
                      <ArrowRight size={16} className="desttop__go" />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
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
          {shown.map((c, i) => {
            const hero = site[`countryHero.${c.slug}`] || ''
            return (
              <Link key={c.slug} to={paths.country(c.slug)} className="dcard">
                <span className="dcard__media">
                  {hero ? <SmartImage src={hero} alt={c.name} width={320} priority={i < 4} /> : <PlacePlaceholder />}
                </span>
                <span className="dcard__kicker">{c.flag} {c.continent || 'Destination'}</span>
                <span className="dcard__name">{c.name}</span>
                <span className="dcard__cta">Explore <ArrowRight size={14} /></span>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
