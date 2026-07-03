// The Guided Planner engine: answers → a complete draft trip, built purely
// from the curated dataset (no AI, no external calls). Dependency-injected
// loaders keep it testable in Node against the real data.
import { bestRoute, kmBetween } from './route.js'

export const INTERESTS = [
  { id: 'food', label: 'Food & wine', emoji: '🍝' },
  { id: 'history', label: 'History & art', emoji: '🏛️' },
  { id: 'coast', label: 'Coast & beaches', emoji: '🌊' },
  { id: 'nature', label: 'Hiking & nature', emoji: '🥾' },
  { id: 'towns', label: 'Small towns', emoji: '🏘️' },
  { id: 'cities', label: 'City life', emoji: '🌆' },
]

export const PACES = [
  { id: 'relaxed', label: 'Relaxed', blurb: 'One thing at a time, room to linger' },
  { id: 'balanced', label: 'Balanced', blurb: 'A full day, but never a march' },
  { id: 'packed', label: 'Packed', blurb: 'See as much as humanly possible' },
]

export const STYLES = [
  { id: 'base', label: 'One base, day trips', blurb: 'Unpack once, explore outward' },
  { id: 'touring', label: 'Touring', blurb: 'A new town every day or two' },
]

// type weights per interest — how much each place type satisfies an interest
const TYPE_WEIGHTS = {
  food: { CITY: 1, TOWN: 1.5, COAST: 1 },
  history: { LANDMARK: 3, CITY: 2, TOWN: 1 },
  coast: { COAST: 3, LAKE: 1.5 },
  nature: { MOUNTAIN: 3, LAKE: 2, COAST: 1 },
  towns: { TOWN: 3, LANDMARK: 1 },
  cities: { CITY: 3 },
}

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']

