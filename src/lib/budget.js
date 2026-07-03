// Budget arithmetic — deliberately dumb and deterministic. Claude estimates
// *rates* (with low/high ranges); this file turns them into totals. Money
// maths never comes from the model.

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

// rates: the validated shape from /api/ai?action=budget
// inputs: { nights, adults, children, rooms, includeFlights, includeCar }
// overrides: { [lineKey]: number } — a user-fixed value replaces the range
export function computeBudget(rates, inputs, overrides = {}) {
  const nights = Math.max(1, n(inputs.nights))
  const days = nights + 1
  const people = Math.max(1, n(inputs.adults)) + n(inputs.children)
  const rooms = Math.max(1, n(inputs.rooms))
  const lines = []

  const push = (key, label, detail, low, high, note) => {
    const ov = overrides[key]
    const fixed = Number.isFinite(Number(ov)) ? Number(ov) : null
    lines.push({
      key, label, detail, note: note || '',
      low: fixed ?? Math.round(low), high: fixed ?? Math.round(high),
      overridden: fixed !== null,
    })
  }

  if (rates.accommodation?.perNight) {
    const r = rates.accommodation.perNight
    push('stay', 'Accommodation', `${nights} night${nights === 1 ? '' : 's'} × ${rooms} room${rooms === 1 ? '' : 's'}`,
      n(r.low) * nights * rooms, n(r.high) * nights * rooms, rates.accommodation.note)
  }
  if (rates.food?.perPersonPerDay) {
    const r = rates.food.perPersonPerDay
    push('food', 'Food & drink', `${people} people × ${days} days`,
      n(r.low) * people * days, n(r.high) * people * days, rates.food.note)
  }
  for (const [i, a] of (rates.activities || []).entries()) {
    if (!a?.perPerson) continue
    push(`act${i}`, a.name || 'Activity', `${people} people`,
      n(a.perPerson.low) * people, n(a.perPerson.high) * people, a.note)
  }
  if (rates.localTransport?.perPersonPerDay) {
    const r = rates.localTransport.perPersonPerDay
    push('transport', 'Getting around', `${people} people × ${days} days`,
      n(r.low) * people * days, n(r.high) * people * days, rates.localTransport.note)
  }
  if (inputs.includeFlights && rates.flights?.perPerson) {
    const r = rates.flights.perPerson
    push('flights', 'Flights', `${people} people, return`,
      n(r.low) * people, n(r.high) * people, rates.flights.note)
  }
  if (inputs.includeCar && rates.carRental?.perDay) {
    const r = rates.carRental.perDay
    push('car', 'Car rental', `${days} days`,
      n(r.low) * days, n(r.high) * days, rates.carRental.note)
  }
  if (rates.extras?.perPersonPerDay) {
    const r = rates.extras.perPersonPerDay
    push('extras', 'Extras & spending', `${people} people × ${days} days`,
      n(r.low) * people * days, n(r.high) * people * days, rates.extras.note)
  }

  const low = lines.reduce((s, l) => s + l.low, 0)
  const high = lines.reduce((s, l) => s + l.high, 0)
  return {
    lines, low, high,
    perPersonDayLow: Math.round(low / people / days),
    perPersonDayHigh: Math.round(high / people / days),
    people, days, nights,
  }
}

export const fmtMoney = (v, currency = 'EUR') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
