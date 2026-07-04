export const COUNTRIES = [
  { slug: 'italy',    name: 'Italy',    flag: '🇮🇹', available: true,
    blurb: 'Coast to alps — 20 regions, hundreds of towns and tables.' },
  { slug: 'spain',    name: 'Spain',    flag: '🇪🇸', available: true,
    blurb: 'Sun, tapas and flamenco — 18 regions from the Pyrenees to the Canaries.' },
  { slug: 'portugal', name: 'Portugal', flag: '🇵🇹', available: true,
    blurb: 'Atlantic light and azulejos — 11 regions from the Minho to Madeira.' },
  { slug: 'usa',      name: 'United States', flag: '🇺🇸', available: false,
    blurb: 'Fifty states of road trips, parks and cities.' },
  { slug: 'france',   name: 'France',   flag: '🇫🇷', available: true },
  { slug: 'greece',   name: 'Greece',   flag: '🇬🇷', available: true },
  { slug: 'united_kingdom', name: 'United Kingdom', flag: '🇬🇧', available: true,
    blurb: '17 regions to explore, town by town.' },
  { slug: 'united_states', name: 'United States', flag: '🇺🇸', available: true,
    blurb: '13 regions to explore, town by town.' },
]

export const isAvailableCountry = (slug) => COUNTRIES.some((c) => c.slug === slug && c.available)
