// Trip planner store. localStorage is always the offline cache; when the
// person is signed in, trips also sync to their account through /api/trips
// (a debounced diff pushes only what changed). Reactive via
// useSyncExternalStore so any component stays in sync.
import { useSyncExternalStore } from 'react'
import { api } from './api.js'

const KEY = 'mhp_trips_v1'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.trips)) return parsed
    }
  } catch { /* ignore */ }
  return { trips: [], activeTripId: null }
}

let state = load()
const listeners = new Set()

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
}
function set(next) {
  // stamp changed trips so sign-in merges pick the right winner
  if (next.trips && state.trips) {
    const prev = new Map(state.trips.map((t) => [t.id, t]))
    next = {
      ...next,
      trips: next.trips.map((t) => (prev.get(t.id) === t ? t : { ...t, updatedAt: Date.now() })),
    }
  }
  state = next
  persist()
  schedulePush()
  listeners.forEach((l) => l())
}

// ── account sync ─────────────────────────────────────────────────────────────
let signedIn = false
let shadow = new Map()          // tripId -> JSON string last seen on the server
let pushTimer = null

const tripJson = (t) => JSON.stringify(t)

function schedulePush() {
  if (!signedIn) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(pushChanges, 800)
}

async function pushChanges() {
  if (!signedIn) return
  const current = new Map(state.trips.map((t) => [t.id, t]))
  // upsert new/changed trips
  for (const [id, t] of current) {
    const j = tripJson(t)
    if (shadow.get(id) === j) continue
    try {
      const ts = Date.now()
      await api.trips.upsert({ id, name: t.name, data: t, updatedAt: ts })
      shadow.set(id, j)
    } catch (e) { console.warn('trip sync failed (will retry on next change)', e) }
  }
  // delete removed trips
  for (const id of [...shadow.keys()]) {
    if (current.has(id)) continue
    try { await api.trips.remove(id); shadow.delete(id) }
    catch (e) { console.warn('trip delete sync failed', e) }
  }
}

// Force any pending debounced sync to run now and wait for it — used before
// publishing a freshly-created trip so the server has it before it snapshots.
export async function flushTrips() { clearTimeout(pushTimer); await pushChanges() }

// Called from Layout when auth changes. On sign-in: pull the account's trips,
// merge with anything local (local trips not yet on the server are adopted
// into the account), then keep pushing changes in the background.
export async function syncTrips(user) {
  if (!user) { signedIn = false; shadow = new Map(); return }
  try {
    const rows = await api.trips.list()
    signedIn = true
    const merged = new Map()

    for (const r of rows) {
      const local = state.trips.find((t) => t.id === r.id)
      const localTs = local?.updatedAt || 0
      const winner = local && localTs > (r.updatedAt || 0) ? local : { ...r.data, id: r.id }
      merged.set(r.id, winner)
      if (winner === local) { /* newer locally — will push via diff */ }
      else shadow.set(r.id, tripJson(winner))
    }
    for (const t of state.trips) if (!merged.has(t.id)) merged.set(t.id, t)   // local-only → adopt

    const trips = [...merged.values()]
    const activeTripId = trips.some((t) => t.id === state.activeTripId)
      ? state.activeTripId
      : (trips[0]?.id || null)
    set({ trips, activeTripId })
  } catch (e) {
    signedIn = false
    console.warn('could not load account trips', e)
  }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// ── store interface for useSyncExternalStore ──
export function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) }
export function getSnapshot() { return state }
export function useTrips() { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) }

