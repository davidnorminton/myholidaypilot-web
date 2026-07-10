// Viator Partner API (Affiliate / Basic Access) ingest.
//
// Pulls tours & activities from Viator and bakes them into static JSON so the
// live pages can render "Things to do" cards that deep-link to viator.com
// (where a 30-day cookie accrues our commission). Mirrors the other sync
// scripts: reads a key from the environment and no-ops without one, so builds
// still succeed on machines that don't have the key.
//
//   VIATOR_API_KEY   your exp-api-key (Vercel env var / .env) — REQUIRED
//   VIATOR_CURRENCY  default EUR
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

const KEY = (process.env.VIATOR_API_KEY || '').trim()
const BASE = (process.env.VIATOR_API_BASE || 'https://api.viator.com/partner').replace(/\/$/, '')
const CURRENCY = process.env.VIATOR_CURRENCY || 'EUR'
const LANG = process.env.VIATOR_LANG || 'en-GB'

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d) => { const a = argv.find((x) => x.startsWith(`${f}=`)); return a ? a.slice(f.length + 1) : d }
const MODE = has('--probe') ? 'probe' : has('--map-places') ? 'mapPlaces' : has('--map') ? 'map' : 'ingest'
const ONLY_COUNTRY = val('--country', '')
const LIMIT = Math.min(Number(val('--limit', '24')) || 24, 50)

