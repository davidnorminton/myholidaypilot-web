import { useState } from 'react'
import { Sparkles, RefreshCw, X, Feather } from 'lucide-react'
import { api } from '../lib/api.js'
import { setStory } from '../lib/trips.js'

// The trip narrator: one Claude call turns the planned days into a short
// magazine-style overview, stored on the trip (and carried by share links
// and the PDF). Editable only by regenerating — it narrates the plan as-is.
export default function TripStory({ trip, readOnly = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const story = trip.story

  const generate = async () => {
    setBusy(true); setError('')
    try {
      // one summary line per day: places + a few picks + the stay
      const byDate = new Map()
      for (const p of trip.places) {
        if (!p.date) continue
        if (!byDate.has(p.date)) byDate.set(p.date, [])
        byDate.get(p.date).push(p)
      }
      const days = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, places]) => {
        const bits = places.map((p) => {
          const picks = [
            ...(p.attractions || []).slice(0, 2).map((a) => a.text),
            ...(p.restaurants || []).slice(0, 1).map((r) => r.mustOrder ? `${r.name} (${r.mustOrder})` : r.name),
          ]
          return `${p.name}${picks.length ? ` — ${picks.join(', ')}` : ''}`
        })
        const stay = (trip.stays || []).find((s) => s.from && date >= s.from && date <= (s.to || s.from))
        return { date, summary: bits.join(' · ') + (stay ? ` · staying at ${stay.name}` : '') }
      })
      const res = await api.ai.narrate({
        tripName: trip.name, startDate: trip.startDate, endDate: trip.endDate || trip.startDate, days,
      })
      setStory(trip.id, { text: res.story, generatedAt: Date.now(), model: res.model })
    } catch (e) {
      setError(e.message || 'Could not write the story')
    } finally { setBusy(false) }
  }

  if (!story && readOnly) return null

  if (!story) {
    return (
      <div className="story story--empty">
        <button className="story__cta" onClick={generate} disabled={busy || !trip.startDate || !trip.places.some((p) => p.date)}>
          {busy ? <><RefreshCw size={15} className="pk__spin" /> Writing…</> : <><Feather size={15} /> Tell this trip as a story</>}
        </button>
        {error && <p className="pk__warn">{error}</p>}
      </div>
    )
  }

  return (
    <div className="story">
      <p className="story__text">{story.text}</p>
      {!readOnly && (
        <div className="story__bar">
          <span className="story__meta">Written from your plan</span>
          <button className="story__act" onClick={generate} disabled={busy} title="Rewrite from the current plan">
            <RefreshCw size={13} className={busy ? 'pk__spin' : ''} /> {busy ? 'Rewriting…' : 'Rewrite'}
          </button>
          <button className="story__act" onClick={() => setStory(trip.id, null)} title="Remove the story">
            <X size={13} /> Remove
          </button>
        </div>
      )}
      {error && <p className="pk__warn">{error}</p>}
    </div>
  )
}
