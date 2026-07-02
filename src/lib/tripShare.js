import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

// Compact, URL-safe encoding of a trip for share links. Only what the
// read-only view needs; ids are regenerated on import.
export function encodeTrip(trip) {
  const slim = {
    v: 1,
    name: trip.name, startDate: trip.startDate || '', endDate: trip.endDate || '',
    stays: (trip.stays || []).map((x) => ({ name: x.name, type: x.type, from: x.from, to: x.to, lat: x.lat, lng: x.lng, address: x.address })),
    places: trip.places.map((p) => ({
      regionId: p.regionId, regionName: p.regionName, placeId: p.placeId,
      name: p.name, type: p.type, lat: p.lat, lng: p.lng,
      date: p.date || '', note: p.note || '', isCustom: p.isCustom || undefined,
      attractions: (p.attractions || []).map((a) => ({ id: a.id, text: a.text, lat: a.lat, lng: a.lng, date: a.date || '' })),
      restaurants: (p.restaurants || []).map((r) => ({ id: r.id, name: r.name, cuisine: r.cuisine, mustOrder: r.mustOrder, lat: r.lat, lng: r.lng, date: r.date || '' })),
    })),
  }
  return compressToEncodedURIComponent(JSON.stringify(slim))
}

export function decodeTrip(code) {
  try {
    const obj = JSON.parse(decompressFromEncodedURIComponent(code))
    if (!obj || obj.v !== 1 || !Array.isArray(obj.places)) return null
    return obj
  } catch { return null }
}

export function shareUrl(trip) {
  return `${location.origin}${location.pathname}#/trip/${encodeTrip(trip)}`
}
