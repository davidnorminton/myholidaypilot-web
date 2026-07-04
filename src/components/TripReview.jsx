import { useState } from 'react'
import { Stethoscope, RefreshCw, X, AlertTriangle, Lightbulb, ThumbsUp } from 'lucide-react'
import { api } from '../lib/api.js'
import { setReview } from '../lib/trips.js'
import { kmBetween } from '../lib/route.js'

const ICON = { warn: AlertTriangle, tip: Lightbulb, good: ThumbsUp }

// One click: Claude reads the trip's actual shape (per-day load, weekdays,
// rough driving distance) and flags what a good travel agent would.
export default function TripReview({ trip }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const review = trip.review

  const generate = async () => {
    setBusy(true); setError('')
    try {
      const byDate = new Map()
      for (const p of trip.places) {
        if (!p.date) continue
        if (!byDate.has(p.date)) byDate.set(p.date, [])
        byDate.get(p.date).push(p)
      }
      const dates = [...byDate.keys()].sort()
      const days = dates.map((date, i) => {
        const places = byDate.get(date)
        let km = 0
        for (let j = 1; j < places.length; j++) {
          if (places[j - 1].lat && places[j].lat) km += kmBetween(places[j - 1], places[j])
        }
        const picks = places.flatMap((p) => [
          ...(p.attractions || []).filter((a) => a.date === date).map((a) => a.text),
          ...(p.restaurants || []).filter((r) => r.date === date).map((r) => `eat at ${r.name}`),
        ])
        return {
          n: i + 1,
          weekday: new Date(date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long' }),
          km: Math.round(km) || undefined,
          summary: places.map((p) => p.name).join(', ') + (picks.length ? ` — ${picks.slice(0, 6).join('; ')}` : ' — nothing picked yet'),
        }
      })
      const res = await api.ai.review({
        tripName: trip.name, startDate: trip.startDate, endDate: trip.endDate || trip.startDate,
        adults: trip.packing?.adults ?? 2, children: trip.packing?.children ?? 0, days,
      })
      setReview(trip.id, { observations: res.observations, generatedAt: Date.now() })
    } catch (e) {
      setError(e.message || 'Could not review the plan')
    } finally { setBusy(false) }
  }

  if (!review) {
    return (
      <div className="rvw rvw--empty">
        <button className="story__cta" onClick={generate} disabled={busy || !trip.places.some((p) => p.date)}>
          {busy ? <><RefreshCw size={15} className="pk__spin" /> Reviewing…</> : <><Stethoscope size={15} /> Sense-check my plan</>}
        </button>
        {error && <p className="pk__warn">{error}</p>}
      </div>
    )
  }

  return (
    <div className="rvw">
      <div className="rvw__head">
        <h3><Stethoscope size={15} /> Plan check</h3>
        <button className="story__act" onClick={generate} disabled={busy}>
          <RefreshCw size={13} className={busy ? 'pk__spin' : ''} /> {busy ? 'Reviewing…' : 'Re-check'}
        </button>
        <button className="story__act" onClick={() => setReview(trip.id, null)}><X size={13} /> Dismiss</button>
      </div>
      <ul className="rvw__list">
        {review.observations.map((o, i) => {
          const I = ICON[o.severity] || Lightbulb
          return (
            <li key={i} className={`rvw__item is-${o.severity}`}>
              <I size={14} /> <span>{o.day ? <b>Day {o.day} · </b> : null}{o.text}</span>
            </li>
          )
        })}
      </ul>
      {error && <p className="pk__warn">{error}</p>}
    </div>
  )
}
