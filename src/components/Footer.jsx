import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'
import { paths } from '../lib/paths.js'
import NewsletterSignup from './NewsletterSignup.jsx'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <div className="footer__brand">
          <Link to={paths.home()} className="brand brand--footer" aria-label="myholidaypilot home">
            <span className="brand__mark"><Logo size={40} /></span>
            <span className="brand__name"><span className="brand__my">my</span>holidaypilot</span>
          </Link>
          <p className="footer__tag">Plan your trip region by region — the towns, the food, and the stories in between.</p>
          <NewsletterSignup />
        </div>

        <nav className="footer__cols" aria-label="Footer">
          <div className="footer__col">
            <h3>Explore</h3>
            <Link to={paths.destinations()}>Destinations</Link>
            <Link to={paths.dayTrips()}>Day-trip finder</Link>
            <Link to={paths.gallery()}>Trip ideas</Link>
            <Link to={paths.blog()}>The blog</Link>
          </div>
          <div className="footer__col">
            <h3>Plan</h3>
            <Link to="/trip-planner">Trip planner</Link>
            <Link to={paths.plan()}>Plan a trip</Link>
            <Link to={paths.guided()}>Guided planner</Link>
            <Link to={paths.account('map')}>Your travel map</Link>
          </div>
          <div className="footer__col">
            <h3>Discover</h3>
            <Link to={paths.app()}>Get the app</Link>
            <Link to={paths.saved()}>Saved places</Link>
            <Link to={paths.account()}>My home</Link>
          </div>
          <div className="footer__col">
            <h3>More</h3>
            <Link to={paths.contact()}>Contact</Link>
          </div>
        </nav>
      </div>

      <div className="wrap footer__bar">
        <span>© {year} myholidaypilot. All rights reserved.</span>
        <span className="footer__disc">
          Some links are affiliate links; booking through them may earn us a commission at no extra cost to you.
        </span>
      </div>
    </footer>
  )
}
