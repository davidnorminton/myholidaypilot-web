import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Shield, Heart, CalendarRange, Home } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { paths } from '../lib/paths.js'

export default function AuthButton() {
  const { user, isAdmin, configured, isDev, signOut, devSignIn } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!user) {
    return (
      <div className="auth" ref={ref}>
        <Link className="auth__signin" to={paths.login()}>
          Sign in
        </Link>
        {!configured && isDev && (
          <button className="btn btn--primary auth__dev" onClick={devSignIn}>Continue (dev)</button>
        )}
      </div>
    )
  }

  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="auth" ref={ref}>
      <button className="auth__avatar" onClick={() => setOpen((v) => !v)} aria-label="Account">
        {user.picture ? <img src={user.picture} alt="" /> : <span className="auth__initial">{initial}</span>}
      </button>
      {open && (
        <div className="auth__menu">
          <div className="auth__me">
            <span className="auth__name">{user.name}</span>
            <span className="auth__email">{user.email}</span>
          </div>
          <Link to={paths.account()} className="auth__item" onClick={() => setOpen(false)}>

            <Home size={15} /> My home

          </Link>
          <Link to={paths.trips()} className="auth__item" onClick={() => setOpen(false)}>
            <CalendarRange size={15} /> My trips
          </Link>
          <Link to={paths.saved()} className="auth__item" onClick={() => setOpen(false)}>
            <Heart size={15} /> Saved
          </Link>
          {isAdmin && (
            <Link to={paths.admin()} className="auth__item" onClick={() => setOpen(false)}>
              <Shield size={15} /> Admin
            </Link>
          )}
          <button className="auth__item" onClick={() => { signOut(); setOpen(false) }}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// Email/password sign-in + create-account, sharing one compact form.
