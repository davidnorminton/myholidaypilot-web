import { getDb, schema, eq, and } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { trips, tripPlaces } = schema

async function assertOwner(db, tripId, userId) {
  const [t] = await db.select({ id: trips.id }).from(trips).where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
  if (!t) throw fail(404, 'Trip not found')
}
const touch = (db, tripId) => db.update(trips).set({ updatedAt: Date.now() }).where(eq(trips.id, tripId))

export default handler(async (req, res) => {
  const user = await requireUser(req)
  const db = getDb()

  if (req.method === 'POST') {
    const { tripId, regionId, placeId, date, note, sortOrder, attractions, restaurants } = await readBody(req)
    if (!tripId || !regionId || !placeId) throw fail(400, 'tripId, regionId, placeId required')
    await assertOwner(db, tripId, user.id)
    await db.insert(tripPlaces).values({
      tripId, regionId, placeId, date: date || null, note: note || null,
      sortOrder: sortOrder ?? 0, attractions: attractions ?? [], restaurants: restaurants ?? [],
    }).onConflictDoNothing()
    await touch(db, tripId)
    return send(res, 201, { ok: true })
  }
  if (req.method === 'PATCH') {
    const { tripId, regionId, placeId, ...fields } = await readBody(req)
    await assertOwner(db, tripId, user.id)
    const set = {}
    for (const k of ['date', 'note', 'done', 'sortOrder', 'attractions', 'restaurants'])
      if (fields[k] !== undefined) set[k] = fields[k]
    await db.update(tripPlaces).set(set)
      .where(and(eq(tripPlaces.tripId, tripId), eq(tripPlaces.regionId, regionId), eq(tripPlaces.placeId, placeId)))
    await touch(db, tripId)
    return send(res, 200, { ok: true })
  }
  if (req.method === 'DELETE') {
    const { tripId, regionId, placeId } = req.query || {}
    await assertOwner(db, tripId, user.id)
    await db.delete(tripPlaces)
      .where(and(eq(tripPlaces.tripId, tripId), eq(tripPlaces.regionId, regionId), eq(tripPlaces.placeId, placeId)))
    await touch(db, tripId)
    return send(res, 200, { ok: true })
  }
  throw fail(405, 'Method not allowed')
})
