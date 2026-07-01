import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from './Logo.jsx'
import { paths } from '../lib/paths.js'
import AuthButton from './AuthButton.jsx'

const cls = ({ isActive }) => 'nav__link' + (isActive ? ' nav__link--on' : '')

const LINKS = [
  { to: paths.destinations(), label: 'Destinations' },
  { to: paths.plan(), label: 'Plan' },
  { to: paths.blog(), label: 'Blog' },
  { to: paths.app(), label: 'Get the app' },
]

export default function TopBar() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false) }, [loc.pathname]) // close menu on navigation
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])

  return (
    <header className="topbar">
      <div className="wrap topbar__inner">
        <Link to={paths.home()} className="brand" aria-label="myholidaypilot home">
          <span className="brand__mark"><Logo size={19} /></span>
          <span className="brand__name"><span className="brand__my">my</span>holidaypilot</span>
        </Link>

        <nav className="nav nav--desktop">
          {LINKS.map((l) => <NavLink key={l.to} to={l.to} className={cls}>{l.label}</NavLink>)}
        </nav>

        <div className="topbar__right">
          <AuthButton />
          <button className="hamburger" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="navdrawer__scrim" onClick={() => setOpen(false)} />
          <nav className="navdrawer">
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
