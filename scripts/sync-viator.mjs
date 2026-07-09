// Viator Partner API (Affiliate / Basic Access) ingest.
//
// Pulls tours & activities from Viator and bakes them into static JSON so the
// live pages can render "Things to do" cards that deep-link to viator.com
// (where a 30-day cookie accrues our commission). Mirrors the other sync
// scripts: reads a key from the environment and no-ops without one, so builds
// still succeed on machines that don't have the key.
//
//   VIATOR_API_KEY   your exp-api-key (Vercel env var / .env) — REQUIRED
//   VIATOR_CURRENCY  default GBP
//   VIATOR_LANG      default en-GB
//
// Three modes:
//   node scripts/sync-viator.mjs --probe            dump raw sample responses so
//                                                   we can confirm field shapes
//   node scripts/sync-viator.mjs --map [--country=] fetch /destinations, match
//                                                   our regions → Viator destIds,
//                                                   write viator-destinations.json
//   node scripts/sync-viator.mjs [--country=] [--limit=12]
//                                                   ingest tours per mapped region
//                                                   → public/data/<c>/viator/<r>.json
//
// The destination map (viator-destinations.json) is a REVIEWABLE draft — the
// matching is heuristic (name + nearest coordinates), so eyeball it and correct
// any dubious rows before relying on the ingest.
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'public', 'data')

const KEY = process.env.VIATOR_API_KEY
const BASE = (process.env.VIATOR_API_BASE || 'https://api.viator.com/partner').replace(/\/$/, '')
const CURRENCY = process.env.VIATOR_CURRENCY || 'GBP'
const LANG = process.env.VIATOR_LANG || 'en-GB'

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d) => { const a = argv.find((x) => x.startsWith(`${f}=`)); return a ? a.slice(f.length + 1) : d }
const MODE = has('--probe') ? 'probe' : has('--map') ? 'map' : 'ingest'
const ONLY_COUNTRY = val('--country', '')
const LIMIT = Math.min(Number(val('--limit', '12')) || 12, 50)

if (!KEY) {
  console.log('sync-viator: no VIATOR_API_KEY — skipping (static files left as-is)')
  process.exit(0)
}

const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fb } }
const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v)) }
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function haversineKm(a, b) {
  if (![a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite)) return Infinity
  const R = 6371, toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

async function vfetch(pathname, { method = 'GET', body } = {}, attempt = 0) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'exp-api-key': KEY,
      Accept: 'application/json;version=2.0',
      'Accept-Language': LANG,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 429 && attempt < 4) {           // rate limited — back off
    await sleep(1500 * (attempt + 1))
    return vfetch(pathname, { method, body }, attempt + 1)
  }
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

