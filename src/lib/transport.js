// Mapbox geocoding helpers for travel points and nearby transport.
// Everything degrades to null/[] without a token or offline.
import { kmBetween } from './route.js'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const cache = new Map()

export async function searchPlaces(query, { proximity, country } = {}) {
  if (!TOKEN || !query.trim()) return []
  try {
    const prox = proximity ? `&proximity=${proximity.lng},${proximity.lat}` : ''
    const ctry = country ? `&country=${country}` : ''
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&limit=4&types=poi,place,address${prox}${ctry}&language=en`
    const res = await fetch(url)
    if (!res.ok) return []
    const j = await res.json()
    return (j.features || []).map((f) => ({ label: f.place_name, name: f.text, lat: f.center[1], lng: f.center[0] }))
  } catch { return [] }
}

// Nearest train station to a point (session-cached per ~1km cell).
export async function nearestStation(lat, lng) {
  if (!TOKEN || !lat || !lng) return null
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  if (cache.has(key)) return cache.get(key)
  const promise = (async () => {
    const hits = await searchPlaces('train station', { proximity: { lat, lng } })
    if (!hits.length) return null
    const best = hits
      .map((h) => ({ ...h, km: kmBetween({ lat, lng }, h) }))
      .sort((a, b) => a.km - b.km)[0]
    return best.km <= 40 ? best : null   // beyond ~40km it isn't "nearby"
  })()
  cache.set(key, promise)
  return promise
}
