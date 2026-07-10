import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | busy | done | error

  const submit = async () => {
    if (!email.trim() || state === 'busy') return
    setState('busy')
    try { await api.subscribe.add(email.trim()); setState('done'); setEmail('') }
    catch { setState('error') }
  }

  return (
    <div className="nl">
      <p className="nl__title">Join our Newsletter</p>
      {state === 'done' ? (
        <p className="nl__done">Thanks — you’re on the list.</p>
      ) : (
        <>
          <p className="nl__sub">Region notes and trip tips, now and then. No spam.</p>
          <div className="nl__row">
            <input className="nl__input" type="email" placeholder="EMAIL ADDRESS" value={email}
              onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle') }}
              onKeyDown={(e) => e.key === 'Enter' && submit()} aria-label="Email address" />
            <button className="nl__btn" onClick={submit} disabled={state === 'busy'}>
              {state === 'busy' ? '…' : 'Sign up'}
            </button>
          </div>
          {state === 'error' && <p className="nl__err">Please enter a valid email and try again.</p>}
          <p className="nl__note">Subscribe to myholidaypilot newsletters. Read our <Link to="/privacy">Privacy Policy</Link>.</p>
        </>
      )}
    </div>
  )
}
