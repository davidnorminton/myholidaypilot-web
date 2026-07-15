import { getDb, schema, eq, and, asc } from './_lib/db.js'
import { requireUser, requireAdmin } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
import { slugify } from './_lib/genai.js'
import { scanActions } from './_lib/builder/scan.js'
import { generateActions } from './_lib/builder/generate.js'
import { exportActions } from './_lib/builder/export.js'

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
  // Plain list: ONE query, no child-table scans — this feeds every country
  // dropdown in the admin, so it must be instant. Heavy per-country figures
  // (region counts, last-change for drift) live behind ?action=stats.
  if (req.method === 'GET' && !q.country && !q.action) {
    const rows = await db.select().from(builds)
    return send(res, 200, rows)
  }

  // Heavy list: region counts + last DB change per country (drift indicator).
  if (req.method === 'GET' && q.action === 'stats') {
    const rows = await db.select().from(builds)
    const allRegs = await db.select({ countryId: buildRegions.countryId, updatedAt: buildRegions.updatedAt }).from(buildRegions)
    const allPl = await db.select({ countryId: buildPlaces.countryId, updatedAt: buildPlaces.updatedAt }).from(buildPlaces)
    const out = rows.map((b) => {
      const regs = allRegs.filter((r) => r.countryId === b.countryId)
      const pls = allPl.filter((p) => p.countryId === b.countryId)
      const lastChange = Math.max(b.updatedAt || 0, ...regs.map((r) => r.updatedAt || 0), ...pls.map((p) => p.updatedAt || 0))
      return { ...b, regionCount: regs.length, lastChange }
    })
    return send(res, 200, out)
  }

  if (await scanActions(req, res, db, q)) return

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

  if (await generateActions(req, res, db, q)) return

  // ── manual image: paste a URL for a place ───────────────────────────────────
  if (req.method === 'POST' && q.action === 'setimage') {
    const b = await readBody(req)
    const url = String(b.url || '').trim()
    // Accept absolute http(s) URLs (pasted) and app-relative URLs from our own
    // uploader (/images/… on disk, /api/media?id=… when stored in the DB).
    if (!/^(https?:\/\/|\/)/.test(url)) throw fail(400, 'A valid image URL is required')
    // creditUsername/creditUrl arrive from the admin picker (Unsplash search
    // results); a hand-pasted URL simply has none, and PhotoCredit degrades.
    const image = { index: 0, assetPath: '', isLocal: false, url,
      credit: String(b.credit || '').slice(0, 120),
      creditUsername: String(b.creditUsername || '').slice(0, 120),
      creditUrl: String(b.creditUrl || '').slice(0, 300) }
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

  // ── delete one place ────────────────────────────────────────────────────────
  if (req.method === 'DELETE' && q.place) {
    await db.delete(buildPlaces)
      .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region), eq(buildPlaces.placeId, q.place)))
    return send(res, 200, { ok: true })
  }

  // Remove a whole region and everything hanging off it: its places (details,
  // image references) and the region row itself (prose, restaurants, hero).
  if (req.method === 'DELETE' && q.region) {
    await db.delete(buildPlaces)
      .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region)))
    await db.delete(buildRegions)
      .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
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

  // ── manual details save (edit or clear) ──────────────────────────────────────
  if (req.method === 'POST' && q.action === 'setdetails') {
    const body = await readBody(req)
    const details = body.details || null
    if (q.region) {
      const [r] = await db.select().from(buildRegions)
        .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
      if (!r) throw fail(404, 'No such region')
      const data = { ...r.data }
      if (details) data.details = details; else delete data.details
      await db.update(buildRegions).set({ data, updatedAt: Date.now() })
        .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    } else {
      const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
      if (!b) throw fail(404, 'No such build')
      const guides = { ...(b.guides || {}) }
      if (details) guides.details = details; else delete guides.details
      await db.update(builds).set({ guides, updatedAt: Date.now() }).where(eq(builds.countryId, q.country))
    }
    return send(res, 200, { ok: true })
  }

  if (await exportActions(req, res, db, q)) return

  if (req.method === 'DELETE') {
    if (!q.country) throw fail(400, 'country required')
    await db.delete(builds).where(eq(builds.countryId, q.country))  // cascades to regions + places
    return send(res, 200, { ok: true })
  }

  throw fail(405, 'Method not allowed')
})
