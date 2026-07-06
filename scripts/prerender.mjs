// Post-build prerender. Reads the published static JSON and writes a real
// HTML file per content URL into dist/, with title + meta + Open Graph +
// JSON-LD AND the actual textual content baked into <body>. This makes the
// content visible to AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Bing) and
// social scrapers, which do NOT execute JavaScript — they only read initial
// HTML. Humans still boot the full SPA (the module script is preserved), so
// interactivity is unchanged; React simply replaces the prerendered shell.
//
// Runs automatically after `vite build` (see package.json "build").
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const dataDir = path.join(root, 'public', 'data')
const SITE = (process.env.VITE_SITE_URL || 'https://myholidaypilot.com').replace(/\/+$/, '')

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('prerender: dist/index.html not found — run vite build first'); process.exit(0)
}
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const readJson = (p, fb = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fb } }
const truncate = (s, n = 155) => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s }

// Build one prerendered page: swap <title>, description, canonical, OG tags,
// inject JSON-LD, and place real content inside #root (React overwrites it on
// hydration, but crawlers read it as-is).
function render({ urlPath, title, description, image, jsonLd, bodyHtml }) {
  let html = template
  const canonical = SITE + (urlPath === '/' ? '' : urlPath)
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(canonical)}$2`)
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
  if (image) html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`)
  html = html.replace(/(<meta property="og:title")/, `<meta property="og:url" content="${esc(canonical)}" />\n    $1`)
  if (jsonLd) {
    html = html.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`)
  }
  // inject crawler-readable content into #root
  html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`)
  return html
}

