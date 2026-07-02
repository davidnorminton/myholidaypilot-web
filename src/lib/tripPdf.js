import { getPlacesIndex } from './data.js'
import { bestRoute, kmBetween } from './route.js'

const fmt = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''

// Strip characters jsPDF's built-in (cp1252) fonts can't render.
const safeText = (s) => String(s || '').replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D]/g, '')

function groups(trip) {
  const dated = trip.places.filter((p) => p.date).sort((a, b) => a.date.localeCompare(b.date))
  const loose = trip.places.filter((p) => !p.date)
  const out = []
  for (const p of dated) {
    const last = out[out.length - 1]
    if (last && last.key === p.date) last.places.push(p)
    else out.push({ key: p.date, label: fmt(p.date), places: [p] })
  }
  if (loose.length) out.push({ key: '', label: dated.length ? 'Anytime' : null, places: loose })
  return out
}

// Static map of the trip's places (numbered pins) via the Mapbox Static Images
// API — same token as the live maps. Returns a dataURL, or null when there's
// no token / no coordinates / the request fails (the PDF simply skips the map).
const effectiveDay = (x, p) => (x.date === undefined ? (p.date || '') : (x.date || ''))

function pinsFor(places, extras, numberOf) {
  const placePins = places.slice(0, 30)
    .map((p) => `pin-s-${numberOf(p)}+a9762a(${p.lng.toFixed(4)},${p.lat.toFixed(4)})`)
  const extraPins = extras.slice(0, Math.max(0, 40 - placePins.length))
    .map((m) => `pin-s+${m.colour}(${m.lng.toFixed(4)},${m.lat.toFixed(4)})`)
  return { pins: [...placePins, ...extraPins].join(','), all: [...places, ...extras] }
}

async function staticMap(pins, all, size) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token || all.length === 0) return null
  const view = all.length === 1 ? `${all[0].lng},${all[0].lat},10` : 'auto'
  const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pins}/${view}/${size}@2x?padding=55&access_token=${token}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch { return null }
}