if (!KEY) {
  console.log('sync-viator: no VIATOR_API_KEY — skipping (static files left as-is)')
  process.exit(0)
}
console.log(`sync-viator: ${MODE} · base ${BASE} · key ${KEY.slice(0, 3)}…${KEY.slice(-3)} (${KEY.length} chars)`)

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
  const variants = (cover?.variants || []).filter((v) => v?.url && v.width)
  if (!variants.length) return ''
  // cards are 4:3, so prefer a landscape variant ~440–760px wide; the square
  // NxN variants are a last resort.
  const landscape = variants.filter((v) => v.width >= (v.height || 0) * 1.2)
  const pool = (landscape.length ? landscape : variants).sort((a, b) => a.width - b.width)
  const pick = pool.find((v) => v.width >= 440 && v.width <= 760)
    || pool.find((v) => v.width >= 400)
    || pool[pool.length - 1]
  return pick?.url || ''
}
function durationLabel(d) {
  const m = d?.fixedDurationInMinutes ?? d?.variableDurationFromMinutes
  if (!Number.isFinite(m)) return ''
  if (m < 60) return `${m} min`
  const h = Math.round((m / 60) * 10) / 10
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`
}
// ── coordinates: product start points via /products/bulk + /locations/bulk ──
// The search response carries no coordinates; each product's logistics has
// start-point location refs, which /locations/bulk resolves to a lat/long
// center. Tours without a resolvable fixed point simply get no pin (hotel
// pickups, roaming day trips) — never a fake town-centre pin. Any failure
// degrades to tours without coordinates.
const locCache = new Map()   // ref → {lat,lng} | null
let coordsDisabled = false   // 403 = Basic-access key; skip for the whole run
async function enrichCoords(tours) {
  if (!tours.length || coordsDisabled) return tours
  try {
    const prods = await vfetch('/products/bulk', { method: 'POST', body: { productCodes: tours.map((t) => t.code) } })
    const list = Array.isArray(prods) ? prods : (prods?.products || [])
    const startRef = new Map()
    for (const p of list) {
      const ref = p?.logistics?.start?.[0]?.location?.ref
      if (p?.productCode && ref) startRef.set(p.productCode, ref)
    }
    const missing = [...new Set(startRef.values())].filter((r) => !locCache.has(r))
    for (let i = 0; i < missing.length; i += 400) {
      const chunk = missing.slice(i, i + 400)
      const locs = await vfetch('/locations/bulk', { method: 'POST', body: { locations: chunk } })
      for (const l of (Array.isArray(locs) ? locs : (locs?.locations || []))) {
        const c = l?.center
        locCache.set(l?.reference, (Number.isFinite(c?.latitude) && Number.isFinite(c?.longitude)) ? { lat: c.latitude, lng: c.longitude } : null)
      }
      for (const r of chunk) if (!locCache.has(r)) locCache.set(r, null)
      await sleep(120)
    }
    return tours.map((t) => {
      const c = locCache.get(startRef.get(t.code)) || null
      return c ? { ...t, lat: c.lat, lng: c.lng } : t
    })
  } catch (e) {
    if (/403/.test(e.message)) {
      coordsDisabled = true
      console.warn('    (coords disabled for this run — /products/bulk needs Full Access; request it free via the partner dashboard → Tools → Affiliate API)')
    } else {
      console.warn(`    (coords skipped: ${e.message})`)
    }
    return tours
  }
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

async function searchProducts(filtering, count = LIMIT) {
  const data = await vfetch('/products/search', {
    method: 'POST',
    body: {
      filtering,                              // { destination } or { attractionId }
      sorting: { sort: 'DEFAULT' },           // Viator's featured/merchandising order
      pagination: { start: 1, count },
      currency: CURRENCY,
    },
  })
  return { products: Array.isArray(data.products) ? data.products : [], total: data.totalCount ?? 0 }
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
  const { products } = await searchProducts({ destination: String(sampleId) }, 1)
  console.log('  raw first product:', JSON.stringify(products[0], null, 2))
  console.log('  → mapped card:', JSON.stringify(toCard(products[0] || {}), null, 2))

  // Attractions (for Step 2b: attraction-linked tours). Wrapped so a wrong
  // request shape doesn't abort the whole probe — we just report it.
  let sampleAttraction = null, attractionProduct = null
  console.log(`\nsync-viator --probe: /attractions/search in destId ${sampleId} …`)
  try {
    const ares = await vfetch('/attractions/search', {
      method: 'POST',
      body: { destinationId: sampleId, sorting: { sort: 'DEFAULT' }, pagination: { start: 1, count: 3 } },
    })
    const attrs = ares.attractions || []
    sampleAttraction = attrs[0] || null
    console.log(`  attractions: ${attrs.length}`)
    console.log('  sample attraction:', JSON.stringify(sampleAttraction, null, 2))
    const attractionId = sampleAttraction?.attractionId ?? sampleAttraction?.seoId
    if (attractionId) {
      const { products: byAttr } = await searchProducts({ attractionId }, 1)
      attractionProduct = byAttr[0] || null
      console.log(`  first product for attractionId ${attractionId}:`, attractionProduct?.productCode || '(none)')
    }
  } catch (e) {
    console.log('  ⚠ attractions probe failed — note the request shape to verify:', e.message)
  }

  // coordinates probe — verify /products/bulk + /locations/bulk shapes
  let sampleBulkProduct = null, sampleLocation = null
  try {
    const codes = products.slice(0, 3).map((p) => p.productCode).filter(Boolean)
    console.log(`\nsync-viator --probe: /products/bulk for ${codes.join(', ')} …`)
    const bulk = await vfetch('/products/bulk', { method: 'POST', body: { productCodes: codes } })
    const blist = Array.isArray(bulk) ? bulk : (bulk?.products || [])
    sampleBulkProduct = blist[0] || null
    const refs = blist.map((p) => p?.logistics?.start?.[0]?.location?.ref).filter(Boolean)
    console.log(`  bulk products: ${blist.length}, start refs: ${refs.join(', ') || '(none)'}`)
    if (refs.length) {
      const locs = await vfetch('/locations/bulk', { method: 'POST', body: { locations: refs } })
      const llist = Array.isArray(locs) ? locs : (locs?.locations || [])
      sampleLocation = llist[0] || null
      console.log('  sample location:', JSON.stringify(sampleLocation, null, 2))
    }
  } catch (e) {
    console.log('  ⚠ coords probe failed — verify endpoint availability on this tier:', e.message)
  }

  const out = path.join(root, 'viator-probe.json')
  writeJson(out, { sampleDestination: arr[0], sampleProduct: products[0] || null, mappedCard: toCard(products[0] || {}), sampleAttraction, attractionProduct, sampleBulkProduct, sampleLocation })
  console.log(`\nWrote ${out} — check the field names line up before ingesting.`)
  process.exit(0)
}

// Constrain destination matching to the target country's subtree so the
// nearest-fallback can't jump a border (southeastern Norway once matched
// Skagen, Denmark — the literal nearest big city, across the strait).
// Uses lookupId ancestry ("8.77.902" = world.norway.oslo). Returns null when
// the country node can't be identified — callers fall back to the global pool.
const COUNTRY_ALIASES = {
  united_states: ['usa', 'united states', 'united states of america'],
  united_kingdom: ['united kingdom', 'uk', 'great britain'],
  south_korea: ['south korea', 'korea republic of', 'republic of korea'],
}
function countryScope(dests, slug) {
  const names = new Set(COUNTRY_ALIASES[slug] || [slug.replace(/_/g, ' ')])
  const node = dests.find((d) => d.type === 'COUNTRY' && names.has(norm(d.name)))
  if (!node?.lookupId) return null
  const prefix = `${node.lookupId}.`
  const scoped = dests.filter((d) => String(d.lookupId || '').startsWith(prefix))
  return scoped.length ? scoped : null
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
  const byNameAll = new Map()
  for (const d of dests) {
    const k = norm(d.name)
    if (!byNameAll.has(k)) byNameAll.set(k, [])
    byNameAll.get(k).push(d)
  }
  const nearestOf = (list, r) => list
    .map((d) => ({ d, km: haversineKm({ lat: r.lat, lng: r.lng }, coordOf(d)) }))
    .sort((a, b) => a.km - b.km)[0]

  const map = readJson(path.join(dataDir, 'viator-destinations.json'), {})
  let matched = 0; const weak = []
  for (const country of countries()) {
    const idx = readJson(path.join(dataDir, country, 'index.json'), null)
    if (!idx?.regions) continue
    map[country] ||= {}
    const scoped = countryScope(dests, country)
    if (!scoped) console.log(`  ⚠ ${country}: country node not found — matching against the global pool`)
    const scopedIds = scoped ? new Set(scoped.map((d) => d.destinationId)) : null
    for (const r of idx.regions) {
      // 1) name/capital match, disambiguated to the same-named destination
      //    NEAREST our region's coords (so "Naples" → Italy, not Florida) and
      //    constrained to this country's subtree when we know it
      let named = [...(byNameAll.get(norm(r.name)) || []), ...(byNameAll.get(norm(r.capital)) || [])]
      if (scopedIds) {
        const inC = named.filter((d) => scopedIds.has(d.destinationId))
        if (inC.length) named = inC
      }
      let best = named.length ? { ...nearestOf(named, r), via: 'name' } : null
      if (best && Number.isFinite(best.km) && best.km > 250) best = null   // same name, wrong place
      // 2) otherwise nearest CITY/REGION by coordinates — in-country only
      if (!best && Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
        const pool = (scoped || dests).filter((d) => ['CITY', 'REGION', 'TOWN', 'AREA'].includes(d.type))
        const n = nearestOf(pool, r)
        if (n) best = { ...n, via: 'nearest' }
      }
      if (!best || (best.via === 'nearest' && best.km > 150)) { weak.push(`${country}/${r.id} (${r.name})`); continue }
      map[country][r.id] = { destId: best.d.destinationId, destName: best.d.name, type: best.d.type, via: best.via, km: Math.round(best.km || 0), url: best.d.destinationUrl || best.d.url || null }
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

// ────────────────────────── MAP PLACES ───────────────────────────────
if (MODE === 'mapPlaces') {
  console.log('sync-viator --map-places: fetching /destinations …')
  const dests = (await vfetch('/destinations')).destinations || []
  const coordOf = (d) => ({ lat: d?.center?.latitude ?? d?.latitude, lng: d?.center?.longitude ?? d?.longitude })
  const byNameAll = new Map()
  for (const d of dests) { const k = norm(d.name); if (!byNameAll.has(k)) byNameAll.set(k, []); byNameAll.get(k).push(d) }
  const nearestOf = (list, p) => list.map((d) => ({ d, km: haversineKm({ lat: p.lat, lng: p.lng }, coordOf(d)) })).sort((a, b) => a.km - b.km)[0]

  const regionMap = readJson(path.join(dataDir, 'viator-destinations.json'), {})
  const placeMap = readJson(path.join(dataDir, 'viator-places.json'), {})
  let matched = 0, skipped = 0
  for (const country of countries()) {
    const raw = readJson(path.join(dataDir, country, 'places-index.json'), [])
    const list = Array.isArray(raw) ? raw : (raw.places || [])
    placeMap[country] ||= {}
    const scoped = countryScope(dests, country)
    const scopedIds = scoped ? new Set(scoped.map((d) => d.destinationId)) : null
    const cityPool = (scoped || dests).filter((d) => ['CITY', 'TOWN', 'AREA'].includes(d.type))
    for (const p of list) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
      // name match (coord-verified, in-country when known), else nearest
      // city/town within a tight radius
      let named = byNameAll.get(norm(p.name)) || []
      if (scopedIds) {
        const inC = named.filter((d) => scopedIds.has(d.destinationId))
        if (inC.length) named = inC
      }
      let best = named.length ? nearestOf(named, p) : null
      if (best && best.km > 60) best = null
      if (!best) { const n = nearestOf(cityPool, p); if (n && n.km <= 35) best = n }
      if (!best) { skipped++; continue }
      // if the place resolves to the same destination as its region, skip it —
      // the place page falls back to the region's tours, no need to duplicate.
      const regionDest = regionMap[country]?.[p.regionId]?.destId
      if (best.d.destinationId === regionDest) { skipped++; continue }
      placeMap[country][p.placeId] = { destId: best.d.destinationId, destName: best.d.name, type: best.d.type, km: Math.round(best.km), url: best.d.destinationUrl || best.d.url || null }
      matched++
    }
  }
  writeJson(path.join(dataDir, 'viator-places.json'), placeMap)
  console.log(`\nMatched ${matched} places to a distinct Viator destination (${skipped} → region fallback).`)
  console.log('Review viator-places.json, then run the ingest.')
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
      const { products, total } = await searchProducts({ destination: String(m.destId) })
      const tours = await enrichCoords(products.map(toCard).filter((t) => t.code && t.url))
      writeJson(path.join(dataDir, country, 'viator', `${regionId}.json`), { tours, total, url: m.url || null })
      tours.length ? wrote++ : empty++
      process.stdout.write(`  ${country}/${regionId} (${m.destName}) → ${tours.length} (${tours.filter((t) => t.lat != null).length} pinned)\n`)
      await sleep(120)                          // stay comfortably under 150 req / 10s
    } catch (e) {
      console.warn(`  ✗ ${country}/${regionId}: ${e.message}`)
    }
  }
}

// Place-level tours (only for places mapped to a DISTINCT destination — the
// rest fall back to their region's tours on the client).
const placeMap = readJson(path.join(dataDir, 'viator-places.json'), null)
let pWrote = 0
if (placeMap) {
  for (const country of countries()) {
    for (const [placeId, m] of Object.entries(placeMap[country] || {})) {
      if (!m?.destId) continue
      try {
        const { products, total } = await searchProducts({ destination: String(m.destId) })
        const tours = await enrichCoords(products.map(toCard).filter((t) => t.code && t.url))
        writeJson(path.join(dataDir, country, 'viator', 'places', `${placeId}.json`), { tours, total, url: m.url || null })
        if (tours.length) pWrote++
        process.stdout.write(`  ${country}/place/${placeId} (${m.destName}) → ${tours.length} (${tours.filter((t) => t.lat != null).length} pinned)\n`)
        await sleep(120)
      } catch (e) {
        console.warn(`  ✗ ${country}/place/${placeId}: ${e.message}`)
      }
    }
  }
}
console.log(`\nsync-viator: wrote ${wrote} region files (${empty} empty)${placeMap ? `, ${pWrote} place files` : ''}.`)
