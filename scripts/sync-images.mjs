// Sync place images from the Country Builder database into the published
// public/data/<country>/images.json files — the static files the live site
// (and the prerender) actually read.
//
// Images set in the builder live in build_places.image (DB). Normally they only
// reach the live site via a full country Export. This script pulls them
// directly, so you don't have to re-export everything just to publish images.
//
//   node scripts/sync-images.mjs france              # one country, from local DB
//   node scripts/sync-images.mjs                     # all built countries
//   DATABASE_URL=... DATABASE_AUTH_TOKEN=... \
//     node scripts/sync-images.mjs france            # from production DB
//
// MERGES by default: existing images.json entries are kept; DB images are
// layered on top (DB wins for a place that has an image in both). Pass
// --replace to overwrite a country's images.json entirely from the DB.
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'public', 'data')

const args = process.argv.slice(2)
const replace = args.includes('--replace')
const onlyCountry = args.find((a) => !a.startsWith('--'))

const { getDb } = await import(path.join(root, 'db/client.js'))
const schema = await import(path.join(root, 'db/schema.js'))
const { eq } = await import('drizzle-orm')
const db = getDb()

const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fb } }

// which countries to process: the arg, or every country with a build record
let slugs
if (onlyCountry) {
  slugs = [onlyCountry]
} else {
  const builds = await db.select({ countryId: schema.builds.countryId }).from(schema.builds)
  slugs = builds.map((b) => b.countryId)
}

let totalCountries = 0, totalImages = 0
for (const slug of slugs) {
  const rows = await db.select().from(schema.buildPlaces).where(eq(schema.buildPlaces.countryId, slug))
  if (!rows.length) { console.warn(`  ${slug}: no builder places found — skipped`); continue }

  const cDir = path.join(dataDir, slug)
  if (!fs.existsSync(cDir)) { console.warn(`  ${slug}: no public/data/${slug} dir — skipped`); continue }

  const imgPath = path.join(cDir, 'images.json')
  const existing = replace ? {} : (readJson(imgPath, {}) || {})

  let countryImages = 0
  for (const r of rows) {
    if (!r.image) continue
    existing[r.regionId] = existing[r.regionId] || {}
    existing[r.regionId][r.placeId] = [r.image]      // frontend expects an array
    countryImages++
  }

  if (countryImages === 0) { console.warn(`  ${slug}: DB has 0 place images — nothing to sync`); continue }

  fs.writeFileSync(imgPath, JSON.stringify(existing, null, 0))
  console.log(`  ${slug}: wrote ${countryImages} images → ${path.relative(root, imgPath)}`)
  totalCountries++; totalImages += countryImages
}

console.log(`✓ synced ${totalImages} images across ${totalCountries} countries`)
console.log(`  source: ${process.env.DATABASE_URL || 'file:./local.db'}`)
