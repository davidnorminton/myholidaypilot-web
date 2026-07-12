import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn, UserPlus } from 'lucide-react'
import { useAuth, GoogleSignInButton } from '../lib/auth.jsx'
import { useSeo } from '../lib/seo.js'
import { paths } from '../lib/paths.js'

// Cloudflare Turnstile — renders only when VITE_TURNSTILE_SITEKEY is set;
// dev and unconfigured environments simply skip the widget (the server skips
// verification too when its secret is absent).
const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || ''

function Turnstile({ onToken }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!SITEKEY || !ref.current) return
    let widgetId
    const render = () => {
      if (!window.turnstile || !ref.current) return
      widgetId = window.turnstile.render(ref.current, {
        sitekey: SITEKEY,
        callback: (t) => onToken(t),
        'expired-callback': () => onToken(''),
      })
    }
    if (window.turnstile) render()
    else {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      s.async = true
      s.onload = render
      document.head.appendChild(s)
    }
    return () => { try { if (widgetId !== undefined) window.turnstile?.remove(widgetId) } catch { /* fine */ } }
  }, [onToken])
  if (!SITEKEY) return null
  return <div ref={ref} className="auth-page__captcha" />
}

function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const { user, emailAuth, configured } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || paths.account()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const t0 = useRef(Date.now())

  useSeo({ title: isSignup ? 'Create an account' : 'Sign in', path: isSignup ? '/signup' : '/login', noindex: true })
  useEffect(() => { if (user) navigate(next, { replace: true }) }, [user, navigate, next])

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      // `website` is a honeypot — humans never see it, bots fill it.
      const hp = e.target.elements.website?.value || ''
      await emailAuth(mode, {
        name, email, password,
        website: hp, t0: t0.current, captcha,
      })
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again')
    } finally { setBusy(false) }
  }

  return (
    <div className="page">
      <main className="wrap auth-page">
        <div className="auth-page__card">
          <h1 className="auth-page__title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth-page__sub">
            {isSignup
              ? 'Free — your trips sync across devices, and you can publish to the trip ideas gallery.'
              : 'Sign in to get back to your trips.'}
          </p>

          {configured && (
            <>
              <div className="auth-page__google"><GoogleSignInButton /></div>
              <div className="auth-page__or"><span>or with email</span></div>
            </>
          )}

          <form className="auth-page__form" onSubmit={submit}>
            {isSignup && (
              <label className="auth-page__field">
                <span>Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} />
              </label>
            )}
            <label className="auth-page__field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={160} />
            </label>
            <label className="auth-page__field">
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? 'new-password' : 'current-password'} required minLength={8} maxLength={200} />
            </label>

            {/* honeypot — hidden from humans, tempting to bots */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="auth-page__hp" />

            <Turnstile onToken={setCaptcha} />

            {error && <p className="auth-page__error">{error}</p>}

            <button className="btn btn--primary auth-page__submit" disabled={busy}>
              {isSignup ? <UserPlus size={16} /> : <LogIn size={16} />}
              {busy ? 'One moment…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="auth-page__swap">
            {isSignup
              ? <>Already have an account? <Link to={paths.login()}>Sign in</Link></>
              : <>New here? <Link to={paths.signup()}>Create an account</Link></>}
          </p>
        </div>
      </main>
    </div>
  )
}

export function LoginScreen() { return <AuthPage mode="login" /> }
export function SignupScreen() { return <AuthPage mode="signup" /> }
