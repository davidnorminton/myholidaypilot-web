// Unsplash attribution helpers.
//
// Our images are sourced through the Unsplash API (the builder searches it, and
// every URL carries an ixid). That puts us under the API Terms rather than the
// plain Unsplash License: the License doesn't ask for credit, but the API Terms
// require that each time we display a photo we attribute Unsplash AND the
// photographer, with a link back to the photographer's profile — and that every
// link back carries utm params. See https://unsplash.com/api-terms
//
// Photos that didn't come from Unsplash (our own uploads, other CDNs) are not
// covered by any of this, so the helpers below detect and skip them.

// Must match the application name registered with Unsplash — it's what the
// referral shows up as in the photographer's stats.
export const UNSPLASH_APP = 'myholidaypilot'
const UTM = `utm_source=${UNSPLASH_APP}&utm_medium=referral`

const UNSPLASH_HOST = /^https?:\/\/images\.unsplash\.com\//i

export const isUnsplashUrl = (url) => typeof url === 'string' && UNSPLASH_HOST.test(url)

// Append our utm params to any unsplash.com link (profile or home).
export function withUtm(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    u.searchParams.set('utm_source', UNSPLASH_APP)
    u.searchParams.set('utm_medium', 'referral')
    return u.toString()
  } catch {
    return `${url}${url.includes('?') ? '&' : '?'}${UTM}`
  }
}

export const UNSPLASH_HOME = withUtm('https://unsplash.com/')

// A stored credit is usually just a display name ("Mimmo Sigismondi"), but a
// good chunk were saved with Unsplash's full attribution string pasted in:
//   "Photo by Alain ROUILLER (unsplash.com/@alainr)"
// Those are gold — they carry the real username, which nothing else about a
// stored image does. Pull the two apart so the name displays cleanly and the
// profile link is the photographer's actual one.
//
// Do NOT be tempted to derive a username from the display name: measured against
// the ~98 credits that embed a real one, lowercasing and stripping spaces is
// right 20% of the time. "Lukas Tennie" is @luk10, "Caleb Miller" is @milljestic,
// and guesses like "Ryan" -> @ryan land on a real but *different* photographer.
const EMBEDDED = /^\s*(?:photo\s+by\s+)?(.+?)\s*\(\s*(?:https?:\/\/)?unsplash\.com\/@([A-Za-z0-9_-]+)\s*\)\s*$/i

export function parseCredit(credit) {
  const raw = String(credit || '').trim()
  if (!raw) return { name: '', username: '' }
  const m = raw.match(EMBEDDED)
  if (m) return { name: m[1].trim(), username: m[2] }
  // No username to be had — strip a stray "Photo by " prefix so it doesn't
  // render as "Photo by Photo by …".
  return { name: raw.replace(/^\s*photo\s+by\s+/i, '').trim(), username: '' }
}

// A stored image may carry the photographer's profile URL (creditUrl) or just a
// username; accept either, and tolerate neither.
export function profileUrl({ creditUrl, creditUsername } = {}) {
  if (creditUrl) return withUtm(creditUrl)
  if (creditUsername) return withUtm(`https://unsplash.com/@${creditUsername}`)
  return null
}
