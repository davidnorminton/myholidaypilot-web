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
export async function getImages(country = 'italy') {
  const baseImages = await getJSON(`${country}/images.json`).catch(() => ({}))
  return country === 'italy' ? (imagesOverride() || baseImages) : baseImages
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
