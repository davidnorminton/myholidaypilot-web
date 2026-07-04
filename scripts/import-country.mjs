#!/usr/bin/env node
// Writes an exported country bundle into public/data/{country}/… and flips the
// country to available in src/lib/countries.js.
// Usage: node scripts/import-country.mjs path/to/country-export.json
import fs from 'node:fs'
import path from 'node:path'

const src = process.argv[2]
if (!src) { console.error('Usage: node scripts/import-country.mjs <bundle.json>'); process.exit(1) }
const bundle = JSON.parse(fs.readFileSync(src, 'utf8'))
const cid = bundle.countryId
const root = path.join('public', 'data', cid)

let written = 0
for (const [rel, obj] of Object.entries(bundle.files)) {
  const full = path.join(root, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, JSON.stringify(obj, null, 2))
  written++
}
console.log(`\u2713 wrote ${written} files to ${root}`)

const regPath = path.join('src', 'lib', 'countries.js')
let reg = fs.readFileSync(regPath, 'utf8')
const re = new RegExp(`(slug:\\s*'${cid}'[^}]*available:\\s*)false`)
if (re.test(reg)) {
  reg = reg.replace(re, '$1true')
  fs.writeFileSync(regPath, reg)
  console.log(`\u2713 ${cid} set available: true in countries.js`)
} else if (reg.includes(`slug: '${cid}'`)) {
  console.log(`\u2022 ${cid} already available (or manually set)`)
} else {
  console.log(`! ${cid} not in countries.js — add: { slug: '${cid}', name: '${bundle.name}', flag: '${bundle.flag || ''}', available: true }`)
}
console.log(`\nStats: ${bundle.stats.regions} regions \u00b7 ${bundle.stats.places} places \u00b7 ${bundle.stats.restaurants} restaurants \u00b7 ${bundle.stats.images} images`)
if (bundle.missingImages?.length) console.log(`Missing images (${bundle.missingImages.length}): ${bundle.missingImages.join(', ')}`)
console.log('\nNow: npm run build, commit, push. Live on deploy.')
