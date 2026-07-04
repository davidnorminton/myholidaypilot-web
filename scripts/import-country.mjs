#!/usr/bin/env node
// Writes an exported country bundle into <project>/public/data/{country}/… and
// flips the country to available in src/lib/countries.js.
//
// Paths are anchored to the PROJECT ROOT (the script's parent folder), so it
// writes to the right place no matter which directory you run it from.
//
// Usage: node scripts/import-country.mjs path/to/country-export.json
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
  console.error(`! Could not find package.json at ${ROOT} — is the script inside the project's scripts/ folder?`)
  process.exit(1)
}

const src = process.argv[2]
if (!src) { console.error('Usage: node scripts/import-country.mjs <bundle.json>'); process.exit(1) }
const srcPath = path.resolve(process.cwd(), src)   // bundle path is relative to where you ran it
if (!fs.existsSync(srcPath)) { console.error(`! Bundle not found: ${srcPath}`); process.exit(1) }

const bundle = JSON.parse(fs.readFileSync(srcPath, 'utf8'))
const cid = bundle.countryId
const root = path.join(ROOT, 'public', 'data', cid)

let written = 0
for (const [rel, obj] of Object.entries(bundle.files)) {
  const full = path.join(root, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, JSON.stringify(obj, null, 2))
  written++
}
console.log(`\u2713 wrote ${written} files to ${path.relative(process.cwd(), root) || root}`)

// Registry: flip to available if present, or INSERT the country automatically
// (after the last available entry, so new countries appear next in line).
// Use --draft to import the data without making the country visible yet.
const draft = process.argv.includes('--draft')
const regPath = path.join(ROOT, 'src', 'lib', 'countries.js')
let reg = fs.readFileSync(regPath, 'utf8')
const flipRe = new RegExp(`(slug:\\s*'${cid}'[^}]*available:\\s*)false`)
if (reg.includes(`slug: '${cid}'`)) {
  if (!draft && flipRe.test(reg)) {
    fs.writeFileSync(regPath, reg.replace(flipRe, '$1true'))
    console.log(`\u2713 ${cid} set available: true in countries.js`)
  } else {
    console.log(`\u2022 ${cid} already in countries.js${draft ? ' (left as-is, --draft)' : ''}`)
  }
} else {
  const blurb = (bundle.blurb || `${bundle.stats.regions} regions to explore, town by town.`).replace(/'/g, "\\'")
  const entry = `  { slug: '${cid}', name: '${bundle.name}', flag: '${bundle.flag || ''}', available: ${!draft},\n    blurb: '${blurb}' },`
  // insert after the LAST entry with available: true (falls back to top of array)
  const entryRe = /\{[^{}]*slug:\s*'[^']+'[^{}]*\},?/g
  let lastAvailEnd = -1, m
  while ((m = entryRe.exec(reg))) { if (/available:\s*true/.test(m[0])) lastAvailEnd = m.index + m[0].length }
  if (lastAvailEnd > 0) {
    reg = reg.slice(0, lastAvailEnd) + '\n' + entry + reg.slice(lastAvailEnd)
  } else {
    reg = reg.replace(/export const COUNTRIES = \[/, (h) => h + '\n' + entry)
  }
  fs.writeFileSync(regPath, reg)
  console.log(`\u2713 ${cid} added to countries.js (${draft ? 'draft — available: false' : 'available: true'}, positioned after the last live country)`)
  console.log('  Edit src/lib/countries.js to tweak the blurb or ordering.')
}
console.log(`\nStats: ${bundle.stats.regions} regions \u00b7 ${bundle.stats.places} places \u00b7 ${bundle.stats.restaurants} restaurants \u00b7 ${bundle.stats.images} images`)
if (bundle.missingImages?.length) console.log(`Missing images (${bundle.missingImages.length}): ${bundle.missingImages.slice(0, 20).join(', ')}${bundle.missingImages.length > 20 ? '…' : ''}`)
console.log('\nNow: npm run build, commit, push. Live on deploy.')
