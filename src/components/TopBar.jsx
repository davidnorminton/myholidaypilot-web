import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X, Compass, Map as MapIcon, Wand2, Car, Lightbulb, BookOpen, Route as RouteIcon } from 'lucide-react'
import Logo from './Logo.jsx'
import { paths } from '../lib/paths.js'
import AuthButton from './AuthButton.jsx'
import SiteSearch from './SiteSearch.jsx'

const LINKS = [
  { to: paths.destinations(), label: 'Destinations', icon: Compass },
  { to: '/trip-planner', label: 'Trip planner', icon: RouteIcon },
  { to: paths.plan(), label: 'Plan', icon: MapIcon },
  { to: paths.guided(), label: 'Guided planner', icon: Wand2 },
  { to: paths.dayTrips(), label: 'Day trips', icon: Car },
  { to: '/gallery', label: 'Trip ideas', icon: Lightbulb },
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
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to={paths.home()} className="brand" aria-label="myholidaypilot home">
            <span className="brand__mark"><Logo size={40} /></span>
            <span className="brand__name"><span className="brand__my">my</span>holidaypilot</span>
          </Link>
        </div>

        <div className="topbar__right">
          <SiteSearch />
          <AuthButton />
        </div>
      </div>

      {open && createPortal(
        <>
          <div className="navdrawer__scrim" onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(20,16,12,.32)' }} />
          <nav className="navdrawer navdrawer--side"
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, right: 'auto',
              width: 'min(300px, 84vw)', zIndex: 9998,
              background: 'var(--surface, #fffefb)', borderRight: '1px solid var(--line, #e5e1d8)',
              padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 4,
              boxShadow: '14px 0 44px rgba(0,0,0,.12)', overflowY: 'auto',
            }}>
            <div className="navdrawer__head">
              <span className="navdrawer__title">Menu</span>
              <button className="navdrawer__close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="navdrawer__link" onClick={() => setOpen(false)}>
                <l.icon size={18} strokeWidth={2} className="navdrawer__icon" />
                {l.label}
              </NavLink>
            ))}
          </nav>
        </>,
        document.body
      )}
    </header>
  )
}
