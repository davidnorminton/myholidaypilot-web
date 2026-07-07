// Sync trip-planning details (intro, getting there, itinerary, FAQ) from the
// builder database into the published static files, so the prerender and the
// live pages can serve them:
//   - region details  → public/data/<country>/regions/<id>.json  (.details)
//   - country details → public/data/<country>/index.json         (.details)
// Runs in the build after sync-images. Merge-only; skips without DATABASE_URL.
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'public', 'data')

if (!process.env.DATABASE_URL) {
  console.log('sync-details: no DATABASE_URL — skipping (static files left as-is)')
  process.exit(0)
}

const { getDb } = await import(path.join(root, 'db/client.js'))
const schema = await import(path.join(root, 'db/schema.js'))
const { eq } = await import('drizzle-orm')
const db = getDb()

const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fb } }

const builds = await db.select().from(schema.builds)
let regionCount = 0, countryCount = 0
for (const b of builds) {
  const cDir = path.join(dataDir, b.countryId)
  if (!fs.existsSync(cDir)) continue

  // country-level details → index.json
  if (b.guides?.details) {
    const idxPath = path.join(cDir, 'index.json')
    const idx = readJson(idxPath)
    if (idx) {
      idx.details = b.guides.details
      fs.writeFileSync(idxPath, JSON.stringify(idx))
      countryCount++
    }
  }

  // region-level details → regions/<id>.json
  const regs = await db.select().from(schema.buildRegions).where(eq(schema.buildRegions.countryId, b.countryId))
  for (const r of regs) {
    if (!r.data?.details) continue
    const rfPath = path.join(cDir, 'regions', `${r.regionId}.json`)
    const rf = readJson(rfPath)
    if (!rf) continue
    rf.details = r.data.details
    fs.writeFileSync(rfPath, JSON.stringify(rf))
    regionCount++
  }
}
console.log(`✓ synced trip details: ${countryCount} countries, ${regionCount} regions`)
