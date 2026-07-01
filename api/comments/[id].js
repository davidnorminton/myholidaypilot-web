import { getDb, schema, eq } from '../_lib/db.js'
import { requireUser } from '../_lib/auth.js'
import { send, fail, handler } from '../_lib/util.js'
const { comments } = schema

export default handler(async (req, res) => {
  if (req.method !== 'DELETE') throw fail(405, 'Method not allowed')
  const user = await requireUser(req)
  const db = getDb()
  const id = req.query.id

  const [c] = await db.select().from(comments).where(eq(comments.id, id))
  if (!c) throw fail(404, 'Comment not found')
  if (c.userId !== user.id && user.role !== 'admin') throw fail(403, 'Not your comment')

  // Top-level deletion takes its replies with it (two-level thread).
  if (!c.parentId) await db.delete(comments).where(eq(comments.parentId, id))
  await db.delete(comments).where(eq(comments.id, id))
  return send(res, 200, { ok: true })
})
