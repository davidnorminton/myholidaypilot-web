// Backfill Unsplash photographer profiles onto existing images.
//
// WHY: images picked before this change stored only the photographer's display
// name ("Mimmo Sigismondi"). The Unsplash API Terms want a link to that
// photographer's *profile*, which needs their username — so old records can't be
// attributed compliantly until they're resolved.
//
// Do NOT try to derive the username from the display name. Measured against the
// ~98 credits that embed a real one, lowercasing and stripping spaces is right
// 20% of the time: "Lukas Tennie" is @luk10, "Caleb Miller" is @milljestic, and
// a guess like "Ryan" -> @ryan lands on a real but *different* photographer.
//
// TWO PASSES:
//   1. Free. Many credits were saved with Unsplash's attribution pasted in
//      ("Photo by Alain ROUILLER (unsplash.com/@alainr)") — the username is
//      right there. No API, no limit, no risk. ~70% of records.
//   2. API. An images.unsplash.com URL doesn't expose the API's photo id and
//      there's no public endpoint to map one to the other — but the URL's ixid
//      encodes the exact search query that found it. Re-run that search and match
//      the hit whose urls.raw has the same photo path. Falls back to the place's
//      stored imageQueries.
//
// RESUMING: progress is the data. Every resolve is written immediately and the
// work list is derived from "no creditUsername yet", so re-running just picks up
// where it stopped — no checkpoint file to lose. Failures are remembered too
// (creditLookupFailedAt), so a photo Unsplash can no longer find doesn't burn
// quota again on every run; --retry-failed reconsiders them.
//
// RATE LIMITS: Unsplash is 50 req/hour on a demo app, 5000 once approved for
// production. Each API-path image costs 1-3 searches. We read the quota straight
// off Unsplash's X-Ratelimit-Remaining header and stop cleanly with a reserve
// left, rather than blundering into a 429.
//
// Usage:
//   node scripts/backfill-credits.mjs --dry-run       # report only, no writes
//   node scripts/backfill-credits.mjs --free-only     # pass 1 only, zero API calls
//   node scripts/backfill-credits.mjs                 # both passes
//   node scripts/backfill-credits.mjs --limit 40      # cap API CALLS (not images)
//   node scripts/backfill-credits.mjs --retry-failed  # reconsider past failures
//   node scripts/backfill-credits.mjs --watch         # grind unattended until done
//
// WHERE TO RUN: from your machine, pointed at Turso — NOT on Vercel. It's a
// long, rate-limited, resumable maintenance job; serverless functions cap out
// long before it finishes. Nothing needs deploying afterwards either: /api/images
// reads build_places live, so the moment Turso has the profiles the site serves
// them. Re-export only matters for the static images.json fallback.
//
//   DATABASE_URL="libsql://<db>.turso.io" DATABASE_AUTH_TOKEN="<token>" \
//     node scripts/backfill-credits.mjs --dry-run --free-only
//
// Needs DATABASE_URL (+ DATABASE_AUTH_TOKEN for Turso), and the Unsplash key
// from site_settings (secret.unsplashKey). Guards against writing to local.db
// by accident — pass --local if that's genuinely what you want.

import 'dotenv/config'
import { getDb } from '../db/client.js'
import * as schema from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
// Shared with the admin tool (api/_lib/builder/scan.js) so the two can't drift.
import { isUnsplashUrl, fromCreditString, resolveCredit, RESERVE } from '../api/_lib/unsplash.js'

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const val = (f) => {
  const i = args.findIndex((a) => a === f || a.startsWith(`${f}=`))
  if (i < 0) return null
  const a = args[i]
  return a.includes('=') ? a.split('=')[1] : args[i + 1]
}
const DRY = has('--dry-run')
const FREE_ONLY = has('--free-only')
const RETRY_FAILED = has('--retry-failed')
// Unattended grinding. On a demo app (50 requests/hour) a few thousand images is
// days of work — nobody should sit clicking a button for that. --watch does a
// pass, sleeps until the quota rolls over, and goes again until it's done.
// Progress is the data, so killing it at any point loses nothing.
const WATCH = has('--watch')
const LIMIT = Number(val('--limit')) || Infinity   // API calls, not images

