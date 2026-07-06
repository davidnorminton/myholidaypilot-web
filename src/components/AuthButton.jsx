import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Shield, ChevronDown, Heart, CalendarRange, Home } from 'lucide-react'
import { useAuth, GoogleSignInButton } from '../lib/auth.jsx'
import { paths } from '../lib/paths.js'

export default function AuthButton() {
  const { user, isAdmin, configured, isDev, signOut, devSignIn, emailAuth } = useAuth()
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
        <button className="auth__signin" onClick={() => setOpen((v) => !v)}>
          Sign in <ChevronDown size={14} />
        </button>
        {open && (
          <div className="auth__menu auth__menu--signin">
            <EmailAuthForm emailAuth={emailAuth} onDone={() => setOpen(false)} />
            {configured && (
              <>
                <div className="auth__or"><span>or</span></div>
                <GoogleSignInButton />
              </>
            )}
            {!configured && isDev && (
              <button className="btn btn--primary auth__dev" onClick={() => { devSignIn(); setOpen(false) }}>Continue (dev)</button>
            )}
          </div>
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
function EmailAuthForm({ emailAuth, onDone }) {
  const [mode, setMode] = useState('login')   // login | signup
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const go = async () => {
    setErr(''); setBusy(true)
    try { await emailAuth(mode, form); onDone() }
    catch (e) { setErr(e.message || 'Something went wrong') }
    finally { setBusy(false) }
  }

  return (
    <div className="eauth">
      <div className="eauth__tabs">
        <button className={mode === 'login' ? 'is-on' : ''} onClick={() => { setMode('login'); setErr('') }}>Sign in</button>
        <button className={mode === 'signup' ? 'is-on' : ''} onClick={() => { setMode('signup'); setErr('') }}>Create account</button>
      </div>
      {mode === 'signup' && (
        <input className="eauth__input" placeholder="Your name" value={form.name} onChange={set('name')} autoComplete="name" />
      )}
      <input className="eauth__input" type="email" placeholder="Email" value={form.email} onChange={set('email')} autoComplete="email" />
      <input className="eauth__input" type="password" placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'}
        value={form.password} onChange={set('password')}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        onKeyDown={(e) => e.key === 'Enter' && !busy && go()} />
      {err && <p className="eauth__err">{err}</p>}
      <button className="btn btn--primary eauth__go" onClick={go} disabled={busy}>
        {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>
    </div>
  )
}
