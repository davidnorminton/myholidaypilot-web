// Admin CMS overrides. Edits are stored in localStorage and the data loaders
// (src/lib/data.js) read them, so changes show live on the site. Use the Export
// tab to download the individual JSON files and commit them to public/data/.
import { useSyncExternalStore } from 'react'

const KEY = 'mhp_cms_v1'

function load() {
  try {
    const r = localStorage.getItem(KEY)
    const o = r ? JSON.parse(r) : {}
    return { regions: o.regions || {}, images: o.images || null, affiliates: o.affiliates || null, hub: o.hub || null }
  } catch { return { regions: {}, images: null, affiliates: null, hub: null } }
}
let state = load()
const listeners = new Set()
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ } }
function set(next) { state = next; persist(); listeners.forEach((l) => l()) }

export function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) }
export function getSnapshot() { return state }
export function useCms() { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) }

// non-hook getters (used by data.js)
export function regionOverride(id) { return state.regions[id] || null }
export function imagesOverride() { return state.images }
export function affiliatesOverride() { return state.affiliates }
export function hubOverride() { return state.hub }

// setters
export function saveRegion(id, obj) { set({ ...state, regions: { ...state.regions, [id]: obj } }) }
export function clearRegion(id) { const r = { ...state.regions }; delete r[id]; set({ ...state, regions: r }) }
export function saveImages(obj) { set({ ...state, images: obj }) }
export function clearImages() { set({ ...state, images: null }) }
export function saveAffiliates(obj) { set({ ...state, affiliates: obj }) }
export function saveHub(obj) { set({ ...state, hub: obj }) }
export function clearHub() { set({ ...state, hub: null }) }
export function clearAffiliates() { set({ ...state, affiliates: null }) }
export function resetAll() { set({ regions: {}, images: null, affiliates: null, hub: null }) }
export function editedRegionIds() { return Object.keys(state.regions) }

// ---- helpers ----
export const uid = (prefix = 'x') => prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

export function download(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// Rebuild the flat search index from (merged) region objects.
export function buildPlacesIndex(regions) {
  const out = []
  for (const r of regions) {
    for (const p of (r.places || [])) {
      out.push({
        placeId: p.id, name: p.name, nameIt: p.nameIt || p.name, type: p.type,
        lat: p.lat, lng: p.lng, regionId: r.id, regionName: r.name, regionEmoji: r.emoji,
      })
    }
  }
  return out
}

// Rebuild index.json meta (counts, names) from merged regions; keeps base hero/box.
export function buildIndex(baseIndex, regions) {
  const byId = Object.fromEntries(regions.map((r) => [r.id, r]))
  const regionsMeta = (baseIndex.regions || []).map((m) => {
    const r = byId[m.id]
    if (!r) return m
    return {
      ...m, name: r.name, nameIt: r.nameIt, capital: r.capital, lat: r.lat, lng: r.lng,
      emoji: r.emoji, colour: r.colour, bestTimeToVisit: r.bestTimeToVisit,
      placeCount: (r.places || []).length, restaurantCount: (r.restaurants || []).length,
    }
  })
  return {
    ...baseIndex,
    exportedAt: new Date().toISOString(),
    totalPlaces: regions.reduce((a, r) => a + (r.places || []).length, 0),
    totalRestaurants: regions.reduce((a, r) => a + (r.restaurants || []).length, 0),
    regions: regionsMeta,
  }
}