// ── mutations ──
export function createTrip(name = 'My trip', countryId = 'italy') {
  const trip = { id: uid(), name, countryId, createdAt: Date.now(), places: [] }
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
// Destination changed in the planner — airports, guides and Viator all key off it.
export function setTripCountry(id, countryId) {
  set({ ...state, trips: state.trips.map((t) => (t.id === id ? { ...t, countryId } : t)) })
}
// A day's "saved" flag — the day picker collapses to its summary when set.
// Keyed by the day's date so the flags survive reloads and follow date shifts.
export function setDaySaved(id, date, on) {
  set({ ...state, trips: state.trips.map((t) => (t.id === id ? { ...t, savedDays: { ...(t.savedDays || {}), [date]: !!on } } : t)) })
}
export function clearSavedDays(id) {
  set({ ...state, trips: state.trips.map((t) => (t.id === id ? { ...t, savedDays: {} } : t)) })
}
// Reorder one day's picks (attractions or restaurants) on a place. Items from
// other days keep their positions — only the given day's items swap slots.
export function reorderPlaceItems(tripId, regionId, placeId, kind, day, orderedIds) {
  updatePlace(tripId, regionId, placeId, (p) => {
    const arr = [...(p[kind] || [])]
    const slots = arr.map((x, i) => ((x.date || '') === day ? i : -1)).filter((i) => i >= 0)
    const byId = new Map(arr.filter((x) => (x.date || '') === day).map((x) => [x.id, x]))
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean)
    if (ordered.length !== slots.length) return p   // ids out of sync — leave untouched
    slots.forEach((slot, i) => { arr[slot] = ordered[i] })
    return { ...p, [kind]: arr }
  })
}

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
              p.regionId === regionId && p.placeId === placeId
                ? { ...p, done: !p.done, visitedAt: !p.done ? Date.now() : undefined }
                : p
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

const DAY_MS = 86400000
const shiftDate = (d, delta) => {
  if (!d) return d
  const t = new Date(d + 'T12:00'); t.setTime(t.getTime() + delta * DAY_MS)
  return t.toISOString().slice(0, 10)
}

export function setTripDates(tripId, startDate, endDate) {
  set({
    ...state,
    trips: state.trips.map((t) => {
      if (t.id !== tripId) return t
      // Moving the start date moves the whole trip: the end date and every
      // scheduled place/pick shift by the same number of days.
      if (t.startDate && startDate && startDate !== t.startDate && endDate === (t.endDate || '')) {
        const delta = Math.round((new Date(startDate) - new Date(t.startDate)) / DAY_MS)
        const shiftItems = (arr) => (arr || []).map((x) => (x.date ? { ...x, date: shiftDate(x.date, delta) } : x))
        return {
          ...t,
          startDate,
          endDate: shiftDate(t.endDate, delta),
          places: t.places.map((p) => ({
            ...p,
            date: p.date ? shiftDate(p.date, delta) : p.date,
            attractions: shiftItems(p.attractions),
            restaurants: shiftItems(p.restaurants),
          })),
        }
      }
      return { ...t, startDate, endDate }
    }),
  })
}

// A full copy of a trip (places, picks, notes) under a new name.
export function duplicateTrip(id) {
  const src = state.trips.find((t) => t.id === id)
  if (!src) return null
  const copy = { ...structuredClone(src), id: uid(), name: `Copy of ${src.name}`, createdAt: Date.now() }
  set({ ...state, trips: [...state.trips, copy], activeTripId: copy.id })
  return copy.id
}

// Import a trip received via a share link.
export function importTrip(data) {
  const trip = {
    id: uid(), createdAt: Date.now(),
    name: data.name || 'Shared trip',
    countryId: data.countryId || 'italy',
    story: data.story?.text ? { text: data.story.text, generatedAt: Date.now() } : undefined,
    startDate: data.startDate || '', endDate: data.endDate || '',
    places: (data.places || []).map((p) => ({ ...p })),
    stays: (data.stays || []).map((x) => ({ ...x, id: uid() })),
  }
  set({ trips: [...state.trips, trip], activeTripId: trip.id })
  return trip.id
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
  updatePlace(tripId, regionId, placeId, (p) => {
    // When a place is scheduled for the FIRST time, its unscheduled ('anytime')
    // picks move onto that day. After that, picks stay on the day they were
    // chosen for — switching days must never drag them along.
    const oldDay = p.date || ''
    const follow = (arr) => (arr || []).map((x) => {
      const d = x.date === undefined ? oldDay : (x.date || '')
      return oldDay === '' && d === '' ? { ...x, date: date || '' } : x
    })
    return withAutoDone({ ...p, date, attractions: follow(p.attractions), restaurants: follow(p.restaurants) })
  })
}

