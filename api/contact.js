import { getDb, schema, desc } from './_lib/db.js'
import { optionalUser, requireAdmin } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'

const { contactMessages } = schema
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default handler(async (req, res) => {
  const db = getDb()

  if (req.method === 'POST') { // public contact form
    const { name, email, subject, body, website, ts } = await readBody(req)

    // Bot protection 1: honeypot. 'website' is a hidden field no human fills in.
    // Bots that auto-complete every field will populate it → silently accept
    // and discard (return ok so the bot doesn't learn it was caught).
    if (website && String(website).trim()) return send(res, 201, { ok: true })

    // Bot protection 2: timing. A real person takes more than a couple of
    // seconds to read and fill the form; sub-2s submissions are almost always
    // scripted. Also silently discard.
    const elapsed = ts ? Date.now() - Number(ts) : 99999
    if (elapsed >= 0 && elapsed < 2000) return send(res, 201, { ok: true })

    const n = String(name || '').trim()
    const e = String(email || '').trim().toLowerCase()
    const msg = String(body || '').trim()
    if (!n) throw fail(400, 'Please add your name')
    if (!EMAIL.test(e)) throw fail(400, 'Please enter a valid email')
    if (msg.length < 5) throw fail(400, 'Please add a message')
    if (msg.length > 4000) throw fail(400, 'Message is too long')
    // Bot protection 3: reject messages stuffed with links (spam signature).
    const linkCount = (msg.match(/https?:\/\//gi) || []).length
    if (linkCount >= 4) return send(res, 201, { ok: true })

    await db.insert(contactMessages).values({
      name: n.slice(0, 120), email: e.slice(0, 160),
      subject: String(subject || '').trim().slice(0, 200) || null, body: msg,
    })
    return send(res, 201, { ok: true })
  }

  if (req.method === 'GET') { // admin: list submissions
    requireAdmin(await optionalUser(req))
    const rows = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(300)
    return send(res, 200, rows)
  }

  if (req.method === 'PATCH') { // admin: mark handled / unhandled
    requireAdmin(await optionalUser(req))
    const { id, handled } = await readBody(req)
    if (!id) throw fail(400, 'Missing id')
    const { eq } = await import('drizzle-orm')
    await db.update(contactMessages).set({ handled: handled ? 1 : 0 }).where(eq(contactMessages.id, id))
    return send(res, 200, { ok: true })
  }

  throw fail(405, 'Method not allowed')
})
