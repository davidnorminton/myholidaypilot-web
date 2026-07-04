import crypto from 'node:crypto'
import { getDb, schema, eq } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { send, fail, handler } from './_lib/util.js'
const { sessions } = schema

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

// Exchange a fresh Google credential (verified by requireUser's Bearer path)
// for a long-lived session token, so hour-old Google tokens stop mattering.
export default handler(async (req, res) => {
  const db = getDb()

  if (req.method === 'POST') {
    const user = await requireUser(req)             // verifies the fresh Google token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + THIRTY_DAYS
    await db.insert(sessions).values({ token, userId: user.id, expiresAt })
    return send(res, 200, { token, expiresAt, role: user.role })
  }

  if (req.method === 'DELETE') {
    const t = (req.headers['x-session'] || '').toString()
    if (t) await db.delete(sessions).where(eq(sessions.token, t))
    return send(res, 200, { ok: true })
  }

  throw fail(405, 'Method not allowed')
})
