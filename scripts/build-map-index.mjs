// Build public/data/map-index.json — everything the /map page needs, in one
// small file.
//
// WHY: the map shows a point per live country with name, flag, capital and
// region/place counts. Deriving that client-side would mean fetching every
// country's index.json (34 requests, ~MBs) to draw 34 dots. Precomputing it at
// build time makes the page one ~4KB fetch.
//
// Country centroids aren't stored anywhere, but every region carries lat/lng —
// so the centroid is the mean of the country's regions, nudged by CENTROIDS for
// the handful where spread-out territories drag the mean somewhere silly
// (France's mean sits in the Atlantic once overseas regions join).
//
// Runs as part of prebuild (see package.json), same as gen-countries.mjs.

import fs from 'node:fs'
import path from 'node:path'

const DATA = path.resolve('public', 'data')
const OUT = path.join(DATA, 'map-index.json')

// Countries metadata (name/flag) lives in the generated countries.js — read the
// same source it's generated FROM to avoid importing app code into a script.
const { COUNTRY_META } = await import('../src/lib/countryMeta.js')

// Capitals aren't in the data anywhere. Small, stable, fine to keep here.
const CAPITALS = {
  australia: 'Canberra', brazil: 'Brasília', canada: 'Ottawa', china: 'Beijing',
  denmark: 'Copenhagen', egypt: 'Cairo', fiji: 'Suva', finland: 'Helsinki',
  france: 'Paris', germany: 'Berlin', greece: 'Athens', iceland: 'Reykjavík',
  india: 'New Delhi', indonesia: 'Jakarta', ireland: 'Dublin', israel: 'Jerusalem',
  italy: 'Rome', japan: 'Tokyo', malaysia: 'Kuala Lumpur', mexico: 'Mexico City',
  netherlands: 'Amsterdam', new_zealand: 'Wellington', norway: 'Oslo', peru: 'Lima',
  poland: 'Warsaw', portugal: 'Lisbon', saudi_arabia: 'Riyadh', singapore: 'Singapore',
  south_africa: 'Pretoria', south_korea: 'Seoul', spain: 'Madrid', sweden: 'Stockholm',
  switzerland: 'Bern', thailand: 'Bangkok', turkey: 'Ankara',
  united_arab_emirates: 'Abu Dhabi', united_kingdom: 'London',
  united_states: 'Washington, D.C.', vietnam: 'Hanoi',
}

// Where a plain mean of region coordinates lands somewhere unhelpful
// (overseas territories, extreme aspect ratios), pin the point by hand.
const CENTROIDS = {
  france: [46.6, 2.4], united_states: [39.8, -98.6], norway: [61.5, 8.8],
  indonesia: [-2.5, 118.0], canada: [56.1, -106.3], new_zealand: [-41.8, 172.8],
}

const countries = []
for (const slug of fs.readdirSync(DATA)) {
  const idxPath = path.join(DATA, slug, 'index.json')
  if (!fs.existsSync(idxPath)) continue
  let idx
  try { idx = JSON.parse(fs.readFileSync(idxPath, 'utf8')) } catch { continue }
  const meta = COUNTRY_META.find((c) => c.slug === slug) || {}
  const regions = Array.isArray(idx.regions) ? idx.regions : []
  const pts = regions.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
  let lat, lng
  if (CENTROIDS[slug]) [lat, lng] = CENTROIDS[slug]
  else if (pts.length) {
    lat = pts.reduce((n, r) => n + r.lat, 0) / pts.length
    lng = pts.reduce((n, r) => n + r.lng, 0) / pts.length
  } else continue   // no coordinates at all — can't place a point
  countries.push({
    slug,
    name: meta.name || slug,
    flag: meta.flag || '',
    capital: CAPITALS[slug] || '',
    lat: Number(lat.toFixed(3)),
    lng: Number(lng.toFixed(3)),
    regions: idx.totalRegions ?? regions.length,
    places: idx.totalPlaces ?? regions.reduce((n, r) => n + (r.placeCount || 0), 0),
  })
}

countries.sort((a, b) => a.name.localeCompare(b.name))
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), countries }, null, 1))
console.log(`✓ map-index.json — ${countries.length} countries, ${(fs.statSync(OUT).size / 1024).toFixed(1)}KB`)
