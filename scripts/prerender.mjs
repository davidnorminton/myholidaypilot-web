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
const sitemapUrls = []                     // { loc, priority } collected as we render
const addUrl = (urlPath, priority) => sitemapUrls.push({ loc: SITE + (urlPath === '/' ? '' : urlPath), priority })
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
  addUrl('/', '1.0'); pages++
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
  addUrl('/destinations', '0.6'); pages++
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
  addUrl(`/${slug}`, '0.9'); pages++

  // regions + places
  for (const rSummary of (index.regions || [])) {
    const rf = readJson(path.join(cDir, 'regions', `${rSummary.id}.json`))
    if (!rf) continue
    const places = rf.places || []
    const placeList = places.map((p) => p.name).filter(Boolean)
    const restaurants = rf.restaurants || []
    write(`/${slug}/${rSummary.id}`, render({
      urlPath: `/${slug}/${rSummary.id}`,
      title: `${rf.name}, ${name} — what to do, where to eat | myholidaypilot`,
      description: truncate(rf.history || rf.culturalNotes || `Things to do in ${rf.name}, ${name}: ${placeList.slice(0, 6).join(', ')}.`),
      image: rSummary.heroImage?.url,
      jsonLd: { '@context': 'https://schema.org', '@type': 'TouristDestination', name: `${rf.name}, ${name}`, url: `${SITE}/${slug}/${rSummary.id}` },
      bodyHtml: `<main><nav>${esc(name)}</nav><h1>${esc(rf.name)}</h1>`
        + (rf.nameIt && rf.nameIt !== rf.name ? `<p>${esc(rf.nameIt)}</p>` : '')
        + (rf.history ? `<h2>History</h2><p>${esc(rf.history)}</p>` : '')
        + (rf.culturalNotes ? `<h2>Culture</h2><p>${esc(rf.culturalNotes)}</p>` : '')
        + (rf.languageNotes ? `<h2>Language</h2><p>${esc(rf.languageNotes)}</p>` : '')
        + (rf.bestTimeToVisit ? `<h2>Best time to visit</h2><p>${esc(rf.bestTimeToVisit)}</p>` : '')
        + (placeList.length ? `<h2>Places to visit</h2><ul>${places.map((p) => {
            const d = p.description ? ` — ${esc(truncate(p.description, 120))}` : ''
            return `<li>${esc(p.name)}${d}</li>`
          }).join('')}</ul>` : '')
        + (restaurants.length ? `<h2>Where to eat</h2><ul>${restaurants.map((r) => {
            const bits = [r.cuisine, r.neighbourhood || r.address].filter(Boolean).map(esc).join(', ')
            const dish = r.mustOrder ? ` Order: ${esc(r.mustOrder)}.` : ''
            return `<li>${esc(r.name)}${bits ? ` (${bits})` : ''}.${dish}</li>`
          }).join('')}</ul>` : '')
        + `</main>`,
    }))
    addUrl(`/${slug}/${rSummary.id}`, '0.8'); pages++

    for (const p of places) {
      const desc = truncate(p.description || `${p.name} in ${rf.name}, ${name}.`)
      // Each activity/food/culture item is { text, detail } — include BOTH so
      // crawlers get the substance, not just the label.
      const list = (arr, heading) => (Array.isArray(arr) && arr.length)
        ? `<h2>${heading}</h2><ul>${arr.map((t) => {
            const label = esc(t.text || t.name || t)
            const detail = t.detail ? ` — ${esc(t.detail)}` : ''
            return `<li>${label}${detail}</li>`
          }).join('')}</ul>`
        : ''
      write(`/${slug}/${rSummary.id}/${p.id}`, render({
        urlPath: `/${slug}/${rSummary.id}/${p.id}`,
        title: `${p.name}, ${rf.name} — ${name} travel guide | myholidaypilot`,
        description: desc,
        image: p.image?.url,
        jsonLd: { '@context': 'https://schema.org', '@type': 'TouristAttraction', name: p.name,
          description: desc, address: { '@type': 'PostalAddress', addressRegion: rf.name, addressCountry: name },
          url: `${SITE}/${slug}/${rSummary.id}/${p.id}` },
        bodyHtml: `<main><nav>${esc(name)} › ${esc(rf.name)}</nav><h1>${esc(p.name)}</h1>`
          + (p.nameIt && p.nameIt !== p.name ? `<p>${esc(p.nameIt)}</p>` : '')
          + `<p>${esc(p.description || '')}</p>`
          + list(p.activities, 'Things to do')
          + list(p.food, 'Food to try')
          + list(p.culture, 'Local customs & good to know')
          + `</main>`,
      }))
      addUrl(`/${slug}/${rSummary.id}/${p.id}`, '0.6'); pages++
    }
  }
}