const db = getDb()
let quotaLeft = Infinity   // filled in by pass 2 from Unsplash's own header

// Which database are we actually about to write to? dotenv does not override
// variables already in the environment, so an inline DATABASE_URL=... wins over
// .env — but if you forget it, .env's file:./local.db wins silently and this
// "succeeds" against the wrong database. Say it out loud every run.
const TARGET = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || 'file:./local.db'
const isLocalFile = TARGET.startsWith('file:')
console.log(`database: ${TARGET.replace(/(libsql:\/\/[^.]{0,6})[^.]*/, '$1…')}${isLocalFile ? '  (LOCAL FILE — not Turso)' : '  (remote)'}`)
if (isLocalFile && !has('--local')) {
  console.log('\nThis is your local SQLite file, not production. The credits your live site')
  console.log('serves come from Turso via /api/images. To backfill production:')
  console.log('\n  DATABASE_URL="libsql://<db>.turso.io" DATABASE_AUTH_TOKEN="<token>" \\')
  console.log('    node scripts/backfill-credits.mjs --dry-run --free-only\n')
  console.log('Pass --local if you really do mean local.db.')
  process.exit(1)
}

// ── helpers ─────────────────────────────────────────────────────────────────
const label = (p) => `${p.countryId}/${p.regionId}/${p.placeId}`
const save = (p, fields) => db.update(schema.buildPlaces)
  .set({ image: { ...p.image, ...fields }, updatedAt: Date.now() })
  .where(and(eq(schema.buildPlaces.countryId, p.countryId),
    eq(schema.buildPlaces.regionId, p.regionId), eq(schema.buildPlaces.placeId, p.placeId)))

// ── run ─────────────────────────────────────────────────────────────────────
const places = await db.select().from(schema.buildPlaces)
const unsplash = places.filter((p) => isUnsplashUrl(p.image?.url))
const missing = unsplash.filter((p) => !p.image?.creditUsername)

console.log(`${places.length} places · ${unsplash.length} Unsplash images · ${missing.length} without a profile`)
if (DRY) console.log('(dry run — nothing will be written)')

// ── pass 1: free, unlimited ─────────────────────────────────────────────────
let free = 0
for (const p of missing) {
  const got = fromCreditString(p.image?.credit)
  if (!got) continue
  free++
  console.log(`  ✓ ${label(p)} → @${got.creditUsername}  (embedded in credit)`)
  if (!DRY) await save(p, { ...got, creditLookupFailedAt: null })
  p.image = { ...p.image, ...got }   // so pass 2 skips it
}
console.log(`\npass 1 (free): resolved ${free}`)

// ── pass 2: API, budgeted ───────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rest = missing.filter((p) => !p.image?.creditUsername)
const skipped = RETRY_FAILED ? [] : rest.filter((p) => p.image?.creditLookupFailedAt)
const queue = RETRY_FAILED ? rest : rest.filter((p) => !p.image?.creditLookupFailedAt)