// Mark a place as the base for the whole trip — the day picker then pre-selects
// it on every day.
export function setPlaceAllDays(tripId, regionId, placeId, on) {
  updatePlace(tripId, regionId, placeId, (p) => ({ ...p, allDays: !!on }))
}

// A place counts as "locked in" once it has a day or any picks; clears when
// everything is removed. Manual ticks still work in between.
// Re-derive a place's done ("locked in") state from whether it's planned —
// used when the planner popup closes, so a manual untick doesn't linger after
// the person has clearly planned the place.
// ── gallery copy ─────────────────────────────────────────────────────────────
// Materialise a published snapshot into a fresh trip of your own. Relative
// day numbers become real dates starting three weeks from today; shift them
// afterwards with the normal date controls.
export function importGalleryTrip(snap) {
  const start = new Date(); start.setDate(start.getDate() + 21)
  const iso = (dayN) => {
    if (!dayN) return ''
    const d = new Date(start); d.setDate(d.getDate() + (dayN - 1))
    return d.toISOString().slice(0, 10)
  }
  const id = createTrip(snap.title || 'Copied trip', snap.countryId || 'italy')
  setTripDates(id, iso(1), iso(snap.days || 1))
  for (const p of snap.places || []) {
    addPlace(id, { regionId: p.regionId, regionName: p.regionName, placeId: p.placeId, name: p.name, type: p.type, lat: p.lat, lng: p.lng })
    if (p.day) setPlaceDate(id, p.regionId, p.placeId, iso(p.day))
    for (const a of p.attractions || []) togglePlaceItem(id, p.regionId, p.placeId, 'attractions', { id: a.id, text: a.text, lat: a.lat, lng: a.lng }, iso(a.day))
    for (const r of p.restaurants || []) togglePlaceItem(id, p.regionId, p.placeId, 'restaurants', { id: r.id, name: r.name, cuisine: r.cuisine, mustOrder: r.mustOrder, lat: r.lat, lng: r.lng }, iso(r.day))
  }
  for (const s of snap.stays || []) {
    if (s.name) addStay(id, { name: s.name, type: s.type || 'hotel', from: iso(s.fromDay), to: iso(s.toDay) })
  }
  setActiveTrip(id)
  return id
}

// ── story ────────────────────────────────────────────────────────────────────
export function setStory(tripId, story) {
  set({ ...state, trips: state.trips.map((t) => (t.id === tripId ? { ...t, story } : t)) })
}

// ── review ───────────────────────────────────────────────────────────────────
export function setReview(tripId, review) {
  set({ ...state, trips: state.trips.map((t) => (t.id === tripId ? { ...t, review } : t)) })
}

// ── budget ───────────────────────────────────────────────────────────────────
export function setBudget(tripId, budget) {
  set({ ...state, trips: state.trips.map((t) => (t.id === tripId ? { ...t, budget } : t)) })
}
export function setBudgetOverride(tripId, key, value) {
  set({
    ...state,
    trips: state.trips.map((t) => {
      if (t.id !== tripId || !t.budget) return t
      const overrides = { ...(t.budget.overrides || {}) }
      if (value === null || value === '' || !Number.isFinite(Number(value))) delete overrides[key]
      else overrides[key] = Number(value)
      return { ...t, budget: { ...t.budget, overrides } }
    }),
  })
}

// ── travellers (shared by budget + packing) ─────────────────────────────────
export function setTravellers(tripId, travellers) {
  set({ ...state, trips: state.trips.map((t) => (t.id === tripId ? { ...t, travellers } : t)) })
}

