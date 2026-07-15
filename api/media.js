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
  // s-maxage, not just max-age. This is a Serverless Function, and Vercel's edge
  // only caches a function response when it sees s-maxage — max-age alone is a
  // browser directive, so without this EVERY new visitor cold-starts the
  // function and reads the blob out of Turso again. A page of blog covers meant
  // an invocation and a DB read per image, per visitor.
  // Safe to pin forever: upload.js mints the id from the filename plus a
  // timestamp and only ever INSERTs, so an id's bytes never change. Replacing an
  // image produces a new id and a new URL.
  res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
  res.end(buf)
})
