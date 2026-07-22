import { useState, useRef } from 'react'
import { ScanSearch, Camera, Zap, RefreshCw, Square, AlertTriangle, Plug } from 'lucide-react'
import { api } from '../../lib/api.js'

// Photo credits — Unsplash attribution coverage across the builder.
//
// Our images come from the Unsplash API, whose Terms require the photographer
// credited with a link to their *profile* wherever a photo is shown. That needs
// their username, and images picked before we captured it stored only a display
// name. This finds those and repairs them.
//
// Two repair paths, and deliberately no third: never derive a username from the
// display name. Measured against the credits that embed a real one, guessing is
// right 20% of the time and lands on real-but-wrong photographers.
//   · Free  — the username is already inside the credit string for many records
//             ("Photo by Alain ROUILLER (unsplash.com/@alainr)"). No API calls.
//   · Look up — re-runs each image's original search (recovered from the URL's
//             ixid) and matches on photo path.
//
// The lookup is batched on purpose: Unsplash allows 50 requests/hour on a demo
// app (5000 once approved) and each image costs 1-3 searches, while the function
// itself has a 120s ceiling. So we loop small batches client-side, showing
// progress, and every hit is saved as it happens — stopping at any point just
// resumes next time.
const BATCH_CALLS = 12

function Stat({ label, value, tone = '' }) {
  return (
    <div className={`credit-stat ${tone ? `credit-stat--${tone}` : ''}`}>
      <span className="credit-stat__n">{value}</span>
      <span className="credit-stat__l">{label}</span>
    </div>
  )
}

