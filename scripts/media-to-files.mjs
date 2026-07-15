// Move uploaded images out of the database and into public/images as real files.
//
// WHY: on Vercel the filesystem is read-only, so api/upload.js can't write a
// file and falls back to storing the bytes in the `media` table, served by
// api/media.js. That works, but every image is then a serverless function call
// and a row read, the blobs bloat the database (and every backup and replica of
// it), and there's no actual file anywhere.
//
// WHAT: writes each row to public/images/<name> (they're already webp — upload.js
// resizes to 1600px and converts on the way in), then rewrites every stored
// reference from /api/media?id=X to /images/X.webp. Commit the files and Vite
// copies public/ into dist/ at build: they become ordinary static assets on
// Vercel's CDN, with the immutable Cache-Control from vercel.json. No function,
// no row read, no blob.
//
// The ids are already filenames — api/upload.js mints `slug-<timestamp>.webp`
// and stores the name minus its extension as the id — so this is a straight
// export, not a rename.
//
// Usage:
//   node scripts/media-to-files.mjs --dry-run    # report only: sizes, refs, collisions
//   node scripts/media-to-files.mjs              # write files + rewrite references
//   node scripts/media-to-files.mjs --files-only # write files, leave the DB alone
//   node scripts/media-to-files.mjs --purge      # after verifying: drop the blobs
//
// Point it at production:
//   DATABASE_URL="libsql://<db>.turso.io" DATABASE_AUTH_TOKEN="<token>" \
//     node scripts/media-to-files.mjs --dry-run
//
// AFTERWARDS: commit public/images/, deploy, check a few pages, and only then
// re-run with --purge. Until you do, api/media.js still answers, so nothing
// breaks if a reference was missed.

import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getDb } from '../db/client.js'
import * as schema from '../db/schema.js'
import { eq } from 'drizzle-orm'

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const DRY = has('--dry-run')
const FILES_ONLY = has('--files-only')
const PURGE = has('--purge')

const OUT = path.resolve('public', 'images')
const db = getDb()

const TARGET = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || 'file:./local.db'
console.log(`database: ${TARGET.replace(/(libsql:\/\/[^.]{0,6})[^.]*/, '$1…')}`)
console.log(`output  : ${OUT}${DRY ? '   (dry run — nothing will be written)' : ''}\n`)

// ── the rows ────────────────────────────────────────────────────────────────
const rows = await db.select().from(schema.media)
if (!rows.length) { console.log('No rows in `media` — nothing to move.'); process.exit(0) }

let bytes = 0
for (const r of rows) bytes += (r.data?.length || 0)
console.log(`${rows.length} images · ${(bytes / 1024 / 1024).toFixed(1)}MB total`)

// A name is only safe as a filename if it can't escape the directory.
const unsafe = rows.filter((r) => !r.name || /[/\\]|\.\./.test(r.name))
if (unsafe.length) {
  console.error(`\n${unsafe.length} row(s) have a name that isn't a safe filename — stopping:`)
  for (const r of unsafe.slice(0, 5)) console.error('   ' + JSON.stringify(r.name) + '  (id: ' + r.id + ')')
  process.exit(1)
}
const dupes = rows.map((r) => r.name).filter((n, i, a) => a.indexOf(n) !== i)
if (dupes.length) { console.error(`\nDuplicate filenames — stopping: ${[...new Set(dupes)].join(', ')}`); process.exit(1) }

const nonWebp = rows.filter((r) => r.mime !== 'image/webp')
if (nonWebp.length) console.log(`note: ${nonWebp.length} row(s) aren't image/webp (${[...new Set(nonWebp.map((r) => r.mime))].join(', ')}) — written as-is under their stored name`)

// ── 1. write the files ──────────────────────────────────────────────────────
// Skipped entirely under --purge: that pass exists to verify the files an
// EARLIER run wrote and you then committed and deployed. Re-exporting first
// would recreate anything missing and the check would only ever be marking its
// own homework.
let written = 0, skipped = 0
if (!DRY && !PURGE) await fs.mkdir(OUT, { recursive: true })
for (const r of (PURGE ? [] : rows)) {
  const dest = path.join(OUT, r.name)
  const buf = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data)
  if (!DRY) {
    // Already there and identical? Leave it — makes re-runs cheap and safe.
    try {
      const cur = await fs.readFile(dest)
      if (cur.equals(buf)) { skipped++; continue }
    } catch { /* not there yet */ }
    await fs.writeFile(dest, buf)
  }
  written++
}
if (PURGE) console.log('\nfiles: not touched (--purge verifies what a previous run wrote)')
else console.log(`\nfiles: ${written} written${skipped ? `, ${skipped} already present and identical` : ''}`)

