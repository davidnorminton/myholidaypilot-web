import { getDb, schema, eq, desc, sql } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { trips, tripPlaces } = schema

export default handler(async (req, res) => {
  const user = await requireUser(req)
  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db.select().from(trips).where(eq(trips.userId, user.id)).orderBy(desc(trips.updatedAt))
    const counts = await db.select({ tripId: tripPlaces.tripId, n: sql`count(*)` })
      .from(tripPlaces).groupBy(tripPlaces.tripId)
    const byTrip = Object.fromEntries(counts.map((c) => [c.tripId, Number(c.n)]))
    return send(res, 200, rows.map((t) => ({ ...t, placeCount: byTrip[t.id] || 0 })))
  }
  if (req.method === 'POST') {
    const { name, startDate, endDate } = await readBody(req)
    const [row] = await db.insert(trips)
      .values({ userId: user.id, name: name || 'My trip', startDate: startDate || null, endDate: endDate || null })
      .returning()
    return send(res, 201, row)
  }
  throw fail(405, 'Method not allowed')
})
