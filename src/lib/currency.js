// Show the Viator "from" price in the visitor's likely currency.
//
// Prices are baked at build time in ONE base currency (EUR — see
// scripts/sync-viator.mjs). We can't re-price per visitor without either
// baking several currencies or calling Viator at runtime, so here we detect
// the visitor's currency from their browser locale and convert for display.
//
// IMPORTANT: these are INDICATIVE conversions using approximate rates. Viator
// sets exact prices per market and shows them on the booking page when the
// visitor clicks through. Update PER_EUR occasionally, or swap in a live rate
// feed if you want tighter numbers. Non-EUR figures are best treated as a
// rough guide, not a quote.

// Rate = units of currency per 1 EUR (approximate; edit as needed).
const PER_EUR = {
  EUR: 1, GBP: 0.84, USD: 1.09, CHF: 0.94, CAD: 1.48, AUD: 1.63, NZD: 1.78,
  JPY: 172, SEK: 11.3, DKK: 7.46, NOK: 11.7, PLN: 4.3, CZK: 25, HUF: 395,
}

// ISO region (from the locale, e.g. "en-GB" → "GB") → currency.
// Anything not listed (incl. the eurozone) falls back to EUR.
const REGION_CCY = {
  GB: 'GBP', US: 'USD', CH: 'CHF', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY',
  SE: 'SEK', DK: 'DKK', NO: 'NOK', PL: 'PLN', CZ: 'CZK', HU: 'HUF',
}

// The "location identifier": the visitor's browser locale(s). No network call.
// Falls back to EUR during prerender (no navigator) and when unmappable.
export function detectCurrency() {
  if (typeof navigator === 'undefined') return 'EUR'
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
    for (const l of langs) {
      const region = (String(l).split('-')[1] || '').toUpperCase()
      if (region && REGION_CCY[region]) return REGION_CCY[region]
    }
  } catch { /* ignore and fall through */ }
  return 'EUR'
}

export function convert(amount, from, to) {
  const rf = PER_EUR[from]
  const rt = PER_EUR[to]
  if (amount == null || rf == null || rt == null) return null
  return (amount / rf) * rt // from → EUR → to
}

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

// Format a baked price (given in `from`) in the visitor's currency `to`.
// If we don't have a rate, we show the original rather than guess.
export function displayPrice(amount, from = 'EUR', to = detectCurrency()) {
  if (amount == null) return ''
  if (from === to) return formatMoney(amount, from)
  const c = convert(amount, from, to)
  return c != null ? formatMoney(c, to) : formatMoney(amount, from)
}