export default function AdminCredits() {
  const [state, setState] = useState('idle')     // idle | scanning | fixing | error
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [log, setLog] = useState([])
  const stopRef = useRef(false)

  // One request with the key that's actually saved, reporting exactly what came
  // back. Diagnosing this by hand meant copying the key into a curl, and a
  // mistyped one 401s and looks identical to a broken app — which cost us a day.
  const ping = async () => {
    setState('scanning'); setError(''); setLog([])
    try {
      const r = await api.builder.creditPing()
      if (r.reason) { say(r.reason); setState('idle'); return }
      say(`Key ends …${r.keyTail} (${r.keyLength} chars)`)
      for (const p of r.probes || []) {
        if (p.error) { say(`  /${p.path}: ${p.error}`); continue }
        const quota = p.limit ? `${p.remaining}/${p.limit} left this hour` : 'no rate-limit headers'
        say(`  /${p.path}: HTTP ${p.status} · ${quota}`)
        if (p.body) say(`      ${p.body}`)
        // No headers at all means the request never reached the quota — it was
        // rejected. Not the same thing as being out, though it looks identical
        // from the outside.
        if (!p.limit && p.status === 401) say('      key rejected — this is not a quota problem')
      }
      if (r.separateBuckets) {
        say('')
        say('  These two endpoints have DIFFERENT quotas left — they are separate buckets.')
        say('  Look up spends /search/users first, so that one drains while photos looks fine.')
      }
    } catch (e) { setError(e.message || 'Test failed') }
    setState('idle')
  }

  const scan = async () => {
    setState('scanning'); setError('')
    try {
      setData(await api.builder.creditScan())
      setState('idle')
    } catch (e) { setError(e.message || 'Scan failed'); setState('error') }
  }

  const say = (m) => setLog((l) => [...l.slice(-40), m])

  const fixFree = async () => {
    setState('fixing'); setError(''); setLog([])
    try {
      const r = await api.builder.creditFix('free', 0)
      say(`Free pass: ${r.fixed} credited with no API calls · ${r.remaining} still need a lookup`)
      setData(await api.builder.creditScan())
    } catch (e) { setError(e.message || 'Fix failed') }
    setState('idle')
  }

  // Wait out an empty quota window without losing the run. Ticks once a second
  // so Stop stays responsive; returns false if the user stopped meanwhile.
  const waitOut = async (mins) => {
    for (let i = mins * 60; i > 0; i--) {
      if (stopRef.current) return false
      await new Promise((res) => setTimeout(res, 1000))
    }
    return true
  }

  // Loop batches until every image is credited or the user stops. The demo tier
  // is a rolling window — requests age out continuously and the builder competes
  // for the same pot — so an empty reading isn't the end, it's a pause: wait a
  // few minutes and harvest whatever trickled back. One click, runs to done.
  const fixApi = async (retryFailed = false) => {
    setState('fixing'); setError(''); setLog([]); stopRef.current = false
    let total = 0, misses = 0, waits = 0
    try {
      for (;;) {
        if (stopRef.current) { say('Stopped.'); break }
        const r = await api.builder.creditFix('api', BATCH_CALLS, retryFailed)
        total += r.fixed; misses += r.failed
        // Say what Unsplash actually returned. "quota spent" on its own sent us
        // round in circles for a day — the useful facts are the plan's limit
        // (50 = demo, 5000 = production) and the HTTP status behind a failure.
        const quota = r.quotaRemaining != null
          ? ` · ${r.quotaRemaining}${r.quotaLimit ? '/' + r.quotaLimit : ''} requests left this hour`
          : ''
        say(`Batch: +${r.fixed} credited, ${r.failed} not found (${r.calls} API calls)${quota}`)
        // The decisive line: what the batch's FIRST response reported. If this
        // is already ~2, the pot was empty before we spent a single call —
        // something else on this key consumed it.
        if (r.firstRemaining != null) say(`  first call saw ${r.firstRemaining} remaining — pot state before this batch spent anything`)
        if (r.stopped === 'BAD_KEY') { setError('Unsplash rejected your Access Key (401). Fix it in Admin → AI.'); break }
        if (r.lastStatus && r.lastStatus !== 200) say(`  Unsplash replied HTTP ${r.lastStatus}${r.lastError ? ` — ${r.lastError}` : ''}`)
        if (r.quotaLimit && r.quotaLimit <= 50) {
          say(`  Your app is on the DEMO tier (${r.quotaLimit}/hour). ${r.remaining} images needs `
            + `~${Math.ceil(r.remaining / r.quotaLimit)}h of quota — apply for production access (5000/hour).`)
        }
        if (r.remaining === 0) { say('All images credited. 🎉'); break }
        const quotaSpent = (r.quotaRemaining != null && r.quotaRemaining <= 2)
          || (r.stopped && (r.stopped.includes('quota') || r.stopped.includes('429')))
        if (quotaSpent) {
          // A rolling window: requests age out continuously, so quota reappears
          // in trickles rather than on the hour. Wait a few minutes and go
          // again — the run persists until the work is done or you press Stop.
          waits++
          say(`Quota window empty (${r.remaining} images to go) — waiting 5 min, then continuing. Stop any time; progress is saved.`)
          if (!(await waitOut(5))) break
          say('Retrying…')
          continue
        }
        if (r.fixed === 0 && r.failed === 0) { say(r.stopped || 'Nothing left this pass.'); break }
      }
      say(`Done this session: ${total} credited, ${misses} unmatched.`)
      setData(await api.builder.creditScan())
    } catch (e) { setError(e.message || 'Lookup failed') }
    setState('idle')
  }

  const t = data?.totals
  const busy = state === 'scanning' || state === 'fixing'

  return (
    <div className="cms">
      <div className="cms-sec__head">
        <h3>Photo credits</h3>
        <span className="credit-head-actions">
          <button className="cms-add" onClick={ping} disabled={busy}>
            <Plug size={15} /> Test Unsplash
          </button>
          <button className="cms-add" onClick={scan} disabled={busy}>
            <ScanSearch size={15} /> {state === 'scanning' ? 'Scanning…' : data ? 'Rescan' : 'Run scan'}
          </button>
        </span>
      </div>
      <p className="admin-note">
        Unsplash's API terms require every photo we show to credit the photographer and link to
        their profile. That needs their username — images picked before we started saving it have
        only a name. <strong>Free</strong> costs no API calls: it reads usernames already sitting in
        the credit text, and reuses any photographer we've already identified on another photo.{' '}
        <strong>Look up</strong> asks Unsplash who the photographer is by name — one call settles
        every photo of theirs — and only falls back to re-running an image's original photo search
        when the name is ambiguous or missing. It's rate limited, so it runs in batches and saves as
        it goes: stop any time and pick up later.
      </p>

      {error && <p className="admin-empty">{error}</p>}

      {t && (
        <>
          <div className="credit-stats">
            <Stat label="Unsplash images" value={t.total} />
            <Stat label="Credited" value={t.ok} tone={t.ok === t.total ? 'good' : ''} />
            <Stat label="Fixable free" value={t.free} tone={t.free ? 'good' : ''} />
            <Stat label="Need a lookup" value={t.api} tone={t.api ? 'warn' : ''} />
            <Stat label="Not found" value={t.failed} tone={t.failed ? 'bad' : ''} />
          </div>

          <div className="credit-actions">
            <button className="btn btn--soft" onClick={fixFree} disabled={busy || !t.free}>
              <Zap size={14} /> Fix {t.free} free
            </button>
            <button className="btn btn--soft" onClick={() => fixApi(false)} disabled={busy || !t.api}>
              <Camera size={14} /> Look up {t.api} via Unsplash
            </button>
            {!!t.failed && (
              <button className="btn btn--soft" onClick={() => fixApi(true)} disabled={busy}>
                <RefreshCw size={14} /> Retry {t.failed} not found
              </button>
            )}
            {state === 'fixing' && (
              <button className="btn btn--soft" onClick={() => { stopRef.current = true }}>
                <Square size={14} /> Stop
              </button>
            )}
          </div>

          {!!t.failed && (
            <p className="admin-note credit-warn">
              <AlertTriangle size={14} /> {t.failed} image{t.failed === 1 ? '' : 's'} can't be matched — Unsplash
              no longer returns them for their original search. Re-pick them in Missing images
              (choosing a photo now saves the profile automatically).
            </p>
          )}

          {!!log.length && (
            <pre className="credit-log">{log.join('\n')}</pre>
          )}

          {data.countries.map((c) => (
            <section key={c.countryId} className="cms-sec">
              <div className="cms-sec__head">
                <h3>
                  {c.flag ? `${c.flag} ` : ''}{c.name}{' '}
                  <span className="scan__count">
                    {c.ok}/{c.total} credited
                  </span>
                </h3>
              </div>
              <div className="credit-bar" title={`${c.ok} credited · ${c.free} free · ${c.api} lookup · ${c.failed} not found`}>
                <span className="credit-bar__seg credit-bar__seg--ok" style={{ width: `${(c.ok / c.total) * 100}%` }} />
                <span className="credit-bar__seg credit-bar__seg--free" style={{ width: `${(c.free / c.total) * 100}%` }} />
                <span className="credit-bar__seg credit-bar__seg--api" style={{ width: `${(c.api / c.total) * 100}%` }} />
                <span className="credit-bar__seg credit-bar__seg--bad" style={{ width: `${(c.failed / c.total) * 100}%` }} />
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}