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

const { buildPlaces } = schema

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

  // short cache: images change rarely, but we want builder edits to show up
  // quickly. 60s edge cache with stale-while-revalidate keeps it snappy.
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300')
  return send(res, 200, out)
})