// ── 2. rewrite the references ───────────────────────────────────────────────
// /api/media?id=X  ->  /images/X.webp   (using each row's real stored name)
const byId = new Map(rows.map((r) => [r.id, r.name]))
const mediaRef = /\/api\/media\?id=([A-Za-z0-9._-]+)/g
let missed = 0
const rewrite = (text) => String(text).replace(mediaRef, (m, id) => {
  const name = byId.get(id)
  if (!name) { missed++; return m }        // unknown id — leave it, api/media still serves
  return `/images/${name}`
})
const touches = (v) => typeof v === 'string' && v.includes('/api/media?id=')
// Walk a JSON blob rewriting any string that mentions a media URL.
const deepRewrite = (val) => {
  if (typeof val === 'string') return touches(val) ? rewrite(val) : val
  if (Array.isArray(val)) return val.map(deepRewrite)
  if (val && typeof val === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(val)) out[k] = deepRewrite(v)
    return out
  }
  return val
}

const changes = []
if (!FILES_ONLY && !PURGE) {
  // blog posts: cover image, and the body HTML can embed <img src="/api/media…">
  for (const p of await db.select().from(schema.blogPosts)) {
    const cover = touches(p.coverImage) ? rewrite(p.coverImage) : p.coverImage
    const body = deepRewrite(p.body)
    if (cover === p.coverImage && JSON.stringify(body) === JSON.stringify(p.body)) continue
    changes.push(`blog_posts/${p.slug}`)
    if (!DRY) await db.update(schema.blogPosts).set({ coverImage: cover, body }).where(eq(schema.blogPosts.id, p.id))
  }
  // place images
  for (const r of await db.select().from(schema.buildPlaces)) {
    if (!touches(r.image?.url)) continue
    changes.push(`build_places/${r.countryId}/${r.regionId}/${r.placeId}`)
    if (!DRY) await db.update(schema.buildPlaces).set({ image: deepRewrite(r.image) })
      .where(eq(schema.buildPlaces.placeId, r.placeId))
  }
  // region heroes
  for (const r of await db.select().from(schema.buildRegions)) {
    if (!JSON.stringify(r.data || {}).includes('/api/media?id=')) continue
    changes.push(`build_regions/${r.countryId}/${r.regionId}`)
    if (!DRY) await db.update(schema.buildRegions).set({ data: deepRewrite(r.data) })
      .where(eq(schema.buildRegions.regionId, r.regionId))
  }
  // country heroes and anything else parked in settings
  for (const s of await db.select().from(schema.siteSettings)) {
    if (!touches(s.value)) continue
    changes.push(`site_settings/${s.key}`)
    if (!DRY) await db.update(schema.siteSettings).set({ value: rewrite(s.value) }).where(eq(schema.siteSettings.key, s.key))
  }
  // published trips
  for (const t of await db.select().from(schema.publicTrips)) {
    if (!JSON.stringify(t.data || {}).includes('/api/media?id=')) continue
    changes.push(`public_trips/${t.slug}`)
    if (!DRY) await db.update(schema.publicTrips).set({ data: deepRewrite(t.data) }).where(eq(schema.publicTrips.slug, t.slug))
  }
  console.log(`refs : ${changes.length} record(s) ${DRY ? 'would be' : ''} rewritten`)
  for (const c of changes.slice(0, 15)) console.log('   ' + c)
  if (changes.length > 15) console.log(`   … +${changes.length - 15} more`)
  if (missed) console.log(`\n⚠ ${missed} reference(s) point at an id with no media row — left alone.`)
} else if (!PURGE) {
  console.log('refs : skipped (--files-only)')
}

// ── 3. purge (only once you've verified) ────────────────────────────────────
if (PURGE) {
  if (DRY) { console.log('\npurge: skipped (dry run)') }
  else {
    // Only drop a blob once its file is on disk and byte-identical.
    let dropped = 0
    const kept = []
    for (const r of rows) {
      const buf = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data)
      let ok = false
      try { ok = (await fs.readFile(path.join(OUT, r.name))).equals(buf) } catch { ok = false }
      if (!ok) { kept.push(r.name); console.warn(`  ! ${r.name}: not on disk (or differs) — keeping the blob`); continue }
      await db.delete(schema.media).where(eq(schema.media.id, r.id))
      dropped++
    }
    console.log(`\npurge: ${dropped} blob(s) dropped, ${kept.length} kept`)
    if (kept.length) {
      console.log('\nKept because the file isn\'t in public/images — run the export first:')
      for (const n of kept.slice(0, 8)) console.log('   ' + n)
    }
  }
} else if (!DRY) {
  console.log('\nBlobs left in place. Commit public/images/, deploy, check the pages,')
  console.log('then re-run with --purge to drop them. api/media.js keeps serving until you do.')
}
