import { getDb, schema, eq } from './_lib/db.js'
import { requireUser, requireAdmin } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { siteSettings } = schema

// Site settings: public read (the landing page needs them), admin write.
export default handler(async (req, res) => {
  const db = getDb()

  if (req.method === 'GET') {
    try {
      const rows = await db.select().from(siteSettings)
      const all = Object.fromEntries(rows.map((r) => [r.key, r.value]))
      if ((req.query || {}).all) {
        // admin view: include ai.* config, mask secrets to their tail
        const user = await requireUser(req)
        requireAdmin(user)
        res.setHeader('Cache-Control', 'private, no-store')   // never cache admin/secret view
        const out = {}
        for (const [k, v] of Object.entries(all)) {
          out[k] = k.startsWith('secret.') ? `••••${String(v).slice(-4)}` : v
        }
        return send(res, 200, out)
      }
      // public view: never expose secrets or AI config
      const pub = {}
      for (const [k, v] of Object.entries(all)) {
        if (!k.startsWith('secret.') && !k.startsWith('ai.')) pub[k] = v
      }
      // Public settings are identical for everyone and change rarely (admin
      // edits). Cache hard at the edge with stale-while-revalidate so the hub
      // images (which read these values) aren't gated behind a cold DB query
      // on every page load. Admin edits surface within a few minutes.
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400')
      return send(res, 200, pub)
    } catch {
      return send(res, 200, {})   // table not migrated yet — defaults apply
    }
  }

  if (req.method === 'PUT') {
    const user = await requireUser(req)
    requireAdmin(user)
    const body = await readBody(req)
    if (!body || typeof body !== 'object') throw fail(400, 'Expected an object of settings')
    for (const [key, value] of Object.entries(body)) {
      if (key.length > 120) throw fail(400, `Key too long: ${key}`)
      if (key.startsWith('secret.') && String(value).startsWith('••••')) continue
      if (value == null || value === '') {
        await db.delete(siteSettings).where(eq(siteSettings.key, key))
      } else {
        if (String(value).length > 4000) throw fail(400, `Value too long for ${key}`)
        await db.insert(siteSettings).values({ key, value: String(value), updatedAt: Date.now() })
          .onConflictDoUpdate({ target: siteSettings.key, set: { value: String(value), updatedAt: Date.now() } })
      }
    }
    return send(res, 200, { ok: true })
  }

  throw fail(405, 'Method not allowed')
})
