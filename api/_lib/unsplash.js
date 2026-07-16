// Unsplash helpers — shared by the builder API and scripts/backfill-credits.mjs
// so the two can never drift apart.
//
// Our images come from the Unsplash API, so the API Terms apply rather than the
// plain Unsplash License: every display needs the photographer credited with a
// link to their profile, and every "download-like" action (choosing a photo to
// set somewhere) has to be reported back to Unsplash.
// See https://unsplash.com/api-terms and the API Guidelines.

export const isUnsplashUrl = (u) => typeof u === 'string' && /^https?:\/\/images\.unsplash\.com\//i.test(u)

// Pull the attribution fields out of an Unsplash search hit.
// `credit` stays the display name so existing records keep working; the other
// two are what make a compliant profile link possible.
export function unsplashCredit(hit) {
  return {
    credit: hit?.user?.name || '',
    creditUsername: hit?.user?.username || '',
    creditUrl: hit?.user?.links?.html || '',
  }
}

// Report a download-like event (Guideline: Triggering a Download). Must be
// authorised and must keep the ixid that comes on download_location.
// Best-effort by design: attribution reporting should never break a pick.
export async function pingUnsplashDownload(hit, accessKey) {
  const loc = hit?.links?.download_location
  if (!loc || !accessKey) return false
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(loc, { headers: { Authorization: `Client-ID ${accessKey}` }, signal: ctrl.signal })
    clearTimeout(t)
    return r.ok
  } catch { return false }
}

// ── recovering a profile for an image we already have ───────────────────────
// Older records stored only the display name. Two ways back to a username, and
// NEVER a third: do not derive one from the display name. Measured against the
// ~98 credits that embed a real username, lowercasing and stripping spaces is
// right 20% of the time — "Lukas Tennie" is @luk10, "Caleb Miller" is
// @milljestic — and a guess like "Ryan" -> @ryan lands on a real but *different*
// photographer, which is worse than showing no link at all.

// 1. Free: many credits were saved with Unsplash's attribution pasted straight
//    in — "Photo by Alain ROUILLER (unsplash.com/@alainr)".
//    Mirrors parseCredit() in src/lib/unsplash.js.
const EMBEDDED = /^\s*(?:photo\s+by\s+)?(.+?)\s*\(\s*(?:https?:\/\/)?unsplash\.com\/@([A-Za-z0-9_-]+)\s*\)\s*$/i
export function fromCreditString(credit) {
  const m = String(credit || '').trim().match(EMBEDDED)
  if (!m) return null
  return { credit: m[1].trim(), creditUsername: m[2], creditUrl: `https://unsplash.com/@${m[2]}` }
}

// 2. API: an images.unsplash.com URL doesn't expose the API's photo id and there
//    is no public endpoint to map one to the other — but the URL's ixid encodes
//    the search query that found it. Re-run the search, match on photo path.
//    The ixid is base64'd pipe-separated fields; [4] is how it was found and [7]
//    the query: 3|955861|0|1|search|1||Eiffel%20Tower%20Paris|en|...
export function queryFromIxid(url) {
  try {
    const ixid = new URL(url).searchParams.get('ixid')
    if (!ixid) return ''
    const parts = Buffer.from(ixid, 'base64').toString('utf8').split('|')
    if (parts[4] !== 'search') return ''
    return decodeURIComponent(parts[7] || '')
  } catch { return '' }
}

// The stable identity of an Unsplash image URL: its path (photo-1502602898657-…).
export function photoPath(url) {
  try { return new URL(url).pathname.replace(/^\/+/, '') } catch { return '' }
}

export const RESERVE = 2   // leave a little quota spare rather than hit a 429

