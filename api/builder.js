import { getDb, schema, eq, and, asc } from './_lib/db.js'
import { requireUser, requireAdmin } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
import { generate, slugify } from './_lib/genai.js'

const { builds, buildRegions, buildPlaces } = schema

// The country builder. Admin-only. Each action advances one stage and writes
// its output straight to the staging tables; a later export turns the whole
// build into Italy-identical JSON under public/data/{country}.
//
// GET                     → list all builds (dashboard)
// GET  ?country=xx        → one build with its regions (+ counts)
// GET  ?country=xx&region=yy → one region with its places
// POST ?action=create     → { name, flag, blurb } begin a build
// POST ?action=regions    → generate the country's regions (stage 1)
// PATCH ?type=region|place|build → save manual edits
// DELETE ?country=xx       → discard a build
export default handler(async (req, res) => {
  const user = await requireUser(req)
  requireAdmin(user)
  const db = getDb()
  const q = req.query || {}

  // ── reads ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && !q.country && !q.action) {
    const rows = await db.select().from(builds)
    // attach region counts
    const out = []
    for (const b of rows) {
      const regs = await db.select({ id: buildRegions.id }).from(buildRegions).where(eq(buildRegions.countryId, b.countryId))
      out.push({ ...b, regionCount: regs.length })
    }
    return send(res, 200, out)
  }

  if (req.method === 'GET' && q.country && !q.region && !q.action) {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const regions = await db.select().from(buildRegions)
      .where(eq(buildRegions.countryId, q.country)).orderBy(asc(buildRegions.sort))
    // per-region place counts
    const withCounts = []
    for (const r of regions) {
      const places = await db.select().from(buildPlaces)
        .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, r.regionId)))
      const detailed = places.filter((p) => (p.data.activities || []).length > 0).length
      const withImage = places.filter((p) => p.image).length
      withCounts.push({
        ...r,
        placeCount: places.length,
        detailedPlaces: detailed,
        imagedPlaces: withImage,
        hasRestaurants: (r.data.restaurants || []).length > 0,
        restaurantCount: (r.data.restaurants || []).length,
        hasProse: !!(r.data.history || '').trim(),
      })
    }
    return send(res, 200, { build: b, regions: withCounts })
  }

  if (req.method === 'GET' && q.country && q.region) {
    const [r] = await db.select().from(buildRegions)
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    if (!r) throw fail(404, 'No such region')
    const places = await db.select().from(buildPlaces)
      .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region)))
      .orderBy(asc(buildPlaces.sort))
    return send(res, 200, { region: r, places })
  }

  // ── stage 0: create a build ─────────────────────────────────────────────────
  if (req.method === 'POST' && q.action === 'create') {
    const b = await readBody(req)
    const name = String(b.name || '').trim()
    if (!name) throw fail(400, 'A country name is required')
    const countryId = slugify(name)
    const [existing] = await db.select().from(builds).where(eq(builds.countryId, countryId))
    if (existing) throw fail(409, 'A build for that country already exists')
    const [row] = await db.insert(builds).values({
      countryId, name, flag: b.flag || null, blurb: b.blurb || null, stage: 0,
    }).returning()
    return send(res, 201, row)
  }

  // ── stage 1: generate the regions ───────────────────────────────────────────
  if (req.method === 'POST' && q.action === 'regions') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')

    const prompt = `List the primary travel regions of ${b.name} — the top-level administrative or clearly-recognised tourist regions a travel guide would organise the country around (for Italy this is its 20 regions; for other countries use the natural equivalent, typically 8 to 25).

For EACH region give:
- id: a lowercase slug (a-z, 0-9, underscores)
- name: the English name
- nameLocal: the local-language name
- capital: the main city
- lat, lng: the region's approximate centre (decimals)
- emoji: one emoji that evokes it
- bestTimeToVisit: one sentence
- boundingBox: {north, south, east, west} approximate decimal degrees

Respond with ONLY valid JSON, no markdown, no fences:
{"regions":[{"id":"","name":"","nameLocal":"","capital":"","lat":0,"lng":0,"emoji":"","bestTimeToVisit":"","boundingBox":{"north":0,"south":0,"east":0,"west":0}}]}`

    const out = await generate(prompt, { maxTokens: 4000 })
    if (!Array.isArray(out.regions) || !out.regions.length) throw fail(502, 'The model did not return regions — try again')

    // colour palette cycled like Italy's colour field (argb hex strings)
    const palette = ['ff4caf50', 'ff2196f3', 'ffff9800', 'ff9c27b0', 'ffe91e63', 'ff009688', 'ff795548', 'ff3f51b5', 'ffcddc39', 'ffff5722']
    let i = 0
    for (const r of out.regions) {
      const regionId = slugify(r.id || r.name)
      if (!regionId) continue
      const data = {
        id: regionId,
        name: String(r.name || '').slice(0, 60),
        nameIt: String(r.nameLocal || r.name || '').slice(0, 60),  // keep Italy's field name for export parity
        capital: String(r.capital || '').slice(0, 60),
        lat: Number(r.lat) || 0,
        lng: Number(r.lng) || 0,
        emoji: String(r.emoji || '📍').slice(0, 8),
        colour: palette[i % palette.length],
        boundingBox: {
          north: Number(r.boundingBox?.north) || 0, south: Number(r.boundingBox?.south) || 0,
          east: Number(r.boundingBox?.east) || 0, west: Number(r.boundingBox?.west) || 0,
        },
        bestTimeToVisit: String(r.bestTimeToVisit || '').slice(0, 300),
        history: '', culturalNotes: '', languageNotes: '',   // filled in later stages
      }
      await db.insert(buildRegions).values({ countryId: b.countryId, regionId, data, sort: i })
        .onConflictDoUpdate({ target: [buildRegions.countryId, buildRegions.regionId], set: { data, updatedAt: Date.now() } })
      i++
    }
    await db.update(builds).set({ stage: Math.max(b.stage, 1), updatedAt: Date.now() }).where(eq(builds.countryId, b.countryId))
    const regions = await db.select().from(buildRegions).where(eq(buildRegions.countryId, b.countryId)).orderBy(asc(buildRegions.sort))
    return send(res, 200, { count: regions.length, regions })
  }

  // ── stage 2: generate places for ONE region ─────────────────────────────────
  if (req.method === 'POST' && q.action === 'places') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const [reg] = await db.select().from(buildRegions)
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    if (!reg) throw fail(404, 'No such region')
    const rd = reg.data

    const prompt = `List the most worthwhile places to visit in ${rd.name} (${rd.nameIt}), ${b.name} — the towns, cities and notable spots a good travel guide would feature. Aim for the genuinely popular and rewarding ones, between 5 and 15 depending on the region's size.

For EACH place give:
- id: a lowercase slug (a-z, 0-9, underscores), unique within the region
- name: the English/common name
- nameLocal: the local-language name
- type: one of CITY, TOWN, VILLAGE, COASTAL, NATURE, LANDMARK, ISLAND
- lat, lng: decimal coordinates of the place
- description: two sentences — what it is and why visit. No markdown.
- imageQueries: two short search phrases that would find a good photo of it

Order them roughly by how essential they are to the region. Respond with ONLY valid JSON, no fences:
{"places":[{"id":"","name":"","nameLocal":"","type":"CITY","lat":0,"lng":0,"description":"","imageQueries":["",""]}]}`

    const out = await generate(prompt, { maxTokens: 4000 })
    if (!Array.isArray(out.places) || !out.places.length) throw fail(502, 'The model did not return places — try again')

    // replace this region's places with the fresh set (regeneration is clean)
    await db.delete(buildPlaces).where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region)))
    const TYPES = ['CITY', 'TOWN', 'VILLAGE', 'COASTAL', 'NATURE', 'LANDMARK', 'ISLAND']
    let i = 0
    for (const p of out.places.slice(0, 15)) {
      const placeId = slugify(p.id || p.name)
      if (!placeId) continue
      const data = {
        id: placeId,
        name: String(p.name || '').slice(0, 80),
        nameIt: String(p.nameLocal || p.name || '').slice(0, 80),
        lat: Number(p.lat) || 0,
        lng: Number(p.lng) || 0,
        type: TYPES.includes(String(p.type).toUpperCase()) ? String(p.type).toUpperCase() : 'TOWN',
        description: String(p.description || '').slice(0, 600),
        imageQueries: Array.isArray(p.imageQueries) ? p.imageQueries.slice(0, 2).map((x) => String(x).slice(0, 60)) : [],
        activities: [], food: [], culture: [],   // stages 3–4
      }
      await db.insert(buildPlaces).values({ countryId: q.country, regionId: q.region, placeId, data, sort: i })
        .onConflictDoUpdate({ target: [buildPlaces.countryId, buildPlaces.regionId, buildPlaces.placeId], set: { data, updatedAt: Date.now() } })
      i++
    }
    // mark this region's places done; advance build stage to 2 once any region has places
    await db.update(buildRegions).set({ placesDone: 1, updatedAt: Date.now() })
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    await db.update(builds).set({ stage: Math.max(b.stage, 2), updatedAt: Date.now() }).where(eq(builds.countryId, q.country))

    const places = await db.select().from(buildPlaces)
      .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region))).orderBy(asc(buildPlaces.sort))
    return send(res, 200, { count: places.length, places })
  }

  // ── stage 5: one Unsplash image for ONE place ───────────────────────────────
  if (req.method === 'POST' && q.action === 'image') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const [pl] = await db.select().from(buildPlaces)
      .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region), eq(buildPlaces.placeId, q.place)))
    if (!pl) throw fail(404, 'No such place')

    const rows = await db.select().from(schema.siteSettings)
    const uKey = Object.fromEntries(rows.map((r) => [r.key, r.value]))['secret.unsplashKey']
    if (!uKey) throw fail(400, 'Add your Unsplash Access Key in Admin → AI first')

    const query = (pl.data.imageQueries?.[0]) || `${pl.data.name} ${b.name}`
    const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high`
    // Guard the outbound call with a timeout so a hanging Unsplash request
    // returns a clean error instead of letting the whole function 502.
    let r
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 12000)
      r = await fetch(u, { headers: { Authorization: `Client-ID ${uKey}` }, signal: ctrl.signal })
      clearTimeout(t)
    } catch (e) {
      throw fail(502, e.name === 'AbortError'
        ? 'Unsplash took too long to respond (timeout) — likely rate-limited; wait and retry.'
        : `Could not reach Unsplash: ${String(e.message || e).slice(0, 120)}`)
    }
    if (!r.ok) {
      let body = ''
      try { body = (await r.text()).slice(0, 200) } catch { /* ignore */ }
      const label = r.status === 429 ? 'Rate Limit Exceeded (429)'
        : r.status === 401 ? 'Unauthorized (401) — check your Unsplash Access Key'
        : r.status === 403 ? 'Forbidden (403) — demo quota likely exhausted; apply for Production access or check your key'
        : `HTTP ${r.status}`
      throw fail(r.status === 401 ? 400 : 502, `Unsplash ${label}: ${body}`)
    }
    let j
    try { j = await r.json() } catch { throw fail(502, 'Unsplash returned an unreadable response — retry.') }
    const hit = j.results?.[0]
    if (!hit) throw fail(502, `No image found for "${query}" — edit the place's image query and retry`)
    const image = {
      index: 0, assetPath: '', isLocal: false,
      url: `${hit.urls.raw}&crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080`,
      credit: hit.user?.name || '',
    }
    await db.update(buildPlaces).set({ image, updatedAt: Date.now() })
      .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region), eq(buildPlaces.placeId, q.place)))
    await db.update(builds).set({ stage: Math.max(b.stage, 5), updatedAt: Date.now() }).where(eq(builds.countryId, q.country))
    return send(res, 200, { done: true, image })
  }

  // ── manual image: paste a URL for a place ───────────────────────────────────
  if (req.method === 'POST' && q.action === 'setimage') {
    const b = await readBody(req)
    const url = String(b.url || '').trim()
    if (!/^https?:\/\//.test(url)) throw fail(400, 'A valid image URL is required')
    const image = { index: 0, assetPath: '', isLocal: false, url, credit: String(b.credit || '').slice(0, 120) }
    await db.update(buildPlaces).set({ image, updatedAt: Date.now() })
      .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region), eq(buildPlaces.placeId, q.place)))
    return send(res, 200, { done: true, image })
  }

  // ── missing images: hierarchical summary across all builds ──────────────────
  // Returns countries → regions → places that have no image, with counts.
  if (req.method === 'GET' && q.action === 'missing') {
    const allBuilds = await db.select().from(builds)
    const out = []
    for (const b of allBuilds) {
      const regs = await db.select().from(buildRegions)
        .where(eq(buildRegions.countryId, b.countryId)).orderBy(asc(buildRegions.sort))
      const regionsOut = []
      let countryMissing = 0
      for (const r of regs) {
        const pls = await db.select().from(buildPlaces)
          .where(and(eq(buildPlaces.countryId, b.countryId), eq(buildPlaces.regionId, r.regionId)))
          .orderBy(asc(buildPlaces.sort))
        const missing = pls.filter((p) => !p.image)
        if (missing.length) {
          regionsOut.push({
            regionId: r.regionId, name: r.data.name, missing: missing.length, total: pls.length,
            places: missing.map((p) => ({ placeId: p.placeId, name: p.data.name,
              query: p.data.imageQueries?.[0] || `${p.data.name} ${b.name}` })),
          })
          countryMissing += missing.length
        }
      }
      if (countryMissing) {
        out.push({ countryId: b.countryId, name: b.name, flag: b.flag || '',
          missing: countryMissing, regions: regionsOut })
      }
    }
    return send(res, 200, { countries: out })
  }

  // ── Unsplash multi-result search (returns options to choose from) ───────────
  if (req.method === 'GET' && q.action === 'imagesearch') {
    const rows = await db.select().from(schema.siteSettings)
    const uKey = Object.fromEntries(rows.map((r) => [r.key, r.value]))['secret.unsplashKey']
    if (!uKey) throw fail(400, 'Add your Unsplash Access Key in Admin → AI first')
    const query = String(q.query || '').trim()
    if (!query) throw fail(400, 'Missing search query')
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=9&orientation=landscape&content_filter=high`
    let r
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000)
      r = await fetch(url, { headers: { Authorization: `Client-ID ${uKey}` }, signal: ctrl.signal })
      clearTimeout(t)
    } catch (e) {
      throw fail(502, e.name === 'AbortError' ? 'Unsplash timed out — likely rate-limited; wait and retry.' : `Could not reach Unsplash: ${String(e.message).slice(0, 100)}`)
    }
    if (!r.ok) {
      const label = r.status === 429 ? 'Rate Limit Exceeded (429)' : r.status === 401 ? 'Unauthorized (401) — check your key' : r.status === 403 ? 'Forbidden (403) — demo quota likely exhausted' : `HTTP ${r.status}`
      throw fail(r.status === 401 ? 400 : 502, `Unsplash ${label}`)
    }
    let j; try { j = await r.json() } catch { throw fail(502, 'Unsplash returned an unreadable response') }
    const results = (j.results || []).map((hit) => ({
      thumb: hit.urls?.thumb || hit.urls?.small,
      url: `${hit.urls.raw}&crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080`,
      credit: hit.user?.name || '',
      link: hit.links?.html || '',
    }))
    return send(res, 200, { results })
  }

  // ── stage 6: region restaurants (where to eat) ──────────────────────────────
  if (req.method === 'POST' && q.action === 'restaurants') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const [reg] = await db.select().from(buildRegions)
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    if (!reg) throw fail(404, 'No such region')
    const rd = reg.data

    const prompt = `Recommend 12 to 15 notable restaurants across ${rd.name} (${rd.nameIt}), ${b.name} — a spread of towns, price points and cuisines a travel guide would list. Real, well-regarded places.

For EACH: name, address (street + town), neighbourhood (the town/area), cuisine (short), priceRange (one of €, €€, €€€, €€€€), description (one sentence), mustOrder (a signature dish), lat, lng (decimals).

Respond with ONLY valid JSON, no fences:
{"restaurants":[{"name":"","address":"","neighbourhood":"","cuisine":"","priceRange":"€€","description":"","mustOrder":"","lat":0,"lng":0}]}`

    const out = await generate(prompt, { maxTokens: 6000 })
    if (!Array.isArray(out.restaurants) || !out.restaurants.length) throw fail(502, 'The model did not return restaurants — try again')
    const restaurants = out.restaurants.slice(0, 20).map((r, i) => ({
      number: i + 1, id: `rest_${i + 1}`,
      name: String(r.name || '').slice(0, 120), address: String(r.address || '').slice(0, 160),
      neighbourhood: String(r.neighbourhood || '').slice(0, 80), cuisine: String(r.cuisine || '').slice(0, 60),
      priceRange: ['€', '€€', '€€€', '€€€€'].includes(r.priceRange) ? r.priceRange : '€€',
      description: String(r.description || '').slice(0, 300), mustOrder: String(r.mustOrder || '').slice(0, 120),
      lat: Number(r.lat) || 0, lng: Number(r.lng) || 0,
    })).filter((r) => r.name)
    const data = { ...rd, restaurants, restaurantCount: restaurants.length }
    await db.update(buildRegions).set({ data, updatedAt: Date.now() })
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    await db.update(builds).set({ stage: Math.max(b.stage, 6), updatedAt: Date.now() }).where(eq(builds.countryId, q.country))
    return send(res, 200, { count: restaurants.length })
  }

  // ── stage 7: region prose (history, culturalNotes, languageNotes) ───────────
  if (req.method === 'POST' && q.action === 'regionprose') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const [reg] = await db.select().from(buildRegions)
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    if (!reg) throw fail(404, 'No such region')
    const rd = reg.data

    const prompt = `For ${rd.name} (${rd.nameIt}), ${b.name}, write three short guide passages in plain prose (no markdown, no line breaks inside a value, use straight quotes only where essential):
- history: 3 to 4 sentences on the region's past.
- culturalNotes: 2 to 3 sentences on its character, traditions and what makes it distinct.
- languageNotes: 1 to 2 sentences on local language, dialect or useful phrases.

Respond with ONLY a single valid JSON object, no fences, no preamble. Escape any double-quotes inside the text as \\". Shape: {"history":"","culturalNotes":"","languageNotes":""}`
    const out = await generate(prompt, { maxTokens: 1500 })
    const data = { ...rd,
      history: String(out.history || '').slice(0, 2000),
      culturalNotes: String(out.culturalNotes || '').slice(0, 2000),
      languageNotes: String(out.languageNotes || '').slice(0, 1000) }
    await db.update(buildRegions).set({ data, updatedAt: Date.now() })
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    return send(res, 200, { done: true })
  }

  // set (or clear) a region's hero image explicitly (URL from admin)
  if (req.method === 'POST' && q.action === 'regionhero') {
    const body = await readBody(req)
    const [reg] = await db.select().from(buildRegions)
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    if (!reg) throw fail(404, 'No such region')
    const url = String(body.url || '').trim()
    const data = { ...reg.data,
      heroImage: url ? { index: 0, assetPath: '', isLocal: false, url, credit: String(body.credit || '') } : null }
    await db.update(buildRegions).set({ data, updatedAt: Date.now() })
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    return send(res, 200, { done: true })
  }

  // ── stages 7–10: country-level guides (festivals/history/food/transport) ────
  if (req.method === 'POST' && q.action === 'guide') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const topic = q.topic
    const guides = { ...(b.guides || {}) }

    let prompt, stageNo
    if (topic === 'festivals') {
      stageNo = 7
      const regs = await db.select().from(buildRegions).where(eq(buildRegions.countryId, b.countryId)).orderBy(asc(buildRegions.sort))
      const regionList = regs.map((r) => `${r.regionId} (${r.data.name})`).join(', ')
      prompt = `List 35 to 45 of the most notable festivals, national holidays and annual events across ${b.name} a traveller might plan around — the famous ones, the regional gems, and the national holidays. Spread them across the whole year and across regions.

For EACH festival give:
- name: the festival's name
- regionId: EXACTLY one id from this list: ${regionList}. For national holidays use the id of the capital's region.
- regionName: that region's display name
- month: the month as a NUMBER 1-12 (if it spans months, the main month)
- dayStart: day of month it starts (number), or null if it varies year to year
- dayEnd: day it ends (number), or null
- description: one to two sentences — what it is and why it's special. No markdown.
- location: the town/city (or "All regions" for national holidays)
- type: one of CARNIVAL, RELIGIOUS, HISTORICAL, MUSIC, FOOD, CULTURAL, NATIONAL
- isNational: true only for nationwide public holidays

Respond with ONLY valid JSON, no fences:
{"festivals":[{"name":"","regionId":"","regionName":"","month":1,"dayStart":null,"dayEnd":null,"description":"","location":"","type":"CULTURAL","isNational":false}]}`
    } else if (topic === 'history') {
      stageNo = 8
      prompt = `Write ${b.name}'s history as a TIMELINE of 10 to 13 eras, from prehistory to today.

For EACH era give:
- period: a very short marker for the timeline spine, with a newline between number and unit where natural (examples: "10,000\nBC", "218\nBC", "1492", "1936", "TODAY")
- label: the era's name (e.g. "Al-Andalus", "The Reconquista")
- dates: the readable range (e.g. "711 – 1492")
- summary: ONE punchy sentence.
- text: 3 to 5 sentences of engaging detail, plain prose, no markdown.

Order chronologically. Respond with ONLY valid JSON, no fences:
{"eras":[{"period":"","label":"","dates":"","summary":"","text":""}]}`
    } else if (topic === 'food') {
      stageNo = 9
      prompt = `Write a practical food & drink guide for ${b.name} as 5 to 7 themed sections a traveller would actually use (e.g. coffee/café culture, reading a menu, must-try dishes, where to eat, drinks & wine, dining customs & etiquette).

Each section: title (short, may include the local word in brackets), icon (ONE of: coffee, restaurant, dining, bar, star), items (3 to 7).
Each item: kind (one of: rule, dish, tip, place), label (short bold heading), text (1 to 3 sentences, plain prose).

Be specific to ${b.name} — real dishes, real customs, honest tourist-trap warnings. Respond with ONLY valid JSON, no fences:
{"sections":[{"title":"","icon":"restaurant","items":[{"kind":"rule","label":"","text":""}]}]}`
    } else if (topic === 'transport') {
      stageNo = 10
      prompt = `Write a practical getting-around guide for ${b.name} as 6 to 9 sections (national trains, city metro/buses, taxis & ride apps, driving, airports, ferries if relevant, tickets & passes, connectivity/SIM).

Each section: title (short, may include the local word in brackets), icon (ONE of: train, transit, subway, taxi, boat, flight, warning, simcard, star), items (3 to 6).
Each item: kind (one of: tip, warn, rule), label (short heading; warns may omit it), text (1 to 3 sentences, plain prose).

Include real operator names, apps and honest warnings (fines, scams, strikes). Respond with ONLY valid JSON, no fences:
{"sections":[{"title":"","icon":"train","items":[{"kind":"tip","label":"","text":""}]}]}`
    } else {
      throw fail(400, 'Unknown guide topic')
    }

    const out = await generate(prompt, { maxTokens: topic === 'festivals' ? 8000 : 6000 })

    if (topic === 'festivals') {
      const regs = await db.select().from(buildRegions).where(eq(buildRegions.countryId, b.countryId))
      const regById = Object.fromEntries(regs.map((r) => [r.regionId, r.data.name]))
      const TYPES = ['CARNIVAL', 'RELIGIOUS', 'HISTORICAL', 'MUSIC', 'FOOD', 'CULTURAL', 'NATIONAL']
      const firstRegion = regs[0]?.regionId || ''
      const fests = (Array.isArray(out.festivals) ? out.festivals : []).slice(0, 80).map((f, i) => {
        const regionId = regById[f.regionId] ? f.regionId : firstRegion
        const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null)
        return {
          id: `f${String(i + 1).padStart(3, '0')}`,
          name: String(f.name || '').slice(0, 120),
          regionId,
          regionName: regById[regionId] || '',
          month: Math.min(12, Math.max(1, Number(f.month) || 1)),
          dayStart: num(f.dayStart),
          dayEnd: num(f.dayEnd),
          description: String(f.description || '').slice(0, 400),
          location: String(f.location || '').slice(0, 100),
          type: TYPES.includes(String(f.type).toUpperCase()) ? String(f.type).toUpperCase() : 'CULTURAL',
          isNational: !!f.isNational,
        }
      }).filter((f) => f.name)
      guides[topic] = {
        version: 1,
        title: 'Festivals & events',
        subtitle: `${fests.length} celebrations through the year — pick a day to see what's on.`,
        festivals: fests,
      }
    } else if (topic === 'history') {
      const eras = (Array.isArray(out.eras) ? out.eras : []).slice(0, 15).map((e) => ({
        kind: 'era',
        period: String(e.period || '').slice(0, 20),
        label: String(e.label || '').slice(0, 80),
        dates: String(e.dates || '').slice(0, 60),
        summary: String(e.summary || '').slice(0, 240),
        text: String(e.text || '').slice(0, 1200),
      })).filter((e) => e.label)
      if (!eras.length) throw fail(502, 'The model did not return a timeline — try again')
      guides[topic] = {
        title: 'A Short History of ' + b.name,
        subtitle: `From its beginnings to today — ${eras.length} eras that shaped it.`,
        sections: [{ title: '', icon: '', items: eras }],
      }
    } else if (topic === 'food' || topic === 'transport') {
      const OK_ICONS = ['coffee', 'restaurant', 'dining', 'bar', 'star', 'train', 'transit', 'subway', 'taxi', 'boat', 'flight', 'warning', 'simcard']
      const OK_KINDS = ['rule', 'dish', 'tip', 'place', 'warn', 'course']
      const sections = (Array.isArray(out.sections) ? out.sections : []).slice(0, 10).map((sec) => ({
        title: String(sec.title || '').slice(0, 80),
        icon: OK_ICONS.includes(sec.icon) ? sec.icon : (topic === 'food' ? 'restaurant' : 'star'),
        items: (Array.isArray(sec.items) ? sec.items : []).slice(0, 8).map((it) => ({
          kind: OK_KINDS.includes(it.kind) ? it.kind : 'tip',
          ...(it.label ? { label: String(it.label).slice(0, 90) } : {}),
          text: String(it.text || '').slice(0, 500),
        })).filter((it) => it.text),
      })).filter((sec) => sec.title && sec.items.length)
      if (!sections.length) throw fail(502, 'The model did not return sections — try again')
      guides[topic] = {
        title: topic === 'food' ? 'Food & Drink' : 'Getting Around',
        subtitle: topic === 'food'
          ? `How to eat well in ${b.name} — customs, dishes and where to go.`
          : `Trains, roads, taxis and how to move around ${b.name}.`,
        sections,
      }
    } else {
      guides[topic] = out
    }

    await db.update(builds).set({ guides, stage: Math.max(b.stage, stageNo), updatedAt: Date.now() }).where(eq(builds.countryId, q.country))
    return send(res, 200, { done: true, topic, count: topic === 'festivals' ? guides[topic].festivals.length : undefined })
  }

  // ── stage 3+4: activities, food & culture for ONE place ─────────────────────
  // The client calls this per place so a long region fills in visibly and a
  // failure never loses completed places (each returns done=true on success).
  if (req.method === 'POST' && q.action === 'detail') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const [pl] = await db.select().from(buildPlaces)
      .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region), eq(buildPlaces.placeId, q.place)))
    if (!pl) throw fail(404, 'No such place')
    const pd = pl.data
    const [reg] = await db.select().from(buildRegions)
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    const regionName = reg?.data?.name || q.region

    const prompt = `For ${pd.name} (${pd.nameIt}) in ${regionName}, ${b.name}, provide three lists a travel guide would show.

${pd.description ? `Context: ${pd.description}` : ''}

1. activities — 4 to 8 specific things to do here. Each: text (short title), detail (one sentence), and lat/lng if it's a distinct spot (else omit).
2. food — 3 to 6 local dishes or food experiences to seek out here. Each: text (the dish/experience name), detail (one sentence describing it).
3. culture — 2 to 4 practical local tips or cultural notes for a visitor here. Each: text (short tip), detail (one sentence).

Be specific to ${pd.name} — real sights, real dishes, real customs. No markdown.

Respond with ONLY valid JSON, no fences:
{"activities":[{"text":"","detail":"","lat":0,"lng":0}],"food":[{"text":"","detail":""}],"culture":[{"text":"","detail":""}]}`

    const out = await generate(prompt, { maxTokens: 2500 })
    const pre = pd.id.slice(0, 4)
    const mk = (arr, tag, withGeo) => (Array.isArray(arr) ? arr : []).slice(0, 8).map((x, i) => {
      const o = { id: `${pre}_${tag}${i + 1}`, text: String(x.text || '').slice(0, 120), detail: String(x.detail || '').slice(0, 300) }
      if (withGeo && Number(x.lat) && Number(x.lng)) { o.lat = Number(x.lat); o.lng = Number(x.lng) }
      return o
    }).filter((o) => o.text)

    const data = {
      ...pd,
      activities: mk(out.activities, '', true),
      food: mk(out.food, 'f', false),
      culture: mk(out.culture, 'c', false),
    }
    await db.update(buildPlaces).set({ data, updatedAt: Date.now() })
      .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region), eq(buildPlaces.placeId, q.place)))
    await db.update(builds).set({ stage: Math.max(b.stage, 3), updatedAt: Date.now() }).where(eq(builds.countryId, q.country))
    return send(res, 200, { done: true, activities: data.activities.length, food: data.food.length, culture: data.culture.length })
  }

  // ── delete one place ────────────────────────────────────────────────────────
  if (req.method === 'DELETE' && q.place) {
    await db.delete(buildPlaces)
      .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region), eq(buildPlaces.placeId, q.place)))
    return send(res, 200, { ok: true })
  }

  // ── manual edits ────────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const b = await readBody(req)
    if (q.type === 'build') {
      await db.update(builds).set({ name: b.name, flag: b.flag, blurb: b.blurb, updatedAt: Date.now() }).where(eq(builds.countryId, q.country))
      return send(res, 200, { ok: true })
    }
    if (q.type === 'region') {
      await db.update(buildRegions).set({ data: b.data, updatedAt: Date.now() })
        .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
      return send(res, 200, { ok: true })
    }
    if (q.type === 'place') {
      await db.update(buildPlaces).set({ data: b.data, image: b.image ?? undefined, updatedAt: Date.now() })
        .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region), eq(buildPlaces.placeId, q.place)))
      return send(res, 200, { ok: true })
    }
    throw fail(400, 'Unknown patch type')
  }

  // ── download ONE guide file (drop straight into public/data/{c}/guide/) ─────
  if (req.method === 'GET' && q.action === 'guidefile') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const g = (b.guides || {})[q.topic]
    if (!g) throw fail(404, 'That guide has not been generated yet')
    return send(res, 200, g)
  }

  // ── export: assemble the whole build into Italy-shaped files ─────────────────
  if (req.method === 'GET' && q.action === 'export') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const cid = b.countryId
    const regionsRows = await db.select().from(buildRegions).where(eq(buildRegions.countryId, cid)).orderBy(asc(buildRegions.sort))
    const placesRows = await db.select().from(buildPlaces).where(eq(buildPlaces.countryId, cid)).orderBy(asc(buildPlaces.sort))
    const guides = b.guides || {}

    // group places by region
    const byRegion = {}
    for (const p of placesRows) { (byRegion[p.regionId] ||= []).push(p) }

    const files = {}            // relpath -> object
    const imagesMap = {}        // images.json: { regionId: { placeId: [img] } }
    const placesIndex = []
    const indexRegions = []
    let totalPlaces = 0, totalRestaurants = 0, totalImages = 0

    for (const r of regionsRows) {
      const rd = r.data
      const rPlaces = byRegion[r.regionId] || []
      imagesMap[r.regionId] = {}
      const placeObjs = rPlaces.map((p) => {
        const pd = p.data
        if (p.image) { imagesMap[r.regionId][p.placeId] = [p.image]; totalImages++ }
        placesIndex.push({
          placeId: pd.id, name: pd.name, nameIt: pd.nameIt, type: pd.type,
          lat: pd.lat, lng: pd.lng, regionId: r.regionId, regionName: rd.name, regionEmoji: rd.emoji,
        })
        return pd
      })
      totalPlaces += placeObjs.length
      const restaurants = rd.restaurants || []
      totalRestaurants += restaurants.length

      // region file (full)
      files[`regions/${r.regionId}.json`] = {
        id: rd.id, name: rd.name, nameIt: rd.nameIt, capital: rd.capital,
        lat: rd.lat, lng: rd.lng, emoji: rd.emoji, colour: rd.colour, boundingBox: rd.boundingBox,
        history: rd.history || '', culturalNotes: rd.culturalNotes || '',
        bestTimeToVisit: rd.bestTimeToVisit || '', languageNotes: rd.languageNotes || '',
        generatedAt: new Date().toISOString(),
        placeCount: placeObjs.length, places: placeObjs,
        restaurantCount: restaurants.length, restaurants,
      }
      // region summary for index.json — hero priority:
      // 1) explicit hero set in the builder, else 2) first place's image
      const firstPlaceImg = rPlaces.find((p) => p.image)?.image
      const hero = (rd.heroImage && rd.heroImage.url)
        ? rd.heroImage
        : (firstPlaceImg || { index: 0, assetPath: '', isLocal: false, url: '', credit: '' })
      indexRegions.push({
        id: rd.id, name: rd.name, nameIt: rd.nameIt, capital: rd.capital,
        lat: rd.lat, lng: rd.lng, emoji: rd.emoji, colour: rd.colour, boundingBox: rd.boundingBox,
        placeCount: placeObjs.length, restaurantCount: restaurants.length,
        bestTimeToVisit: rd.bestTimeToVisit || '', heroImage: hero,
      })
    }

    files['index.json'] = {
      schemaVersion: 3, exportedAt: new Date().toISOString(), appVersion: '1.0',
      totalRegions: regionsRows.length, totalPlaces, totalRestaurants,
      totalChecklistItems: 0, totalImages, affiliateIds: {}, regions: indexRegions,
    }
    files['places-index.json'] = placesIndex
    files['images.json'] = imagesMap

    // guide files (only those generated)
    if (guides.festivals) files['guide/festivals.json'] = guides.festivals
    if (guides.history) files['guide/history.json'] = guides.history
    if (guides.food) files['guide/food.json'] = guides.food
    if (guides.transport) files['guide/transport.json'] = guides.transport

    // hub.json — the Destinations landing cards, links namespaced to this country
    const firstImg = (rid) => Object.values(imagesMap[rid] || {})[0]?.[0]?.url || ''
    const anyImg = indexRegions.find((r) => r.heroImage?.url)?.heroImage?.url || ''
    files['hub.json'] = { sections: [
      { id: 'regions', title: 'Regions', blurb: `All ${regionsRows.length} regions — their towns, tables and stories.`, link: `/${cid}/regions`, image: anyImg },
      ...(guides.festivals ? [{ id: 'festivals', title: 'Festivals & events', blurb: 'Celebrations and events, month by month.', link: `/${cid}/festivals`, image: anyImg }] : []),
      ...(guides.history ? [{ id: 'history', title: 'History', blurb: 'How the country came to be.', link: `/${cid}/history`, image: anyImg }] : []),
      ...(guides.food ? [{ id: 'food', title: 'Food & wine', blurb: 'What to order, region by region.', link: `/${cid}/food`, image: anyImg }] : []),
      ...(guides.transport ? [{ id: 'transport', title: 'Getting around', blurb: 'Trains, driving and ferries.', link: `/${cid}/transport`, image: anyImg }] : []),
      { id: 'plan', title: 'Plan a trip', blurb: 'Save places and build a day-by-day itinerary.', link: '/plan', image: anyImg },
    ] }

    // gaps report for the admin
    const missingImages = placesRows.filter((p) => !p.image).map((p) => p.data.name)
    return send(res, 200, {
      countryId: cid, name: b.name, flag: b.flag, blurb: b.blurb,
      files, stats: { regions: regionsRows.length, places: totalPlaces, restaurants: totalRestaurants, images: totalImages },
      missingImages, guidesMissing: ['festivals', 'history', 'food', 'transport'].filter((g) => !guides[g]),
    })
  }

  // ── discard ─────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!q.country) throw fail(400, 'country required')
    await db.delete(builds).where(eq(builds.countryId, q.country))  // cascades to regions + places
    return send(res, 200, { ok: true })
  }

  throw fail(405, 'Method not allowed')
})
