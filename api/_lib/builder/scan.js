import { getDb, schema, eq, and, asc } from '../db.js'
import { send, readBody, fail } from '../util.js'
import { isUnsplashUrl, fromCreditString, resolveCredit, RESERVE,
  buildPhotographerMap, fromPhotographerMap } from '../unsplash.js'
const { builds, buildRegions, buildPlaces, siteSettings } = schema

// Moved verbatim out of api/builder.js — behaviour-identical. Every matched
// branch ends in `return send(...)` (now truthy) or throws; an unmatched call
// returns undefined so the router falls through to its own routes.
export async function scanActions(req, res, db, q) {
  // ── photo credits: scan ──────────────────────────────────────────────────
  // GET ?action=creditscan → how many Unsplash images can be attributed.
  // Unsplash's API Terms need the photographer's *profile* linked, which needs
  // their username; older records saved only a display name. Pure DB read.
  if (req.method === 'GET' && q.action === 'creditscan') {
    const rows = await db.select({
      countryId: buildPlaces.countryId, regionId: buildPlaces.regionId,
      placeId: buildPlaces.placeId, image: buildPlaces.image,
    }).from(buildPlaces)

    const all = await db.select({ countryId: builds.countryId, name: builds.name, flag: builds.flag }).from(builds)
    const meta = new Map(all.map((b) => [b.countryId, b]))
    const byCountry = new Map()
    for (const r of rows) {
      if (!isUnsplashUrl(r.image?.url)) continue
      const c = byCountry.get(r.countryId) || { countryId: r.countryId,
        name: meta.get(r.countryId)?.name || r.countryId, flag: meta.get(r.countryId)?.flag || '',
        total: 0, ok: 0, free: 0, api: 0, failed: 0 }
      c.total++
      if (r.image?.creditUsername) c.ok++
      else if (fromCreditString(r.image?.credit)) c.free++
      else if (r.image?.creditLookupFailedAt) c.failed++
      else c.api++
      byCountry.set(r.countryId, c)
    }
    const countries = [...byCountry.values()].sort((a, b) => a.name.localeCompare(b.name))
    const sum = (k) => countries.reduce((n, c) => n + c[k], 0)
    return send(res, 200, {
      countries,
      totals: { total: sum('total'), ok: sum('ok'), free: sum('free'), api: sum('api'), failed: sum('failed') },
    })
  }

  // ── photo credits: fix ───────────────────────────────────────────────────
  // POST ?action=creditfix  { mode: 'free' | 'api', limit }
  //
  // 'free' parses usernames already embedded in the credit string — no API, no
  // rate limit, safe to run in one go.
  //
  // 'api' re-runs each image's original search (recovered from its ixid) and
  // matches on photo path. Deliberately BATCHED: Unsplash allows 50 req/hour on
  // a demo app and each image costs 1-3 searches, and this function has a 120s
  // ceiling — so the caller loops small batches rather than one long request.
  // Progress is the data: every hit is written immediately and the work queue is
  // "no creditUsername yet", so stopping at any point simply resumes next time.
  if (req.method === 'POST' && q.action === 'creditfix') {
    const body = await readBody(req).catch(() => ({}))
    const mode = body.mode === 'api' ? 'api' : 'free'
    const limit = Math.max(1, Math.min(Number(body.limit) || 12, 40))   // API CALLS, not images
    const retryFailed = !!body.retryFailed

    const rows = await db.select().from(buildPlaces)
    const unsplash = rows.filter((r) => isUnsplashUrl(r.image?.url))
    const missing = unsplash.filter((r) => !r.image?.creditUsername)
    const save = (r, fields) => db.update(buildPlaces)
      .set({ image: { ...r.image, ...fields }, updatedAt: Date.now() })
      .where(and(eq(buildPlaces.countryId, r.countryId),
        eq(buildPlaces.regionId, r.regionId), eq(buildPlaces.placeId, r.placeId)))

    if (mode === 'free') {
      let fixed = 0
      // 1. usernames already sitting in the credit text
      for (const r of missing) {
        const got = fromCreditString(r.image?.credit)
        if (!got) continue
        await save(r, { ...got, creditLookupFailedAt: null })
        r.image = { ...r.image, ...got }
        fixed++
      }
      // 2. photographers we've already identified on another photo. Rebuild the
      //    map after step 1 so those 100-odd names are in it, and re-run until
      //    it settles — each resolve can unlock more.
      for (;;) {
        const map = buildPhotographerMap(unsplash.map((r) => r.image).filter((i) => i?.creditUsername))
        let round = 0
        for (const r of missing) {
          if (r.image?.creditUsername) continue
          const got = fromPhotographerMap(r.image, map)
          if (!got) continue
          await save(r, got)
          r.image = { ...r.image, ...got }
          round++; fixed++
        }
        if (!round) break
      }
      const left = missing.filter((r) => !r.image?.creditUsername).length
      return send(res, 200, { mode, fixed, failed: 0, remaining: left, calls: 0, stopped: '' })
    }

    // mode === 'api'
    const settings = await db.select().from(siteSettings)
    const bySetting = Object.fromEntries(settings.map((s) => [s.key, s.value]))
    const key = bySetting['secret.unsplashKey']
    if (!key) throw fail(400, 'Add your Unsplash Access Key in Admin → AI first')

    // Unsplash only tells us the remaining quota in a response header, so a
    // stateless function has to spend a request to discover it's out of them.
    // That's a trap: with the tank near empty every batch burned its one call
    // learning it had none, made no progress, and kept the quota pinned at zero.
    // So remember what the last batch was told and don't set off at all.
    let known = null
    try { known = JSON.parse(bySetting['unsplash.quota'] || 'null') } catch { known = null }
    const HOUR = 60 * 60 * 1000
    const fresh = known && Date.now() - known.at < HOUR
    if (fresh && known.remaining <= RESERVE) {
      const readyAt = known.at + HOUR
      const after = await db.select({ image: buildPlaces.image }).from(buildPlaces)
      return send(res, 200, {
        mode, fixed: 0, failed: 0, calls: 0,
        remaining: after.filter((r) => isUnsplashUrl(r.image?.url) && !r.image?.creditUsername).length,
        quotaRemaining: known.remaining, quotaReadyAt: readyAt,
        stopped: `Unsplash quota spent — resets around ${new Date(readyAt).toLocaleTimeString()}`,
      })
    }
    const rememberQuota = (remaining) => (Number.isFinite(remaining)
      ? db.insert(siteSettings).values({ key: 'unsplash.quota', value: JSON.stringify({ remaining, at: Date.now() }), updatedAt: Date.now() })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value: JSON.stringify({ remaining, at: Date.now() }), updatedAt: Date.now() } })
      : Promise.resolve())

    const queue = missing.filter((r) => !fromCreditString(r.image?.credit))
      .filter((r) => (retryFailed ? true : !r.image?.creditLookupFailedAt))
    // Only trust a *fresh* reading. A stale one is from a previous hour, when the
    // tank was empty — seeding from it would refuse to start for ever. Unknown
    // means Infinity: spend one call to find out, which is the whole point of a
    // new hour.
    const budget = { calls: 0, maxCalls: limit, remaining: fresh ? (known?.remaining ?? Infinity) : Infinity }
    let map = buildPhotographerMap(unsplash.map((r) => r.image).filter((i) => i?.creditUsername))
    let fixed = 0, failed = 0, stopped = '', errs = 0

    for (const r of queue) {
      if (budget.remaining <= RESERVE) { stopped = 'Unsplash quota spent — try again next hour'; break }
      if (budget.calls >= budget.maxCalls) { stopped = 'batch limit reached'; break }
      // Free first: this photographer may have been identified since the batch
      // started, by an earlier lookup in this very loop.
      const reused = fromPhotographerMap(r.image, map)
      if (reused) { await save(r, reused); r.image = { ...r.image, ...reused }; fixed++; continue }
      let got = null
      try {
        got = await resolveCredit(r.image, r.data?.imageQueries, key, budget)
        errs = 0
      } catch (e) {
        const m = String(e.message)
        if (m === 'QUOTA') { stopped = 'Unsplash quota spent — try again next hour'; break }
        if (m === 'BUDGET') { stopped = 'batch limit reached'; break }
        if (m === 'RATE_LIMIT') { stopped = 'Unsplash rate limit (429) — wait an hour'; break }
        // Transient (network, a one-off 5xx): do NOT record it as "this photo is
        // gone" — that would skip a perfectly good image on every future run.
        // But if they keep coming, Unsplash is unwell: stop rather than spend the
        // whole batch's quota discovering that.
        if (++errs >= 3) { stopped = `Unsplash keeps erroring (${m}) — stopped`; break }
        continue
      }
      if (got) {
        const { _via, ...fields } = got
        await save(r, fields)
        r.image = { ...r.image, ...fields }
        // Every hit makes the rest of the batch cheaper.
        map = buildPhotographerMap(unsplash.map((x) => x.image).filter((i) => i?.creditUsername))
        fixed++
      } else {
        // Remember it, so the next batch doesn't spend quota failing again.
        await save(r, { creditLookupFailedAt: Date.now() })
        failed++
      }
    }

    await rememberQuota(budget.remaining)
    const after = await db.select({ image: buildPlaces.image }).from(buildPlaces)
    const remaining = after.filter((r) => isUnsplashUrl(r.image?.url) && !r.image?.creditUsername).length
    return send(res, 200, {
      mode, fixed, failed, remaining, calls: budget.calls,
      quotaRemaining: Number.isFinite(budget.remaining) ? budget.remaining : null,
      stopped,
    })
  }

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
