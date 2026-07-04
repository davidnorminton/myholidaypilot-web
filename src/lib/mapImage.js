// Render the scratch-map as a 1200×630 share image (the standard social
// card size) entirely on a canvas — no libraries, no network, brand colours
// baked in. Returns a PNG download.

const PAPER = '#f7f6f2'
const INK = '#2a2621'
const SOFT = '#5a544b'
const MUTED = '#8a8378'
const GOLD = '#a9762a'
const LINE = '#e4e0d8'
const RED = '#e02410'

export function downloadMapImage({ countryName, regions, visitedIds, placeCount }) {
  const W = 1200, H = 630
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  // paper + frame
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = LINE; ctx.lineWidth = 2
  ctx.strokeRect(24, 24, W - 48, H - 48)

  // header
  ctx.fillStyle = GOLD
  ctx.font = '700 15px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('MY TRAVEL MAP', 64, 92)

  ctx.fillStyle = INK
  ctx.font = '400 54px Georgia, "Times New Roman", serif'
  ctx.fillText(countryName, 64, 150)

  const n = visitedIds.size
  ctx.fillStyle = SOFT
  ctx.font = '400 21px Inter, system-ui, sans-serif'
  const statLine = `${n} of ${regions.length} regions${placeCount ? ` · ${placeCount} place${placeCount === 1 ? '' : 's'}` : ''}`
  ctx.fillText(statLine, 64, 186)

  // progress bar
  const barX = 64, barY = 208, barW = W - 128, barH = 10
  ctx.fillStyle = LINE
  roundRect(ctx, barX, barY, barW, barH, 5); ctx.fill()
  if (n > 0) {
    ctx.fillStyle = GOLD
    roundRect(ctx, barX, barY, Math.max(barH, barW * (n / Math.max(1, regions.length))), barH, 5); ctx.fill()
  }

  // region chips, wrapped rows
  ctx.font = '600 19px Inter, system-ui, sans-serif'
  const chipH = 44, gapX = 12, gapY = 14, padX = 18
  let x = 64, y = 252
  for (const r of regions) {
    const on = visitedIds.has(r.id)
    const label = on ? `${r.name}  ✓` : r.name
    const w = ctx.measureText(label).width + padX * 2
    if (x + w > W - 64) { x = 64; y += chipH + gapY }
    if (y + chipH > H - 84) break                       // never overflow the footer
    ctx.fillStyle = on ? GOLD : '#efece6'
    roundRect(ctx, x, y, w, chipH, 22); ctx.fill()
    if (!on) { ctx.strokeStyle = LINE; ctx.lineWidth = 1.5; roundRect(ctx, x, y, w, chipH, 22); ctx.stroke() }
    ctx.fillStyle = on ? '#fff' : MUTED
    ctx.fillText(label, x + padX, y + 29)
    x += w + gapX
  }

  // footer brand
  ctx.fillStyle = RED
  ctx.font = '700 22px Inter, system-ui, sans-serif'
  ctx.fillText('my', 64, H - 52)
  ctx.fillStyle = INK
  ctx.fillText('holidaypilot', 64 + ctx.measureText('my').width, H - 52)
  ctx.fillStyle = MUTED
  ctx.font = '400 16px Inter, system-ui, sans-serif'
  const url = 'myholidaypilot.com'
  ctx.fillText(url, W - 64 - ctx.measureText(url).width, H - 52)

  // download
  const a = document.createElement('a')
  a.download = `${countryName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-travel-map.png`
  a.href = canvas.toDataURL('image/png')
  a.click()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
