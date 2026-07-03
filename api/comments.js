import { getDb, schema, eq, and, asc, desc, isNull } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { comments, users } = schema

// Build the WHERE for a single area, distinguishing region vs place comments.
function areaWhere({ country, type, region, place }) {
  const parts = [eq(comments.countryId, country), eq(comments.targetType, type), eq(comments.regionId, region)]
  parts.push(type === 'place' ? eq(comments.placeId, place) : isNull(comments.placeId))
  return and(...parts)
}

export default handler(async (req, res) => {
  const db = getDb()

  // ── my comments (signed in) ─────────────────────────────────────────────────
  if (req.method === 'GET' && (req.query || {}).mine) {
    const user = await requireUser(req)
    const rows = await db.select({
      id: comments.id, body: comments.body, createdAt: comments.createdAt,
      targetType: comments.targetType, regionId: comments.regionId, placeId: comments.placeId,
    }).from(comments).where(eq(comments.userId, user.id)).orderBy(desc(comments.createdAt)).limit(100)
    return send(res, 200, rows)
  }

  // ── list (public) ──────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { country, type, region, place } = req.query || {}
    if (!country || !type || !region) throw fail(400, 'country, type, region required')
    if (type === 'place' && !place) throw fail(400, 'place required for place comments')
    const rows = await db.select({
      id: comments.id, parentId: comments.parentId, body: comments.body,
      createdAt: comments.createdAt, userId: comments.userId,
      authorName: users.name, authorPicture: users.picture,
    }).from(comments).leftJoin(users, eq(users.id, comments.userId))
      .where(areaWhere({ country, type, region, place }))
      .orderBy(asc(comments.createdAt))
    return send(res, 200, rows)
  }

  // ── create (auth) ──────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const user = await requireUser(req)
    const b = await readBody(req)
    const body = (b.body || '').trim()
    if (!body) throw fail(400, 'Comment cannot be empty')
    if (body.length > 4000) throw fail(400, 'Comment is too long')

    let area
    if (b.parentId) {
      // A reply inherits its parent's area, and the parent must be top-level.
      const [parent] = await db.select().from(comments).where(eq(comments.id, b.parentId))
      if (!parent) throw fail(404, 'Parent comment not found')
      if (parent.parentId) throw fail(400, 'You can only reply to a top-level comment')
      area = { countryId: parent.countryId, targetType: parent.targetType, regionId: parent.regionId, placeId: parent.placeId }
    } else {
      const { countryId, targetType, regionId, placeId } = b
      if (!countryId || !targetType || !regionId) throw fail(400, 'countryId, targetType, regionId required')
      if (targetType === 'place' && !placeId) throw fail(400, 'placeId required for place comments')
      area = { countryId, targetType, regionId, placeId: targetType === 'place' ? placeId : null }
    }

    const [row] = await db.insert(comments).values({
      ...area, parentId: b.parentId || null, userId: user.id, body,
    }).returning()
    return send(res, 201, { ...row, authorName: user.name, authorPicture: user.picture })
  }

  throw fail(405, 'Method not allowed')
})
