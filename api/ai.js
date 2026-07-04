import { getDb, schema, eq, and } from './_lib/db.js'
import { requireUser, requireAdmin } from './_lib/auth.js'
import { send, readBody, fail, handler } from './_lib/util.js'
const { siteSettings, aiUsage } = schema

const ANTHROPIC = 'https://api.anthropic.com/v1'
const VERSION = '2023-06-01'

// Models sometimes wrap JSON in prose or fences despite instructions —
// extract the outermost object before parsing.
function extractJson(text) {
  const cleaned = String(text).replace(/```json|```/g, '')
  const a = cleaned.indexOf('{'), b = cleaned.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('no json')
  return JSON.parse(cleaned.slice(a, b + 1))
}

async function aiConfig(db) {
  const rows = await db.select().from(siteSettings)
  const all = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { key: all['secret.anthropicKey'], model: all['ai.model'], dailyLimit: Number(all['ai.dailyLimit']) || 10 }
}

// Free-but-not-abusable: each user gets a daily allowance of AI calls
// (configurable via the ai.dailyLimit setting; admins are exempt).
async function checkAllowance(db, user, limit) {
  if (user.role === 'admin') return
  const day = new Date().toISOString().slice(0, 10)
  const [row] = await db.select().from(aiUsage)
    .where(and(eq(aiUsage.userId, user.id), eq(aiUsage.day, day)))
  if (row && row.count >= limit) throw fail(429, `Daily AI limit reached (${limit}/day) — try again tomorrow`)
  if (row) await db.update(aiUsage).set({ count: row.count + 1 }).where(eq(aiUsage.id, row.id))
  else await db.insert(aiUsage).values({ userId: user.id, day, count: 1 })
}

