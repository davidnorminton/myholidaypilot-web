// Client-side Google Sign-In via Google Identity Services (GIS).
// NOTE: this is a *soft* gate suitable for a personal/demo site — the admin
// check happens in the browser and is not server-enforced. For real security
// you need a backend that verifies the Google ID token. Configure with:
//   VITE_GOOGLE_CLIENT_ID   (OAuth 2.0 Web client ID from Google Cloud)
//   VITE_ADMIN_EMAILS       (comma-separated allowlist; empty = any signed-in user)
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { setApiAuth, api } from './api.js'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
const USER_KEY = 'mhp_user_v1'
const GSI_SRC = 'https://accounts.google.com/gsi/client'

const AuthContext = createContext(null)

function decodeJwt(token) {
  try {
    const base = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    )
    return JSON.parse(json)
  } catch { return null }
}

let gsiPromise = null
function loadGsi() {
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = GSI_SRC; s.async = true; s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(s)
  })
  return gsiPromise
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { const r = localStorage.getItem(USER_KEY); return r ? JSON.parse(r) : null } catch { return null }
  })
  const [ready, setReady] = useState(false)
  const configured = !!CLIENT_ID

  const handleCredential = useCallback((resp) => {
    const profile = decodeJwt(resp.credential)
    if (!profile) return
    const u = {
      name: profile.name || profile.email,
      email: (profile.email || '').toLowerCase(),
      picture: profile.picture || '',
      sub: profile.sub,
      credential: resp.credential,
    }
    setUser(u)
    try { localStorage.setItem(USER_KEY, JSON.stringify(u)) } catch { /* ignore */ }
    // Exchange the (1-hour) Google token for a 30-day session of our own so
    // long editing stints don't start failing writes. Fire-and-forget.
    setApiAuth({ credential: resp.credential })
    api.session.start().then((sess) => {
      const u2 = { ...u, session: sess.token, sessionExpiresAt: sess.expiresAt }
      delete u2.credential
      setUser(u2)
      try { localStorage.setItem(USER_KEY, JSON.stringify(u2)) } catch { /* ignore */ }
    }).catch(() => { /* keep riding the Google token */ })
  }, [])

  useEffect(() => {
    if (!configured) return
    let live = true
    loadGsi().then(() => {
      if (!live || !window.google?.accounts?.id) return
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential, auto_select: false })
      setReady(true)
    }).catch(() => { /* offline / blocked */ })
    return () => { live = false }
  }, [configured, handleCredential])

  const signOut = useCallback(() => {
    api.session.end().catch(() => {})
    setUser(null)
    try { localStorage.removeItem(USER_KEY) } catch { /* ignore */ }
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect()
  }, [])

  // Email/password sign-in and sign-up. On success the server returns the
  // same session shape the Google flow produces, so downstream is identical.
  const emailAuth = useCallback(async (mode, form) => {
    const r = mode === 'signup' ? await api.authEmail.signup(form) : await api.authEmail.login(form)
    const u = {
      name: r.name, email: (r.email || '').toLowerCase(), picture: r.picture || '',
      sub: null, session: r.token, sessionExpiresAt: r.expiresAt, local: true,
    }
    setUser(u)
    try { localStorage.setItem(USER_KEY, JSON.stringify(u)) } catch { /* ignore */ }
    return u
  }, [])

  // Local-only sign-in so the admin UI is testable in dev without a client ID.
  const devSignIn = useCallback(() => {
    const u = { name: 'Local Admin', email: 'dev@local', picture: '', sub: 'dev', dev: true }
    setUser(u)
    try { localStorage.setItem(USER_KEY, JSON.stringify(u)) } catch { /* ignore */ }
  }, [])

  // Keep the API client's auth header in sync with the signed-in user.
  // Done synchronously during render (it only assigns a module variable):
  // child effects (favourites/trips/visits syncs) run before parent effects,
  // so an effect here would let the first API calls go out unauthenticated.
  if (!user) setApiAuth({})
  else if (user.dev) setApiAuth({ devEmail: user.email, devId: user.sub, devName: user.name })
  else if (user.session && (!user.sessionExpiresAt || user.sessionExpiresAt > Date.now())) setApiAuth({ session: user.session })
  else if (user.credential) setApiAuth({ credential: user.credential })
  else setApiAuth({})

  // Users signed in before sessions existed hold only a Google credential
  // (1-hour expiry). Upgrade them to a session on load; if the credential has
  // already expired, clear the stale sign-in so the UI honestly shows Sign in.
  useEffect(() => {
    if (!user || user.dev || user.session || !user.credential) return
    api.session.start().then((sess) => {
      const u2 = { ...user, session: sess.token, sessionExpiresAt: sess.expiresAt }
      delete u2.credential
      setUser(u2)
      try { localStorage.setItem(USER_KEY, JSON.stringify(u2)) } catch { /* ignore */ }
    }).catch(() => {
      setUser(null)
      try { localStorage.removeItem(USER_KEY) } catch { /* ignore */ }
    })
     
  }, [user?.sub])

  const isAdmin = !!user && (ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes((user.email || '').toLowerCase()))

  const value = { user, isAdmin, configured, ready, isDev: import.meta.env.DEV, signOut, devSignIn, emailAuth }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Renders the official Google button into a div (requires VITE_GOOGLE_CLIENT_ID).
export function GoogleSignInButton({ theme = 'outline', size = 'large' }) {
  const ref = useRef(null)
  const { configured, ready } = useAuth()
  useEffect(() => {
    if (configured && ready && ref.current && window.google?.accounts?.id) {
      ref.current.innerHTML = ''
      window.google.accounts.id.renderButton(ref.current, { theme, size, shape: 'pill', text: 'signin_with' })
    }
  }, [configured, ready, theme, size])
  if (!configured) return null
  return <div ref={ref} className="gsi-btn" />
}
