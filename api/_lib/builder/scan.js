import { getDb, schema, eq, and, asc } from '../db.js'
import { send, readBody, fail } from '../util.js'
const { builds, buildRegions, buildPlaces } = schema

// Moved verbatim out of api/builder.js — behaviour-identical. Every matched
// branch ends in `return send(...)` (now truthy) or throws; an unmatched call
// returns undefined so the router falls through to its own routes.
export async function scanActions(req, res, db, q) {
  // ── duplicate-place scan ─────────────────────────────────────────────────
  // GET ?action=scan → for every build, groups places whose (normalised) name
  // appears in more than one region of the same country, with data figures so
  // the admin can decide which occurrence to keep.
  if (req.method === 'GET' && q.action === 'scan') {
    const allBuilds = await db.select({ countryId: builds.countryId, name: builds.name, flag: builds.flag }).from(builds)
    const allRegions = await db.select({ countryId: buildRegions.countryId, regionId: buildRegions.regionId, data: buildRegions.data }).from(buildRegions)
    const allPlaces = await db.select({ countryId: buildPlaces.countryId, regionId: buildPlaces.regionId, placeId: buildPlaces.placeId, data: buildPlaces.data, image: buildPlaces.image }).from(buildPlaces)

    const regionName = new Map(allRegions.map((r) => [`${r.countryId}/${r.regionId}`, r.data?.name || r.regionId]))
    const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

    const out = []
    for (const b of allBuilds) {
      const groups = new Map()
      for (const p of allPlaces.filter((x) => x.countryId === b.countryId)) {
        const k = norm(p.data?.name || p.placeId)
        if (!k) continue
        if (!groups.has(k)) groups.set(k, [])
        groups.get(k).push(p)
      }
      const dups = []
      for (const [key, list] of groups) {
        const regions = new Set(list.map((p) => p.regionId))
        if (list.length < 2 || regions.size < 2) continue   // same-region twins are a different problem
        dups.push({
          key,
          places: list.map((p) => ({
            regionId: p.regionId,
            regionName: regionName.get(`${b.countryId}/${p.regionId}`) || p.regionId,
            placeId: p.placeId,
            name: p.data?.name || p.placeId,
            images: p.image ? 1 : 0,
            activities: (p.data?.activities || []).length,
            food: (p.data?.food || []).length,
            culture: (p.data?.culture || []).length,
            descriptionChars: String(p.data?.description || '').length,
            hasCoords: Number.isFinite(p.data?.lat) && Number.isFinite(p.data?.lng),
          })),
        })
      }
      if (dups.length) out.push({ countryId: b.countryId, name: b.name, flag: b.flag, groups: dups })
    }
    return send(res, 200, { countries: out })
  }

}
