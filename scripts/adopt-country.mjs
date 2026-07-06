// Adopt an already-published country (static JSON in public/data/<slug>)
// into the Country Builder's database tables, so it can be viewed, edited
// and re-exported like builder-born countries.
//
//   node scripts/adopt-country.mjs italy                     # local db
//   DATABASE_URL=... DATABASE_AUTH_TOKEN=... \
//     node scripts/adopt-country.mjs italy                   # production
//
// Safe to re-run: refuses to touch a country that already has a build,
// unless --force is passed (which replaces it).
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const slug = process.argv[2]
const force = process.argv.includes('--force')
if (!slug) { console.error('Usage: node scripts/adopt-country.mjs <slug> [--force]'); process.exit(1) }

const dataDir = path.join(root, 'public', 'data', slug)
if (!fs.existsSync(path.join(dataDir, 'index.json'))) {
  console.error(`No published data at public/data/${slug}`); process.exit(1)
}

const readJson = (p, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fallback }
}

// display name/flag: country.json (builder-era) → countryMeta curated list → title-case
const countryJson = readJson(path.join(dataDir, 'country.json'), {})
const meta = await import(path.join(root, 'src/lib/countryMeta.js')).catch(() => null)
const curated = meta?.COUNTRY_META?.find?.((c) => c.slug === slug)
const NAME = countryJson.name || curated?.name || slug[0].toUpperCase() + slug.slice(1)
const FLAG = countryJson.flag || curated?.flag || '🌍'
const BLURB = countryJson.blurb || curated?.blurb || ''

const index = readJson(path.join(dataDir, 'index.json'))
const images = readJson(path.join(dataDir, 'images.json'), {})
const guides = {}
for (const topic of ['festivals', 'history', 'food', 'transport']) {
  const g = readJson(path.join(dataDir, 'guide', `${topic}.json`))
  if (g) guides[topic] = g
}

const { getDb } = await import(path.join(root, 'db/client.js'))
const schema = await import(path.join(root, 'db/schema.js'))
const { eq } = await import('drizzle-orm')
const db = getDb()

const [existing] = await db.select().from(schema.builds).where(eq(schema.builds.countryId, slug))
if (existing && !force) {
  console.error(`A build for "${slug}" already exists — pass --force to replace it.`); process.exit(1)
}
if (existing) {
  await db.delete(schema.buildPlaces).where(eq(schema.buildPlaces.countryId, slug))
  await db.delete(schema.buildRegions).where(eq(schema.buildRegions.countryId, slug))
  await db.delete(schema.builds).where(eq(schema.builds.countryId, slug))
  console.log('… replaced existing build')
}

const now = Date.now()
await db.insert(schema.builds).values({
  countryId: slug, name: NAME, flag: FLAG, blurb: BLURB,
  stage: 10, guides, createdAt: now, updatedAt: now,
})

let regionCount = 0, placeCount = 0, imageCount = 0
for (const [i, summary] of (index.regions || []).entries()) {
  const rf = readJson(path.join(dataDir, 'regions', `${summary.id}.json`))
  if (!rf) { console.warn(`  ! missing regions/${summary.id}.json — skipped`); continue }

  // region row: the file's fields ARE the exporter's rd contract
  const { places = [], ...regionData } = rf
  // carry an explicit heroImage only if index.json shows one that ISN'T just
  // the first place's image (that fallback is recomputed at export time)
  const firstPlaceImg = images[summary.id]?.[places[0]?.id]?.[0]?.url
  if (summary.heroImage?.url && summary.heroImage.url !== firstPlaceImg) {
    regionData.heroImage = summary.heroImage
  }
  await db.insert(schema.buildRegions).values({
    id: crypto.randomUUID(), countryId: slug, regionId: rf.id,
    data: regionData, sort: i, createdAt: now, updatedAt: now,
  })
  regionCount++

  for (const [j, p] of places.entries()) {
    const img = images[rf.id]?.[p.id]?.[0] || null
    if (img) imageCount++
    await db.insert(schema.buildPlaces).values({
      id: crypto.randomUUID(), countryId: slug, regionId: rf.id, placeId: p.id,
      data: p, image: img, sort: j, createdAt: now, updatedAt: now,
    })
    placeCount++
  }
}

console.log(`✓ adopted "${NAME}" ${FLAG} into the builder`)
console.log(`  ${regionCount} regions · ${placeCount} places · ${imageCount} images · guides: ${Object.keys(guides).join(', ') || 'none'}`)
console.log(`  target: ${process.env.DATABASE_URL || 'file:./local.db'}`)
