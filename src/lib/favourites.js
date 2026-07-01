import { useSyncExternalStore } from 'react'
import { api } from './api.js'

const key = (r, p) => `${r}/${p}`
let ids = new Set()
let ready = false
let snapshot = { ready, ids }
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
const refresh = () => { snapshot = { ready, ids: new Set(ids) }; emit() }

export async function syncFavourites() {
  try {
    const rows = await api.favourites.list()
    ids = new Set((rows || []).map((r) => key(r.regionId, r.placeId)))
  } catch { /* signed out / API down */ }
  ready = true; refresh()
}
export function clearFavourites() { ids = new Set(); ready = false; refresh() }

export async function toggleFav(regionId, placeId) {
  const k = key(regionId, placeId)
  const was = ids.has(k)
  if (was) ids.delete(k); else ids.add(k)
  refresh()
  try {
    if (was) await api.favourites.remove(regionId, placeId)
    else await api.favourites.add(regionId, placeId)
  } catch (e) {
    if (was) ids.add(k); else ids.delete(k)   // revert
    refresh(); throw e
  }
}

export function useFavourites() {
  const snap = useSyncExternalStore(subscribe, () => snapshot)
  return {
    ready: snap.ready,
    ids: snap.ids,
    count: snap.ids.size,
    isFav: (r, p) => snap.ids.has(key(r, p)),
  }
}
