import { useEffect, useRef, useState } from 'react'
import { getConsent, onConsent } from '../lib/consent.js'

// Set VITE_ADSENSE_CLIENT (e.g. "ca-pub-1234567890123456") and give each AdSlot a
// real numeric `slot` to serve live Google AdSense. Until then, a clearly-labelled
// mockup renders in its place so you can see where ads go.
// Ads only ever load once the visitor has accepted cookies (see CookieBanner).
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || ''

let scriptRequested = false
function loadAdSense() {
  if (scriptRequested || !CLIENT) return
  scriptRequested = true
  const s = document.createElement('script')
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`
  s.async = true
  s.crossOrigin = 'anonymous'
  document.head.appendChild(s)
}

export default function AdSlot({ slot, format = 'leaderboard' }) {
  const [consent, setConsentState] = useState(getConsent())
  useEffect(() => onConsent(setConsentState), [])
  // Serve real ads only when a publisher id AND a numeric slot id are provided
  // AND the visitor has accepted cookies.
  const real = !!CLIENT && !!slot && /^\d{6,}$/.test(String(slot)) && consent === 'accepted'
  const insRef = useRef(null)

  useEffect(() => {
    if (!real) return
    loadAdSense()
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { /* ignore */ }
  }, [real, slot])

  return (
    <aside className={`ad ad--${format}`} aria-label="Advertisement">
      <span className="ad__label">Advertisement</span>
      {real ? (
        <ins
          ref={insRef}
          className="adsbygoogle ad__ins"
          style={{ display: 'block' }}
          data-ad-client={CLIENT}
          data-ad-slot={slot}
          data-ad-format={format === 'in-article' ? 'fluid' : 'auto'}
          data-ad-layout={format === 'in-article' ? 'in-article' : undefined}
          data-full-width-responsive="true"
        />
      ) : (
        <div className={`ad-mock ad-mock--${format}`}>
          <span className="ad-mock__badge">Ad</span>
          <span className="ad-mock__logo" aria-hidden>✦</span>
          <span className="ad-mock__text">
            <span className="ad-mock__title">Your ad could be here</span>
            <span className="ad-mock__sub">Reach travellers planning a trip to Italy.</span>
          </span>
          <span className="ad-mock__cta">Learn more</span>
        </div>
      )}
    </aside>
  )
}
