import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getConsent, setConsent } from '../lib/consent.js'

// Shown until a choice is made. The site sets no tracking cookies today —
// storage is used to make things work (trips, sign-in, this choice) — but the
// choice also gates advertising if it's ever switched on.
export default function CookieBanner() {
  const [choice, setChoice] = useState(getConsent())
  if (choice) return null
  const pick = (v) => { setConsent(v); setChoice(v) }

  return (
    <div className="cookiebar" role="dialog" aria-label="Cookies and storage">
      <p className="cookiebar__text">
        We use your browser's storage to make the site work — your trips, sign-in and preferences.
        We don't set tracking cookies, and advertising only ever runs if you accept.{' '}
        <Link to="/cookies">How we use cookies</Link>
      </p>
      <div className="cookiebar__acts">
        <button className="cookiebar__btn cookiebar__btn--soft" onClick={() => pick('essential')}>Essential only</button>
        <button className="cookiebar__btn" onClick={() => pick('accepted')}>Accept all</button>
      </div>
    </div>
  )
}
