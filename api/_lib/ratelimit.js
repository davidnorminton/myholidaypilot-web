// Minimal per-IP sliding-window limiter. In-memory, so limits apply PER
// serverless instance — honest scope: this blunts brute force and AI-credit
// burn from a single source, not a distributed attack. For that, a KV-backed
// limiter (or Vercel WAF rules) is the upgrade path.
const buckets = new Map()

export function rateLimit(req, { key = 'global', limit = 20, windowMs = 60_000 } = {}) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const k = `${key}:${ip}`
  const hits = (buckets.get(k) || []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    const err = new Error('Too many requests — slow down and try again shortly')
    err.status = 429
    throw err
  }
  hits.push(now)
  buckets.set(k, hits)
  // opportunistic cleanup so the map can't grow unbounded
  if (buckets.size > 5000) {
    for (const [bk, ts] of buckets) if (!ts.some((t) => now - t < windowMs)) buckets.delete(bk)
  }
}
