import { getDb, schema, desc } from './_lib/db.js'
import { optionalUser, requireAdmin } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { subscribers } = schema
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default handler(async (req, res) => {
  const db = getDb()

  if (req.method === 'POST') { // public signup
    const { email } = await readBody(req)
    const e = (email || '').trim().toLowerCase()
    if (!EMAIL.test(e)) throw fail(400, 'Please enter a valid email')
    await db.insert(subscribers).values({ email: e }).onConflictDoNothing()
    return send(res, 201, { ok: true })
  }
  if (req.method === 'GET') { // admin: list for export
    requireAdmin(await optionalUser(req))
    const rows = await db.select().from(subscribers).orderBy(desc(subscribers.createdAt))
    return send(res, 200, rows)
  }
  throw fail(405, 'Method not allowed')
})
