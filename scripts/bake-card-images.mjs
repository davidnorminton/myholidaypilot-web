// Bake a `cardImage` into each region summary in index.json, resolved once at
// build time (region hero → first place with an image). List views (regions
// grid, country hub) then render card images straight from index.json — which
// they already load — with NO separate image fetch. This removes the biggest
// gate on list-page image loading.
//
//   node scripts/bake-card-images.mjs            # all countries, from static images.json
//
// Reads public/data/<country>/{index,images}.json and rewrites index.json.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'public', 'data')

const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fb } }

const countries = fs.existsSync(dataDir)
  ? fs.readdirSync(dataDir).filter((d) => fs.existsSync(path.join(dataDir, d, 'index.json')))
  : []

let total = 0
for (const slug of countries) {
  const idxPath = path.join(dataDir, slug, 'index.json')
  const index = readJson(idxPath)
  const images = readJson(path.join(dataDir, slug, 'images.json'), {})
  if (!index?.regions) continue

  let baked = 0
  for (const r of index.regions) {
    // hero first, else first place in the region that has an image
    let card = r.heroImage?.url || null
    if (!card) {
      const reg = images[r.id]
      if (reg) {
        for (const placeId of Object.keys(reg)) {
          const u = reg[placeId]?.[0]?.url
          if (u) { card = u; break }
        }
      }
    }
    if (card) { r.cardImage = card; baked++ }
  }
  fs.writeFileSync(idxPath, JSON.stringify(index))
  console.log(`  ${slug}: baked ${baked}/${index.regions.length} region card images`)
  total += baked
}
console.log(`✓ baked ${total} region card images into index.json`)
