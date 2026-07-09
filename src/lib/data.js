// Lightweight memoised loaders over the JSON in public/data/.
// Admin CMS overrides (localStorage) are applied at call time so edits show live.
import { regionOverride, imagesOverride, affiliatesOverride, hubOverride } from './cms.js'

const base = import.meta.env.BASE_URL
const cache = new Map()

function getJSON(rel) {
  if (cache.has(rel)) return cache.get(rel)
  const p = fetch(`${base}data/${rel}`).then((r) => {
    if (!r.ok) throw new Error(`${rel} → ${r.status}`)
    return r.json()
  })
  cache.set(rel, p)
  return p
}

export const getIndex = (country = 'italy') => getJSON(`${country}/index.json`)
export const getPlacesIndex = (country = 'italy') => getJSON(`${country}/places-index.json`)
export const getGuide = (topic, country = 'italy') => getJSON(`${country}/guide/${topic}.json`)
export async function getHub(country = 'italy') {
  const base = await getJSON(`${country}/hub.json`).catch(() => ({ sections: [] }))
  return country === 'italy' ? (hubOverride() || base) : base
}

export async function getRegion(id, country = 'italy') {
  const baseRegion = await getJSON(`${country}/regions/${id}.json`)
  return country === 'italy' ? (regionOverride(id) || baseRegion) : baseRegion
}

// Viator tours baked per region/place by scripts/sync-viator.mjs, as
// { tours, total, url }. Fetched at runtime only (never prerendered) so this
// content stays out of the static HTML — Viator content must not be indexed.
const normViator = (v) => Array.isArray(v)
  ? { tours: v, total: v.length, url: null }
  : (v && Array.isArray(v.tours) ? { tours: v.tours, total: v.total ?? v.tours.length, url: v.url ?? null } : { tours: [], total: 0, url: null })
const emptyViator = () => ({ tours: [], total: 0, url: null })

export const getViatorTours = (regionId, country = 'italy') =>
  getJSON(`${country}/viator/${regionId}.json`).then(normViator).catch(emptyViator)

// Place-level tours (distinct destination). Missing → empty; the component
// falls back to the parent region's tours when a place has none.
export const getViatorPlaceTours = (placeId, country = 'italy') =>
  getJSON(`${country}/viator/places/${placeId}.json`).then(normViator).catch(emptyViator)
const imagesCache = new Map()
export async function getImages(country = 'italy') {
  // Prefer live images from the builder DB (so images set in the builder show
  // up immediately, no deploy). Fall back to the static images.json bundled at
  // build time if the API is unreachable or returns nothing.
  // Memoised per country: navigating between pages of the same country reuses
  // the same promise instead of re-hitting the serverless function each time.
  if (imagesCache.has(country)) return imagesCache.get(country)
  const p = (async () => {
    try {
      const res = await fetch(`/api/images?country=${encodeURIComponent(country)}`)
      if (res.ok) {
        const live = await res.json()
        if (live && Object.keys(live).length) {
          return country === 'italy' ? (imagesOverride() || live) : live
        }
      }
    } catch { /* fall through to static */ }
    const baseImages = await getJSON(`${country}/images.json`).catch(() => ({}))
    return country === 'italy' ? (imagesOverride() || baseImages) : baseImages
  })()
  imagesCache.set(country, p)
  return p
}
export async function getAffiliates() {
  const baseAff = await getJSON('affiliates.json')
  return affiliatesOverride() || baseAff
}

// fetch the on-disk base (ignoring overrides) — used by Export to diff/regenerate
export const getBaseRegion = (id, country = 'italy') => getJSON(`${country}/regions/${id}.json`)

export async function placeImages(regionId, placeId, country = 'italy') {
  const all = await getImages(country).catch(() => ({}))
  return all?.[regionId]?.[placeId] ?? []
}
