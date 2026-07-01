// Trip planner store — persisted to localStorage for now (swap for an API/DB later).
// Reactive via useSyncExternalStore so any component stays in sync.
import { useSyncExternalStore } from 'react'

const KEY = 'mhp_trips_v1'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.trips)) return parsed
    }
  } catch (e) { /* ignore */ }
  return { trips: [], activeTripId: null }
}

let state = load()
const listeners = new Set()

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { /* ignore */ }
}
function set(next) {
  state = next
  persist()
  listeners.forEach((l) => l())
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// ── store interface for useSyncExternalStore ──
export function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) }
export function getSnapshot() { return state }
export function useTrips() { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) }

// ── mutations ──
export function createTrip(name = 'My trip') {
  const trip = { id: uid(), name, createdAt: Date.now(), places: [] }
  set({ trips: [...state.trips, trip], activeTripId: trip.id })
  return trip.id
}
export function deleteTrip(id) {
  const trips = state.trips.filter((t) => t.id !== id)
  const activeTripId = state.activeTripId === id ? (trips[0]?.id ?? null) : state.activeTripId
  set({ trips, activeTripId })
}
export function renameTrip(id, name) {
  set({ ...state, trips: state.trips.map((t) => (t.id === id ? { ...t, name } : t)) })
}
export function setActiveTrip(id) { set({ ...state, activeTripId: id }) }

export function addPlace(tripId, place) {
  set({
    ...state,
    trips: state.trips.map((t) => {
      if (t.id !== tripId) return t
      if (t.places.some((p) => p.regionId === place.regionId && p.placeId === place.placeId)) return t
      return { ...t, places: [...t.places, { ...place, addedAt: Date.now(), done: false }] }
    }),
  })
}
export function removePlace(tripId, regionId, placeId) {
  set({
    ...state,
    trips: state.trips.map((t) =>
      t.id === tripId
        ? { ...t, places: t.places.filter((p) => !(p.regionId === regionId && p.placeId === placeId)) }
        : t
    ),
  })
}
export function togglePlaceDone(tripId, regionId, placeId) {
  set({
    ...state,
    trips: state.trips.map((t) =>
      t.id === tripId
        ? {
            ...t,
            places: t.places.map((p) =>
              p.regionId === regionId && p.placeId === placeId ? { ...p, done: !p.done } : p
            ),
          }
        : t
    ),
  })
}

// ── helpers ──
export function activeTrip(snap = state) {
  return snap.trips.find((t) => t.id === snap.activeTripId) || null
}
export function isInTrip(snap, tripId, regionId, placeId) {
  const t = snap.trips.find((x) => x.id === tripId)
  return !!t && t.places.some((p) => p.regionId === regionId && p.placeId === placeId)
}

export function updateNote(tripId, regionId, placeId, note) {
  set({
    ...state,
    trips: state.trips.map((t) =>
      t.id === tripId
        ? {
            ...t,
            places: t.places.map((p) =>
              p.regionId === regionId && p.placeId === placeId ? { ...p, note } : p
            ),
          }
        : t
    ),
  })
}

export function setTripDates(tripId, startDate, endDate) {
  set({ ...state, trips: state.trips.map((t) => (t.id === tripId ? { ...t, startDate, endDate } : t)) })
}

// Make a stable id for a user-entered custom place.
export function customPlaceId() {
  return 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function updatePlace(tripId, regionId, placeId, fn) {
  set({
    ...state,
    trips: state.trips.map((t) =>
      t.id === tripId
        ? { ...t, places: t.places.map((p) => (p.regionId === regionId && p.placeId === placeId ? fn(p) : p)) }
        : t
    ),
  })
}

export function setPlaceDate(tripId, regionId, placeId, date) {
  updatePlace(tripId, regionId, placeId, (p) => ({ ...p, date }))
}

// kind = 'attractions' | 'restaurants'; item must have a stable id
export function togglePlaceItem(tripId, regionId, placeId, kind, item) {
  updatePlace(tripId, regionId, placeId, (p) => {
    const arr = p[kind] || []
    const exists = arr.some((x) => x.id === item.id)
    return { ...p, [kind]: exists ? arr.filter((x) => x.id !== item.id) : [...arr, item] }
  })
}

// Move a place to a target day (date) and position. Reorders the underlying
// places array (which the itinerary groups by date in order) and sets the date.
// targetDate '' moves it back to unscheduled. Insert before {beforeRegionId,
// beforePlaceId} when given, else at the end of the target day's group.
export function movePlaceTo(tripId, regionId, placeId, targetDate, beforeRegionId = null, beforePlaceId = null) {
  set({
    ...state,
    trips: state.trips.map((t) => {
      if (t.id !== tripId) return t
      const places = [...t.places]
      const from = places.findIndex((p) => p.regionId === regionId && p.placeId === placeId)
      if (from < 0) return t
      const [moved] = places.splice(from, 1)
      const next = { ...moved, date: targetDate || '' }
      let insertIdx
      if (beforeRegionId) {
        insertIdx = places.findIndex((p) => p.regionId === beforeRegionId && p.placeId === beforePlaceId)
        if (insertIdx < 0) insertIdx = places.length
      } else {
        let last = -1
        places.forEach((p, i) => { if ((p.date || '') === (targetDate || '')) last = i })
        insertIdx = last >= 0 ? last + 1 : places.length
      }
      places.splice(insertIdx, 0, next)
      return { ...t, places }
    }),
  })
}
