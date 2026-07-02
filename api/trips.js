import { getDb, schema, eq, and, desc } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { trips } = schema

// Trip sync. The client owns the trip shape; the server stores it as a JSON
// document per trip, keyed by the client-generated id and scoped to the user.
export default handler(async (req, res) => {
  const user = await requireUser(req)
  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db.select().from(trips).where(eq(trips.userId, user.id)).orderBy(desc(trips.updatedAt))
    return send(res, 200, rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt, data: JSON.parse(r.data || '{}') })))
  }

  if (req.method === 'POST') { // upsert one trip
    const { id, name, data, updatedAt } = await readBody(req)
    if (!id || typeof id !== 'string' || id.length > 64) throw fail(400, 'Missing trip id')
    if (!data || typeof data !== 'object') throw fail(400, 'Missing trip data')
    const payload = JSON.stringify(data)
    if (payload.length > 400_000) throw fail(400, 'Trip is too large')

    const [existing] = await db.select({ userId: trips.userId }).from(trips).where(eq(trips.id, id))
    if (existing && existing.userId !== user.id) throw fail(403, 'Not your trip')

    const ts = Number(updatedAt) || Date.now()
    if (existing) {
      await db.update(trips).set({ name: name || 'My trip', data: payload, updatedAt: ts }).where(eq(trips.id, id))
    } else {
      await db.insert(trips).values({ id, userId: user.id, name: name || 'My trip', data: payload, updatedAt: ts })
    }
    return send(res, 200, { ok: true, id, updatedAt: ts })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://x')
    const id = url.searchParams.get('id')
    if (!id) throw fail(400, 'Missing trip id')
    await db.delete(trips).where(and(eq(trips.id, id), eq(trips.userId, user.id)))
    return send(res, 200, { ok: true })
  }

  throw fail(405, 'Method not allowed')
})
