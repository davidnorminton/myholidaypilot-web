// Email/password authentication, alongside Google sign-in.
//
// Security properties:
// - scrypt (node:crypto) with OWASP parameters; 32-byte per-user salt;
//   constant-time hash comparison (timingSafeEqual).
// - Unknown-email logins still run a full scrypt against a dummy hash so
//   response timing does not reveal whether an account exists.
// - Identical error message for wrong email and wrong password.
// - DB-backed brute-force throttle: 10 failed attempts per email per
//   15 minutes (serverless functions share no memory, so this lives in SQL).
// - Successful login issues the same 30-day random session token the Google
//   flow uses — downstream auth is identical for both methods.
import crypto from 'node:crypto'
import { rateLimit } from './_lib/ratelimit.js'
import { getDb, schema, eq, and } from './_lib/db.js'
import { send, readBody, fail, handler } from './_lib/util.js'

const { users, sessions, loginAttempts } = schema

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
const WINDOW = 15 * 60 * 1000     // throttle window
const MAX_FAILS = 10              // fails per window per email

// scrypt parameters (OWASP): N=2^14, r=8, p=1, 32-byte salt, 64-byte key.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

function hashPassword(password, salt = crypto.randomBytes(32)) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => {
      if (err) return reject(err)
      resolve(`scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${key.toString('hex')}`)
    })
  })
}

async function verifyPassword(password, stored) {
  try {
    const [algo, N, r, p, saltHex, hashHex] = String(stored || '').split('$')
    if (algo !== 'scrypt') return false
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const actual = await new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, expected.length, { N: +N, r: +r, p: +p }, (err, key) => err ? reject(err) : resolve(key))
    })
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  } catch { return false }
}

// A real hash of a random password — verified against on unknown emails so
// timing is indistinguishable from a wrong-password attempt.
const DUMMY_HASH_PROMISE = hashPassword(crypto.randomBytes(16).toString('hex'))

async function throttle(db, email) {
  const now = Date.now()
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.email, email))
  if (row && now - row.windowStart < WINDOW && row.count >= MAX_FAILS) {
    const mins = Math.ceil((row.windowStart + WINDOW - now) / 60000)
    throw fail(429, `Too many attempts — try again in ${mins} minute${mins === 1 ? '' : 's'}`)
  }
  return row
}

async function recordFail(db, email, row) {
  const now = Date.now()
  if (row && now - row.windowStart < WINDOW) {
    await db.update(loginAttempts).set({ count: row.count + 1 }).where(eq(loginAttempts.id, row.id))
  } else if (row) {
    await db.update(loginAttempts).set({ windowStart: now, count: 1 }).where(eq(loginAttempts.id, row.id))
  } else {
    await db.insert(loginAttempts).values({ email, windowStart: now, count: 1 })
  }
}

async function issueSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + THIRTY_DAYS
  await db.insert(sessions).values({ token, userId, expiresAt })
  return { token, expiresAt }
}

export default handler(async (req, res) => {
  if (req.method !== 'POST') throw fail(405, 'Method not allowed')
  const db = getDb()
  const q = req.query || {}
  const body = await readBody(req)

  // ── create account ──────────────────────────────────────────────────────
  // ── bot protection ──────────────────────────────────────────────────────
  // Layered: a honeypot field bots auto-fill, a minimum-time check on signup
  // (humans don't complete a form in under 3s), and Cloudflare Turnstile when
  // TURNSTILE_SECRET is configured (skipped otherwise so dev keeps working).
  async function verifyHuman(kind) {
    if (String(body.website || '').trim() !== '') throw fail(400, 'Something went wrong — please try again')
    if (kind === 'signup') {
      const t0 = Number(body.t0 || 0)
      if (t0 && Date.now() - t0 < 3000) throw fail(400, 'Please take a moment and try again')
    }
    const secret = process.env.TURNSTILE_SECRET
    if (!secret) return
    const token = String(body.captcha || '')
    if (!token) throw fail(400, 'Please complete the verification')
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    })
    const j = await r.json().catch(() => ({}))
    if (!j.success) throw fail(400, 'Verification failed — please try again')
  }

  if (q.action === 'signup') {
    rateLimit(req, { key: 'signup', limit: 5, windowMs: 10 * 60_000 })   // 5 / 10 min
    await verifyHuman('signup')
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = String(body.name || '').trim().slice(0, 80)
    if (!EMAIL.test(email) || email.length > 160) throw fail(400, 'Please enter a valid email')
    if (password.length < 8) throw fail(400, 'Password must be at least 8 characters')
    if (password.length > 200) throw fail(400, 'Password is too long')
    if (password.toLowerCase() === email) throw fail(400, 'Password cannot be your email')
    if (!name) throw fail(400, 'Please add your name')

    const [existing] = await db.select({ id: users.id, passwordHash: users.passwordHash })
      .from(users).where(eq(users.email, email))
    if (existing) {
      throw fail(409, existing.passwordHash
        ? 'An account with this email already exists — sign in instead'
        : 'This email is registered via Google — use "Sign in with Google"')
    }

    const passwordHash = await hashPassword(password)
    const id = `local_${crypto.randomUUID()}`
    await db.insert(users).values({ id, email, name, picture: '', role: 'user', passwordHash })
    const sess = await issueSession(db, id)
    return send(res, 201, { ...sess, name, email, picture: '' })
  }

  // ── sign in ─────────────────────────────────────────────────────────────
  if (q.action === 'login') {
    rateLimit(req, { key: 'login', limit: 10, windowMs: 10 * 60_000 })   // 10 / 10 min
    await verifyHuman('login')
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!EMAIL.test(email) || !password) throw fail(400, 'Invalid email or password')

    const attemptRow = await throttle(db, email)

    const [u] = await db.select().from(users).where(eq(users.email, email))
    // Always verify against *something* so timing doesn't reveal whether the
    // account exists or is Google-only.
    const stored = u?.passwordHash || await DUMMY_HASH_PROMISE
    const ok = await verifyPassword(password, stored)

    if (!u || !u.passwordHash || !ok) {
      await recordFail(db, email, attemptRow)
      throw fail(401, 'Invalid email or password')
    }

    // success: clear the throttle window, issue a session
    if (attemptRow) await db.delete(loginAttempts).where(eq(loginAttempts.id, attemptRow.id))
    const sess = await issueSession(db, u.id)
    return send(res, 200, { ...sess, name: u.name, email: u.email, picture: u.picture || '' })
  }

  throw fail(404, 'Unknown action')
})
