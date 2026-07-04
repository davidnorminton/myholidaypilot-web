// Display metadata for countries — names, flags, blurbs, and the order they
// appear in. WHICH countries are live is decided automatically: any country
// with a data folder in public/data/ becomes available when the site builds
// (see scripts/gen-countries.mjs). To hide an imported country (draft mode),
// add its slug to HIDDEN below.
//
// A country with data but no entry here still works — it gets a title-cased
// name and a generic blurb — but add an entry for a proper flag and copy.

export const COUNTRY_META = [
  { slug: 'italy', name: 'Italy', flag: '🇮🇹',
    blurb: 'Coast to alps — 20 regions, hundreds of towns and tables.' },
  { slug: 'spain', name: 'Spain', flag: '🇪🇸',
    blurb: 'Sun, tapas and flamenco — 18 regions from the Pyrenees to the Canaries.' },
  { slug: 'portugal', name: 'Portugal', flag: '🇵🇹',
    blurb: 'Atlantic light and azulejos — 11 regions from the Minho to Madeira.' },
  { slug: 'france', name: 'France', flag: '🇫🇷',
    blurb: 'Vineyards, villages and grand cities — all 13 regions, table by table.' },
  { slug: 'greece', name: 'Greece', flag: '🇬🇷',
    blurb: 'Islands, ruins and long lunches — 13 regions from Crete to Thrace.' },
  { slug: 'united_kingdom', name: 'United Kingdom', flag: '🇬🇧',
    blurb: 'Castles, coastlines and pubs — 17 regions across four nations.' },
  { slug: 'united_states', name: 'United States', flag: '🇺🇸',
    blurb: 'Road trips, national parks and big-sky cities — coast to coast.' },
  { slug: 'germany', name: 'Germany', flag: '🇩🇪',
    blurb: 'Castles, forests and beer halls — region by region.' },
  { slug: 'japan', name: 'Japan', flag: '🇯🇵',
    blurb: 'Temples, ramen and bullet trains — 9 regions from Hokkaido to Okinawa.' },
]

// Slugs listed here stay invisible even when their data folder exists.
export const HIDDEN = []
