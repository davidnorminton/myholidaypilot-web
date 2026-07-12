import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Coins, Sparkles, RefreshCw, Pencil } from 'lucide-react'
import { api } from '../lib/api.js'
import { computeBudget, fmtMoney } from '../lib/budget.js'
import { setBudget, setBudgetOverride, setTravellers } from '../lib/trips.js'
import { useFrontendAi } from '../lib/settings.js'
import { COUNTRIES } from '../lib/countries.js'

const STYLES = [
  { id: 'budget', label: 'Budget' },
  { id: 'mid-range', label: 'Mid-range' },
  { id: 'comfort', label: 'Comfort' },
]

// AI budget: Claude estimates the *rates* (per night, per person, per day,
// each as a low–high range); computeBudget does the arithmetic. Every line
// is editable — a typed value replaces the estimate and totals recompute
// instantly, no second API call.
export default function BudgetPanel({ trip, onClose, inline = false }) {
  const aiOn = useFrontendAi()
  const saved = trip.budget
  const [adults, setAdults] = useState(trip.travellers?.adults ?? saved?.inputs?.adults ?? trip.packing?.adults ?? 2)
  const [children, setChildren] = useState(trip.travellers?.children ?? saved?.inputs?.children ?? trip.packing?.children ?? 0)
  // Travellers are shared with the packing list — remember on the trip itself.
  const updAdults = (v) => { setAdults(v); setTravellers(trip.id, { adults: v, children }) }
  const updChildren = (v) => { setChildren(v); setTravellers(trip.id, { adults, children: v }) }
  const [style, setStyle] = useState(saved?.inputs?.style ?? 'mid-range')
  const [includeFlights, setIncludeFlights] = useState(saved?.inputs?.includeFlights ?? false)
  const [flyingFrom, setFlyingFrom] = useState(saved?.inputs?.flyingFrom ?? '')
  const [includeCar, setIncludeCar] = useState(saved?.inputs?.includeCar ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)

  const nights = useMemo(() => {
    if (!trip.startDate || !trip.endDate) return 1
    return Math.max(1, Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000))
  }, [trip.startDate, trip.endDate])

  const currency = 'EUR'   // per-country later; every live destination is EUR today
  const countryName = (COUNTRIES.find((c) => c.slug === (trip.countryId || 'italy')) || {}).name || ''

  const generate = async () => {
    setBusy(true); setError('')
    try {
      const activities = trip.places.flatMap((p) => (p.attractions || []).map((a) => a.text))
      const restaurants = trip.places.flatMap((p) => (p.restaurants || []).map((r) => r.name))
      const res = await api.ai.budget({
        tripName: trip.name, startDate: trip.startDate, endDate: trip.endDate || trip.startDate,
        nights, places: trip.places.map((p) => `${p.name}, ${p.regionName || countryName}`),
        activities, restaurants, adults, children, style,
        includeFlights, flyingFrom, includeCar, currency,
      })
      setBudget(trip.id, {
        generatedAt: Date.now(), model: res.model, currency,
        rates: res.rates,
        inputs: { adults, children, style, includeFlights, flyingFrom, includeCar, nights, rooms: Math.max(1, Math.ceil(adults / 2)) },
        overrides: {},
      })
    } catch (e) {
      setError(e.message || 'Could not estimate the budget')
    } finally { setBusy(false) }
  }

  const totals = useMemo(() => {
    if (!saved?.rates) return null
    return computeBudget(saved.rates, { ...saved.inputs, adults, children, nights, includeFlights, includeCar }, saved.overrides || {})
  }, [saved, adults, children, nights, includeFlights, includeCar])

  const editLine = (key, current) => setEditing({ key, value: current })
  const commitEdit = () => {
    if (editing) setBudgetOverride(trip.id, editing.key, editing.value)
    setEditing(null)
  }

  const body = (
      <div className={`pk bgt ${inline ? 'pk--inline' : ''}`} role={inline ? undefined : 'dialog'} aria-label="Trip budget" onClick={(e) => e.stopPropagation()}>
        <header className="pk__head">
          <h2><Coins size={19} /> Trip budget</h2>
          {!inline && <button className="pk__x" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </header>

        <div className="pk__setup">
          <div className="gq__chips" style={{ marginBottom: 12 }}>
            {STYLES.map((s) => (
              <button key={s.id} className={`gq__chip ${style === s.id ? 'is-on' : ''}`} onClick={() => setStyle(s.id)}>{s.label}</button>
            ))}
          </div>
          <div className="pk__who">
            <label>Adults
              <input type="number" min="1" max="12" value={adults} onChange={(e) => updAdults(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label>Children
              <input type="number" min="0" max="12" value={children} onChange={(e) => updChildren(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="bgt__toggle">
              <input type="checkbox" checked={includeFlights} onChange={(e) => setIncludeFlights(e.target.checked)} /> Flights
            </label>
            {includeFlights && (
              <label>From
                <input type="text" className="bgt__from" placeholder="e.g. London" value={flyingFrom} onChange={(e) => setFlyingFrom(e.target.value)} />
              </label>
            )}
            <label className="bgt__toggle">
              <input type="checkbox" checked={includeCar} onChange={(e) => setIncludeCar(e.target.checked)} /> Car rental
            </label>
          </div>
          <div className="pk__who" style={{ marginTop: 12 }}>
            {aiOn && <button className="btn btn--primary" onClick={generate} disabled={busy || !trip.startDate || !trip.places.length}>
              {busy ? <><RefreshCw size={15} className="pk__spin" /> Estimating…</>
                : saved ? <><Sparkles size={15} /> Re-estimate</>
                : <><Sparkles size={15} /> Estimate my budget</>}
            </button>}
          </div>
          {!trip.startDate && <p className="pk__warn">Set your trip dates first — the budget depends on them.</p>}
          {error && <p className="pk__warn">{error}</p>}
        </div>

        {totals && (
          <div className="pk__list">
            <div className="bgt__total">
              <b>{fmtMoney(totals.low, currency)} – {fmtMoney(totals.high, currency)}</b>
              <span>≈ {fmtMoney(totals.perPersonDayLow, currency)}–{fmtMoney(totals.perPersonDayHigh, currency)} per person per day</span>
            </div>
            <table className="bgt__table">
              <tbody>
                {totals.lines.map((l) => (
                  <tr key={l.key} className={l.overridden ? 'is-fixed' : ''}>
                    <td>
                      <b>{l.label}</b>
                      <span className="bgt__detail">{l.detail}{l.note ? ` · ${l.note}` : ''}</span>
                    </td>
                    <td className="bgt__amount">
                      {editing?.key === l.key ? (
                        <input autoFocus type="number" min="0" value={editing.value}
                          onChange={(e) => setEditing({ key: l.key, value: e.target.value })}
                          onBlur={commitEdit} onKeyDown={(e) => e.key === 'Enter' && commitEdit()} />
                      ) : (
                        <button className="bgt__edit" title={l.overridden ? 'Your figure — tap to change (clear to restore estimate)' : 'Tap to use your own figure'}
                          onClick={() => editLine(l.key, l.overridden ? l.low : Math.round((l.low + l.high) / 2))}>
                          {l.overridden ? fmtMoney(l.low, currency) : `${fmtMoney(l.low, currency)}–${fmtMoney(l.high, currency)}`}
                          <Pencil size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="bgt__disc">
              Estimates, not quotes — prices vary. Tap any figure to use your own.
            </p>
          </div>
        )}
      </div>
  )
  if (inline) return body
  return createPortal(<div className="pk__backdrop" onClick={onClose}>{body}</div>, document.body)
}
