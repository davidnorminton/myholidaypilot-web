import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Compass, Utensils, BookOpen, Check, MapPin, Wand2, Map as MapIcon, Car, Copy, Globe2 } from 'lucide-react'
import { getIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import { useSettings } from '../lib/settings.js'
import { COUNTRIES } from '../lib/countries.js'
import { POSTS } from '../lib/blog.js'
import { useSeo } from '../lib/seo.js'

const HERO = 'https://images.unsplash.com/photo-1476362174823-3a23f4aa6d76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600'

export default function LandingScreen() {
  const site = useSettings()
  useSeo({ path: '/' })
  const [stats, setStats] = useState(null)
  useEffect(() => {
    getIndex().then((d) => setStats({ regions: d.totalRegions, places: d.totalPlaces }))
      .catch(() => setStats(null))
  }, [])

  return (
    <div className="page">
      <section className="land-hero">
        <img className="land-hero__bg" src={site['home.hero'] || HERO} alt="" />
        <div className="land-hero__veil" />
        <div className="wrap land-hero__inner">
          <p className="eyebrow eyebrow--light">Your travel copilot</p>
          <h1 className="land-hero__title">
            {site['home.title']
              ? site['home.title'].split('|').map((line, i, a) => <span key={i}>{line}{i < a.length - 1 && <br />}</span>)
              : <>See more.<br/>Plan&nbsp;less.</>}
          </h1>
          <p className="land-hero__sub">
            {site['home.sub'] || `Handcrafted guides to the world’s regions — where to go, what to eat, and the
            stories behind it. Italy and Spain now, more on the way.`}
          </p>
          <div className="land-hero__cta">
            <Link to={paths.destinations()} className="btn btn--primary">
              Explore destinations <ArrowRight size={17} />
            </Link>
            <Link to={paths.guided()} className="btn btn--ghost">Draft my trip in 30 seconds</Link>
          </div>
        </div>
      </section>

      <section className="wrap band">
        <div className="feature">
          <span className="feature__label"><Compass size={15} /> Region by region</span>
          <h3>Countries, taken one region at a time</h3>
          <p>Every region has its own character and kitchen. We map each one properly — Italy and Spain now, growing from there.</p>
        </div>
        <div className="feature">
          <span className="feature__label"><Utensils size={15} /> Do &amp; eat</span>
          <h3>What each place is actually for</h3>
          <p>Things to do in every town — walks, hiking trails, viewpoints, museums — plus local restaurants and the dish to order.</p>
        </div>
        <div className="feature">
          <span className="feature__label"><BookOpen size={15} /> Stories, not listings</span>
          <h3>The why, not just the where</h3>
          <p>History, customs and culture for every place you'll stand in, so it means something when you get there.</p>
        </div>
      </section>

      <section className="wrap planner-feat">
        <div className="planner-feat__copy">
          <p className="eyebrow">The trip planner</p>
          <h2 className="planner-feat__title">From saved places to a day-by-day plan</h2>
          <p className="planner-feat__sub">
            Save the towns you like the look of, set your dates, and shape the trip into days —
            with the attractions and restaurants you've chosen pinned to each stop, all on one map.
            Free with a Google sign-in — your trips are saved to your account and follow you across devices.
          </p>
          <ul className="planner-feat__list">
            <li><Check size={15} /> Save places as you browse</li>
            <li><Check size={15} /> Build days and drag them into order</li>
            <li><Check size={15} /> Pick attractions &amp; restaurants per stop</li>
            <li><Check size={15} /> Stays, flights &amp; best-route days</li>
            <li><Check size={15} /> Day maps, weather &amp; distances</li>
            <li><Check size={15} /> A printable PDF &amp; share link</li>
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
      </section>

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
          <h2 className="sec-title">Choose a destination</h2>
          <Link to={paths.destinations()} className="sec-link">All destinations <ArrowRight size={15} /></Link>
        </div>
        <div className="dest-row">
          {COUNTRIES.filter((c) => c.available).map((c) => (
            <Link key={c.slug} to={paths.country(c.slug)} className="dest dest--on">
              <span className="dest__flag">{c.flag}</span>
              <div>
                <h3 className="dest__name">{c.name}</h3>
                <p className="dest__meta">
                  {c.slug === 'italy' && stats ? `${stats.regions} regions · ${stats.places} places` : c.blurb || 'Ready to explore'}
                </p>
              </div>
              <ArrowRight size={18} className="dest__go" />
            </Link>
          ))}
        </div>
      </section>


      <section className="wrap home-sec">
        <div className="home-sec__head">
          <h2 className="sec-title">From the blog</h2>
          <Link to={paths.blog()} className="sec-link">All posts <ArrowRight size={15} /></Link>
        </div>
        <div className="grid grid--posts">
          {POSTS.slice(0, 3).map((p) => (
            <Link key={p.slug} to={paths.post(p.slug)} className="post-card">
              <div className="post-card__media"><img src={p.cover} alt="" loading="lazy" /></div>
              <div className="post-card__body">
                <span className="post-card__tag">{p.tag}</span>
                <h3 className="post-card__title">{p.title}</h3>
                <p className="post-card__excerpt">{p.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
