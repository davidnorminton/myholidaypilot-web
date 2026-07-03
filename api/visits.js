import { getDb, schema, eq, and } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { regionVisits } = schema

// "Been here" region visits — same contract shape as favourites.
export default handler(async (req, res) => {
  const user = await requireUser(req)
  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db.select().from(regionVisits).where(eq(regionVisits.userId, user.id))
    return send(res, 200, rows)
  }
  if (req.method === 'POST') {
    const { regionId, countryId } = await readBody(req)
    if (!regionId) throw fail(400, 'regionId required')
    await db.insert(regionVisits).values({ userId: user.id, regionId, countryId: countryId || 'italy' }).onConflictDoNothing()
    return send(res, 201, { ok: true })
  }
  if (req.method === 'DELETE') {
    const { regionId } = req.query || {}
    if (!regionId) throw fail(400, 'regionId required')
    await db.delete(regionVisits).where(and(eq(regionVisits.userId, user.id), eq(regionVisits.regionId, regionId)))
    return send(res, 200, { ok: true })
  }
  throw fail(405, 'Method not allowed')
})
