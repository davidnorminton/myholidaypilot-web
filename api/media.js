// Serves images stored in the database (uploads made on serverless hosting,
// where the filesystem is read-only). Public read; content is admin-uploaded.
import { getDb, schema, eq } from './_lib/db.js'
import { fail, handler } from './_lib/util.js'

export default handler(async (req, res) => {
  if (req.method !== 'GET') throw fail(405, 'Method not allowed')
  const id = (req.query || {}).id
  if (!id) throw fail(400, 'Missing id')

  const db = getDb()
  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id))
  if (!row) throw fail(404, 'Not found')

  const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data)
  res.statusCode = 200
  res.setHeader('Content-Type', row.mime || 'application/octet-stream')
  res.setHeader('Content-Length', buf.length)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.end(buf)
})
