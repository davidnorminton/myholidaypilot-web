import { OAuth2Client } from 'google-auth-library'
import { getDb, schema, eq } from './db.js'
import { fail } from './util.js'

const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
const oauth = clientId ? new OAuth2Client(clientId) : null
const adminEmails = (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
const isProd = process.env.NODE_ENV === 'production' ||
  (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development')

// Admin check. SECURITY: if ADMIN_EMAILS is unset we fail CLOSED in
// production (nobody is admin) rather than open (everybody is). The
// permissive empty-list behaviour survives only in local dev, where the
// dev sign-in is already admin anyway.
const isAdmin = (email) => adminEmails.length === 0
  ? !isProd
  : adminEmails.includes((email || '').toLowerCase())

async function profileFromReq(req) {
  // Our own session (exchanged at sign-in) — outlives Google's 1-hour tokens.
  const sess = (req.headers['x-session'] || '').toString()
  if (sess) {
    const db = getDb()
    const [row] = await db.select({
      token: schema.sessions.token, expiresAt: schema.sessions.expiresAt,
      id: schema.users.id, email: schema.users.email, name: schema.users.name, picture: schema.users.picture,
    }).from(schema.sessions)
      .leftJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
      .where(eq(schema.sessions.token, sess))
    if (row && row.expiresAt > Date.now() && row.id) {
      return { id: row.id, email: (row.email || '').toLowerCase(), name: row.name || row.email, picture: row.picture || '' }
    }
    // fall through: an expired/unknown session may still ride with a Bearer token
  }

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (token && oauth) {
    // An expired/garbled Google token must read as "not signed in" (401),
    // not an unhandled 500 — tokens expire hourly and stale tabs send them.
    try {
      const ticket = await oauth.verifyIdToken({ idToken: token, audience: clientId })
      const p = ticket.getPayload()
      return { id: p.sub, email: (p.email || '').toLowerCase(), name: p.name || p.email, picture: p.picture || '' }
    } catch {
      return null
    }
  }
  // Dev fallback — only when Google isn't configured AND not in production.
  if (!oauth && !isProd) {
    const email = (req.headers['x-dev-email'] || '').toString().toLowerCase()
    const id = (req.headers['x-dev-id'] || email).toString()
    if (id) return { id, email, name: (req.headers['x-dev-name'] || 'Local user').toString(), picture: '', dev: true }
  }
  return null
}

// Verifies identity, upserts the user row, returns { id, email, name, picture, role }.
export async function requireUser(req) {
  const p = await profileFromReq(req)
  if (!p) throw fail(401, 'Not signed in')
  // Local dev sign-in is always admin (it only works locally, when Google is
  // unconfigured and not in production). Real Google users honour ADMIN_EMAILS.
  const role = (p.dev || isAdmin(p.email)) ? 'admin' : 'user'
  const db = getDb()
  await db.insert(schema.users)
    .values({ id: p.id, email: p.email, name: p.name, picture: p.picture, role })
    .onConflictDoUpdate({ target: schema.users.id, set: { email: p.email, name: p.name, picture: p.picture, role } })
  return { ...p, role }
}

export async function optionalUser(req) { try { return await requireUser(req) } catch { return null } }
export function requireAdmin(user) { if (!user || user.role !== 'admin') throw fail(403, 'Admin only') }
