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
