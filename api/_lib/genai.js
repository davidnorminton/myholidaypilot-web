// Shared Claude call for the country builder. Reads the site AI config,
// prompts for strict JSON, and returns the parsed object.
import { getDb, schema } from './db.js'
import { fail } from './util.js'

const ANTHROPIC = 'https://api.anthropic.com/v1'
const VERSION = '2023-06-01'

export function extractJson(text) {
  const cleaned = String(text).replace(/```json|```/g, '').trim()
  const a = cleaned.indexOf('{'), la = cleaned.indexOf('[')
  const startsArray = la >= 0 && (a < 0 || la < a)
  const start = startsArray ? la : a
  if (start < 0) throw new Error('no json')
  const slice = cleaned.slice(start)
  // 1) straight parse
  try { return JSON.parse(slice) } catch { /* try repair */ }
  // 2) parse up to the last balanced close (handles trailing prose)
  const end = startsArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}')
  if (end > start) { try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { /* try truncation repair */ } }
  // 3) sanitise raw newlines/tabs inside strings (a common prose breaker),
  //    then retry a straight parse of the balanced slice.
  const balancedEnd = startsArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}')
  if (balancedEnd > start) {
    const sane = sanitiseControlChars(cleaned.slice(start, balancedEnd + 1))
    try { return JSON.parse(sane) } catch { /* fall through to truncation repair */ }
  }
  // 4) truncation repair: close open strings/brackets from a cut-off response,
  //    dropping the last (incomplete) element so we salvage what completed.
  return repairTruncated(slice)
}

// Escape raw control chars (newlines/tabs/CR) that appear INSIDE JSON strings —
// models sometimes emit literal newlines in prose values, which JSON.parse rejects.
function sanitiseControlChars(s) {
  let out = '', inStr = false, esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) { out += c; esc = false; continue }
      if (c === '\\') { out += c; esc = true; continue }
      if (c === '"') { out += c; inStr = false; continue }
      if (c === '\n') { out += '\\n'; continue }
      if (c === '\r') { out += '\\r'; continue }
      if (c === '\t') { out += '\\t'; continue }
      out += c; continue
    }
    if (c === '"') { inStr = true; out += c; continue }
    out += c
  }
  return out
}

// Salvage JSON cut off mid-stream (max_tokens). Strategy: scan char by char
// tracking bracket depth; remember the index after every point where depth
// returns to a 'safe' level (just inside the outermost array). Truncate there,
// then close whatever brackets remain open. Recovers the complete elements.
function repairTruncated(s) {
  let inStr = false, esc = false
  const stack = []                 // current open brackets
  let safeLen = -1                 // length to which we can safely truncate
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
    if (c === '"') { inStr = true; continue }
    if (c === '{' || c === '[') stack.push(c)
    else if (c === '}' || c === ']') {
      stack.pop()
      // after closing an element that sits directly inside the outer array,
      // this is a clean cut point (outer '[' plus maybe an outer '{' wrapper)
      if (stack.length <= 2) safeLen = i + 1
    }
  }
  if (safeLen < 0) throw new Error('unrepairable json')
  let out = s.slice(0, safeLen)
  // recompute what's still open and close it
  const open = []; let is2 = false, e2 = false
  for (let i = 0; i < out.length; i++) { const c = out[i]
    if (is2) { if (e2) e2 = false; else if (c === '\\') e2 = true; else if (c === '"') is2 = false; continue }
    if (c === '"') is2 = true
    else if (c === '{') open.push('}')
    else if (c === '[') open.push(']')
    else if (c === '}' || c === ']') open.pop()
  }
  while (open.length) out += open.pop()
  return JSON.parse(out)
}

export async function aiConfig(db) {
  const rows = await db.select().from(schema.siteSettings)
  const all = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { key: all['secret.anthropicKey'], model: all['ai.model'] }
}

// Prompt Claude, expect JSON, return parsed. maxTokens generous for big lists.
export async function generate(prompt, { maxTokens = 4000 } = {}) {
  const db = getDb()
  const { key, model } = await aiConfig(db)
  if (!key) throw fail(400, 'AI is not configured yet — add your Anthropic key in Admin → AI')
  if (!model) throw fail(400, 'No AI model selected yet')
  const r = await fetch(`${ANTHROPIC}/messages`, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': VERSION, 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!r.ok) throw fail(r.status === 401 ? 400 : 502, `Anthropic: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
  try { return extractJson(text) } catch {
    const hint = j.stop_reason === 'max_tokens'
      ? 'The response was too long and got cut off — try again (fewer items) or regenerate.'
      : 'The model returned an unexpected format — try again'
    throw fail(502, hint)
  }
}

export const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
