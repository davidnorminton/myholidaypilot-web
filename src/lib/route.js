// Order a day's stops by proximity: nearest-neighbour from the start, then
// 2-opt until no swap shortens the path. N is small (a day's stops), so this
// runs instantly and lands at or near the optimum.

export function kmBetween(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const pathKm = (pts, order) => {
  let km = 0
  for (let i = 1; i < order.length; i++) km += kmBetween(pts[order[i - 1]], pts[order[i]])
  return km
}

export function bestRoute(pts, startIdx = 0) {
  const n = pts.length
  if (n < 2) return { order: pts.map((_, i) => i), km: 0 }

  // nearest neighbour
  const left = new Set(pts.map((_, i) => i))
  let order = [startIdx]
  left.delete(startIdx)
  while (left.size) {
    const cur = pts[order[order.length - 1]]
    let best = null, bestD = Infinity
    for (const i of left) { const d = kmBetween(cur, pts[i]); if (d < bestD) { bestD = d; best = i } }
    order.push(best); left.delete(best)
  }

  // 2-opt (keep the start fixed — it's "where the day begins")
  let improved = true
  while (improved) {
    improved = false
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const next = order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1))
        if (pathKm(pts, next) + 1e-9 < pathKm(pts, order)) { order = next; improved = true }
      }
    }
  }
  return { order, km: pathKm(pts, order) }
}
