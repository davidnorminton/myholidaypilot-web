import { getDb, schema, eq, and, asc } from '../db.js'
import { send, readBody, fail } from '../util.js'
const { builds, buildRegions, buildPlaces } = schema

// Moved verbatim out of api/builder.js — behaviour-identical. Every matched
// branch ends in `return send(...)` (now truthy) or throws; an unmatched call
// returns undefined so the router falls through to its own routes.
export async function exportActions(req, res, db, q) {
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
}