// ── Extract the handful of fields our cards need (defensive: shapes verified
//    via --probe). Kept in one place so a shape tweak is a one-line change. ──
function pickThumb(images) {
  const list = Array.isArray(images) ? images : []
  const cover = list.find((i) => i?.isCover) || list[0]
  const variants = cover?.variants || []
  if (!variants.length) return ''
  // prefer a ~400–600px wide variant; fall back to the largest
  const sorted = [...variants].filter((v) => v?.url).sort((a, b) => (a.width || 0) - (b.width || 0))
  const mid = sorted.find((v) => (v.width || 0) >= 400) || sorted[sorted.length - 1]
  return mid?.url || ''
}
function durationLabel(d) {
  const m = d?.fixedDurationInMinutes ?? d?.variableDurationFromMinutes
  if (!Number.isFinite(m)) return ''
  if (m < 60) return `${m} min`
  const h = Math.round((m / 60) * 10) / 10
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`
}
function toCard(p) {
  return {
    code: p.productCode,
    title: p.title,
    image: pickThumb(p.images),
    rating: p.reviews?.combinedAverageRating ?? null,
    reviews: p.reviews?.totalReviews ?? 0,
    price: p.pricing?.summary?.fromPrice ?? null,
    currency: p.pricing?.currency || CURRENCY,
    url: p.productUrl || '',                 // affiliate deep link (commission)
    duration: durationLabel(p.duration),
    freeCancellation: Array.isArray(p.flags) && p.flags.includes('FREE_CANCELLATION'),
  }
}

async function searchProducts(destId, count = LIMIT) {
  const data = await vfetch('/products/search', {
    method: 'POST',
    body: {
      filtering: { destination: String(destId) },
      sorting: { sort: 'DEFAULT' },           // Viator's featured/merchandising order
      pagination: { start: 1, count },
      currency: CURRENCY,
    },
  })
  return Array.isArray(data.products) ? data.products : []
}

const countries = () => (ONLY_COUNTRY ? [ONLY_COUNTRY] : fs.readdirSync(dataDir)
  .filter((c) => fs.existsSync(path.join(dataDir, c, 'index.json'))))

// ─────────────────────────────── PROBE ───────────────────────────────
if (MODE === 'probe') {
  console.log('sync-viator --probe: fetching /destinations …')
  const dests = await vfetch('/destinations')
  const arr = dests.destinations || []
  console.log(`  destinations: ${arr.length}`)
  console.log('  sample destination:', JSON.stringify(arr[0], null, 2))
  const sample = arr.find((d) => d.type === 'CITY') || arr[0]
  const sampleId = sample?.destinationId
  console.log(`\nsync-viator --probe: /products/search for destId ${sampleId} (${sample?.name}) …`)
  const products = await searchProducts(sampleId, 1)
  console.log('  raw first product:', JSON.stringify(products[0], null, 2))
  console.log('  → mapped card:', JSON.stringify(toCard(products[0] || {}), null, 2))
  const out = path.join(root, 'viator-probe.json')
  writeJson(out, { sampleDestination: arr[0], sampleProduct: products[0] || null, mappedCard: toCard(products[0] || {}) })
  console.log(`\nWrote ${out} — check the field names line up before ingesting.`)
  process.exit(0)
}

// ──────────────────────────────── MAP ────────────────────────────────
if (MODE === 'map') {
  console.log('sync-viator --map: fetching /destinations …')
  const dests = (await vfetch('/destinations')).destinations || []
  // coord accessor is defensive: v2 exposes center {latitude,longitude}; some
  // shapes use coordinates — support both, else fall back to name-only match.
  const coordOf = (d) => ({
    lat: d?.center?.latitude ?? d?.coordinates?.latitude ?? d?.latitude,
    lng: d?.center?.longitude ?? d?.coordinates?.longitude ?? d?.longitude,
  })
  const byName = new Map()
  for (const d of dests) { const k = norm(d.name); if (!byName.has(k)) byName.set(k, d) }

  const map = readJson(path.join(dataDir, 'viator-destinations.json'), {})
  let matched = 0; const weak = []
  for (const country of countries()) {
    const idx = readJson(path.join(dataDir, country, 'index.json'), null)
    if (!idx?.regions) continue
    map[country] ||= {}
    for (const r of idx.regions) {
      // 1) name match on region or capital; 2) nearest by coordinates
      const nameHit = byName.get(norm(r.name)) || byName.get(norm(r.capital))
      let best = nameHit ? { d: nameHit, km: 0, via: byName.get(norm(r.name)) ? 'name' : 'capital' } : null
      if (!best && Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
        for (const d of dests) {
          if (!['CITY', 'REGION', 'TOWN', 'AREA'].includes(d.type)) continue
          const km = haversineKm({ lat: r.lat, lng: r.lng }, coordOf(d))
          if (!best || km < best.km) best = { d, km, via: 'nearest' }
        }
      }
      if (!best || (best.via === 'nearest' && best.km > 150)) { weak.push(`${country}/${r.id} (${r.name})`); continue }
      map[country][r.id] = { destId: best.d.destinationId, destName: best.d.name, type: best.d.type, via: best.via, km: Math.round(best.km) }
      matched++
    }
  }
  const out = path.join(dataDir, 'viator-destinations.json')
  writeJson(out, map)
  console.log(`\nMatched ${matched} regions → ${out}`)
  if (weak.length) console.log(`⚠ ${weak.length} unmatched / low-confidence (set these by hand):\n  ${weak.join('\n  ')}`)
  console.log('\nReview the file (especially "via":"nearest" rows), then run the ingest.')
  process.exit(0)
}

// ─────────────────────────────── INGEST ──────────────────────────────
const map = readJson(path.join(dataDir, 'viator-destinations.json'), null)
if (!map) { console.error('sync-viator: no viator-destinations.json — run `--map` first.'); process.exit(1) }

let wrote = 0, empty = 0
for (const country of countries()) {
  const regions = map[country] || {}
  for (const [regionId, m] of Object.entries(regions)) {
    if (!m?.destId) continue
    try {
      const products = await searchProducts(m.destId)
      const tours = products.map(toCard).filter((t) => t.code && t.url)
      writeJson(path.join(dataDir, country, 'viator', `${regionId}.json`), tours)
      tours.length ? wrote++ : empty++
      process.stdout.write(`  ${country}/${regionId} (${m.destName}) → ${tours.length}\n`)
      await sleep(120)                          // stay comfortably under 150 req / 10s
    } catch (e) {
      console.warn(`  ✗ ${country}/${regionId}: ${e.message}`)
    }
  }
}
console.log(`\nsync-viator: wrote ${wrote} region files (${empty} empty).`)
