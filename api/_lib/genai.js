// Shared Claude call for the country builder. Reads the site AI config,
// prompts for strict JSON, and returns the parsed object.
import { getDb, schema } from './db.js'
import { fail } from './util.js'

const ANTHROPIC = 'https://api.anthropic.com/v1'
const VERSION = '2023-06-01'

export function extractJson(text) {
  const cleaned = String(text).replace(/```json|```/g, '')
  const a = cleaned.indexOf('{'), b = cleaned.lastIndexOf('}')
  const la = cleaned.indexOf('['), lb = cleaned.lastIndexOf(']')
  // support a top-level array too
  if (la >= 0 && (a < 0 || la < a)) return JSON.parse(cleaned.slice(la, lb + 1))
  if (a < 0 || b <= a) throw new Error('no json')
  return JSON.parse(cleaned.slice(a, b + 1))
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
  try { return extractJson(text) } catch { throw fail(502, 'The model returned an unexpected format — try again') }
}

export const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
