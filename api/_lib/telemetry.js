// Ship server-side errors to New Relic — the missing half of every debugging
// session this project has had. The browser agent sees what users see; this
// sees what the FUNCTIONS saw: the Unsplash 401s, the Turso hiccups, the
// unexpected 500s that until now existed only as screenshots of their symptoms.
//
// Deliberately the Log API over the Node APM agent: the full agent assumes a
// long-lived process and behaves poorly in serverless, and Vercel's log-drain
// integration (the zero-code path) needs a Pro plan. A direct POST to the Log
// API works on any plan, adds one dependency-free file, and costs one bounded
// await on the error path only.
//
// Configuration (Vercel → Settings → Environment Variables):
//   NEW_RELIC_LICENSE_KEY   the INGEST license key (not a user API key)
//   NEW_RELIC_LOG_ENDPOINT  optional; EU accounts: https://log-api.eu.newrelic.com/log/v1
// Absent key = silent no-op, so local dev and preview builds send nothing.

const ENDPOINT = process.env.NEW_RELIC_LOG_ENDPOINT || 'https://log-api.newrelic.com/log/v1'

// Notable non-error signals — the things worth knowing about even though the
// request succeeded: an Unsplash key rejected, a rate limit hit, a jailbreak
// canary tripped. Same bounded, silent-without-key behaviour as reportError.
export async function reportEvent(name, attributes = {}) {
  const key = process.env.NEW_RELIC_LICENSE_KEY
  if (!key) return { sent: false, reason: 'NEW_RELIC_LICENSE_KEY not set' }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 1500)
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': key },
      signal: ctrl.signal,
      body: JSON.stringify([{
        message: name,
        level: 'warn',
        timestamp: Date.now(),
        attributes: {
          service: 'myholidaypilot-api',
          event: name,
          deployment: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
          region: process.env.VERCEL_REGION || '',
          ...attributes,
        },
      }]),
    })
    // 202 = accepted and it WILL appear in Logs. 403 = wrong key TYPE (a User
    // key where the Ingest–License key belongs). Anything else, the body says.
    return { sent: r.status === 202, status: r.status, endpoint: ENDPOINT,
      body: r.status === 202 ? '' : (await r.text().catch(() => '')).slice(0, 160) }
  } catch (e) {
    return { sent: false, reason: String(e.message), endpoint: ENDPOINT }
  } finally { clearTimeout(t) }
}

export async function reportError(err, req, extra = {}) {
  const key = process.env.NEW_RELIC_LICENSE_KEY
  if (!key) return
  const ctrl = new AbortController()
  // Bounded: an observability outage must never turn a 500 into a hang.
  const t = setTimeout(() => ctrl.abort(), 1500)
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': key },
      signal: ctrl.signal,
      body: JSON.stringify([{
        message: `${req?.method || '-'} ${String(req?.url || '').split('?')[0]} — ${err?.message || err}`,
        level: 'error',
        timestamp: Date.now(),
        attributes: {
          service: 'myholidaypilot-api',
          'error.message': String(err?.message || err).slice(0, 500),
          'error.stack': String(err?.stack || '').slice(0, 2000),
          'http.method': req?.method || '',
          'http.path': String(req?.url || '').split('?')[0].slice(0, 200),
          deployment: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
          region: process.env.VERCEL_REGION || '',
          ...extra,
        },
      }]),
    })
  } catch { /* never let telemetry become the outage */ }
  finally { clearTimeout(t) }
}
