import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdSlot from '../components/AdSlot.jsx'
import { ArrowRight, Compass, Utensils, BookOpen } from 'lucide-react'
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
          <span className="feature__ic"><Compass size={20} /></span>
          <h3>Region by region</h3>
          <p>Twenty Italian regions, each with its own colour, character and kitchen.</p>
        </div>
        <div className="feature">
          <span className="feature__ic"><Utensils size={20} /></span>
          <h3>Where to eat</h3>
          <p>Local restaurants with a must-order dish and directions, so you skip the guesswork.</p>
        </div>
        <div className="feature">
          <span className="feature__ic"><BookOpen size={20} /></span>
          <h3>Stories, not listings</h3>
          <p>History, dialect and customs for every place — the why, not just the where.</p>
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