function write(urlPath, html) {
  const rel = urlPath === '/' ? 'index.html' : path.join(urlPath.replace(/^\//, ''), 'index.html')
  const out = path.join(dist, rel)
  fs.mkdirSync(path.dirname(out), true && { recursive: true })
  fs.writeFileSync(out, html)
}

const countryMetaMod = await import(path.join(root, 'src/lib/countryMeta.js')).catch(() => ({}))
const nameFor = (slug, cj) => cj?.name || countryMetaMod.COUNTRY_META?.find?.((c) => c.slug === slug)?.name
  || slug.split(/[_-]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

let pages = 0
const countries = fs.existsSync(dataDir)
  ? fs.readdirSync(dataDir).filter((d) => fs.existsSync(path.join(dataDir, d, 'index.json')))
  : []

// ── home page ───────────────────────────────────────────────────────────────
// Assembled from the static, high-value parts (headline, pitch, feature
// sections, destination list). Dynamic bits (live blog, rankings) stay
// client-side — crawlers get the substance, humans get the full SPA.
{
  const liveNames = countries
    .map((slug) => nameFor(slug, readJson(path.join(dataDir, slug, 'country.json'), {})))
    .sort((a, b) => a.localeCompare(b))
  write('/', render({
    urlPath: '/',
    title: 'myholidaypilot — travel guides, region by region',
    description: 'Handcrafted travel guides to the world’s regions — where to go, what to eat, and the stories behind it. Plan a trip region by region.',
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'myholidaypilot', url: SITE,
      description: 'Handcrafted travel guides, region by region.',
      potentialAction: { '@type': 'SearchAction', target: `${SITE}/destinations`, 'query-input': 'required name=q' },
    },
    bodyHtml: `<main>`
      + `<p>Your travel copilot</p>`
      + `<h1>See more. Plan less.</h1>`
      + `<p>Handcrafted guides to the world’s regions — where to go, what to eat, and the stories behind it. New countries added all the time.</p>`
      + `<h2>Every place, mapped and worth your time</h2>`
      + `<p>Each country is broken into its real regions, and every region into its towns, cities, islands and parks. Every place comes with the things to do there, the food to try, and the local customs worth knowing.</p>`
      + `<h2>Where to eat, and when to be there</h2>`
      + `<p>A curated list of restaurants for every region — each with the dish to order. Plus a festival calendar for every country, so you can time your trip.</p>`
      + `<h2>The story behind the country</h2>`
      + `<p>A timeline from prehistory to today for every country, plus practical guides to getting around: trains, taxis and tickets, with honest local warnings.</p>`
      + (liveNames.length ? `<h2>Destinations</h2><ul>${liveNames.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '')
      + `</main>`,
  }))
  pages++
}

// ── destinations index ───────────────────────────────────────────────────────
{
  const liveNames = countries
    .map((slug) => nameFor(slug, readJson(path.join(dataDir, slug, 'country.json'), {})))
    .sort((a, b) => a.localeCompare(b))
  write('/destinations', render({
    urlPath: '/destinations',
    title: 'Destinations — every country, region by region | myholidaypilot',
    description: truncate('Browse travel guides by country: ' + liveNames.join(', ') + '. Each mapped region by region.'),
    jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Destinations', url: `${SITE}/destinations` },
    bodyHtml: `<main><h1>Destinations</h1><p>Pick where to wander — every country mapped region by region.</p>`
      + (liveNames.length ? `<ul>${liveNames.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '') + `</main>`,
  }))
  pages++
}

for (const slug of countries) {
  const cDir = path.join(dataDir, slug)
  const index = readJson(path.join(cDir, 'index.json'), { regions: [] })
  const cj = readJson(path.join(cDir, 'country.json'), {})
  const name = nameFor(slug, cj)
  const blurb = cj.blurb || `Travel guide to ${name} — region by region.`

  // country hub
  const regionNames = (index.regions || []).map((r) => r.name).filter(Boolean)
  write(`/${slug}`, render({
    urlPath: `/${slug}`,
    title: `${name} travel guide — region by region | myholidaypilot`,
    description: truncate(`${blurb} ${regionNames.length ? 'Regions: ' + regionNames.join(', ') + '.' : ''}`),
    jsonLd: { '@context': 'https://schema.org', '@type': 'TouristDestination', name, description: blurb, url: `${SITE}/${slug}` },
    bodyHtml: `<main><h1>${esc(name)}</h1><p>${esc(blurb)}</p>`
      + (regionNames.length ? `<h2>Regions</h2><ul>${regionNames.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '')
      + `</main>`,
  }))
  pages++

  // regions + places
  for (const rSummary of (index.regions || [])) {
    const rf = readJson(path.join(cDir, 'regions', `${rSummary.id}.json`))
    if (!rf) continue
    const places = rf.places || []
    const placeList = places.map((p) => p.name).filter(Boolean)
    write(`/${slug}/${rSummary.id}`, render({
      urlPath: `/${slug}/${rSummary.id}`,
      title: `${rf.name}, ${name} — what to do, where to eat | myholidaypilot`,
      description: truncate(rf.history || rf.culturalNotes || `Things to do in ${rf.name}, ${name}: ${placeList.slice(0, 6).join(', ')}.`),
      image: rSummary.heroImage?.url,
      jsonLd: { '@context': 'https://schema.org', '@type': 'TouristDestination', name: `${rf.name}, ${name}`, url: `${SITE}/${slug}/${rSummary.id}` },
      bodyHtml: `<main><h1>${esc(rf.name)}</h1><p>${esc(rf.history || rf.culturalNotes || '')}</p>`
        + (placeList.length ? `<h2>Places</h2><ul>${placeList.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '')
        + `</main>`,
    }))
    pages++

    for (const p of places) {
      const desc = truncate(p.description || `${p.name} in ${rf.name}, ${name}.`)
      write(`/${slug}/${rSummary.id}/${p.id}`, render({
        urlPath: `/${slug}/${rSummary.id}/${p.id}`,
        title: `${p.name}, ${rf.name} — ${name} travel guide | myholidaypilot`,
        description: desc,
        image: p.image?.url,
        jsonLd: { '@context': 'https://schema.org', '@type': 'TouristAttraction', name: p.name,
          description: desc, address: { '@type': 'PostalAddress', addressRegion: rf.name, addressCountry: name },
          url: `${SITE}/${slug}/${rSummary.id}/${p.id}` },
        bodyHtml: `<main><nav>${esc(name)} › ${esc(rf.name)}</nav><h1>${esc(p.name)}</h1>`
          + `<p>${esc(p.description || '')}</p>`
          + (Array.isArray(p.activities) && p.activities.length ? `<h2>Things to do</h2><ul>${p.activities.map((t) => `<li>${esc(t.text || t.name || t)}</li>`).join('')}</ul>` : '')
          + (Array.isArray(p.food) && p.food.length ? `<h2>Food to try</h2><ul>${p.food.map((t) => `<li>${esc(t.text || t.name || t)}</li>`).join('')}</ul>` : '')
          + `</main>`,
      }))
      pages++
    }
  }
}

console.log(`✓ prerendered ${pages} content pages into dist/ (${countries.length} countries)`)