export default handler(async (req, res) => {
  const db = getDb()
  const action = (req.query || {}).action

  // ── list available models (admin, powers the dynamic model picker) ────────
  if (req.method === 'GET' && action === 'models') {
    const user = await requireUser(req)
    requireAdmin(user)
    const { key } = await aiConfig(db)
    if (!key) throw fail(400, 'No Anthropic API key saved yet')
    const r = await fetch(`${ANTHROPIC}/models?limit=100`, {
      headers: { 'x-api-key': key, 'anthropic-version': VERSION },
    })
    if (!r.ok) throw fail(r.status, `Anthropic: ${(await r.text()).slice(0, 200)}`)
    const j = await r.json()
    return send(res, 200, (j.data || []).map((m) => ({ id: m.id, name: m.display_name || m.id })))
  }

  // ── generate a packing list for a trip (any signed-in user) ───────────────
  if (req.method === 'POST' && action === 'packing') {
    const user = await requireUser(req)
    const { key, model, dailyLimit } = await aiConfig(db)
    if (!key) throw fail(400, 'AI is not configured yet')
    if (!model) throw fail(400, 'No AI model selected yet')
    await checkAllowance(db, user, dailyLimit)

    const b = await readBody(req)
    const { tripName, startDate, endDate, places = [], activities = [], adults = 2, children = 0, weather = '' } = b || {}
    if (!startDate || !places.length) throw fail(400, 'Trip details required')

    const prompt = `Create a packing list for this trip.

Trip: ${String(tripName).slice(0, 80)}
Dates: ${startDate} to ${endDate}
Destinations: ${places.slice(0, 20).map((p) => String(p).slice(0, 60)).join(', ')}
Travellers: ${Number(adults) || 1} adult(s), ${Number(children) || 0} child(ren)
Planned activities: ${activities.length ? activities.slice(0, 40).map((a) => String(a).slice(0, 80)).join('; ') : 'general sightseeing'}
Weather forecast: ${String(weather).slice(0, 600) || 'not available — infer from destination and season'}

Rules:
- Tailor items to the weather, the activities, and the group (include child items only if children > 0).
- Practical quantities where useful (e.g. "T-shirts × 5").
- Include documents/essentials, clothing, toiletries, tech, and activity-specific gear.
- 25 to 45 items total. No explanations.

Respond with ONLY valid JSON, no markdown fences, in exactly this shape:
{"categories":[{"name":"Essentials","items":["Passports","..."]}]}`

    const r = await fetch(`${ANTHROPIC}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) throw fail(r.status === 401 ? 400 : 502, `Anthropic: ${(await r.text()).slice(0, 200)}`)
    const j = await r.json()
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
    let parsed
    try { parsed = extractJson(text) } catch {
      throw fail(502, 'The model returned an unexpected format — try again')
    }
    if (!Array.isArray(parsed.categories)) throw fail(502, 'The model returned an unexpected shape — try again')
    return send(res, 200, { categories: parsed.categories, model })
  }

  // ── estimate budget rates for a trip (any signed-in user) ─────────────────
  if (req.method === 'POST' && action === 'budget') {
    const user = await requireUser(req)
    const { key, model, dailyLimit } = await aiConfig(db)
    if (!key) throw fail(400, 'AI is not configured yet')
    if (!model) throw fail(400, 'No AI model selected yet')
    await checkAllowance(db, user, dailyLimit)

    const b = await readBody(req)
    const {
      tripName, startDate, endDate, nights = 1, places = [], activities = [], restaurants = [],
      adults = 2, children = 0, style = 'mid-range', includeFlights = false, flyingFrom = '',
      includeCar = false, currency = 'EUR',
    } = b || {}
    if (!startDate || !places.length) throw fail(400, 'Trip details required')

    const prompt = `Estimate realistic ${currency} price RATES (not totals) for this trip. Use current typical prices for the specific destinations and season.

Trip: ${String(tripName).slice(0, 80)}
Dates: ${startDate} to ${endDate} (${nights} nights)
Destinations: ${places.slice(0, 20).map((p) => String(p).slice(0, 60)).join(', ')}
Travellers: ${Number(adults) || 1} adult(s), ${Number(children) || 0} child(ren)
Travel style: ${String(style).slice(0, 20)}
Planned activities: ${activities.length ? activities.slice(0, 30).map((a) => String(a).slice(0, 70)).join('; ') : 'general sightseeing'}
Restaurant picks: ${restaurants.slice(0, 15).map((r) => String(r).slice(0, 50)).join('; ') || 'none listed'}
${includeFlights ? `Include return flight rate per person${flyingFrom ? ` from ${String(flyingFrom).slice(0, 40)}` : ''}.` : 'Do NOT include flights.'}
${includeCar ? 'Include car rental per-day rate (economy).' : 'Do NOT include car rental.'}

Rules:
- RATES ONLY — per night / per person / per day as specified. The app does the multiplication.
- low/high must be realistic numbers for the style and season. Activity entries: one per DISTINCT paid activity from the list (free sights get low 0), max 8, most significant first.
- One short note per rate (max 12 words).

Respond with ONLY valid JSON, no markdown fences, exactly this shape (omit flights/carRental if not requested):
{"accommodation":{"perNight":{"low":0,"high":0},"note":""},"food":{"perPersonPerDay":{"low":0,"high":0},"note":""},"activities":[{"name":"","perPerson":{"low":0,"high":0},"note":""}],"localTransport":{"perPersonPerDay":{"low":0,"high":0},"note":""},"flights":{"perPerson":{"low":0,"high":0},"note":""},"carRental":{"perDay":{"low":0,"high":0},"note":""},"extras":{"perPersonPerDay":{"low":0,"high":0},"note":""}}`

    const r = await fetch(`${ANTHROPIC}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) throw fail(r.status === 401 ? 400 : 502, `Anthropic: ${(await r.text()).slice(0, 200)}`)
    const j = await r.json()
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
    let rates
    try { rates = extractJson(text) } catch {
      throw fail(502, 'The model returned an unexpected format — try again')
    }
    if (!rates.accommodation?.perNight || !rates.food?.perPersonPerDay) {
      throw fail(502, 'The model returned an unexpected shape — try again')
    }
    return send(res, 200, { rates, model, currency })
  }

  // ── narrate a trip as a short story (any signed-in user) ──────────────────
  if (req.method === 'POST' && action === 'narrate') {
    const user = await requireUser(req)
    const { key, model, dailyLimit } = await aiConfig(db)
    if (!key) throw fail(400, 'AI is not configured yet')
    if (!model) throw fail(400, 'No AI model selected yet')
    await checkAllowance(db, user, dailyLimit)

    const b = await readBody(req)
    const { tripName, startDate, endDate, days = [] } = b || {}
    if (!days.length) throw fail(400, 'Trip details required')

    const dayLines = days.slice(0, 21).map((d) =>
      `${d.date}: ${String(d.summary).slice(0, 220)}`).join('\n')

    const prompt = `Write a warm, evocative overview of this planned trip — the kind of paragraph a quality travel magazine would open with. Written to the traveller ("you").

Trip: ${String(tripName).slice(0, 80)}
Dates: ${startDate} to ${endDate}
Day by day:
${dayLines}

Rules:
- 220 to 300 words, plain prose, no markdown, no headings, no lists.
- Present tense. Mention only places, meals and activities that appear above — invent nothing.
- Weave in the shape of the trip (arrival, the middle days, the last evening) rather than listing every item.
- End on a single short sentence that lands.

Respond with ONLY valid JSON, no fences: {"story":"..."}`

    const r = await fetch(`${ANTHROPIC}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) throw fail(r.status === 401 ? 400 : 502, `Anthropic: ${(await r.text()).slice(0, 200)}`)
    const j = await r.json()
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
    let parsed
    try { parsed = extractJson(text) } catch {
      throw fail(502, 'The model returned an unexpected format — try again')
    }
    if (typeof parsed.story !== 'string' || parsed.story.length < 50) {
      throw fail(502, 'The model returned an unexpected shape — try again')
    }
    return send(res, 200, { story: parsed.story.slice(0, 2400), model })
  }

  // ── draft a blog post in the house style (admin only) ─────────────────────
  if (req.method === 'POST' && action === 'blog') {
    const user = await requireUser(req)
    requireAdmin(user)
    const { key, model } = await aiConfig(db)
    if (!key) throw fail(400, 'AI is not configured yet')
    if (!model) throw fail(400, 'No AI model selected yet')

    const b = await readBody(req)
    const { topic, notes = '', existing = [], styleSample = '', country = '' } = b || {}
    if (!topic) throw fail(400, 'A topic is required')

    const archive = existing.slice(0, 40)
      .map((p) => `- "${String(p.title).slice(0, 90)}" (${String(p.tag || '').slice(0, 20)}): ${String(p.dek || '').slice(0, 140)}`)
      .join('\n')

    const countryLine = country ? `The post is about ${String(country).slice(0, 40)} — ground every recommendation, place and cultural detail firmly in ${String(country).slice(0, 40)}.` : ''
    const prompt = `Write a blog post for myholidaypilot, a travel-guide site covering Italy, Spain and more, with a quiet, editorial voice — practical, warm, honest, never listicle-breathless.
${countryLine}
TOPIC: ${String(topic).slice(0, 200)}
${notes ? `EDITOR'S NOTES: ${String(notes).slice(0, 400)}` : ''}

POSTS ALREADY PUBLISHED (do not repeat their ground; complement them, and you may reference their themes without linking):
${archive || '(none yet)'}

STYLE SAMPLE from a published post (match this register, not its content):
${String(styleSample).slice(0, 1800)}

Rules:
- 900 to 1100 words.
- Body is plain HTML using only <p>, <h2>, <ul>, <li>, <strong>, <em>. No <h1>, no images, no links, no markdown.
- 3 to 5 <h2> sections. Open strong — no throat-clearing intro sentence about "when you think of travel".
- Practical specifics over generalities; hedge honestly where prices/times drift.
- End with a sentence that lands, not a summary.
- tag: one or two words (e.g. Planning, Food, Culture, Field notes).
- excerpt: one or two sentences for the blog index, under 200 characters.

Respond with ONLY valid JSON, no fences: {"title":"","tag":"","excerpt":"","html":""}`

    const r = await fetch(`${ANTHROPIC}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) throw fail(r.status === 401 ? 400 : 502, `Anthropic: ${(await r.text()).slice(0, 200)}`)
    const j = await r.json()
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
    let parsed
    try { parsed = extractJson(text) } catch {
      throw fail(502, 'The model returned an unexpected format — try again')
    }
    if (!parsed.title || !parsed.html || parsed.html.length < 400) {
      throw fail(502, 'The model returned an unexpected shape — try again')
    }
    // belt-and-braces: strip tags we didn't ask for
    parsed.html = String(parsed.html).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<img[^>]*>/gi, '')
    return send(res, 200, {
      title: String(parsed.title).slice(0, 140),
      tag: String(parsed.tag || 'Field notes').slice(0, 30),
      excerpt: String(parsed.excerpt || '').slice(0, 240),
      html: parsed.html.slice(0, 20000),
      model,
    })
  }

  // ── ask about a place (scoped Q&A, any signed-in user) ────────────────────
  if (req.method === 'POST' && action === 'place') {
    const user = await requireUser(req)
    const { key, model, dailyLimit } = await aiConfig(db)
    if (!key) throw fail(400, 'AI is not configured yet')
    if (!model) throw fail(400, 'No AI model selected yet')
    await checkAllowance(db, user, dailyLimit)

    const b = await readBody(req)
    const question = String(b.question || '').trim().slice(0, 300)
    const placeName = String(b.placeName || '').slice(0, 80)
    const context = String(b.context || '').slice(0, 4000)
    if (!question || !placeName) throw fail(400, 'A question and a place are required')

    const prompt = `You are the travel guide for myholidaypilot answering ONE visitor question about ${placeName}, Italy.

OUR GUIDE'S NOTES ON THE PLACE (primary source — prefer this):
${context || '(none provided)'}

QUESTION: ${question}

Rules:
- Answer in 2 to 5 sentences, plain text, no markdown, no lists.
- Ground the answer in the notes above plus reliable general knowledge of the place. If something genuinely varies (opening hours, prices), say so honestly rather than inventing specifics.
- If the question is unrelated to visiting this place, say you can only help with ${placeName}.

Respond with ONLY valid JSON, no fences: {"answer":"..."}`

    const r = await fetch(`${ANTHROPIC}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) throw fail(r.status === 401 ? 400 : 502, `Anthropic: ${(await r.text()).slice(0, 200)}`)
    const j = await r.json()
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
    let parsed
    try { parsed = extractJson(text) } catch { throw fail(502, 'The model returned an unexpected format — try again') }
    if (typeof parsed.answer !== 'string' || parsed.answer.length < 5) throw fail(502, 'The model returned an unexpected shape — try again')
    return send(res, 200, { answer: parsed.answer.slice(0, 1500) })
  }

  // ── itinerary sense-check (any signed-in user) ─────────────────────────────
  if (req.method === 'POST' && action === 'review') {
    const user = await requireUser(req)
    const { key, model, dailyLimit } = await aiConfig(db)
    if (!key) throw fail(400, 'AI is not configured yet')
    if (!model) throw fail(400, 'No AI model selected yet')
    await checkAllowance(db, user, dailyLimit)

    const b = await readBody(req)
    const { tripName, startDate, endDate, adults = 2, children = 0, days = [] } = b || {}
    if (!days.length) throw fail(400, 'Trip details required')

    const dayLines = days.slice(0, 21).map((d) => `Day ${d.n} (${d.weekday}${d.km ? `, ~${d.km} km driving` : ''}): ${String(d.summary).slice(0, 220)}`).join('\n')

    const prompt = `Review this trip plan like an experienced, kind Italy travel agent. Find the things worth flagging BEFORE they travel.

Trip: ${String(tripName).slice(0, 80)} · ${startDate} to ${endDate} · ${adults} adult(s), ${children} child(ren)
${dayLines}

Look for: overloaded days; heavy driving days (especially with children); Monday museum closures and Sunday shop closures in Italy; days with no food picks; unrealistic pacing; anything seasonal about the dates. Also note ONE thing they've done well.

Rules:
- 3 to 6 observations, each ONE sentence, specific to their actual plan (mention the day number).
- severity: "warn" for real problems, "tip" for improvements, "good" for the positive one.
- Be honest — if the plan is genuinely well balanced, say so and keep the list short.

Respond with ONLY valid JSON, no fences: {"observations":[{"severity":"warn","day":3,"text":"..."}]}`

    const r = await fetch(`${ANTHROPIC}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) throw fail(r.status === 401 ? 400 : 502, `Anthropic: ${(await r.text()).slice(0, 200)}`)
    const j = await r.json()
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
    let parsed
    try { parsed = extractJson(text) } catch { throw fail(502, 'The model returned an unexpected format — try again') }
    if (!Array.isArray(parsed.observations)) throw fail(502, 'The model returned an unexpected shape — try again')
    const obs = parsed.observations.slice(0, 6).map((o) => ({
      severity: ['warn', 'tip', 'good'].includes(o.severity) ? o.severity : 'tip',
      day: Number.isFinite(Number(o.day)) ? Number(o.day) : null,
      text: String(o.text || '').slice(0, 240),
    })).filter((o) => o.text)
    return send(res, 200, { observations: obs })
  }

  throw fail(405, 'Method not allowed')
})
