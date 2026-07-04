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

// Registry is now GENERATED from the data folders (scripts/gen-countries.mjs).
// --draft hides the country by adding it to HIDDEN in countryMeta.js.
const draft = process.argv.includes('--draft')
const metaPath = path.join(ROOT, 'src', 'lib', 'countryMeta.js')
let meta = fs.readFileSync(metaPath, 'utf8')
const inHidden = new RegExp(`HIDDEN\\s*=\\s*\\[[^\\]]*'${cid}'`)
if (draft && !inHidden.test(meta)) {
  meta = meta.replace(/export const HIDDEN = \[/, `export const HIDDEN = [\n  '${cid}',`)
  fs.writeFileSync(metaPath, meta)
  console.log(`\u2713 ${cid} added to HIDDEN (draft) — remove it from src/lib/countryMeta.js to go live`)
} else if (!draft && inHidden.test(meta)) {
  meta = meta.replace(new RegExp(`\\s*'${cid}',?`), '')
  fs.writeFileSync(metaPath, meta)
  console.log(`\u2713 ${cid} removed from HIDDEN — going live`)
}
const { execFileSync } = await import('node:child_process')
execFileSync('node', [path.join(ROOT, 'scripts', 'gen-countries.mjs')], { stdio: 'inherit' })
if (!meta.includes(`slug: '${cid}'`)) {
  console.log(`\u2022 Tip: add ${cid} to src/lib/countryMeta.js for a proper flag and blurb.`)
}

console.log(`\nStats: ${bundle.stats.regions} regions \u00b7 ${bundle.stats.places} places \u00b7 ${bundle.stats.restaurants} restaurants \u00b7 ${bundle.stats.images} images`)
if (bundle.missingImages?.length) console.log(`Missing images (${bundle.missingImages.length}): ${bundle.missingImages.slice(0, 20).join(', ')}${bundle.missingImages.length > 20 ? '…' : ''}`)
console.log('\nNow: npm run build, commit, push. Live on deploy.')
