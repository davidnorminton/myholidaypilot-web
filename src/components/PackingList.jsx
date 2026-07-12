import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Luggage, Sparkles, RefreshCw, FileDown } from 'lucide-react'
import { api } from '../lib/api.js'
import { dayWeather } from '../lib/weather.js'
import { setPacking, togglePackingItem } from '../lib/trips.js'
import { useFrontendAi, useSettings } from '../lib/settings.js'
import { buildPackingSeed } from '../lib/packingSeed.js'
import { downloadPackingPdf } from '../lib/packingPdf.js'

// AI packing list: reads the trip (dates, places, chosen activities), fetches
// the forecast where available, asks who's travelling, and has Claude draft a
// checklist. The result is stored on the trip, so it syncs and persists.
export default function PackingList({ trip, onClose }) {
  const aiOn = useFrontendAi()
  const site = useSettings()
  const [adults, setAdults] = useState(trip.packing?.adults ?? 2)
  const [children, setChildren] = useState(trip.packing?.children ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const packing = trip.packing

  const summary = useMemo(() => {
    const places = trip.places.map((p) => `${p.name} (${p.regionName || ''})`)
    const activities = trip.places.flatMap((p) => [
      ...(p.attractions || []).map((a) => a.text),
      ...(p.restaurants || []).map((r) => r.name),
    ])
    return { places, activities }
  }, [trip])

  const generate = async () => {
    setBusy(true); setError('')
    try {
      // forecast for each trip day where the anchor place allows it
      let weather = ''
      if (trip.startDate && trip.endDate) {
        const anchor = trip.places.find((p) => p.lat && p.lng)
        if (anchor) {
          const days = []
          for (let d = new Date(trip.startDate + 'T12:00'); ; d.setDate(d.getDate() + 1)) {
            const iso = d.toISOString().slice(0, 10)
            if (iso > trip.endDate) break
            days.push(iso)
          }
          const results = await Promise.all(days.map((date) => dayWeather(anchor.lat, anchor.lng, date).catch(() => null)))
          weather = results.map((w, i) => w ? `${days[i]}: ${w.max}°/${w.min}°C, ${w.label}` : null)
            .filter(Boolean).join('; ')
        }
      }
      const res = await api.ai.packing({
        tripName: trip.name,
        startDate: trip.startDate,
        endDate: trip.endDate || trip.startDate,
        places: summary.places,
        activities: summary.activities,
        adults, children, weather,
      })
      setPacking(trip.id, {
        generatedAt: Date.now(), adults, children, model: res.model,
        categories: res.categories.map((c) => ({
          name: c.name,
          items: (c.items || []).map((text) => ({ text: String(text), done: false })),
        })),
      })
    } catch (e) {
      setError(e.message || 'Could not generate the list')
    } finally { setBusy(false) }
  }

  // Instant list — no AI, no network: climate archetype × month × duration,
  // with the plug type pulled from the country facts when they exist.
  const instant = () => {
    let facts = null
    try { facts = JSON.parse(site[`countryFacts.${trip.countryId}`] || 'null') } catch { /* none */ }
    setPacking(trip.id, {
      generatedAt: Date.now(), adults, children, model: 'instant',
      categories: buildPackingSeed(trip, facts),
    })
  }

  const total = packing ? packing.categories.reduce((n, c) => n + c.items.length, 0) : 0
  const done = packing ? packing.categories.reduce((n, c) => n + c.items.filter((i) => i.done).length, 0) : 0

  return createPortal(
    <div className="pk__backdrop" onClick={onClose}>
      <div className="pk" role="dialog" aria-label="Packing list" onClick={(e) => e.stopPropagation()}>
        <header className="pk__head">
          <h2><Luggage size={19} /> Packing list</h2>
          <button className="pk__x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="pk__setup">
          <p className="pk__context">
            {trip.places.length} destination{trip.places.length === 1 ? '' : 's'} · {summary.activities.length} planned
            activit{summary.activities.length === 1 ? 'y' : 'ies'}{trip.startDate ? ` · ${trip.startDate} → ${trip.endDate || trip.startDate}` : ''}.
            Weather is checked automatically where the forecast reaches.
          </p>
          <div className="pk__who">
            <label>Adults
              <input type="number" min="1" max="12" value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label>Children
              <input type="number" min="0" max="12" value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            {aiOn && <button className="btn btn--primary" onClick={generate} disabled={busy || !trip.startDate || !trip.places.length}>
              {busy ? <><RefreshCw size={15} className="pk__spin" /> Generating list…</>
                : packing ? <><Sparkles size={15} /> Regenerate</>
                : <><Sparkles size={15} /> Generate my list</>}
            </button>}
            <button className="btn btn--soft" onClick={instant} disabled={busy || !trip.startDate}
              title="A sensible checklist built from the season and trip length — works offline">
              <Luggage size={15} /> {packing ? 'Instant list (replace)' : 'Instant list'}
            </button>
          </div>
          {!trip.startDate && <p className="pk__warn">Set your trip dates first — the list depends on them.</p>}
          {error && <p className="pk__warn">{error}</p>}
        </div>

        {packing && (
          <div className="pk__list">
            <div className="pk__listbar">
              <p className="pk__progress">{done} of {total} packed · saved with your trip</p>
              <button className="btn btn--soft pk__pdf" onClick={() => downloadPackingPdf(trip)}>
                <FileDown size={14} /> PDF
              </button>
            </div>
            {packing.categories.map((cat, ci) => (
              <section key={ci} className="pk__cat">
                <h3>{cat.name}</h3>
                <ul>
                  {cat.items.map((it, ii) => (
                    <li key={ii}>
                      <label className={`pk__item ${it.done ? 'is-done' : ''}`}>
                        <input type="checkbox" checked={!!it.done} onChange={() => togglePackingItem(trip.id, ci, ii)} />
                        <span>{it.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
