import { getPlacesIndex } from './data.js'
import { shareUrl } from './tripShare.js'
import { bestRoute, kmBetween } from './route.js'

const fmt = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''

// Strip characters jsPDF's built-in (cp1252) fonts can't render.
const safeText = (s) => String(s || '').replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D]/g, '')

function groups(trip) {
  const byDate = new Map()
  for (const p of trip.places) {
    if (!p.date) continue
    if (!byDate.has(p.date)) byDate.set(p.date, [])
    byDate.get(p.date).push(p)
  }
  // every day of the trip gets a section — including days that only carry
  // picks, a stay or a transfer, which used to vanish from the PDF entirely
  const keys = new Set(byDate.keys())
  if (trip.startDate && trip.endDate && trip.endDate >= trip.startDate) {
    for (let d = new Date(trip.startDate + 'T12:00'); ; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10)
      if (iso > trip.endDate) break
      keys.add(iso)
    }
  }
  const sorted = [...keys].sort()
  const out = sorted.map((key, i) => ({
    key,
    n: trip.startDate ? Math.round((new Date(key) - new Date(trip.startDate)) / 86400000) + 1 : i + 1,
    label: fmt(key),
    places: byDate.get(key) || [],
  }))
  const loose = trip.places.filter((p) => !p.date)
  if (loose.length) out.push({ key: '', label: sorted.length ? 'Anytime' : null, places: loose })
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
  try {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(169, 118, 42)
    doc.textWithLink('Open this trip online', W - M - doc.getTextWidth('Open this trip online'), y, { url: shareUrl(t) })
  } catch { /* link is a nicety */ }
  y += 14
  doc.setDrawColor(169, 118, 42); doc.setLineWidth(1.2); doc.line(M, y, W - M, y)
  y += 24

  // ── trip facts: getting there & where you're staying ──
  {
    const facts = []
    if (t.travel?.arrive) facts.push(['Arriving', `${t.travel.arrive.name}${t.travel.arrive.address ? ' — ' + t.travel.arrive.address : ''}`])
    if (t.travel?.depart) facts.push(['Leaving from', `${t.travel.depart.name}${t.travel.depart.address ? ' — ' + t.travel.depart.address : ''}`])
    for (const st of (t.stays || [])) {
      const range = st.from ? ` · ${fmt(st.from)} – ${fmt(st.to || st.from)}` : ''
      facts.push(['Staying', `${st.name} (${st.type})${range}${st.address ? ' — ' + st.address : ''}`])
    }
    if (facts.length) {
      for (const [k, v] of facts) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(169, 118, 42)
        doc.text(k.toUpperCase(), M, y, { charSpace: 1.2 })
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(70, 66, 59)
        const wrapped = doc.splitTextToSize(safeText(v), W - M * 2 - 92)
        doc.text(wrapped, M + 92, y)
        y += Math.max(13, wrapped.length * 12 + 1)
      }
      y += 12
    }
  }

  // ── the trip, as a story (when one has been written) ──
  if (t.story?.text) {
    doc.setFont('times', 'italic'); doc.setFontSize(10.5); doc.setTextColor(88, 82, 74)
    const storyLines = doc.splitTextToSize(safeText(t.story.text), W - M * 2 - 24)
    need(Math.min(storyLines.length, 8) * 13 + 20)
    doc.setDrawColor(169, 118, 42); doc.setLineWidth(2); doc.line(M, y - 4, M, y - 4 + storyLines.length * 13)
    doc.text(storyLines, M + 14, y + 6)
    y += storyLines.length * 13 + 20
  }

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
      need(140)   // keep the heading with its map/content — no orphaned day labels
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(169, 118, 42)
      const head = g.n ? `DAY ${g.n} · ${g.label.toUpperCase()}` : g.label.toUpperCase()
      doc.text(head, M, y, { charSpace: 1.5 })
      const where = g.places.map((p) => p.name).join(' · ')
      if (where) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(150, 144, 134)
        doc.text(safeText(where).slice(0, 60), W - M, y, { align: 'right' })
      }
      y += 18
    }
    const gstay = stayFor(g.key || '')
    if (gstay) {
      need(16)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(90, 85, 78)
      const stayLine = `Staying at: ${gstay.name} (${gstay.type})${gstay.address ? ' — ' + gstay.address : ''}`
      const sw = doc.splitTextToSize(safeText(stayLine), W - M * 2)
      doc.text(sw, M, y)
      y += sw.length * 12 + 4
    }
    const dm = dayMaps[gi]
    if (dm) {
      const w = W - M * 2, h = w * (260 / 700)
      need(h + 16)
      doc.addImage(dm, 'PNG', M, y, w, h)
      doc.setDrawColor(229, 225, 216); doc.setLineWidth(.75); doc.rect(M, y, w, h)
      y += h + 14
    }
    { // recommended route timeline for the day
      const { places: dp, ex } = dayMarkers(g.key || '')
      const rstay = stayFor(g.key || '')
      const rarr = g.key && g.key === t.startDate && t.travel?.arrive?.lat ? t.travel.arrive : null
      const rdep = g.key && g.key === t.endDate && t.travel?.depart?.lat ? t.travel.depart : null
      const stops = [
        ...(rarr ? [{ lat: rarr.lat, lng: rarr.lng, label: `Arrive (${rarr.name})`, rgb: [21, 101, 192] }] : []),
        ...(rstay?.lat && rstay?.lng ? [{ lat: rstay.lat, lng: rstay.lng, label: `Stay (${rstay.name})`, rgb: [58, 55, 51] }] : []),
        ...dp.map((p) => ({ lat: p.lat, lng: p.lng, label: p.name, rgb: [169, 118, 42] })),
        ...ex.map((m) => ({ lat: m.lat, lng: m.lng, label: m.text || m.name, rgb: m.colour === 'bb3a2c' ? [187, 58, 44] : [31, 111, 84] }))]
      if (stops.length + (rdep ? 1 : 0) >= 2) {
        let { order, km } = bestRoute(stops, 0)
        let seq = order.map((i) => stops[i])
        if (rdep) { km += seq.length ? kmBetween(seq[seq.length - 1], rdep) : 0; seq = [...seq, { lat: rdep.lat, lng: rdep.lng, label: `Depart (${rdep.name})`, rgb: [21, 101, 192] }] }
        else if (rstay?.lat && !rarr && seq.length > 1) { km += kmBetween(seq[seq.length - 1], seq[0]); seq = [...seq, { ...seq[0], label: 'Back to your stay' }] }

        need(18)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(169, 118, 42)
        doc.text('RECOMMENDED ROUTE', M, y, { charSpace: 1.4 })
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(150, 144, 134)
        doc.text(`total ~ ${km < 10 ? km.toFixed(1) : Math.round(km)} km`, W - M, y, { align: 'right' })
        y += 12

        const dotX = M + 5
        for (let i = 0; i < seq.length; i++) {
          const m = seq[i]
          need(34)
          // stop: coloured dot + name
          doc.setFillColor(...m.rgb)
          doc.circle(dotX, y - 3, 3.4, 'F')
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(50, 47, 42)
          const line = doc.splitTextToSize(safeText(m.label), W - M * 2 - 30)[0]
          doc.text(line, dotX + 11, y)
          y += 9
          // connector: dotted rail + leg distance, with room to breathe
          if (i < seq.length - 1) {
            const k = kmBetween(m, seq[i + 1])
            doc.setDrawColor(190, 184, 174); doc.setLineWidth(0.9)
            doc.setLineDashPattern([1.2, 2], 0)
            doc.line(dotX, y - 4, dotX, y + 12)
            doc.setLineDashPattern([], 0)
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 144, 134)
            doc.text(`${k < 10 ? k.toFixed(1) : Math.round(k)} km`, dotX + 11, y + 6)
            y += 19
          } else {
            y += 8
          }
        }
        y += 6
      }
    }
    { // plans on this day from places scheduled elsewhere (or unscheduled)
      const visiting = []
      for (const p of t.places) {
        if ((p.date || '') === (g.key || '')) continue
        for (const a of (p.attractions || [])) if (effectiveDay(a, p) === (g.key || '')) visiting.push({ text: a.text, from: p.name })
        for (const r of (p.restaurants || [])) if (effectiveDay(r, p) === (g.key || '')) visiting.push({ text: r.name + (r.mustOrder ? ` — ${r.mustOrder}` : ''), from: p.name })
      }
      if (g.key && visiting.length) {
        need(20)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(169, 118, 42)
        doc.text('PLANS THIS DAY', M, y, { charSpace: 1.4 })
        y += 13
        for (const v of visiting) {
          const wrapped = doc.splitTextToSize(`${safeText(v.text)}  (from ${safeText(v.from)})`, W - M * 2 - 30)
          need(wrapped.length * 13 + 4)
          doc.setDrawColor(122, 116, 106); doc.setLineWidth(1)
          doc.rect(M, y - 6.5, 8, 8)
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(70, 66, 59)
          doc.text(wrapped, M + 14, y); y += wrapped.length * 13 + 2
        }
        y += 8
      }
      if (!g.places.length && g.key && !visiting.length) {
        need(16)
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); doc.setTextColor(150, 144, 134)
        doc.text('Nothing planned yet — a free day.', M, y)
        y += 18
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
      section('Where to eat', (p.restaurants || []).map((r) => ({ ...r, text: `${r.name}${r.mustOrder ? ' — try: ' + r.mustOrder : ''}` })))

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