export async function downloadTripPdf(trip) {
  // Backfill any place saved without coordinates (older trips) from the index.
  let byId = {}
  try {
    const idx = await getPlacesIndex()
    byId = Object.fromEntries(idx.map((p) => [`${p.regionId}/${p.placeId}`, p]))
  } catch { /* offline — map may miss those pins */ }
  const healed = trip.places.map((p) => {
    if (p.lat && p.lng) return p
    const hit = byId[`${p.regionId}/${p.placeId}`]
    return hit ? { ...p, lat: hit.lat, lng: hit.lng } : p
  })
  const t = { ...trip, places: healed }

  const gs = groups(t)
  const ordered = gs.flatMap((g) => g.places)
  const withCoords = ordered.filter((p) => p.lat && p.lng)
  const numbered = new Map(withCoords.map((p, i) => [p, i + 1]))
  const numberOf = (p) => numbered.get(p) || ''
  const extras = ordered.flatMap((p) => [
    ...(p.attractions || []).filter((a) => a.lat && a.lng).map((a) => ({ ...a, colour: '1f6f54' })),
    ...(p.restaurants || []).filter((r) => r.lat && r.lng).map((r) => ({ ...r, colour: 'bb3a2c' })),
  ])

  // one map per day: that day's places, plus picks belonging to that day
  const stayFor = (key) => (key ? (t.stays || []).find((x) => x.from && x.to && x.from <= key && key <= x.to) : null)
  const dayMarkers = (key) => {
    const places = withCoords.filter((p) => (p.date || '') === key)
    const ex = t.places.flatMap((p) => [
      ...(p.attractions || []).filter((a) => a.lat && a.lng && effectiveDay(a, p) === key).map((a) => ({ ...a, colour: '1f6f54' })),
      ...(p.restaurants || []).filter((r) => r.lat && r.lng && effectiveDay(r, p) === key).map((r) => ({ ...r, colour: 'bb3a2c' })),
    ])
    return { places, ex }
  }
  const overview = pinsFor(withCoords, extras, numberOf)
  const [{ jsPDF }, mapData, ...dayMaps] = await Promise.all([
    import('jspdf'),
    staticMap(overview.pins, overview.all, '700x360'),
    ...gs.map((g) => {
      const { places, ex } = dayMarkers(g.key || '')
      const stay = stayFor(g.key || '')
      const dp = pinsFor(places, ex, numberOf)
      let pins = dp.pins, all = dp.all
      if (stay?.lat && stay?.lng) {
        const sp = `pin-s-lodging+3a3733(${stay.lng.toFixed(4)},${stay.lat.toFixed(4)})`
        pins = pins ? `${sp},${pins}` : sp
        all = [stay, ...all]
      }
      const arr = g.key && g.key === t.startDate ? t.travel?.arrive : null
      const dep = g.key && g.key === t.endDate ? t.travel?.depart : null
      for (const pt of [arr, dep]) {
        if (!pt?.lat || !pt?.lng) continue
        const pp = `pin-s-${pt.type === 'airport' ? 'airport' : 'rail'}+1565c0(${pt.lng.toFixed(4)},${pt.lat.toFixed(4)})`
        pins = pins ? `${pp},${pins}` : pp
        all = [pt, ...all]
      }
      return staticMap(pins, all, '700x260')
    }),
  ])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), M = 52, bottom = doc.internal.pageSize.getHeight() - 56
  let y = 64
  const need = (h) => { if (y + h > bottom) { doc.addPage(); y = 64 } }

  // ── header ──
  doc.setFont('times', 'normal'); doc.setFontSize(30); doc.setTextColor(28, 26, 23)
  doc.text(safeText(trip.name) || 'My trip', M, y)
  y += 20
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(120, 114, 106)
  const dates = trip.startDate ? `${fmt(trip.startDate)} - ${fmt(trip.endDate || trip.startDate)}` : ''
  const regions = new Set(trip.places.map((p) => p.regionName).filter(Boolean))
  doc.text([dates, `${trip.places.length} place${trip.places.length === 1 ? '' : 's'}`,
    regions.size ? `${regions.size} region${regions.size === 1 ? '' : 's'}` : '']
    .filter(Boolean).join('   ·   '), M, y)
  y += 14
  doc.setDrawColor(169, 118, 42); doc.setLineWidth(1.2); doc.line(M, y, W - M, y)
  y += 24

  // ── map (numbered pins match the numbered places below) ──
  if (mapData) {
    const w = W - M * 2, h = w * (360 / 700)
    need(h + 20)
    doc.addImage(mapData, 'PNG', M, y, w, h)
    doc.setDrawColor(229, 225, 216); doc.setLineWidth(.75); doc.rect(M, y, w, h)
    y += h + 26
  }

  // ── days & places ──
  for (let gi = 0; gi < gs.length; gi++) {
    const g = gs[gi]
    if (g.label) {
      need(40)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(169, 118, 42)
      doc.text(g.label.toUpperCase(), M, y, { charSpace: 1.5 })
      y += 18
    }
    const gstay = stayFor(g.key || '')
    if (gstay) {
      need(16)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(90, 85, 78)
      doc.text(safeText(`Staying at: ${gstay.name} (${gstay.type})`), M, y)
      y += 14
    }
    const dm = dayMaps[gi]
    if (dm) {
      const w = W - M * 2, h = w * (260 / 700)
      need(h + 16)
      doc.addImage(dm, 'PNG', M, y, w, h)
      doc.setDrawColor(229, 225, 216); doc.setLineWidth(.75); doc.rect(M, y, w, h)
      y += h + 14
    }
    { // recommended route text for the day
      const { places: dp, ex } = dayMarkers(g.key || '')
      const rstay = stayFor(g.key || '')
      const rarr = g.key && g.key === t.startDate && t.travel?.arrive?.lat ? t.travel.arrive : null
      const rdep = g.key && g.key === t.endDate && t.travel?.depart?.lat ? t.travel.depart : null
      const stops = [
        ...(rarr ? [{ lat: rarr.lat, lng: rarr.lng, label: `Arrive (${rarr.name})` }] : []),
        ...(rstay?.lat && rstay?.lng ? [{ lat: rstay.lat, lng: rstay.lng, label: `Stay (${rstay.name})` }] : []),
        ...dp.map((p) => ({ lat: p.lat, lng: p.lng, label: p.name })),
        ...ex.map((m) => ({ lat: m.lat, lng: m.lng, label: m.text || m.name }))]
      if (stops.length + (rdep ? 1 : 0) >= 2) {
        let { order, km } = bestRoute(stops, 0)
        let seq = order.map((i) => stops[i])
        if (rdep) { km += seq.length ? kmBetween(seq[seq.length - 1], rdep) : 0; seq = [...seq, { lat: rdep.lat, lng: rdep.lng, label: `Depart (${rdep.name})` }] }
        else if (rstay?.lat && !rarr && seq.length > 1) { km += kmBetween(seq[seq.length - 1], seq[0]); seq = [...seq, { ...seq[0], label: 'back to stay' }] }
        const parts = seq.map((m, i) => i < seq.length - 1
          ? `${safeText(m.label)}  ${(() => { const k = kmBetween(m, seq[i + 1]); return (k < 10 ? k.toFixed(1) : Math.round(k)) })()} km >`
          : safeText(m.label))
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 114, 106)
        const wrapped = doc.splitTextToSize(`Route: ${parts.join('  ')}   ·   total ~ ${km < 10 ? km.toFixed(1) : Math.round(km)} km`, W - M * 2)
        need(wrapped.length * 11 + 8)
        doc.text(wrapped, M, y); y += wrapped.length * 11 + 10
      }
    }
    for (const p of g.places) {
      need(34)
      // an empty checkbox to tick on the trip — never pre-filled
      const box = (x, size = 10) => {
        doc.setDrawColor(122, 116, 106); doc.setLineWidth(1)
        doc.rect(x, y - size + 1.5, size, size)
      }
      box(M)
      const num = numbered.get(p)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(28, 26, 23)
      doc.text(`${num ? num + '.  ' : ''}${safeText(p.name)}`, M + 18, y)
      const meta = [p.regionName, p.isCustom ? 'your own place' : null].filter(Boolean).join(' · ')
      if (meta) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(150, 144, 134)
        doc.text(safeText(meta), W - M, y, { align: 'right' })
      }
      y += 18

      // planner-style groups: a small gold heading, then checkbox rows
      const section = (label, items) => {
        if (!items?.length) return
        need(20)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(169, 118, 42)
        doc.text(label.toUpperCase(), M + 18, y, { charSpace: 1.4 })
        y += 13
        for (const it of items) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(70, 66, 59)
          const itemDay = it.date === undefined ? (p.date || '') : (it.date || '')
          const tag = itemDay !== (p.date || '') ? `  (${itemDay ? fmt(itemDay) : 'anytime'})` : ''
          const wrapped = doc.splitTextToSize(`${safeText(it.text || it.name)}${tag}`, W - M * 2 - 48)
          need(wrapped.length * 13 + 4)
          box(M + 18, 8)
          doc.text(wrapped, M + 32, y); y += wrapped.length * 13 + 2
        }
        y += 4
      }
      section('Things to do', p.attractions)
      section('Where to eat', p.restaurants)

      if (p.note?.trim()) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); doc.setTextColor(120, 114, 106)
        const wrapped = doc.splitTextToSize(safeText(p.note.trim()), W - M * 2 - 36)
        need(wrapped.length * 12 + 2)
        doc.text(wrapped, M + 18, y); y += wrapped.length * 12
      }
      y += 12
    }
    y += 6
  }

  // ── footer ──
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(166, 160, 150)
    doc.text('myholidaypilot - travel, region by region', M, doc.internal.pageSize.getHeight() - 30)
    doc.text(`${i} / ${pages}`, W - M, doc.internal.pageSize.getHeight() - 30, { align: 'right' })
  }

  const safe = (trip.name || 'trip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  doc.save(`${safe || 'trip'}.pdf`)
}
