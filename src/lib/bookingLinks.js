import { buildUrl } from './affiliates.js'

// Deep-link builders shared by the flights editor, the day picker's
// accommodation tab, and the bookings summary.

// ISO codes for our country slugs (Mapbox filters + Skyscanner fallbacks).
export const ISO = { italy: 'it', spain: 'es', portugal: 'pt', france: 'fr', germany: 'de', greece: 'gr',
  japan: 'jp', netherlands: 'nl', norway: 'no', poland: 'pl', singapore: 'sg', south_korea: 'kr',
  sweden: 'se', switzerland: 'ch', thailand: 'th', turkey: 'tr', united_kingdom: 'gb', united_states: 'us' }

// Best guess at the visitor's home country from their browser locale.
export function homeCountry() {
  for (const l of (navigator.languages || [navigator.language || ''])) {
    const m = /-([a-z]{2})$/i.exec(l || '')
    if (m) return m[1].toLowerCase()
  }
  return ''
}

// Skyscanner's UK code is 'uk', not ISO 'gb' — one invalid code collapses the
// referral to their homepage.
export const skyCountry = (c) => (c === 'gb' ? 'uk' : c)

// A Skyscanner place code for an airport point: its IATA, an IATA parsed from
// the name ("Pescara (PSR)"), or a country-code fallback.
export function codeFor(pt, fb) {
  if (pt?.iata) return pt.iata.toLowerCase()
  const m = /\(([A-Za-z]{3})\)/.exec(pt?.name || '')
  if (m) return m[1].toLowerCase()
  return fb ? skyCountry(fb) : null
}

// One-way flight search for a trip direction ('arrive' | 'depart').
export function skyscannerUrl(affCfg, trip, which) {
  if (!affCfg?.skyscanner) return null
  const home = trip.travel?.home || null
  const destPt = which === 'arrive' ? trip.travel?.arrive : trip.travel?.depart
  const homeCode = codeFor(home, homeCountry())
  const destCode = codeFor(destPt, ISO[trip.countryId])
  const p = which === 'arrive'
    ? { origin: homeCode || '', iata: destCode || '', outboundDate: trip.startDate || '' }
    : { origin: destCode || '', iata: homeCode || '', outboundDate: trip.endDate || '' }
  return buildUrl(affCfg.skyscanner, p)
}

const plusDays = (iso, n) => {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Booking.com search: location + real check-in/out dates when known.
// `checkout` defaults to the night after check-in.
export function bookingUrl(affCfg, { location, checkin = '', checkout = '' }) {
  if (!affCfg?.booking || !location) return null
  const out = checkout || (checkin ? plusDays(checkin, 1) : '')
  return buildUrl(affCfg.booking, { location, checkin, checkout: out })
}
