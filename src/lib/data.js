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

export const getIndex = () => getJSON('index.json')
export const getPlacesIndex = () => getJSON('places-index.json')
export const getGuide = (topic) => getJSON(`guide/${topic}.json`)
export async function getHub() {
  const base = await getJSON('hub.json').catch(() => ({ sections: [] }))
  return hubOverride() || base
}

export async function getRegion(id) {
  const baseRegion = await getJSON(`regions/${id}.json`)
  return regionOverride(id) || baseRegion
}
export async function getImages() {
  const baseImages = await getJSON('images.json').catch(() => ({}))
  return imagesOverride() || baseImages
}
export async function getAffiliates() {
  const baseAff = await getJSON('affiliates.json')
  return affiliatesOverride() || baseAff
}

// fetch the on-disk base (ignoring overrides) — used by Export to diff/regenerate
export const getBaseRegion = (id) => getJSON(`regions/${id}.json`)

export async function placeImages(regionId, placeId) {
  const all = await getImages().catch(() => ({}))
  return all?.[regionId]?.[placeId] ?? []
}
