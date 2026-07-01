import { getDb, schema, eq, and } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { favourites } = schema

export default handler(async (req, res) => {
  const user = await requireUser(req)
  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db.select().from(favourites).where(eq(favourites.userId, user.id))
    return send(res, 200, rows)
  }
  if (req.method === 'POST') {
    const { regionId, placeId } = await readBody(req)
    if (!regionId || !placeId) throw fail(400, 'regionId and placeId required')
    await db.insert(favourites).values({ userId: user.id, regionId, placeId }).onConflictDoNothing()
    return send(res, 201, { ok: true })
  }
  if (req.method === 'DELETE') {
    const { regionId, placeId } = req.query || {}
    await db.delete(favourites).where(and(
      eq(favourites.userId, user.id), eq(favourites.regionId, regionId), eq(favourites.placeId, placeId)))
    return send(res, 200, { ok: true })
  }
  throw fail(405, 'Method not allowed')
})