// ── blog posts ───────────────────────────────────────────────────────────────
// Bundled posts (src/lib/blog.js) always prerender. Published posts live in the
// database — we read them if build-time credentials are present, but NEVER fail
// the build if the DB is unreachable (missing creds, network): the content
// pages and bundled posts still ship.
{
  const slugify = (s) => String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const bySlug = new Map()

  // 1. bundled posts
  try {
    const mod = await import(path.join(root, 'src/lib/blog.js'))
    for (const p of (mod.POSTS || [])) {
      const slug = slugify(p.slug || p.title)
      if (slug) bySlug.set(slug, { slug, title: p.title, dek: p.dek, tag: p.tag, author: p.author, body: p.body || [], coverImage: p.coverImage })
    }
  } catch { /* no bundled posts */ }

  // 2. published DB posts (optional, best-effort)
  if (process.env.DATABASE_URL) {
    try {
      const { getDb } = await import(path.join(root, 'db/client.js'))
      const schema = await import(path.join(root, 'db/schema.js'))
      const { eq } = await import('drizzle-orm')
      const db = getDb()
      const rows = await db.select().from(schema.blogPosts).where(eq(schema.blogPosts.status, 'published'))
      for (const r of rows) {
        const slug = slugify(r.slug || r.title)
        if (slug) bySlug.set(slug, { slug, title: r.title, dek: r.dek, tag: r.tag, author: r.author,
          body: Array.isArray(r.body) ? r.body : [], coverImage: r.coverImage, publishedAt: r.publishedAt })
      }
      console.log(`  blog: ${rows.length} published posts from DB`)
    } catch (e) {
      console.warn(`  blog: skipped DB posts (${e.message.split('\n')[0]}) — bundled posts still prerendered`)
    }
  } else {
    console.log('  blog: no DATABASE_URL at build — only bundled posts prerendered')
  }

  const posts = [...bySlug.values()]
  if (posts.length) {
    // /blog index
    write('/blog', render({
      urlPath: '/blog',
      title: 'The journal — travel notes & guides | myholidaypilot',
      description: 'Travel writing from myholidaypilot: how to travel region by region, eat like a local, and time your trips.',
      jsonLd: { '@context': 'https://schema.org', '@type': 'Blog', name: 'myholidaypilot journal', url: `${SITE}/blog` },
      bodyHtml: `<main><h1>The journal</h1><ul>${posts.map((p) =>
        `<li><a href="${SITE}/blog/${p.slug}">${esc(p.title)}</a>${p.dek ? ` — ${esc(p.dek)}` : ''}</li>`).join('')}</ul></main>`,
    }))
    addUrl('/blog', '0.6'); pages++

    // each post
    for (const p of posts) {
      const paras = (p.body || []).filter((x) => typeof x === 'string')
      const desc = truncate(p.dek || paras[0] || p.title)
      write(`/blog/${p.slug}`, render({
        urlPath: `/blog/${p.slug}`,
        title: `${p.title} | myholidaypilot`,
        description: desc,
        image: p.coverImage,
        jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: p.title,
          description: desc, author: { '@type': p.author ? 'Person' : 'Organization', name: p.author || 'myholidaypilot' },
          image: p.coverImage || undefined, url: `${SITE}/blog/${p.slug}`,
          datePublished: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined },
        bodyHtml: `<main><article><h1>${esc(p.title)}</h1>`
          + (p.dek ? `<p>${esc(p.dek)}</p>` : '')
          + (p.author ? `<p>By ${esc(p.author)}</p>` : '')
          + paras.map((t) => `<p>${esc(t)}</p>`).join('')
          + `</article></main>`,
      }))
      addUrl(`/blog/${p.slug}`, '0.6'); pages++
    }
  }
}

// ── sitemap.xml + robots.txt (complete, all countries) ───────────────────────
{
  const today = new Date().toISOString().slice(0, 10)
  const body = sitemapUrls.map((u) =>
    `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), xml)
  fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`)
  console.log(`✓ wrote sitemap.xml (${sitemapUrls.length} urls) + robots.txt`)
}

console.log(`✓ prerendered ${pages} content pages into dist/ (${countries.length} countries)`)
