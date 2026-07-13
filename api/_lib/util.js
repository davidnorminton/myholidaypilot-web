export function send(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  // Default to no-store so user/live data is never cached by accident — but let
  // a route opt into caching by setting Cache-Control BEFORE calling send()
  // (e.g. public settings, images). Only apply the default if none was set.
  if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
  return true   // sentinel so dispatchers can tell "handled" from "no match"
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
// Unexpected (non-fail) errors are logged with their stack, and in local dev
// the stack rides along in the response so the client can show where it broke.
const isProd = process.env.NODE_ENV === 'production' ||
  (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development')
export function handler(fn) {
  return async (req, res) => {
    try { await fn(req, res) }
    catch (e) {
      if (!e.status) console.error(`[api] ${req.method} ${req.url || ''} —`, e.stack || e)
      send(res, e.status || 500, { error: e.message || 'Server error', ...(!isProd && !e.status ? { stack: e.stack } : {}) })
    }
  }
}
