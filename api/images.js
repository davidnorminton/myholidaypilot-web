// Serve place images straight from the Country Builder database, so images set
// in the builder appear on the live site immediately — no export, no deploy.
//
//   GET /api/images?country=france
//     → { "regionId": { "placeId": [ { url, credit, ... } ] }, ... }
//
// Shape matches the static public/data/<country>/images.json exactly, so the
// frontend can use it as a drop-in source. Public, read-only, cacheable.
import { getDb, schema, eq } from './_lib/db.js'
import { send, fail, handler } from './_lib/util.js'

const { buildPlaces, buildRegions } = schema

export default handler(async (req, res) => {
  if (req.method !== 'GET') throw fail(405, 'Method not allowed')
  const country = String((req.query || {}).country || '').trim().toLowerCase()
  if (!country) throw fail(400, 'country is required')

  const db = getDb()
  const rows = await db.select({
    regionId: buildPlaces.regionId,
    placeId: buildPlaces.placeId,
    image: buildPlaces.image,
  }).from(buildPlaces).where(eq(buildPlaces.countryId, country))

  const out = {}
  for (const r of rows) {
    if (!r.image) continue
    ;(out[r.regionId] = out[r.regionId] || {})[r.placeId] = [r.image]
  }

  // Region heroes ride along under a reserved key (never collides with a real
  // region id). Consumers do keyed lookups, so unknown keys are inert.
  const regs = await db.select({ regionId: buildRegions.regionId, data: buildRegions.data })
    .from(buildRegions).where(eq(buildRegions.countryId, country))
  const heroes = {}
  for (const r of regs) if (r.data?.heroImage?.url) heroes[r.regionId] = r.data.heroImage
  if (Object.keys(heroes).length) out.__regions = heroes

  // Cache aggressively at the edge: images change rarely, and stale-while-
  // revalidate serves instantly from cache while refreshing in the background.
  // 5-min fresh, 1-day stale window — builder edits still surface within minutes.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400')
  return send(res, 200, out)
})
