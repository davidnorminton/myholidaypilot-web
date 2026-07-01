import { getDb, schema, eq } from '../_lib/db.js'
import { optionalUser, requireUser, requireAdmin } from '../_lib/auth.js'
import { send, readBody, fail, handler } from '../_lib/util.js'
const { blogPosts } = schema

export default handler(async (req, res) => {
  const db = getDb()
  const slug = req.query.slug

  if (req.method === 'GET') {
    const [row] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug))
    if (!row) throw fail(404, 'Not found')
    if (row.status !== 'published') requireAdmin(await optionalUser(req)) // drafts: admins only
    return send(res, 200, row)
  }
  if (req.method === 'PATCH') {
    const user = await requireUser(req); requireAdmin(user)
    const p = await readBody(req)
    const set = { updatedAt: Date.now() }
    for (const k of ['title', 'dek', 'coverImage', 'tag', 'author', 'body', 'tags', 'status', 'publishedAt', 'slug'])
      if (p[k] !== undefined) set[k] = p[k]
    if (p.status === 'published' && p.publishedAt === undefined) set.publishedAt = Date.now()
    const [row] = await db.update(blogPosts).set(set).where(eq(blogPosts.slug, slug)).returning()
    if (!row) throw fail(404, 'Not found')
    return send(res, 200, row)
  }
  if (req.method === 'DELETE') {
    const user = await requireUser(req); requireAdmin(user)
    await db.delete(blogPosts).where(eq(blogPosts.slug, slug))
    return send(res, 200, { ok: true })
  }
  throw fail(405, 'Method not allowed')
})