if (FREE_ONLY) {
  console.log(`pass 2 skipped (--free-only) — ${rest.length} still need an API lookup`)
} else if (!queue.length) {
  console.log(`pass 2: nothing to do${skipped.length ? ` (${skipped.length} previously failed — --retry-failed to reconsider)` : ''}`)
} else {
  const settings = await db.select().from(schema.siteSettings)
  const key = Object.fromEntries(settings.map((r) => [r.key, r.value]))['secret.unsplashKey']
  if (!key) { console.error('\nNo secret.unsplashKey in site_settings — set it in Admin → AI first.'); process.exit(1) }

  console.log(`pass 2 (API): ${queue.length} to look up${skipped.length ? `, ${skipped.length} skipped as previously failed` : ''}`)
  const budget = { calls: 0, maxCalls: LIMIT, remaining: Infinity }
  let done = 0, failed = 0, stopped = '', errs = 0
  for (const p of queue) {
    if (budget.calls >= budget.maxCalls) { stopped = `--limit ${LIMIT} reached`; break }
    if (budget.remaining <= RESERVE) { stopped = 'Unsplash quota exhausted'; break }
    let got = null
    try {
      got = await resolveCredit(p.image, p.data?.imageQueries, key, budget)
      errs = 0
    } catch (e) {
      const m = String(e.message)
      if (m === 'BAD_KEY') {
        console.error('\nUnsplash rejected the Access Key (HTTP 401).')
        console.error('Check secret.unsplashKey in Admin → AI. It must be the Access Key from')
        console.error('unsplash.com/oauth/applications — not the Secret Key.')
        process.exit(1)
      }
      if (m === 'QUOTA') { stopped = 'Unsplash quota spent'; break }
      if (m === 'BUDGET') { stopped = 'budget reached'; break }
      if (m === 'RATE_LIMIT') { stopped = 'Unsplash returned 429'; break }
      // Transient: do NOT mark the image as gone — a network blip would
      // otherwise condemn a good photo to being skipped on every future run.
      console.warn(`  ! ${label(p)}: ${m}`)
      if (++errs >= 3) { stopped = `Unsplash keeps erroring (${m})`; break }
      continue
    }
    if (got) {
      done++
      const { _via, ...fields } = got
      console.log(`  ✓ ${label(p)} → @${fields.creditUsername}  (${_via})`)
      if (!DRY) await save(p, fields)
    } else {
      failed++
      console.log(`  – ${label(p)}: no match`)
      // Remember it, so the next run doesn't spend quota failing again.
      if (!DRY) await save(p, { creditLookupFailedAt: Date.now() })
    }
  }
  quotaLeft = budget.remaining
  console.log(`\npass 2: resolved ${done} · unmatched ${failed} · api calls ${budget.calls}`)
  if (stopped) console.log(`stopped: ${stopped} — re-run to continue where this left off`)
}

// ── unattended: sleep out the rate limit and go again ───────────────────────
if (WATCH && !DRY && !FREE_ONLY) {
  for (;;) {
    const left = (await db.select().from(schema.buildPlaces))
      .filter((p) => isUnsplashUrl(p.image?.url) && !p.image?.creditUsername && !p.image?.creditLookupFailedAt)
    if (!left.length) { console.log('\nwatch: nothing left to look up — done.'); break }
    const mins = 61
    console.log(`\nwatch: ${left.length} still to do. Sleeping ${mins} min for the quota to roll over…`)
    console.log(`       (safe to Ctrl-C — everything resolved so far is saved)`)
    await sleep(mins * 60 * 1000)
    console.log(`\nwatch: resuming ${new Date().toLocaleTimeString()}`)
    const { spawnSync } = await import('node:child_process')
    const r = spawnSync(process.execPath, [process.argv[1], ...args.filter((a) => a !== '--watch')],
      { stdio: 'inherit', env: process.env })
    if (r.status !== 0) { console.error('watch: pass failed — stopping.'); break }
  }
}

// ── where we are ────────────────────────────────────────────────────────────
const after = await db.select().from(schema.buildPlaces)
const left = after.filter((p) => isUnsplashUrl(p.image?.url) && !p.image?.creditUsername)
const permanent = left.filter((p) => p.image?.creditLookupFailedAt)
console.log(`\n── remaining: ${left.length} of ${unsplash.length} images still without a profile`)
if (Number.isFinite(quotaLeft)) console.log(`   unsplash quota left this hour: ${quotaLeft}`)
if (permanent.length) {
  console.log(`   ${permanent.length} of those are marked unmatched — Unsplash no longer returns them for their`)
  console.log('   original query. Re-pick in Admin → Images (which now stores the profile), or --retry-failed.')
}
if (!DRY && left.length < unsplash.length) {
  console.log('\nNext: re-export the affected countries and re-import so the public JSON carries the profiles.')
}
