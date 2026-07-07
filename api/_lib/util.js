export function send(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  // Default to no-store so user/live data is never cached by accident — but let
  // a route opt into caching by setting Cache-Control BEFORE calling send()
  // (e.g. public settings, images). Only apply the default if none was set.
  if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store')
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
