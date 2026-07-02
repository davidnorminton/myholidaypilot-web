import { Check, Circle } from 'lucide-react'

// A gentle checklist strip: what the trip still needs before it's ready.
export default function TripReadiness({ trip }) {
  if (!trip.places.length) return null

  const itemDay = (x, p) => (x.date === undefined ? (p.date || '') : (x.date || ''))
  const datesSet = !!(trip.startDate && trip.endDate)
  const undated = trip.places.filter((p) => !p.date).length
  const allDated = datesSet && undated === 0

  let hungryDays = 0
  if (datesSet) {
    const dayKeys = new Set(trip.places.map((p) => p.date).filter(Boolean))
    for (const day of dayKeys) {
      const eats = trip.places.some((p) => (p.restaurants || []).some((r) => itemDay(r, p) === day))
      if (!eats) hungryDays++
    }
  }

  let uncoveredNights = 0
  if (datesSet) {
    const stays = trip.stays || []
    for (let d = new Date(trip.startDate + 'T12:00'); ; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10)
      if (iso > trip.endDate) break
      if (!stays.some((s) => s.from && s.to && s.from <= iso && iso <= s.to)) uncoveredNights++
    }
  }

  const checks = [
    { ok: datesSet, label: datesSet ? 'Dates set' : 'Set your dates' },
    { ok: datesSet && uncoveredNights === 0, label: !datesSet ? 'Add where you\'re staying' : uncoveredNights === 0 ? 'Every night has a stay' : `${uncoveredNights} night${uncoveredNights === 1 ? '' : 's'} without a stay` },
    { ok: allDated, label: allDated ? 'Every place has a day' : datesSet ? `${undated} place${undated === 1 ? '' : 's'} without a day` : 'Give each place a day' },
    { ok: datesSet && hungryDays === 0, label: !datesSet ? 'Pick where to eat' : hungryDays === 0 ? 'Every day has food' : `${hungryDays} day${hungryDays === 1 ? '' : 's'} with nowhere to eat` },
  ]
  if (checks.every((c) => c.ok)) return (
    <p className="readiness readiness--done"><Check size={14} /> Trip ready — dates, stays, days and dinners all sorted.</p>
  )
  return (
    <ul className="readiness">
      {checks.map((c, i) => (
        <li key={i} className={c.ok ? 'is-ok' : ''}>
          {c.ok ? <Check size={13} /> : <Circle size={11} />} {c.label}
        </li>
      ))}
    </ul>
  )
}
