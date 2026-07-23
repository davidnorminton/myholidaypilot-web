// Nearest places within a region, by great-circle distance.
//
// Used by the place page ("Nearby in {Region}") and mirrored in the prerender so
// crawlers and users see the same links. Same-region only, on purpose: the
// region's places are already loaded (zero extra fetches client-side), and the
// prerender walks region files anyway. Cross-region nearby would need a
// country-wide coordinate index — worth it someday, not for four links.

const R = 6371 // km
const rad = (d) => (d * Math.PI) / 180

export function distanceKm(aLat, aLng, bLat, bLng) {
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// The `n` nearest places COUNTRY-WIDE, from the build-time places-geo index
// ({id, r: regionId, rn: regionName, n: name, lat, lng} per place). Border
// places finally get their real closest neighbours instead of only same-region
// ones — Ventimiglia's nearest towns are in the next region over, not 200km up
// its own coast.
export function nearbyAcross(place, geoPlaces, n = 4) {
  if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return []
  return (geoPlaces || [])
    .filter((p) => p.id !== place.id && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => ({ id: p.id, name: p.n, regionId: p.r, regionName: p.rn,
      km: distanceKm(place.lat, place.lng, p.lat, p.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
}

// The `n` nearest other places in the same region that have coordinates.
export function nearbyPlaces(place, regionPlaces, n = 4) {
  if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return []
  return (regionPlaces || [])
    .filter((p) => p.id !== place.id && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => ({ ...p, km: distanceKm(place.lat, place.lng, p.lat, p.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
}
