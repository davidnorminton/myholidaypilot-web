import { Link } from 'react-router-dom'
import {
  MapPin, Compass, WifiOff, CalendarRange, UtensilsCrossed, Languages,
  Star, ArrowRight, Smartphone,
} from 'lucide-react'
import { paths } from '../lib/paths.js'

// Set this to your real Play Store listing when published.
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.david.italytravel'

const FEATURES = [
  { icon: Compass, title: 'All of Italy, organised', body: '20 regions and 189 hand-picked places — cities, hill towns, coast and mountains.' },
  { icon: WifiOff, title: 'Works offline', body: 'Guides, photos and maps travel with you. No signal, no problem on the road.' },
  { icon: MapPin, title: 'Maps & directions', body: 'Every place and sight pinned, with one tap through to navigation.' },
  { icon: CalendarRange, title: 'Build your trip', body: 'Save places, set the days, and shape a plan that actually fits your time.' },
  { icon: UtensilsCrossed, title: 'Eat like a local', body: 'A “must order” for every restaurant so you skip the menu guesswork.' },
  { icon: Languages, title: 'Speak a little Italian', body: 'Handy phrases and culture notes for each region, in your pocket.' },
]

export default function AppScreen() {
  return (
    <div className="page app-page">
      <section className="app-hero">
        <div className="wrap app-hero__inner">
          <div className="app-hero__copy">
            <p className="eyebrow">Solara · Android</p>
            <h1 className="app-hero__title">Italy, the whole country in your pocket.</h1>
            <p className="app-hero__sub">
              The offline-first travel guide behind myholidaypilot — every region, every town worth slowing
              down for, plus a planner that turns saved places into a real itinerary.
            </p>
            <div className="app-hero__cta">
              <a className="play-btn" href={PLAY_URL} target="_blank" rel="noreferrer">
                <span className="play-btn__ic"><GooglePlayGlyph /></span>
                <span className="play-btn__txt"><small>Get it on</small><strong>Google Play</strong></span>
              </a>
              <Link to={paths.country()} className="app-hero__alt">Browse the web guide <ArrowRight size={15} /></Link>
            </div>
            <p className="app-hero__rating"><Star size={15} className="app-hero__star" /> Built for Pixel & every modern Android · Free to start</p>
          </div>

          <div className="app-hero__device">
            <PhoneMock />
          </div>
        </div>
      </section>

      <section className="wrap app-features">
        {FEATURES.map((f) => {
          const Icon = f.icon
          return (
            <div key={f.title} className="app-feature">
              <span className="app-feature__ic"><Icon size={20} /></span>
              <h3 className="app-feature__title">{f.title}</h3>
              <p className="app-feature__body">{f.body}</p>
            </div>
          )
        })}
      </section>

      <section className="wrap app-cta">
        <div className="app-cta__card">
          <Smartphone size={26} className="app-cta__icon" />
          <h2 className="app-cta__title">Ready when you are</h2>
          <p className="app-cta__sub">Download it free, save your first region, and start planning the trip.</p>
          <a className="play-btn play-btn--lg" href={PLAY_URL} target="_blank" rel="noreferrer">
            <span className="play-btn__ic"><GooglePlayGlyph /></span>
            <span className="play-btn__txt"><small>Get it on</small><strong>Google Play</strong></span>
          </a>
        </div>
      </section>
    </div>
  )
}

function PhoneMock() {
  const regions = [
    { e: '🏛️', n: 'Lazio', c: '#b5544a' },
    { e: '🍷', n: 'Tuscany', c: '#7a8b4f' },
    { e: '🚤', n: 'Veneto', c: '#3f7d9c' },
    { e: '🍋', n: 'Campania', c: '#d99a2b' },
  ]
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone__notch" />
      <div className="phone__screen">
        <div className="phone__bar">
          <span className="phone__brand"><span className="phone__mark"><Compass size={12} strokeWidth={2.6} /></span>Italy Travel</span>
        </div>
        <div className="phone__hero">
          <span className="phone__heroTitle">Explore Italy</span>
          <span className="phone__heroSub">20 regions · 189 places</span>
        </div>
        <div className="phone__list">
          {regions.map((r) => (
            <div className="phone__row" key={r.n}>
              <span className="phone__emoji" style={{ background: `${r.c}22`, color: r.c }}>{r.e}</span>
              <span className="phone__rowText"><b>{r.n}</b><small>Tap to explore</small></span>
              <span className="phone__chev" style={{ color: r.c }}>›</span>
            </div>
          ))}
        </div>
        <div className="phone__tabbar">
          <span className="phone__tab phone__tab--on">Explore</span>
          <span className="phone__tab">Plan</span>
          <span className="phone__tab">Saved</span>
        </div>
      </div>
    </div>
  )
}

function GooglePlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#34A853" d="M3.6 2.1 13.4 12 3.6 21.9c-.3-.2-.5-.6-.5-1.1V3.2c0-.5.2-.9.5-1.1Z" opacity=".0" />
      <path fill="#00E0FF" d="M3.7 2 14 12 3.7 22c-.4-.2-.6-.6-.6-1.1V3.1c0-.5.2-.9.6-1.1Z" />
      <path fill="#FFCE00" d="m17.8 8.6 2.8 1.6c.9.5.9 1.8 0 2.3l-2.8 1.6L14.6 12l3.2-3.4Z" />
      <path fill="#FF3D44" d="M3.7 2c.3-.2.8-.2 1.2 0l11.9 6.8L14 12 3.7 2Z" />
      <path fill="#00C853" d="M14 12l2.8 3.2L4.9 22c-.4.2-.9.2-1.2 0L14 12Z" />
    </svg>
  )
}
