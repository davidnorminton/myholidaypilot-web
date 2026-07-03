// Region-level "been here" marks — same reactive pattern as favourites.
import { useSyncExternalStore } from 'react'
import { api } from './api.js'

let ids = new Set()          // regionIds
let byCountry = new Map()    // regionId -> countryId
let ready = false
let snapshot = { ready, ids }
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
const refresh = () => { snapshot = { ready, ids: new Set(ids) }; emit() }

export async function syncVisits() {
  try {
    const rows = await api.visits.list()
    ids = new Set((rows || []).map((r) => r.regionId))
    byCountry = new Map((rows || []).map((r) => [r.regionId, r.countryId]))
  } catch { /* signed out */ }
  ready = true; refresh()
}
export function clearVisits() { ids = new Set(); byCountry = new Map(); ready = false; refresh() }

export async function toggleVisit(regionId, countryId = 'italy') {
  const was = ids.has(regionId)
  if (was) ids.delete(regionId); else { ids.add(regionId); byCountry.set(regionId, countryId) }
  refresh()
  try {
    if (was) await api.visits.remove(regionId)
    else await api.visits.add(regionId, countryId)
  } catch (e) {
    if (was) ids.add(regionId); else ids.delete(regionId)
    refresh(); throw e
  }
}

export function useVisits() {
  const snap = useSyncExternalStore(subscribe, () => snapshot)
  return { ready: snap.ready, ids: snap.ids, has: (regionId) => snap.ids.has(regionId) }
}
