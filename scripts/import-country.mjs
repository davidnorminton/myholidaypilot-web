#!/usr/bin/env node
// Writes an exported country bundle into <project>/public/data/{country}/… and
// flips the country to available in src/lib/countries.js.
//
// Paths are anchored to the PROJECT ROOT (the script's parent folder), so it
// writes to the right place no matter which directory you run it from.
//
// Usage:
//   node scripts/import-country.mjs                                  # every *.json in <project>/countries/
//   node scripts/import-country.mjs path/to/country-export.json      # one bundle
//   node scripts/import-country.mjs path/to/exports-folder/          # every *.json inside
//   (--draft applies to everything imported in the run)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
  console.error(`! Could not find package.json at ${ROOT} — is the script inside the project's scripts/ folder?`)
  process.exit(1)
}

// No argument → the project's countries/ folder, where individual country
// export files live. An explicit file or folder path still works.
const src = process.argv.slice(2).find((a) => !a.startsWith('--'))
const srcPath = src ? path.resolve(process.cwd(), src) : path.join(ROOT, 'countries')
if (!fs.existsSync(srcPath)) {
  console.error(src ? `! Not found: ${srcPath}` : `! No countries/ folder at ${srcPath} — put your country export JSONs there, or pass a path.`)
  process.exit(1)
}

// One bundle file, or every .json in a directory (non-bundles are skipped
// with a warning rather than killing the run).
const bundlePaths = fs.statSync(srcPath).isDirectory()
  ? fs.readdirSync(srcPath).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(srcPath, f))
  : [srcPath]
if (!bundlePaths.length) { console.error(`! No .json files in ${srcPath}`); process.exit(1) }

const draft = process.argv.includes('--draft')
const metaPath = path.join(ROOT, 'src', 'lib', 'countryMeta.js')
const imported = []

function importBundle(bundlePath) {
  let bundle
  try { bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8')) } catch {
    console.warn(`! Skipping ${path.basename(bundlePath)} — not valid JSON`); return
  }
  if (!bundle.countryId || !bundle.files) {
    console.warn(`! Skipping ${path.basename(bundlePath)} — not a country export bundle`); return
  }
  const cid = bundle.countryId
  const root = path.join(ROOT, 'public', 'data', cid)

  let written = 0
  for (const [rel, obj] of Object.entries(bundle.files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, JSON.stringify(obj, null, 2))
    written++
  }
  // carry the builder-set metadata (name, flag, blurb) with the data, so the
  // countries generator can use it without a manual countryMeta.js entry.
  fs.writeFileSync(path.join(root, 'country.json'), JSON.stringify({
    name: bundle.name, flag: bundle.flag || '', blurb: bundle.blurb || '',
  }, null, 2))
  written++
  console.log(`\u2713 ${cid}: wrote ${written} files to ${path.relative(process.cwd(), root) || root}`)

  // --draft hides the country by adding it to HIDDEN in countryMeta.js.
  let meta = fs.readFileSync(metaPath, 'utf8')
  const inHidden = new RegExp(`HIDDEN\\s*=\\s*\\[[^\\]]*'${cid}'`)
  if (draft && !inHidden.test(meta)) {
    meta = meta.replace(/export const HIDDEN = \[/, `export const HIDDEN = [\n  '${cid}',`)
    fs.writeFileSync(metaPath, meta)
    console.log(`  \u2713 ${cid} added to HIDDEN (draft) — remove it from src/lib/countryMeta.js to go live`)
  } else if (!draft && inHidden.test(meta)) {
    meta = meta.replace(new RegExp(`\\s*'${cid}',?`), '')
    fs.writeFileSync(metaPath, meta)
    console.log(`  \u2713 ${cid} removed from HIDDEN — going live`)
  }
  if (!meta.includes(`slug: '${cid}'`)) {
    console.log(`  \u2022 Tip: add ${cid} to src/lib/countryMeta.js for a proper flag and blurb.`)
  }

  const st = bundle.stats || {}
  console.log(`  Stats: ${st.regions ?? '?'} regions \u00b7 ${st.places ?? '?'} places \u00b7 ${st.restaurants ?? '?'} restaurants \u00b7 ${st.images ?? '?'} images`)
  if (bundle.missingImages?.length) console.log(`  Missing images (${bundle.missingImages.length}): ${bundle.missingImages.slice(0, 20).join(', ')}${bundle.missingImages.length > 20 ? '…' : ''}`)
  imported.push(cid)
}

for (const bp of bundlePaths) importBundle(bp)

if (!imported.length) { console.error('\n! Nothing imported.'); process.exit(1) }

// Registry is GENERATED from the data folders — once per run, after all bundles.
const { execFileSync } = await import('node:child_process')
execFileSync('node', [path.join(ROOT, 'scripts', 'gen-countries.mjs')], { stdio: 'inherit' })

console.log(`\nImported ${imported.length} countr${imported.length === 1 ? 'y' : 'ies'}: ${imported.join(', ')}`)
console.log('Now: npm run build, commit, push. Live on deploy.')
