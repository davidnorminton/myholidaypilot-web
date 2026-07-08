import { getDb, schema, eq, and, desc, sql } from './_lib/db.js'
import { requireUser, requireAdmin } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { publicTrips, trips } = schema

const slugify = (s) => String(s || 'trip').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'trip'

// Build the sanitised public snapshot SERVER-SIDE from the stored trip —
// the client never dictates what gets published. Real dates become relative
// day numbers; stay addresses, travel points, packing, budget and any other
// personal fields are dropped.
function sanitise(trip) {
  const start = trip.startDate ? new Date(trip.startDate + 'T12:00') : null
  const dayOf = (iso) => {
    if (!iso || !start) return null
    const d = Math.round((new Date(iso + 'T12:00') - start) / 86400000) + 1
    return d >= 1 ? d : null
  }
  const places = (trip.places || []).map((p) => ({
    regionId: p.regionId, regionName: p.regionName, placeId: p.placeId,
    name: p.name, type: p.type, lat: p.lat, lng: p.lng,
    day: dayOf(p.date),
    note: p.note ? String(p.note).slice(0, 300) : undefined,
    attractions: (p.attractions || []).map((a) => ({ id: a.id, text: a.text, lat: a.lat, lng: a.lng, day: dayOf(a.date) })),
    restaurants: (p.restaurants || []).map((r) => ({ id: r.id, name: r.name, cuisine: r.cuisine, mustOrder: r.mustOrder, lat: r.lat, lng: r.lng, day: dayOf(r.date) })),
  }))
  const stays = (trip.stays || []).map((s) => ({
    name: s.name, type: s.type,
    fromDay: dayOf(s.from), toDay: dayOf(s.to || s.from),
  }))
  const days = trip.startDate && trip.endDate
    ? Math.max(1, Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1)
    : Math.max(1, ...places.map((p) => p.day || 1))
  return {
    title: String(trip.name || 'A trip').slice(0, 80),
    countryId: trip.countryId || 'italy',
    days, places, stays,
    story: trip.story?.text ? String(trip.story.text).slice(0, 2400) : null,
  }
}

export default handler(async (req, res) => {
  const db = getDb()
  const q = req.query || {}

  // ── one public trip by slug (public) ───────────────────────────────────────
  if (req.method === 'GET' && q.slug) {
    const [row] = await db.select().from(publicTrips).where(eq(publicTrips.slug, q.slug))
    if (!row || row.status !== 'live') throw fail(404, 'Trip not found')
    // Public content — cache at the edge; publish/unpublish shows within 5 min.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
    return send(res, 200, row)
  }

  // ── admin list (everything, incl. hidden) ──────────────────────────────────
  if (req.method === 'GET' && q.admin) {
    const user = await requireUser(req); requireAdmin(user)
    const rows = await db.select().from(publicTrips).orderBy(desc(publicTrips.createdAt))
    return send(res, 200, rows)
  }

  // ── my publications (owner) ────────────────────────────────────────────────
  if (req.method === 'GET' && q.mine) {
    const user = await requireUser(req)
    const rows = await db.select().from(publicTrips).where(eq(publicTrips.userId, user.id))
    return send(res, 200, rows.map(({ data, ...card }) => card))
  }

  // ── gallery list (public; cards only, no full data) ───────────────────────
  if (req.method === 'GET') {
    let rows = await db.select().from(publicTrips)
      .where(eq(publicTrips.status, 'live'))
      .orderBy(desc(publicTrips.featured), desc(publicTrips.createdAt))
      .limit(200)
    if (q.country) rows = rows.filter((r) => r.countryId === q.country)
    // Public list — edge-cached; new publications appear within 5 min.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
    return send(res, 200, rows.map(({ data, ...card }) => card))
  }

  // ── publish / republish (owner of the trip) ────────────────────────────────
  if (req.method === 'POST' && q.action === 'publish') {
    const user = await requireUser(req)
    const b = await readBody(req)
    if (!b.tripId) throw fail(400, 'tripId required')
    // the server's copy of the trip is the source of truth
    const [tripRow] = await db.select().from(trips)
      .where(and(eq(trips.id, b.tripId), eq(trips.userId, user.id)))
    if (!tripRow) throw fail(404, 'Trip not found — is it synced to your account?')
    // trips.data is a plain-text JSON document — parse before sanitising
    let tripData
    try { tripData = typeof tripRow.data === 'string' ? JSON.parse(tripRow.data) : tripRow.data } catch { tripData = {} }
    const snap = sanitise(tripData)
    if (!snap.places.length) throw fail(400, 'Add some places before publishing')

    const authorName = b.attribution ? (user.name || null) : null
    const regionNames = [...new Set(snap.places.map((p) => p.regionName).filter(Boolean))]
    // The client may hint a cover place (e.g. one it knows has a card image);
    // honour it only if it's actually part of this trip, else fall back to the
    // first real place.
    const hinted = b.cover && b.cover.placeId
      ? snap.places.find((p) => p.regionId === b.cover.regionId && p.placeId === b.cover.placeId)
      : null
    const cover = hinted || snap.places.find((p) => p.regionId && p.placeId) || {}

    const [existing] = await db.select().from(publicTrips).where(eq(publicTrips.tripId, b.tripId))
    const fields = {
      title: snap.title, story: snap.story, days: snap.days, placeCount: snap.places.length,
      regionNames, coverRegionId: cover.regionId || null, coverPlaceId: cover.placeId || null,
      authorName, data: snap, countryId: snap.countryId, status: 'live', updatedAt: Date.now(),
    }
    if (existing) {
      await db.update(publicTrips).set(fields).where(eq(publicTrips.id, existing.id))
      return send(res, 200, { slug: existing.slug, republished: true })
    }
    const slug = `${slugify(snap.title)}-${b.tripId.slice(0, 4)}`
    await db.insert(publicTrips).values({ ...fields, slug, tripId: b.tripId, userId: user.id })
    return send(res, 201, { slug })
  }

  // ── copy counter (signed-in, after a successful import) ────────────────────
  if (req.method === 'POST' && q.action === 'copied') {
    await requireUser(req)
    const b = await readBody(req)
    if (!b.slug) throw fail(400, 'slug required')
    await db.update(publicTrips).set({ copies: sql`${publicTrips.copies} + 1` })
      .where(eq(publicTrips.slug, b.slug))
    return send(res, 200, { ok: true })
  }

  // ── admin moderation: feature / hide / unhide ──────────────────────────────
  if (req.method === 'PATCH') {
    const user = await requireUser(req); requireAdmin(user)
    const b = await readBody(req)
    if (!b.id) throw fail(400, 'id required')
    const patch = {}
    if (b.featured !== undefined) patch.featured = b.featured ? 1 : 0
    if (b.status === 'live' || b.status === 'hidden') patch.status = b.status
    if (!Object.keys(patch).length) throw fail(400, 'Nothing to change')
    patch.updatedAt = Date.now()
    await db.update(publicTrips).set(patch).where(eq(publicTrips.id, b.id))
    return send(res, 200, { ok: true })
  }

  // ── unpublish (owner, or admin) ────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const user = await requireUser(req)
    const { tripId, id } = q
    if (id && user.role === 'admin') {
      await db.delete(publicTrips).where(eq(publicTrips.id, id))
      return send(res, 200, { ok: true })
    }
    if (!tripId) throw fail(400, 'tripId required')
    await db.delete(publicTrips)
      .where(and(eq(publicTrips.tripId, tripId), eq(publicTrips.userId, user.id)))
    return send(res, 200, { ok: true })
  }

  throw fail(405, 'Method not allowed')
})
