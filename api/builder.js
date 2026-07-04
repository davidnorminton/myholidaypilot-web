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
  if (req.method === 'GET' && !q.country) {
    const rows = await db.select().from(builds)
    // attach region counts
    const out = []
    for (const b of rows) {
      const regs = await db.select({ id: buildRegions.id }).from(buildRegions).where(eq(buildRegions.countryId, b.countryId))
      out.push({ ...b, regionCount: regs.length })
    }
    return send(res, 200, out)
  }

  if (req.method === 'GET' && q.country && !q.region) {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const regions = await db.select().from(buildRegions)
      .where(eq(buildRegions.countryId, q.country)).orderBy(asc(buildRegions.sort))
    // per-region place counts
    const withCounts = []
    for (const r of regions) {
      const places = await db.select({ id: buildPlaces.id }).from(buildPlaces)
        .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, r.regionId)))
      withCounts.push({ ...r, placeCount: places.length })
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

  // ── discard ─────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!q.country) throw fail(400, 'country required')
    await db.delete(builds).where(eq(builds.countryId, q.country))  // cascades to regions + places
    return send(res, 200, { ok: true })
  }

  throw fail(405, 'Method not allowed')
})