// ── packing list ─────────────────────────────────────────────────────────────
export function setPacking(tripId, packing) {
  set({ ...state, trips: state.trips.map((t) => (t.id === tripId ? { ...t, packing } : t)) })
}
export function togglePackingItem(tripId, catIdx, itemIdx) {
  set({
    ...state,
    trips: state.trips.map((t) => {
      if (t.id !== tripId || !t.packing) return t
      const cats = t.packing.categories.map((c, ci) => ci !== catIdx ? c : {
        ...c, items: c.items.map((it, ii) => ii !== itemIdx ? it : { ...it, done: !it.done }),
      })
      return { ...t, packing: { ...t.packing, categories: cats } }
    }),
  })
}

export function refreshPlaceDone(tripId, regionId, placeId) {
  updatePlace(tripId, regionId, placeId, (p) => withAutoDone(p))
}

function withAutoDone(p) {
  const planned = !!(p.date || p.attractions?.length || p.restaurants?.length)
  return { ...p, done: planned }
}

// kind = 'attractions' | 'restaurants'; item must have a stable id.
// Selections are per-day: `date` is the day this pick belongs to ('' = anytime),
// so the same attraction/restaurant can be chosen on more than one day.
// Items saved before dates existed are migrated to the place's day on first touch.
export function togglePlaceItem(tripId, regionId, placeId, kind, item, date = '') {
  updatePlace(tripId, regionId, placeId, (p) => {
    const arr = (p[kind] || []).map((x) => (x.date === undefined ? { ...x, date: p.date || '' } : x))
    const d = date || ''
    const exists = arr.some((x) => x.id === item.id && (x.date || '') === d)
    return withAutoDone({
      ...p,
      [kind]: exists
        ? arr.filter((x) => !(x.id === item.id && (x.date || '') === d))
        : [...arr, { ...item, date: d }],
    })
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
      const next = withAutoDone({ ...moved, date: targetDate || '' })
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

// ── travel points (how you arrive & leave) ──────────────────────────────────
// trip.travel = { arrive: { name, type, lat, lng } | null, depart: {...} | null }
export function setTravelPoint(tripId, which, point) {
  set({ ...state, trips: state.trips.map((t) =>
    t.id === tripId ? { ...t, travel: { ...(t.travel || {}), [which]: point } } : t) })
}

// ── stays (accommodation) ────────────────────────────────────────────────────
// A stay covers a range of nights: { id, name, type, from, to, lat?, lng?, address? }
export function addStay(tripId, stay) {
  const withId = { ...stay, id: uid() }
  set({ ...state, trips: state.trips.map((t) => (t.id === tripId ? { ...t, stays: [...(t.stays || []), withId] } : t)) })
  return withId.id
}
export function updateStay(tripId, stayId, patch) {
  set({ ...state, trips: state.trips.map((t) =>
    t.id === tripId ? { ...t, stays: (t.stays || []).map((s) => (s.id === stayId ? { ...s, ...patch } : s)) } : t) })
}
export function removeStay(tripId, stayId) {
  set({ ...state, trips: state.trips.map((t) =>
    t.id === tripId ? { ...t, stays: (t.stays || []).filter((s) => s.id !== stayId) } : t) })
}
// The stay whose nights cover a given day ('' → none).
export function stayForDay(trip, date) {
  if (!date) return null
  return (trip.stays || []).find((s) => s.from && s.to && s.from <= date && date <= s.to) || null
}

// Backfill lat/lng for places saved before coordinates were stored (older
// trips). Called once with the places index; writes only if something changed.
export function healTripCoords(index) {
  const byId = Object.fromEntries(index.map((p) => [`${p.regionId}/${p.placeId}`, p]))
  let changed = false
  const trips = state.trips.map((t) => {
    const places = t.places.map((p) => {
      if (p.lat && p.lng) return p
      const hit = byId[`${p.regionId}/${p.placeId}`]
      if (!hit) return p
      changed = true
      return { ...p, lat: hit.lat, lng: hit.lng }
    })
    return changed ? { ...t, places } : t
  })
  if (changed) set({ ...state, trips })
}
