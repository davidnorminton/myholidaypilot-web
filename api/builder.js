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