// `budget` is carried across calls: { calls, maxCalls, remaining }. `remaining`
// comes from Unsplash's own X-Ratelimit-Remaining header — the truth about
// quota, rather than us guessing and blundering into a 429.
export async function searchUnsplash(query, key, budget) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape&content_filter=high`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    budget.calls++
    const r = await fetch(url, { headers: { Authorization: `Client-ID ${key}` }, signal: ctrl.signal })
    // Record what Unsplash actually said. Without this the caller can only
    // report "it didn't work", which is useless when the question is *why* —
    // an exhausted quota, a rejected key and a restricted app all look alike
    // from the outside, and the answer is sitting in these headers.
    const rem = r.headers.get('x-ratelimit-remaining')
    const lim = r.headers.get('x-ratelimit-limit')
    if (rem != null && rem !== '') budget.remaining = Number(rem)
    if (lim != null && lim !== '') budget.limit = Number(lim)   // 50 = demo app, 5000 = production
    budget.lastStatus = r.status
    if (r.status === 429) throw new Error('RATE_LIMIT')
    // 401 means the key is rejected — wrong, revoked, or the Secret Key pasted
    // where the Access Key goes. Nothing to wait for and nothing to retry, so
    // fail loudly rather than letting it look like a transient blip. Unsplash
    // sends no rate-limit headers on a 401, so any quota figure we're holding
    // is meaningless and must not be reported as if it were current.
    if (r.status === 401) { budget.authFailed = true; throw new Error('BAD_KEY') }
    if (!r.ok) {
      // Unsplash puts the reason in the body — "Rate Limit Exceeded", "OAuth
      // error: The access token is invalid", etc. Carry it up.
      const why = await r.text().catch(() => '')
      budget.lastError = why.slice(0, 200)
      throw new Error(`HTTP ${r.status}${why ? `: ${why.replace(/\s+/g, ' ').slice(0, 120)}` : ''}`)
    }
    const j = await r.json()
    return j.results || []
  } finally { clearTimeout(t) }
}

// Resolve one image's photographer. Throws BUDGET when it would exceed the
// call cap or the remaining quota — the caller stops and reports progress.
// Returns null when Unsplash simply no longer returns the photo for its query.
export async function resolveCredit(image, queries, key, budget) {
  const want = photoPath(image?.url)
  if (!want) return null
  const tries = [...new Set([queryFromIxid(image.url), ...(queries || [])].filter(Boolean))]
  for (const q of tries) {
    if (budget.remaining <= RESERVE) throw new Error('QUOTA')
    if (budget.calls >= budget.maxCalls) throw new Error('BUDGET')
    const hits = await searchUnsplash(q, key, budget)
    const hit = hits.find((h) => photoPath(h?.urls?.raw || '') === want)
    if (hit) return { ...unsplashCredit(hit), credit: hit.user?.name || image.credit || '', creditLookupFailedAt: null, _via: q }
  }
  return null
}

// Work out an image's credit fields when something saves it.
//
// A caller may send the full set (the admin picker, straight off an Unsplash
// search), or just a url + a hand-typed credit (the manual row in Admin →
// Images). Rebuilding the object naively from the body wipes a username that a
// backfill worked hard to find, so:
//   · explicit values from the caller always win
//   · else, a username embedded in the credit text
//   · else, keep what's already stored — but only while the URL is unchanged,
//     since a different photo means a different photographer
export function resolveCreditFields({ url, body = {}, existing = null }) {
  const credit = String(body.credit ?? existing?.credit ?? '').slice(0, 120)
  const sameImage = existing?.url && existing.url === url
  const embedded = fromCreditString(credit)
  const username = String(body.creditUsername || '').trim()
    || embedded?.creditUsername
    || (sameImage ? existing?.creditUsername : '') || ''
  const profile = String(body.creditUrl || '').trim()
    || embedded?.creditUrl
    || (sameImage ? existing?.creditUrl : '') || ''
  return {
    credit,
    creditUsername: String(username).slice(0, 120),
    creditUrl: String(profile).slice(0, 300),
    // A new photo invalidates a previous "couldn't find this one" verdict.
    ...(sameImage ? {} : { creditLookupFailedAt: null }),
  }
}

// ── photographer reuse ──────────────────────────────────────────────────────
// Photographers shoot more than one place, so a name we've already resolved
// once needs no second lookup. Free, and it compounds: every API hit makes the
// next images cheaper.
//
// Guarded, because an exact display name is strong evidence but not proof:
//   · multi-word names only — "Luca" is two different people in our own data,
//     "Luca Pennacchioni" is not
//   · a name that has ever mapped to two usernames is dropped entirely
// The failure mode we're avoiding is crediting the wrong photographer, which is
// worse than crediting none.
export function buildPhotographerMap(images) {
  const seen = new Map()
  for (const im of images) {
    const user = im?.creditUsername
    if (!user) continue
    const name = creditName(im.credit)
    if (!isReusableName(name)) continue
    const key = name.toLowerCase()
    if (!seen.has(key)) seen.set(key, new Map())
    const m = seen.get(key)
    m.set(user, { creditUsername: user, creditUrl: im.creditUrl || `https://unsplash.com/@${user}` })
  }
  const out = new Map()
  for (const [name, users] of seen) {
    if (users.size !== 1) continue      // ambiguous — never guess between them
    out.set(name, [...users.values()][0])
  }
  return out
}

// The display name, with any embedded attribution stripped back off.
export function creditName(credit) {
  const raw = String(credit || '').trim()
  const m = raw.match(EMBEDDED)
  return (m ? m[1] : raw.replace(/^\s*photo\s+by\s+/i, '')).trim()
}

export const isReusableName = (name) => String(name || '').trim().split(/\s+/).filter(Boolean).length >= 2

export function fromPhotographerMap(image, map) {
  const name = creditName(image?.credit)
  if (!isReusableName(name)) return null
  const hit = map.get(name.toLowerCase())
  if (!hit) return null
  return { credit: image.credit, ...hit, creditLookupFailedAt: null }
}
