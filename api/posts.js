import { getDb, schema, eq, desc } from './_lib/db.js'
import { optionalUser, requireUser, requireAdmin } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { blogPosts } = schema
const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default handler(async (req, res) => {
  const db = getDb()

  if (req.method === 'GET') {
    const user = await optionalUser(req)
    const all = req.query?.all === '1' && user?.role === 'admin'
    // Optional paging (?limit=&offset=) for the home carousel's load-more;
    // without params the full list returns as before.
    const limit = Math.min(Number(req.query?.limit) || 0, 50)
    const offset = Math.max(Number(req.query?.offset) || 0, 0)
    let qy = all
      ? db.select().from(blogPosts).orderBy(desc(blogPosts.publishedAt))
      : db.select().from(blogPosts).where(eq(blogPosts.status, 'published')).orderBy(desc(blogPosts.publishedAt))
    if (limit) qy = qy.limit(limit).offset(offset)
    // Public list — edge-cached; new/edited posts appear within 5 min.
    if (!all) res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
    const rows = await qy
    // Cards don't need article bodies — the post page fetches its own by slug.
    return send(res, 200, all ? rows : rows.map(({ body, ...card }) => card))
  }
  if (req.method === 'POST') {
    const user = await requireUser(req); requireAdmin(user)
    const p = await readBody(req)
    const status = p.status === 'published' ? 'published' : 'draft'
    const [row] = await db.insert(blogPosts).values({
      slug: slugify(p.slug || p.title), title: p.title || 'Untitled', dek: p.dek ?? null,
      coverImage: p.coverImage ?? null, tag: p.tag ?? null, author: p.author ?? user.name ?? null,
      body: p.body ?? [], tags: p.tags ?? (p.tag ? [p.tag] : []), status,
      publishedAt: status === 'published' ? (p.publishedAt ?? Date.now()) : null,
    }).returning()
    return send(res, 201, row)
  }
  throw fail(405, 'Method not allowed')
})
