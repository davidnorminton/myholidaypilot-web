import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdSlot from '../components/AdSlot.jsx'
import { ArrowRight, Compass, Utensils, BookOpen, Check, MapPin } from 'lucide-react'
import { getIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import { COUNTRIES } from '../lib/countries.js'
import { POSTS } from '../lib/blog.js'
import { useSeo } from '../lib/seo.js'

const HERO = 'https://images.unsplash.com/photo-1476362174823-3a23f4aa6d76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600'

export default function LandingScreen() {
  useSeo({ path: '/' })
  const [stats, setStats] = useState(null)
  useEffect(() => {
    getIndex().then((d) => setStats({ regions: d.totalRegions, places: d.totalPlaces }))
      .catch(() => setStats(null))
  }, [])

  return (
    <div className="page">
      <section className="land-hero">
        <img className="land-hero__bg" src={HERO} alt="" />
        <div className="land-hero__veil" />
        <div className="wrap land-hero__inner">
          <p className="eyebrow eyebrow--light">Your travel copilot</p>
          <h1 className="land-hero__title">See more.<br/>Plan&nbsp;less.</h1>
          <p className="land-hero__sub">
            Handcrafted guides to the world’s regions — where to go, what to eat, and the
            stories behind it. We start with Italy and grow from there.
          </p>
          <div className="land-hero__cta">
            <Link to={paths.country()} className="btn btn--primary">
              Explore Italy <ArrowRight size={17} />
            </Link>
            <Link to={paths.blog()} className="btn btn--ghost">Read the blog</Link>
          </div>
        </div>
      </section>

      <section className="wrap band">
        <div className="feature">
          <span className="feature__label"><Compass size={15} /> Region by region</span>
          <h3>Countries, taken one region at a time</h3>
          <p>Every region has its own character and kitchen. We map each one properly — starting with Italy, growing from there.</p>
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
            Free, in the browser, no app required.
          </p>
          <ul className="planner-feat__list">
            <li><Check size={15} /> Save places as you browse</li>
            <li><Check size={15} /> Build days and drag them into order</li>
            <li><Check size={15} /> Pick attractions &amp; restaurants per stop</li>
            <li><Check size={15} /> See the whole trip on a map</li>
          </ul>
          <Link to={paths.plan()} className="btn btn--primary">Start a trip <ArrowRight size={17} /></Link>
        </div>

        <div className="planner-feat__mock" aria-hidden="true">
          <div className="pm">
            <div className="pm__head">
              <span className="pm__name">Tuscany week</span>
              <span className="pm__dates">12 – 18 Sep</span>
            </div>
            <div className="pm__day">Day 1 · Florence</div>
            <div className="pm__row pm__row--done"><span className="pm__n">1</span> Uffizi Gallery <Check size={13} className="pm__tick" /></div>
            <div className="pm__row"><span className="pm__n">2</span> Ponte Vecchio at dusk</div>
            <div className="pm__row pm__row--eat"><Utensils size={12} /> Trattoria Mario — bistecca</div>
            <div className="pm__day">Day 2 · Siena</div>
            <div className="pm__row"><span className="pm__n">3</span> Piazza del Campo</div>
            <div className="pm__row"><span className="pm__n">4</span> Walk the old walls</div>
            <div className="pm__map"><MapPin size={13} /> 6 places · 2 regions on the map</div>
          </div>
        </div>
      </section>

      <section className="wrap home-sec">
        <div className="home-sec__head">
          <h2 className="sec-title">Choose a destination</h2>
          <Link to={paths.destinations()} className="sec-link">All destinations <ArrowRight size={15} /></Link>
        </div>
        <div className="dest-row">
          <Link to={paths.country()} className="dest dest--on">
            <span className="dest__flag">🇮🇹</span>
            <div>
              <h3 className="dest__name">Italy</h3>
              <p className="dest__meta">
                {stats ? `${stats.regions} regions · ${stats.places} places` : 'Ready to explore'}
              </p>
            </div>
            <ArrowRight size={18} className="dest__go" />
          </Link>
          {COUNTRIES.filter((c) => !c.available).slice(0, 3).map((c) => (
            <div key={c.slug} className="dest dest--soon">
              <span className="dest__flag">{c.flag}</span>
              <div>
                <h3 className="dest__name">{c.name}</h3>
                <p className="dest__meta">Coming soon</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="wrap"><AdSlot format="leaderboard" slot="landing-leaderboard" /></div>

      <section className="wrap home-sec">
        <div className="home-sec__head">
          <h2 className="sec-title">From the journal</h2>
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

      <footer className="foot wrap">myholidaypilot · made for slow, curious travel</footer>
    </div>
  )
}