// deterministic pseudo-random from a seed, for "regenerate" variety
function rng(seed) {
  let s = seed >>> 0 || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

function placeScore(p, interests, rand) {
  let score = 0.5
  for (const int of interests) score += TYPE_WEIGHTS[int]?.[p.type] || 0
  return score + rand() * 0.6
}

export function scoreRegions({ index, placesIndex }, quiz, { exclude = [], seed = 1 } = {}) {
  const rand = rng(seed)
  const month = quiz.startDate ? MONTHS[new Date(quiz.startDate + 'T12:00').getMonth()] : null
  const byRegion = new Map()
  for (const p of placesIndex) {
    if (!byRegion.has(p.regionId)) byRegion.set(p.regionId, [])
    byRegion.get(p.regionId).push(p)
  }
  return index.regions
    .filter((r) => !exclude.includes(r.id))
    .map((r) => {
      const places = byRegion.get(r.id) || []
      let score = places.reduce((s, p) => s + placeScore(p, quiz.interests, rand), 0) / Math.max(places.length, 1) * 4
      score += Math.min(places.length, 12) * 0.12                       // enough to fill the trip
      if (month && (r.bestTimeToVisit || '').toLowerCase().includes(month)) score += 2.2
      if (quiz.interests.includes('food')) score += Math.min(r.restaurantCount || 0, 20) * 0.04
      return { region: r, places, score: score + rand() * 0.8 }
    })
    .sort((a, b) => b.score - a.score)
}

function tripDays(startDate, nights) {
  const out = []
  const d = new Date(startDate + 'T12:00')
  for (let i = 0; i <= nights; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

// how many places / picks per day for each pace
const PACE = {
  relaxed: { places: (days) => Math.max(2, days - 1), do: 2, eat: 1 },
  balanced: { places: (days) => days, do: 3, eat: 1 },
  packed: { places: (days) => days + Math.max(1, Math.floor(days / 3)), do: 4, eat: 2 },
}

export async function generatePlan(quiz, { index, placesIndex, getRegion }, { seed = 1, exclude = [] } = {}) {
  const rand = rng(seed + 7)
  const ranked = scoreRegions({ index, placesIndex }, quiz, { exclude, seed })
  const top = ranked[0]
  if (!top) return null
  const { region, places: candidates } = top

  const days = tripDays(quiz.startDate, quiz.nights)
  const pace = PACE[quiz.pace] || PACE.balanced
  const wanted = Math.min(pace.places(days.length), candidates.length)

  // choose places: best interest fit; guarantee a CITY/TOWN base
  const scored = candidates.map((p) => ({ p, s: placeScore(p, quiz.interests, rand) }))
    .sort((a, b) => b.s - a.s)
  let chosen = scored.slice(0, wanted).map((x) => x.p)
  if (!chosen.some((p) => p.type === 'CITY' || p.type === 'TOWN')) {
    const base = scored.find((x) => x.p.type === 'CITY' || x.p.type === 'TOWN')
    if (base) chosen = [base.p, ...chosen.slice(0, wanted - 1)]
  }

  // order + assign days
  let ordered
  const baseIdx = chosen.findIndex((p) => p.type === 'CITY') >= 0
    ? chosen.findIndex((p) => p.type === 'CITY')
    : chosen.findIndex((p) => p.type === 'TOWN')
  if (quiz.style === 'base' && baseIdx >= 0) {
    const base = chosen[baseIdx]
    const rest = chosen.filter((_, i) => i !== baseIdx)
      .sort((a, b) => kmBetween(base, a) - kmBetween(base, b))
    ordered = [base, ...rest]
  } else {
    const { order } = bestRoute(chosen, Math.max(baseIdx, 0))
    ordered = order.map((i) => chosen[i])
  }

  // one place per day in order; extras double up on the geographically nearest day
  const perDay = new Map(days.map((d) => [d, []]))
  ordered.slice(0, days.length).forEach((p, i) => perDay.get(days[i]).push(p))
  for (const extra of ordered.slice(days.length)) {
    let best = days[0], bestD = Infinity
    for (const d of days) {
      const host = perDay.get(d)[0]
      if (!host) continue
      const dist = kmBetween(host, extra)
      if (perDay.get(d).length < 2 && dist < bestD) { bestD = dist; best = d }
    }
    perDay.get(best).push(extra)
  }

  // picks from the full region file
  const full = await getRegion(region.id)
  const detail = new Map((full.places || []).map((p) => [p.id, p]))
  const allRestaurants = full.restaurants || []
  const usedRestaurants = new Set()

  const dayPlans = days.map((date) => ({
    date,
    places: (perDay.get(date) || []).map((p) => {
      const d = detail.get(p.placeId) || {}
      const attractions = (d.activities || []).slice(0, pace.do)
        .map((a) => ({ id: a.id, text: a.text, lat: a.lat, lng: a.lng, date }))
      const near = [...allRestaurants]
        .filter((r) => !usedRestaurants.has(r.id))
        .sort((a, b) => {
          const da = a.lat ? kmBetween(a, p) : 999, db = b.lat ? kmBetween(b, p) : 999
          return da - db
        })
        .slice(0, pace.eat)
      near.forEach((r) => usedRestaurants.add(r.id))
      const restaurants = near.map((r) => ({
        id: r.id, name: r.name, cuisine: r.cuisine, priceRange: r.priceRange,
        mustOrder: r.mustOrder, lat: r.lat, lng: r.lng, date,
      }))
      return { ...p, attractions, restaurants }
    }),
  }))

  // rough distance: the day-to-day journey through every stop, in order
  let km = 0
  const seq = dayPlans.flatMap((d) => d.places).filter((p) => p.lat && p.lng)
  for (let i = 1; i < seq.length; i++) km += kmBetween(seq[i - 1], seq[i])
  if (quiz.style === 'base' && seq.length > 1) km *= 2   // day trips return to base

  return {
    region: { id: region.id, name: region.name, emoji: region.emoji, bestTimeToVisit: region.bestTimeToVisit },
    startDate: quiz.startDate,
    endDate: days[days.length - 1],
    days: dayPlans,
    placeCount: ordered.length,
    km: Math.round(km),
    name: `${region.name} in ${days.length} days`,
  }
}
