import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X, Compass, Wand2, Car, Lightbulb, BookOpen, Route as RouteIcon } from 'lucide-react'
import Logo from './Logo.jsx'
import { paths } from '../lib/paths.js'
import AuthButton from './AuthButton.jsx'
import SiteSearch from './SiteSearch.jsx'

// Primary items shown directly in the header (Mindtrip-style); the drawer
// carries the full list.
const HEADER_LINKS = [
  { to: paths.destinations(), label: 'Destinations' },
  { to: paths.plan(), label: 'Trip planner' },
  { to: '/trip-ideas', label: 'Trip ideas' },
]

const LINKS = [
  { to: paths.destinations(), label: 'Destinations', icon: Compass },
  { to: paths.plan(), label: 'Trip planner', icon: RouteIcon },
  { to: paths.guided(), label: 'Guided planner', icon: Wand2 },
  { to: paths.dayTrips(), label: 'Day trips', icon: Car },
  { to: '/trip-ideas', label: 'Trip ideas', icon: Lightbulb },
  { to: paths.blog(), label: 'Blog', icon: BookOpen },
]

export default function TopBar() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false) }, [loc.pathname]) // close menu on navigation
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])

  return (
    <header className="topbar">
      <div className="wrap topbar__inner">
        <div className="topbar__left">
          <button className="hamburger" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X size={30} /> : <Menu size={30} />}
          </button>
          <Link to={paths.home()} className="brand" aria-label="myholidaypilot home">
            <span className="brand__mark"><Logo size={40} /></span>
            <span className="brand__name"><span className="brand__my">my</span>holidaypilot</span>
          </Link>
          <nav className="topbar__nav" aria-label="Primary">
            {HEADER_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="topbar__navlink">{l.label}</NavLink>
            ))}
          </nav>
        </div>

        <div className="topbar__right">
          <SiteSearch />
          <AuthButton />
        </div>
      </div>

      {open && createPortal(
        <>
          <div className="navdrawer__scrim" onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(20,16,12,.38)' }} />
          <nav className="navdrawer navdrawer--panel"
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, right: 'auto',
              width: 'min(320px, 88vw)', zIndex: 9998,
              background: 'var(--surface, #ffffff)', borderRight: '1px solid var(--line, #e8e5df)',
              borderRadius: '0 22px 22px 0', padding: '18px 16px 16px',
              display: 'flex', flexDirection: 'column', gap: 4,
              boxShadow: '0 24px 70px rgba(20,16,12,.22)', overflowY: 'auto',
            }}>
            <div className="navdrawer__brandrow">
              <Link to={paths.home()} className="brand" onClick={() => setOpen(false)} aria-label="myholidaypilot home">
                <span className="brand__mark"><Logo size={34} /></span>
                <span className="brand__name"><span className="brand__my">my</span>holidaypilot</span>
              </Link>
              <button className="navdrawer__close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            <div className="navdrawer__links">
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} className="navdrawer__link" onClick={() => setOpen(false)}>
                  <l.icon size={18} strokeWidth={2} className="navdrawer__icon" />
                  {l.label}
                </NavLink>
              ))}
            </div>
            <div className="navdrawer__foot">
              <AuthButton />
            </div>
          </nav>
        </>,
        document.body
      )}
    </header>
  )
}
