export function regionColour(argb) {
  if (!argb) return '#8a8378'
  const hex = argb.length === 8 ? argb.slice(2) : argb
  return `#${hex}`
}

const TYPE_LABELS = {
  CITY: 'City', TOWN: 'Town', VILLAGE: 'Village', NATURE: 'Nature', PARK: 'Park',
  MOUNTAIN: 'Mountain', LAKE: 'Lake', COASTAL: 'Coast', BEACH: 'Beach', ISLAND: 'Island',
  HISTORIC: 'Historic', LANDMARK: 'Landmark', RELIGIOUS: 'Religious', MUSEUM: 'Museum',
  VIEWPOINT: 'Viewpoint', RUINS: 'Ruins', CASTLE: 'Castle',
}
export function typeLabel(type) {
  if (!type) return 'Place'
  return TYPE_LABELS[type] || type.charAt(0) + type.slice(1).toLowerCase()
}

export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

export function mapsQuery(parts) {
  const q = (Array.isArray(parts) ? parts : [parts]).filter(Boolean).join(' ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
