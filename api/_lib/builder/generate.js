import { getDb, schema, eq, and, asc } from '../db.js'
import { send, readBody, fail } from '../util.js'
import { generate, slugify } from '../genai.js'
const { builds, buildRegions, buildPlaces } = schema

// Moved verbatim out of api/builder.js — behaviour-identical. Every matched
// branch ends in `return send(...)` (now truthy) or throws; an unmatched call
// returns undefined so the router falls through to its own routes.
export async function generateActions(req, res, db, q) {
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

  // ── trip details: SEO planning content for a region or the whole country ────
  // POST ?action=details&country=X[&region=Y] → generates a structured block
  // (intro, getting there, days needed, itinerary, FAQ) from the build data and
  // stores it on the region (data.details) or country (guides.details). It is
  // synced into the static files at build time and prerendered for SEO.
  if (req.method === 'POST' && q.action === 'details') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')

    const shape = `Respond ONLY with JSON, no prose around it:
{"intro":"2-3 sentence overview a traveller planning a holiday would want first",
 "gettingThere":"how to get there and get around: airports, trains, driving — 2-4 sentences, practical",
 "daysNeeded":"how many days to spend and why — 1-2 sentences",
 "bestTime":"when to go, month by month feel — 1-2 sentences",
 "itinerary":[{"day":1,"title":"","text":"1-2 sentences"},{"day":2,"title":"","text":""},{"day":3,"title":"","text":""}],
 "faq":[{"q":"a real question travellers search for","a":"a direct, factual 1-3 sentence answer"}]}
Give exactly 5 faq entries. Questions should match what people type into Google (e.g. "Is X worth visiting?", "How many days do you need in X?"). Be specific and factual; no marketing fluff.`

    let details
    if (q.region) {
      const [r] = await db.select().from(buildRegions)
        .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
      if (!r) throw fail(404, 'No such region')
      const places = await db.select().from(buildPlaces)
        .where(and(eq(buildPlaces.countryId, q.country), eq(buildPlaces.regionId, q.region)))
      const placeNames = places.map((p) => p.data?.name).filter(Boolean).slice(0, 15)
      const prompt = `You are writing trip-planning content for ${r.data.name}, a region of ${b.name}, for a travel guide.
Known places in the region: ${placeNames.join(', ') || 'n/a'}.
Capital: ${r.data.capital || 'n/a'}. Best time to visit: ${r.data.bestTimeToVisit || 'n/a'}.
Context: ${String(r.data.history || '').slice(0, 600)}

${shape}`
      details = await generate(prompt, { maxTokens: 3000 })
      await db.update(buildRegions)
        .set({ data: { ...r.data, details }, updatedAt: Date.now() })
        .where(and(eq(buildRegions.countryId, q.country), eq(buildRegions.regionId, q.region)))
    } else {
      const regs = await db.select().from(buildRegions).where(eq(buildRegions.countryId, q.country))
      const regionNames = regs.map((r) => r.data?.name).filter(Boolean)
      const prompt = `You are writing trip-planning content for ${b.name} as a whole, for a travel guide's country page.
Its regions: ${regionNames.join(', ') || 'n/a'}.

${shape.replace('"itinerary":[{"day":1', '"itinerary":[{"day":1').replace('exactly 5 faq', 'exactly 5 faq')}
For the itinerary, sketch a first-visit route across 2-3 regions rather than one town.`
      details = await generate(prompt, { maxTokens: 3000 })
      await db.update(builds)
        .set({ guides: { ...(b.guides || {}), details }, updatedAt: Date.now() })
        .where(eq(builds.countryId, q.country))
    }
    return send(res, 200, { details })
  }


  // ── top 10 most visited places ───────────────────────────────────────────────
  // One AI call, given the build's own region list, returns the country's ten
  // most visited places each assigned to the most appropriate region. Places
  // already in the build (name-matched) are linked; missing ones are inserted
  // into their assigned region (surfacing in Missing images / detail stages
  // like any stage-2 place). The ordered list is saved on the build and baked
  // into index.json at export.
  if (req.method === 'POST' && q.action === 'top10') {
    const [b] = await db.select().from(builds).where(eq(builds.countryId, q.country))
    if (!b) throw fail(404, 'No such build')
    const regionsRows = await db.select().from(buildRegions).where(eq(buildRegions.countryId, q.country))
    if (!regionsRows.length) throw fail(400, 'Generate the regions first — the top 10 need regions to belong to')
    const placesRows = await db.select().from(buildPlaces).where(eq(buildPlaces.countryId, q.country))

    const regionList = regionsRows.map((r) => `${r.regionId} (${r.data?.name || r.regionId})`).join(', ')
    const prompt = `You are compiling the definitive "top 10 most visited places" list for ${b.name} for a travel guide.

Rules:
- Exactly 10 entries, ordered from most visited (rank 1) to tenth.
- "Place" means a visitable destination: a city, town, site, monument, park or island — the things tourism statistics rank.
- Each entry MUST be assigned to the most appropriate region from this exact list (use the id before the parentheses): ${regionList}
- description: two sentences — what it is and why so many people visit. No markdown.
- Respond with ONLY this JSON, no other text:
{"places":[{"rank":1,"id":"","name":"","nameLocal":"","type":"CITY","lat":0,"lng":0,"regionId":"","description":""}]}`

    const out = await generate(prompt, { json: true })
    const list = Array.isArray(out.places) ? out.places.slice(0, 10) : []
    if (list.length < 10) throw fail(502, 'The model did not return 10 places — try again')

    const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
    // Match by name AND by place id: "Grand Canyon National Park" must link to
    // an existing "Grand Canyon" whose slug collides, not violate the unique
    // index trying to re-insert it.
    const byName = new Map(placesRows.map((p) => [norm(p.data?.name || p.placeId), p]))
    const byId = new Map(placesRows.map((p) => [p.placeId, p]))
    const validRegions = new Set(regionsRows.map((r) => r.regionId))

    const top10 = []
    const added = [], matched = [], skipped = []
    for (const raw of list) {
      const rawSlug = slugify(raw.id || raw.name)
      const hit = byName.get(norm(raw.name)) || byId.get(rawSlug)
      if (hit) {
        matched.push(raw.name)
        top10.push({ rank: top10.length + 1, name: hit.data?.name || raw.name, placeId: hit.placeId, regionId: hit.regionId, added: false })
        continue
      }
      const regionId = validRegions.has(raw.regionId) ? raw.regionId : null
      if (!regionId) { skipped.push(`${raw.name} (unknown region "${raw.regionId}")`); continue }
      const placeId = rawSlug
      await db.insert(buildPlaces).values({
        countryId: q.country, regionId, placeId, sort: 900 + top10.length,
        data: {
          id: placeId, name: String(raw.name).slice(0, 120), nameLocal: String(raw.nameLocal || '').slice(0, 120),
          type: String(raw.type || 'CITY').toUpperCase().slice(0, 30),
          lat: Number(raw.lat) || 0, lng: Number(raw.lng) || 0,
          description: String(raw.description || '').slice(0, 600),
          activities: [], food: [], culture: [],
        },
      })
      added.push(`${raw.name} → ${regionId}`)
      byId.set(placeId, { placeId, regionId, data: { name: raw.name } })
      top10.push({ rank: top10.length + 1, name: raw.name, placeId, regionId, added: true })
    }

    const guides = { ...(b.guides || {}), top10 }
    await db.update(builds).set({ guides, updatedAt: Date.now() }).where(eq(builds.countryId, q.country))
    return send(res, 200, { ok: true, top10, matched, added, skipped })
  }
}
