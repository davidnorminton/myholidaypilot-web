import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { requireUser, requireAdmin } from './_lib/auth.js'
import { getDb, schema } from './_lib/db.js'
import { send, readBody, fail, handler } from './_lib/util.js'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const FALLBACK_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }
const slug = (s) => (s || 'image').toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'image'
const MAX_WIDTH = 1600

export default handler(async (req, res) => {
  if (req.method !== 'POST') throw fail(405, 'Method not allowed')
  requireAdmin(await requireUser(req))

  const { filename, contentType, dataBase64 } = await readBody(req)
  if (!ALLOWED.has(contentType)) throw fail(400, 'Only JPG, PNG, WebP, GIF or AVIF images are allowed')

  const input = Buffer.from((dataBase64 || '').split(',').pop() || '', 'base64')
  if (!input.length) throw fail(400, 'Empty file')
  if (input.length > 10 * 1024 * 1024) throw fail(400, 'Image is larger than 10 MB')

  // Auto-orient, downscale to a sensible max width, and convert to WebP.
  let out, ext
  try {
    out = await sharp(input, { animated: contentType === 'image/gif' })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    ext = 'webp'
  } catch {
    out = input                                   // if processing fails, keep the original
    ext = FALLBACK_EXT[contentType]
  }

  const name = `${slug(filename)}-${Date.now().toString(36)}.${ext}`
  const dir = path.resolve('public', 'images')
  try {
    // Local dev: write into public/images so the file can be committed.
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, name), out)
    return send(res, 201, { url: `/images/${name}`, bytes: out.length, storage: 'file' })
  } catch {
    // Serverless (read-only fs): store in the database, serve via /api/media.
    const db = getDb()
    const id = name.replace(/\.[^.]+$/, '')
    await db.insert(schema.media).values({
      id, name, mime: ext === 'webp' ? 'image/webp' : contentType, data: out, createdAt: Date.now(),
    })
    return send(res, 201, { url: `/api/media?id=${id}`, bytes: out.length, storage: 'db' })
  }
})
