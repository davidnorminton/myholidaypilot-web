import { getDb, schema, eq, and, asc } from '../_lib/db.js'
import { requireUser } from '../_lib/auth.js'
import { send, readBody, fail, handler } from '../_lib/util.js'
const { trips, tripPlaces } = schema

async function ownTrip(db, id, userId) {
  const [t] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.userId, userId)))
  if (!t) throw fail(404, 'Trip not found')
  return t
}

export default handler(async (req, res) => {
  const user = await requireUser(req)
  const db = getDb()
  const id = req.query.id
  const trip = await ownTrip(db, id, user.id)

  if (req.method === 'GET') {
    const places = await db.select().from(tripPlaces).where(eq(tripPlaces.tripId, id)).orderBy(asc(tripPlaces.sortOrder))
    return send(res, 200, { trip, places })
  }
  if (req.method === 'PATCH') {
    const { name, startDate, endDate } = await readBody(req)
    const set = { updatedAt: Date.now() }
    if (name !== undefined) set.name = name
    if (startDate !== undefined) set.startDate = startDate
    if (endDate !== undefined) set.endDate = endDate
    const [row] = await db.update(trips).set(set).where(eq(trips.id, id)).returning()
    return send(res, 200, row)
  }
  if (req.method === 'DELETE') {
    await db.delete(trips).where(eq(trips.id, id))   // trip_places cascade
    return send(res, 200, { ok: true })
  }
  throw fail(405, 'Method not allowed')
})
