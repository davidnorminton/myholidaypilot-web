import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Compass, Check, MapPin, Wand2, Map as MapIcon, Car, Copy, Globe2, Landmark, UtensilsCrossed, ChevronDown } from 'lucide-react'
import { getIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import { Reveal } from '../components/Reveal.jsx'
import FeaturedDestinations from '../components/FeaturedDestinations.jsx'
import BlogCarousel from '../components/BlogCarousel.jsx'
import { useSettings, getSettings } from '../lib/settings.js'
import { COUNTRIES } from '../lib/countries.js'
import { usePublishedPosts } from '../lib/blogStore.js'
import { useSeo } from '../lib/seo.js'

const HERO = 'https://images.unsplash.com/photo-1476362174823-3a23f4aa6d76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600'


// Global tourist-arrival ranking (most-visited first) — used to order the
// "Top destinations" list. Countries not listed fall to the end.
const VISIT_RANK = {
  france: 1, spain: 2, united_states: 3, italy: 4, united_kingdom: 6,
  germany: 7, greece: 9, japan: 11, portugal: 14, netherlands: 15,
  poland: 16, switzerland: 18, sweden: 22, norway: 24, south_korea: 25,
}
const visitRank = (slug) => VISIT_RANK[slug] ?? 999

export default function LandingScreen() {
  const latestPosts = usePublishedPosts()
  const liveCount = COUNTRIES.filter((c) => c.available).length
  const site = useSettings()
  // Resolve the hero only after settings load, so the bundled fallback never
  // flashes/downloads first when an admin hero is set.
  const [heroSrc, setHeroSrc] = useState(null)
  useEffect(() => {
    let live = true
    getSettings().then((s2) => live && setHeroSrc(s2?.['home.hero'] || HERO)).catch(() => live && setHeroSrc(HERO))
    return () => { live = false }
  }, [])
  useSeo({ path: '/' })
  const [stats, setStats] = useState(null)
  useEffect(() => {
    getIndex().then((d) => setStats({ regions: d.totalRegions, places: d.totalPlaces }))
      .catch(() => setStats(null))
  }, [])

  return (
    <div className="page">
      <section className="land-hero">
        {heroSrc && <img className="land-hero__bg land-hero__bg--kb" src={heroSrc} alt="" fetchPriority="high" decoding="async" />}
        <div className="land-hero__veil" />
        <div className="wrap">
          <div className="land-hero__inner">
          <p className="eyebrow eyebrow--light">Your travel copilot</p>
          <h1 className="land-hero__title">
            {site['home.title']
              ? site['home.title'].split('|').map((line, i, a) => <span key={i}>{line}{i < a.length - 1 && <br />}</span>)
              : <>See more.<br/>Plan&nbsp;less.</>}
          </h1>
          <p className="land-hero__sub">
            {site['home.sub'] || `Handcrafted guides to the world’s regions — where to go, what to eat, and the
            stories behind it. ${liveCount} countries mapped, more on the way.`}
          </p>
          <div className="land-hero__cta">
            <Link to={paths.destinations()} className="btn btn--primary">
              Explore destinations <ArrowRight size={17} />
            </Link>
            <Link to={paths.guided()} className="btn btn--ghost">Draft my trip in 30 seconds</Link>
          </div>
          </div>
        </div>
      </section>

      <FeaturedDestinations />

      <section className="wrap splits">
        <Reveal className="split">
          <div className="split__label">
            <span className="feature__label"><Compass size={15} /> Region by region</span>
            <h3 className="split__title">Every place, mapped and worth your time</h3>
          </div>
          <div className="split__body">
            <p>Each country is broken into its real regions, and every region into its towns, cities, islands and parks. Every place comes with the things to do there — walks, viewpoints, museums, beaches — the food to try, and the local customs worth knowing before you go.</p>
          </div>
        </Reveal>

        <Reveal className="split split--reverse">
          <div className="split__label">
            <span className="feature__label"><UtensilsCrossed size={15} /> Eat &amp; celebrate</span>
            <h3 className="split__title">Where to eat, and when to be there</h3>
          </div>
          <div className="split__body">
            <p>A curated list of restaurants for every region — from old-school institutions to market stalls — each with the dish to order when you sit down. Plus a festival calendar for every country, so you can time your trip to the carnival, food fair or saint's day when it all happens.</p>
          </div>
        </Reveal>

        <Reveal className="split">
          <div className="split__label">
            <span className="feature__label"><Landmark size={15} /> Understand it</span>
            <h3 className="split__title">The story behind the country</h3>
          </div>
          <div className="split__body">
            <p>A timeline from prehistory to today for every country — so the ruins, castles and old towns mean something when you stand in them. And practical guides to getting around: trains, taxis and tickets, with the honest warnings a good local would give you.</p>
          </div>
        </Reveal>
      </section>

      <Reveal className="wrap planner-feat" as="section">
        <div className="planner-feat__copy">
          <p className="eyebrow">The trip planner</p>
          <h2 className="planner-feat__title">From saved places to a day-by-day plan</h2>
          <p className="planner-feat__sub">
            Pick a destination and dates, then build each day — things to do, bookable
            experiences, places to eat and where you're staying, all pinned to one map.
            No account needed to plan; sign in with Google and your trips sync across devices.
          </p>
          <ul className="planner-feat__list">
            <li><Check size={15} /> Plan each day: sights, food &amp; experiences</li>
            <li><Check size={15} /> Drag a day's picks into the perfect order</li>
            <li><Check size={15} /> Flights from your home airport, stays per night</li>
            <li><Check size={15} /> Day maps, weather &amp; distances</li>
            <li><Check size={15} /> Review &amp; book everything in one place</li>
            <li><Check size={15} /> A printable PDF, share link &amp; trip ideas gallery</li>
          </ul>
          <div className="planner-feat__ctas">
            <Link to={paths.plan()} className="btn btn--primary">Start a trip <ArrowRight size={17} /></Link>
            <Link to={paths.guided()} className="btn btn--soft">Or let us draft it — guided planner</Link>
          </div>
        </div>

        <div className="planner-feat__mock" aria-hidden="true">
          <div className="pm">
            <div className="pm__head">
              <span className="pm__name">Abruzzo week</span>
              <span className="pm__dates">1 – 5 Jul</span>
            </div>
            <div className="pm__status">
              <span className="pm__chip pm__chip--ok"><Check size={11} /> Dates set</span>
              <span className="pm__chip pm__chip--ok"><Check size={11} /> Every day has food</span>
              <span className="pm__chip pm__chip--todo">1 night without a stay</span>
            </div>
            <div className="pm__day">
              <span>Day 2 · Thu 2 Jul</span>
              <span className="pm__stay">🛏 Hotel Esplanade</span>
              <span className="pm__wx">🌤️ 27°</span>
              <span className="pm__km">≈ 5.6 km</span>
            </div>
            <div className="pm__tl">
              <div className="pm__stop"><i style={{ background: '#3a3733' }} /> Hotel Esplanade</div>
              <div className="pm__leg">0.6 km</div>
              <div className="pm__stop"><i style={{ background: '#a9762a' }} /> Pescara old town</div>
              <div className="pm__leg">0.4 km</div>
              <div className="pm__stop"><i style={{ background: '#1f6f54' }} /> Explore the fish market</div>
              <div className="pm__leg">1.2 km</div>
              <div className="pm__stop"><i style={{ background: '#bb3a2c' }} /> Trattoria del Pescatore — brodetto</div>
              <div className="pm__leg">3.4 km</div>
              <div className="pm__stop"><i style={{ background: '#3a3733' }} /> Back to your stay</div>
            </div>
            <div className="pm__map"><MapPin size={13} /> Day map · best route · PDF &amp; share link</div>
          </div>
        </div>
      </Reveal>

      <section className="wrap duo">
        <article className="duo__card">
          <p className="eyebrow">Guided planner</p>
          <h2 className="duo__title">Five questions. A whole trip.</h2>
          <p className="duo__sub">
            Tell us when, your pace and what you're into — we draft the full itinerary from our
            hand-curated guides: days, sights, dinners, distances. Then fine-tune every detail.
          </p>
          <div className="duo__mock duo__mock--quiz" aria-hidden="true">
            <span className="gq__chip is-on">🍝 Food &amp; wine</span>
            <span className="gq__chip">🏛️ History &amp; art</span>
            <span className="gq__chip is-on">🌊 Coast</span>
            <span className="gq__chip">🥾 Hiking</span>
            <span className="duo__arrow">→</span>
            <span className="duo__result">Sardinia in 5 days · 5 places · ≈ 241 km</span>
          </div>
          <Link to={paths.guided()} className="btn btn--primary"><Wand2 size={16} /> Draft my trip</Link>
        </article>

        <article className="duo__card">
          <p className="eyebrow">Day-trip finder</p>
          <h2 className="duo__title">A free day? See what's in reach</h2>
          <p className="duo__sub">
            Pick your base and get every worthwhile day trip ranked by distance,
            with drive times — filter by coast, towns, mountains and more.
          </p>
          <div className="duo__mock duo__mock--dtf" aria-hidden="true">
            <span className="duo__result">From <b>Florence</b></span>
            <span className="duo__arrow">→</span>
            <span className="gq__chip is-on">Siena · 51 km</span>
            <span className="gq__chip">Lucca · 60 km</span>
            <span className="gq__chip">Pisa · 69 km</span>
          </div>
          <Link to={paths.dayTrips()} className="btn btn--soft"><Car size={16} /> Find day trips</Link>
        </article>

        <article className="duo__card">
          <p className="eyebrow">Travel map</p>
          <h2 className="duo__title">Scratch the map, region by region</h2>
          <p className="duo__sub">
            Every place you tick off on a trip lights up your personal travel map — country by
            country, region by region — with your stats ready to share.
          </p>
          <div className="duo__mock duo__mock--map" aria-hidden="true">
            <span className="duo__reg is-on">🏔️ Abruzzo <Check size={11} /></span>
            <span className="duo__reg is-on">🍷 Tuscany <Check size={11} /></span>
            <span className="duo__reg">🎭 Veneto</span>
            <span className="duo__reg">🍋 Campania</span>
            <span className="duo__reg">🏝️ Sardinia</span>
            <span className="duo__reg">⛰️ Trentino</span>
          </div>
          <Link to={paths.account('map')} className="btn btn--soft"><MapIcon size={16} /> See your map</Link>
        </article>

        <article className="duo__card">
          <p className="eyebrow">Trip ideas</p>
          <h2 className="duo__title">Real trips, ready to copy</h2>
          <p className="duo__sub">
            Browse itineraries other travellers have planned and published — day by day, with the
            sights and dinners chosen — and copy any of them straight into your own planner.
          </p>
          <div className="duo__mock duo__mock--gal" aria-hidden="true">
            <span className="duo__result">Abruzzo long weekend · 3 days</span>
            <span className="duo__arrow">→</span>
            <span className="gq__chip is-on"><Copy size={11} /> Use this trip</span>
          </div>
          <Link to={paths.gallery()} className="btn btn--soft"><Globe2 size={16} /> Browse trip ideas</Link>
        </article>
      </section>

      <section className="wrap home-sec">
        <div className="home-sec__head">
          <Reveal as="h2" className="sec-title">Top destinations</Reveal>
          <Link to={paths.destinations()} className="sec-link">All destinations <ArrowRight size={15} /></Link>
        </div>
        <Reveal as="ol" className="topdest">
          {COUNTRIES.filter((c) => c.available)
            .slice()
            .sort((a, b) => visitRank(a.slug) - visitRank(b.slug))
            .slice(0, 10)
            .map((c, i) => (
              <li key={c.slug}>
                <Link to={paths.country(c.slug)} className="topdest__row reveal-row" style={{ transitionDelay: `${i * 45}ms` }}>
                  <span className="topdest__rank">{i + 1}</span>
                  <span className="topdest__flag">{c.flag}</span>
                  <span className="topdest__name">{c.name}</span>
                  <span className="topdest__meta">
                    {c.slug === 'italy' && stats ? `${stats.regions} regions · ${stats.places} places` : c.blurb}
                  </span>
                  <ArrowRight size={17} className="topdest__go" />
                </Link>
              </li>
            ))}
        </Reveal>
      </section>


      <BlogCarousel />

      <section className="wrap home-sec">
        <Reveal as="h2" className="sec-title">Frequently asked questions</Reveal>
        <div className="tripdetails__faq home-faq">
          {[
            { q: 'What is myholidaypilot?', a: 'A travel guide and free trip planner. Every country is broken into its real regions, and every region into its towns, cities and landmarks — with things to do, restaurants and the dish to order, festivals, and honest local tips.' },
            { q: 'Is myholidaypilot free to use?', a: 'Yes. Browsing every guide and using the trip planner — itineraries, packing lists, budgets and PDF export — is free. Sign in with Google or email to save trips across devices.' },
            { q: 'How does the trip planner work?', a: 'Save the places you like as you browse, arrange them into a day-by-day itinerary on a map, then generate a packing list and budget for your dates. You can export the plan as a PDF or share it with friends.' },
            { q: 'Which countries are covered?', a: 'Countries across Europe, Asia and North America — each mapped region by region — with new countries added regularly.' },
            { q: 'When is the best time to book a holiday?', a: 'It depends on the destination — every region page includes the best months to visit, and every country has a festival calendar so you can time your trip around the events worth travelling for.' },
          ].map((f, i) => (
            <details key={i} className="tripdetails__q">
              <summary><span>{f.q}</span><ChevronDown size={16} className="tripdetails__chev" aria-hidden /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

    </div>
  )
}
