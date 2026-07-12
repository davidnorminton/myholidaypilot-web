// Instant packing checklist — no AI, no network. Seeds from the destination's
// climate archetype × the trip month × duration × what the trip contains,
// plus the plug-adapter line from the country facts when available. Honest
// scope: month-level climate bands, not a forecast — the AI list (which reads
// the live forecast) remains the richer option.

const CLIMATE = {
  italy: 'med', spain: 'med', portugal: 'med', greece: 'med', turkey: 'med',
  france: 'temperate', germany: 'continental', poland: 'continental',
  netherlands: 'oceanic', united_kingdom: 'oceanic',
  norway: 'nordic', sweden: 'nordic', switzerland: 'alpine',
  japan: 'east_asia', south_korea: 'east_asia',
  singapore: 'tropical', thailand: 'tropical',
  united_states: 'varied',
}

// month: 1-12 → { band: hot|warm|mild|cold, rain: bool }
function bandFor(climate, m) {
  const inR = (a, b) => (a <= b ? m >= a && m <= b : m >= a || m <= b)
  switch (climate) {
    case 'med': return { band: inR(6, 9) ? 'hot' : inR(4, 5) || m === 10 ? 'warm' : 'mild', rain: inR(11, 2) }
    case 'temperate': return { band: inR(6, 8) ? 'hot' : inR(4, 5) || inR(9, 10) ? 'mild' : 'cold', rain: inR(10, 3) }
    case 'oceanic': return { band: inR(7, 8) ? 'warm' : inR(5, 6) || m === 9 ? 'mild' : 'cold', rain: true }
    case 'continental': return { band: inR(6, 8) ? 'hot' : m === 5 || m === 9 ? 'warm' : 'cold', rain: inR(6, 8) }
    case 'nordic': return { band: inR(6, 8) ? 'mild' : 'cold', rain: inR(9, 11) }
    case 'alpine': return { band: inR(7, 8) ? 'warm' : inR(5, 6) || m === 9 ? 'mild' : 'cold', rain: inR(5, 8) }
    case 'east_asia': return { band: inR(6, 9) ? 'hot' : inR(4, 5) || inR(10, 11) ? 'mild' : 'cold', rain: inR(6, 7) || m === 9 }
    case 'tropical': return { band: 'hot', rain: inR(5, 10) }
    default: return { band: 'warm', rain: false }   // 'varied' — adjust note added below
  }
}

export function buildPackingSeed(trip, facts) {
  const m = trip.startDate ? new Date(trip.startDate + 'T12:00').getMonth() + 1 : 7
  const climate = CLIMATE[trip.countryId] || 'temperate'
  const { band, rain } = bandFor(climate, m)
  const nights = trip.startDate && trip.endDate
    ? Math.max(1, Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000))
    : 3
  const long = nights >= 7
  const hasFlights = !!(trip.travel?.arrive || trip.travel?.depart || trip.travel?.home)
  const swim = (climate === 'med' || climate === 'tropical') && (band === 'hot' || band === 'warm')

  const docs = [
    'Passport / ID (check the expiry date)',
    hasFlights && 'Boarding passes / airline app signed in',
    'Travel insurance details',
    'Bank cards + a little local cash',
    'Booking confirmations (offline copies)',
  ]
  const tech = [
    'Phone + charging cable',
    facts?.plugs ? `Travel adapter (${facts.plugs})` : 'Travel adapter',
    'Power bank',
    long && 'Spare charging cable',
  ]
  const clothing = {
    hot: ['Light, breathable clothes', 'Sun hat & sunglasses', 'Comfortable walking shoes', 'A light layer for evenings', swim && 'Swimwear & quick-dry towel', 'Sandals'],
    warm: ['Light layers — t-shirts + a jumper', 'Comfortable walking shoes', 'Light jacket for evenings', swim && 'Swimwear & quick-dry towel'],
    mild: ['Layers — long sleeves + a warm jumper', 'Comfortable walking shoes', 'A proper jacket', 'Scarf or buff'],
    cold: ['Warm coat', 'Jumpers / thermals to layer', 'Hat, gloves & scarf', 'Warm waterproof shoes or boots', 'Thick socks'],
  }[band]
  const health = [
    'Any medication you take (in hand luggage)',
    'Painkillers & plasters',
    band === 'hot' && 'Sunscreen (high SPF)',
    band === 'hot' && 'Insect repellent',
    'Toiletries (hand-luggage sizes if flying)',
    'Hand sanitiser',
  ]
  const extras = [
    rain && 'Packable rain jacket or small umbrella',
    long && 'Laundry kit (detergent sheets, travel line)',
    'Day bag / small backpack',
    'Reusable water bottle',
    'Earplugs & eye mask',
    climate === 'varied' && 'US climates vary a lot by region — adjust for where you\u2019re headed',
  ]

  const cat = (name, items) => ({ name, items: items.filter(Boolean).map((text) => ({ text, done: false })) })
  return [
    cat('Documents & money', docs),
    cat('Tech', tech),
    cat(`Clothing — ${band} weather expected`, clothing),
    cat('Health & toiletries', health),
    cat('Extras', extras),
  ]
}
