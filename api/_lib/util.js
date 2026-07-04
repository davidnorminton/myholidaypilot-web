export function send(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  // API responses are live data — never cache them (browser, service worker,
  // or Vercel edge). Static /data JSON keeps its CDN caching separately.
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body) { try { return JSON.parse(req.body) } catch { return {} } }
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) : {}
}

export function fail(status, message) { const e = new Error(message); e.status = status; return e }

// Wraps a handler with JSON error handling so routes can just `throw fail(...)`.
export function handler(fn) {
  return async (req, res) => {
    try { await fn(req, res) }
    catch (e) { send(res, e.status || 500, { error: e.message || 'Server error' }) }
  }
}
