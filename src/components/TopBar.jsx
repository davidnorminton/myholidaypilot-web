import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from './Logo.jsx'
import { paths } from '../lib/paths.js'
import AuthButton from './AuthButton.jsx'
import SiteSearch from './SiteSearch.jsx'

const LINKS = [
  { to: paths.destinations(), label: 'Destinations' },
  { to: paths.plan(), label: 'Plan' },
  { to: paths.guided(), label: 'Guided planner' },
  { to: paths.dayTrips(), label: 'Day trips' },
  { to: '/gallery', label: 'Trip ideas' },
  { to: paths.blog(), label: 'Blog' },
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

      {open && (
        <>
          <div className="navdrawer__scrim" onClick={() => setOpen(false)} />
          <nav className="navdrawer navdrawer--side">
            <div className="navdrawer__head">
              <span className="navdrawer__title">Menu</span>
              <button className="navdrawer__close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="navdrawer__link" onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}
    </header>
  )
}
