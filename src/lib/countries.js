export const COUNTRIES = [
  { slug: 'italy',    name: 'Italy',    flag: '🇮🇹', available: true,
    blurb: 'Coast to alps — 20 regions, hundreds of towns and tables.' },
  { slug: 'spain',    name: 'Spain',    flag: '🇪🇸', available: true,
    blurb: 'Sun, tapas and flamenco — 18 regions from the Pyrenees to the Canaries.' },
  { slug: 'portugal', name: 'Portugal', flag: '🇵🇹', available: true,
    blurb: 'Atlantic light and azulejos — 11 regions from the Minho to Madeira.' },
  { slug: 'usa',      name: 'United States', flag: '🇺🇸', available: false,
    blurb: 'Fifty states of road trips, parks and cities.' },
  { slug: 'france',   name: 'France',   flag: '🇫🇷', available: false },
  { slug: 'greece',   name: 'Greece',   flag: '🇬🇷', available: false },
]

export const isAvailableCountry = (slug) => COUNTRIES.some((c) => c.slug === slug && c.available)
