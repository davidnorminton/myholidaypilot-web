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
// same transform the app uses, so the preloaded URL exactly matches what React
// requests — the browser preload becomes a cache hit, not a duplicate download

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const dataDir = path.join(root, 'public', 'data')
const SITE = (process.env.VITE_SITE_URL || 'https://myholidaypilot.com').replace(/\/+$/, '')

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('prerender: dist/index.html not found — run vite build first'); process.exit(0)
}
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const { imgUrl } = await import(path.join(root, 'src/lib/imgUrl.js'))

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const readJson = (p, fb = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fb } }
const truncate = (s, n = 155) => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s }

// Build one prerendered page: swap <title>, description, canonical, OG tags,
// inject JSON-LD, and place real content inside #root (React overwrites it on
// hydration, but crawlers read it as-is).
function render({ urlPath, title, description, image, jsonLd, bodyHtml, preloadImagesFor }) {
  let html = template
  const canonical = SITE + (urlPath === '/' ? '' : urlPath)
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(canonical)}$2`)
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
  if (image) {
    html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`)
    // Preload the hero at the size the app will render it (1600 bucket): the
    // browser starts downloading it the moment HTML arrives — before any JS.
    const heroHref = imgUrl(image, 1600)
    html = html.replace('</head>', `  <link rel="preload" as="image" href="${esc(heroHref)}" fetchpriority="high" />\n  </head>`)
  }
  if (preloadImagesFor) {
    // start the image-manifest fetch as soon as the HTML arrives, in parallel
    // with the JS — cards get their URLs the moment React asks for them.
    html = html.replace('</head>', `  <link rel="preload" as="fetch" href="/api/images?country=${esc(preloadImagesFor)}" crossorigin="anonymous" />\n  </head>`)
  }
  html = html.replace(/(<meta property="og:title")/, `<meta property="og:url" content="${esc(canonical)}" />\n    $1`)
  if (jsonLd) {
    const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd]
    const scripts = blocks.map((b) => `  <script type="application/ld+json">${JSON.stringify(b)}</script>`).join('\n')
    html = html.replace('</head>', `${scripts}\n  </head>`)
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
const TODAY = new Date().toISOString().slice(0, 10)
const toDate = (v) => { try { return v ? new Date(v).toISOString().slice(0, 10) : null } catch { return null } }
const addUrl = (urlPath, priority, lastmod) => sitemapUrls.push({ loc: SITE + (urlPath === '/' ? '' : urlPath), priority, lastmod: lastmod || TODAY })
// BreadcrumbList JSON-LD from [{name, url}] crumbs — Google renders these as the
// Render a trip-details block (from the admin generator) as SEO-friendly HTML,
// and its FAQ as FAQPage JSON-LD. Used on country and region pages.
function detailsHtml(d, title = 'Plan your trip') {
  if (!d) return ''
  let h = `<section><h2>${esc(title)}</h2>`
  if (d.intro) h += `<p>${esc(d.intro)}</p>`
  if (d.gettingThere) h += `<h3>Getting there &amp; around</h3><p>${esc(d.gettingThere)}</p>`
  if (d.daysNeeded) h += `<h3>How long to stay</h3><p>${esc(d.daysNeeded)}</p>`
  if (d.bestTime) h += `<h3>When to go</h3><p>${esc(d.bestTime)}</p>`
  if (Array.isArray(d.itinerary) && d.itinerary.length) {
    h += `<h3>Suggested itinerary</h3><ol>` + d.itinerary.map((it) =>
      `<li><strong>${esc(it.title || `Day ${it.day}`)}</strong> — ${esc(it.text || '')}</li>`).join('') + `</ol>`
  }
  if (Array.isArray(d.faq) && d.faq.length) {
    h += `<h3>Frequently asked questions</h3>` + d.faq.map((f) =>
      `<h4>${esc(f.q)}</h4><p>${esc(f.a)}</p>`).join('')
  }
  return h + `</section>`
}
function faqJsonLd(d) {
  if (!Array.isArray(d?.faq) || !d.faq.length) return null
  return { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: d.faq.map((f) => ({ '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
}

// breadcrumb trail in search results instead of a bare URL.
const breadcrumb = (crumbs) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) })
const countries = fs.existsSync(dataDir)
  ? fs.readdirSync(dataDir).filter((d) => fs.existsSync(path.join(dataDir, d, 'index.json')))
  : []

// ── home page ───────────────────────────────────────────────────────────────
// Assembled from the static, high-value parts (headline, pitch, feature
// sections, destination list). Dynamic bits (live blog, rankings) stay
// client-side — crawlers get the substance, humans get the full SPA.
{
  const livePairs = countries
    .map((slug) => ({ slug, name: nameFor(slug, readJson(path.join(dataDir, slug, 'country.json'), {})) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const homeFaq = [
    { q: 'What is myholidaypilot?', a: 'A travel guide and free trip planner. Every country is broken into its real regions, and every region into its towns, cities and landmarks — with things to do, restaurants and the dish to order, festivals, and honest local tips.' },
    { q: 'Is myholidaypilot free to use?', a: 'Yes. Browsing every guide and using the trip planner — itineraries, packing lists, budgets and PDF export — is free. Sign in with Google or email to save trips across devices.' },
    { q: 'How does the trip planner work?', a: 'Save the places you like as you browse, arrange them into a day-by-day itinerary on a map, then generate a packing list and budget for your dates. You can export the plan as a PDF or share it with friends.' },
    { q: 'Which countries are covered?', a: 'Countries across Europe, Asia and North America — each mapped region by region — with new countries added regularly.' },
    { q: 'When is the best time to book a holiday?', a: 'It depends on the destination — every region page includes the best months to visit, and every country has a festival calendar so you can time your trip around the events worth travelling for.' },
  ]
  write('/', render({
    urlPath: '/',
    title: 'myholidaypilot — holiday trip planner & travel guides, region by region',
    description: 'Plan your holiday region by region: handcrafted travel guides with things to do, where to eat and festival dates — plus a free trip planner to build your day-by-day itinerary.',
    jsonLd: [{
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'myholidaypilot', url: SITE,
      description: 'Handcrafted travel guides, region by region.',
      // (no SearchAction: the site search is client-side with no crawlable
      // /search?q= results URL, and a malformed target is worse than none)
    }, {
      '@context': 'https://schema.org', '@type': 'Organization',
      name: 'myholidaypilot', url: SITE, logo: `${SITE}/logo.png`,
    }, {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: homeFaq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }],
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
      + `<h2>Frequently asked questions</h2>` + homeFaq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')
      + (livePairs.length ? `<h2>Destinations</h2><ul>${livePairs.map(({ slug, name: n }) => `<li><a href="${SITE}/${slug}">${esc(n)}</a></li>`).join('')}</ul>` : '')
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
      + (countries.length ? `<ul>${countries.map((slug) => {
          const n = nameFor(slug, readJson(path.join(dataDir, slug, 'country.json'), {}))
          return `<li><a href="${SITE}/${slug}">${esc(n)}</a></li>`
        }).sort().join('')}</ul>` : '') + `</main>`,
  }))
  addUrl('/destinations', '0.6'); pages++
  addUrl('/trip-planner', '0.8')
}

for (const slug of countries) {
  const cDir = path.join(dataDir, slug)
  const index = readJson(path.join(cDir, 'index.json'), { regions: [] })
  const cj = readJson(path.join(cDir, 'country.json'), {})
  // Images live separately, keyed region → place → [{ url }]. Used for og:image
  // so shared links show the right photo (not the generic homepage fallback).
  const images = readJson(path.join(cDir, 'images.json'), {})
  const placeImage = (regionId, placeId) => images[regionId]?.[placeId]?.[0]?.url || null
  // First place in a region that actually has an image set — not every place
  // has one, so scan rather than assume places[0] has it.
  const firstRegionImage = (regionId, placesArr) => {
    for (const pl of (placesArr || [])) {
      const u = placeImage(regionId, pl.id)
      if (u) return u
    }
    return null
  }
  const name = nameFor(slug, cj)
  const blurb = cj.blurb || `Travel guide to ${name} — region by region.`

  // country hub
  const regionNames = (index.regions || []).map((r) => r.name).filter(Boolean)
  write(`/${slug}`, render({
    urlPath: `/${slug}`,
    preloadImagesFor: slug,
    title: `${name} travel guide — regions, places & holiday planning | myholidaypilot`,
    description: truncate(`${blurb} ${regionNames.length ? 'Regions: ' + regionNames.join(', ') + '.' : ''}`),
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'TouristDestination', name, description: blurb, url: `${SITE}/${slug}` },
      ...(faqJsonLd(index.details) ? [faqJsonLd(index.details)] : []),
    ],
    bodyHtml: `<main><nav><a href="${SITE}/destinations">Destinations</a></nav><h1>${esc(name)}</h1><p>${esc(blurb)}</p>`
      + detailsHtml(index.details, `Plan your trip to ${name}`)
      + ((index.regions || []).length ? `<h2>Regions</h2><ul>${(index.regions || []).map((r) =>
          `<li><a href="${SITE}/${slug}/${r.id}">${esc(r.name)}</a></li>`).join('')}</ul>` : '')
      + `</main>`,
  }))
  addUrl(`/${slug}`, '0.9'); pages++

  // country-level guide pages (festivals / history / food / transport)
  for (const topic of ['festivals', 'history', 'food', 'transport']) {
    const g = readJson(path.join(cDir, 'guide', `${topic}.json`))
    if (!g) continue
    let inner = ''
    if (topic === 'festivals' && Array.isArray(g.festivals)) {
      inner = `<ul>${g.festivals.map((f) => {
        const when = [f.month, f.regionName].filter(Boolean).map(esc).join(', ')
        const d = f.description || f.detail
        return `<li>${esc(f.name)}${when ? ` (${when})` : ''}${d ? ` — ${esc(truncate(d, 140))}` : ''}</li>`
      }).join('')}</ul>`
    } else if (Array.isArray(g.sections)) {
      inner = g.sections.map((sec) => {
        const items = (sec.items || []).map((it) => {
          const label = it.label || it.period || it.name || ''
          const text = it.text || it.detail || it.description || ''
          return `<li>${label ? `<strong>${esc(label)}</strong>` : ''}${label && text ? ' — ' : ''}${esc(text)}</li>`
        }).join('')
        return (sec.title ? `<h3>${esc(sec.title)}</h3>` : '') + (items ? `<ul>${items}</ul>` : '')
      }).join('')
    }
    const gtitle = g.title || topic
    write(`/${slug}/${topic}`, render({
      urlPath: `/${slug}/${topic}`,
      title: `${gtitle} — ${name} travel guide | myholidaypilot`,
      description: truncate(g.subtitle || `${gtitle} in ${name}.`),
      jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: `${gtitle} — ${name}`, url: `${SITE}/${slug}/${topic}` },
      bodyHtml: `<main><nav><a href="${SITE}/${slug}">${esc(name)}</a></nav><h1>${esc(gtitle)}</h1>`
        + (g.subtitle ? `<p>${esc(g.subtitle)}</p>` : '') + inner + `</main>`,
    }))
    addUrl(`/${slug}/${topic}`, '0.7'); pages++
  }

  // regions + places
  for (const rSummary of (index.regions || [])) {
    const rf = readJson(path.join(cDir, 'regions', `${rSummary.id}.json`))
    if (!rf) continue
    const places = rf.places || []
    const placeList = places.map((p) => p.name).filter(Boolean)
    const restaurants = rf.restaurants || []
    write(`/${slug}/${rSummary.id}`, render({
      urlPath: `/${slug}/${rSummary.id}`,
      preloadImagesFor: slug,
      title: `Things to do in ${rf.name}, ${name} — places, food & trip ideas | myholidaypilot`,
      description: truncate(`Plan a holiday in ${rf.name}, ${name}: ${placeList.slice(0, 5).join(', ')} — with where to eat and when to go. ${rf.history || rf.culturalNotes || ''}`),
      // Use the baked cardImage (hero → first place with an image, DB-synced)
      // so the preload URL matches exactly what the region page renders — the
      // browser preload becomes a cache hit and the hero paints immediately.
      image: rSummary.cardImage || rSummary.heroImage?.url || firstRegionImage(rSummary.id, places),
      jsonLd: [
        Object.assign(
          { '@context': 'https://schema.org', '@type': 'TouristDestination', name: `${rf.name}, ${name}`, url: `${SITE}/${slug}/${rSummary.id}` },
          rf.history || rf.culturalNotes ? { description: truncate(rf.history || rf.culturalNotes, 300) } : {},
          rSummary.cardImage ? { image: rSummary.cardImage } : {},
          rSummary.lat && rSummary.lng ? { geo: { '@type': 'GeoCoordinates', latitude: rSummary.lat, longitude: rSummary.lng } } : {},
          places.length ? { containsPlace: places.slice(0, 12).map((pl) => ({ '@type': 'TouristAttraction', name: pl.name, url: `${SITE}/${slug}/${rSummary.id}/${pl.id}` })) } : {},
        ),
        breadcrumb([{ name: 'Destinations', url: `${SITE}/destinations` }, { name, url: `${SITE}/${slug}` }, { name: rf.name, url: `${SITE}/${slug}/${rSummary.id}` }]),
        ...(faqJsonLd(rf.details) ? [faqJsonLd(rf.details)] : []),
      ],
      bodyHtml: `<main><nav><a href="${SITE}/destinations">Destinations</a> › <a href="${SITE}/${slug}">${esc(name)}</a></nav><h1>${esc(rf.name)}</h1>`
        + (rf.nameIt && rf.nameIt !== rf.name ? `<p>${esc(rf.nameIt)}</p>` : '')
        + detailsHtml(rf.details, `Plan your trip to ${rf.name}`)
        + (rf.history ? `<h2>History</h2><p>${esc(rf.history)}</p>` : '')
        + (rf.culturalNotes ? `<h2>Culture</h2><p>${esc(rf.culturalNotes)}</p>` : '')
        + (rf.languageNotes ? `<h2>Language</h2><p>${esc(rf.languageNotes)}</p>` : '')
        + (rf.bestTimeToVisit ? `<h2>Best time to visit</h2><p>${esc(rf.bestTimeToVisit)}</p>` : '')
        + (places.length ? `<h2>Places to visit</h2><ul>${places.map((p) => {
            const d = p.description ? ` — ${esc(truncate(p.description, 120))}` : ''
            return `<li><a href="${SITE}/${slug}/${rSummary.id}/${p.id}">${esc(p.name)}</a>${d}</li>`
          }).join('')}</ul>` : '')
        + (restaurants.length ? `<h2>Where to eat</h2><ul>${restaurants.map((r) => {
            const bits = [r.cuisine, r.neighbourhood || r.address].filter(Boolean).map(esc).join(', ')
            const dish = r.mustOrder ? ` Order: ${esc(r.mustOrder)}.` : ''
            return `<li>${esc(r.name)}${bits ? ` (${bits})` : ''}.${dish}</li>`
          }).join('')}</ul>` : '')
        + `</main>`,
    }))
    addUrl(`/${slug}/${rSummary.id}`, '0.8', toDate(rf.generatedAt)); pages++

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
        preloadImagesFor: slug,
        title: `${p.name}, ${rf.name} — things to do, food & tips | myholidaypilot`,
        description: desc,
        image: placeImage(rSummary.id, p.id),
        jsonLd: [
          Object.assign(
            { '@context': 'https://schema.org', '@type': 'TouristAttraction', name: p.name,
              description: desc, address: { '@type': 'PostalAddress', addressRegion: rf.name, addressCountry: name },
              url: `${SITE}/${slug}/${rSummary.id}/${p.id}`,
              containedInPlace: { '@type': 'TouristDestination', name: `${rf.name}, ${name}`, url: `${SITE}/${slug}/${rSummary.id}` } },
            p.lat && p.lng ? { geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } } : {},
            placeImage(rSummary.id, p.id) ? { image: placeImage(rSummary.id, p.id) } : {},
          ),
          breadcrumb([{ name: 'Destinations', url: `${SITE}/destinations` }, { name, url: `${SITE}/${slug}` }, { name: rf.name, url: `${SITE}/${slug}/${rSummary.id}` }, { name: p.name, url: `${SITE}/${slug}/${rSummary.id}/${p.id}` }]),
        ],
        bodyHtml: `<main><nav><a href="${SITE}/${slug}">${esc(name)}</a> › <a href="${SITE}/${slug}/${rSummary.id}">${esc(rf.name)}</a></nav><h1>${esc(p.name)}</h1>`
          + (p.nameIt && p.nameIt !== p.name ? `<p>${esc(p.nameIt)}</p>` : '')
          + `<p>${esc(p.description || '')}</p>`
          + list(p.activities, 'Things to do')
          + list(p.food, 'Food to try')
          + list(p.culture, 'Local customs & good to know')
          + `</main>`,
      }))
      addUrl(`/${slug}/${rSummary.id}/${p.id}`, '0.6', toDate(rf.generatedAt)); pages++
    }
  }
}

// ── /trip-planner: prerendered landing page for the planner tool ─────────────
// A dedicated, crawlable page targeting "holiday trip planner" queries — the
// homepage mentions the planner, but a focused page is what can rank for it.
{
  const faq = [
    { q: 'Is the myholidaypilot trip planner free?', a: 'Yes — building itineraries, saving places, packing lists and budgets are all free. Sign in with Google or email to save trips across devices.' },
    { q: 'Can I plan a multi-day holiday itinerary?', a: 'Yes. Pick the places you want to visit and arrange them into a day-by-day itinerary, with a map of each day and travel times between stops.' },
    { q: 'Does it work for any destination?', a: 'The planner covers every country on myholidaypilot — each broken into regions, with hand-picked places, restaurants and festivals to add to your trip.' },
    { q: 'Can I export or share my itinerary?', a: 'Yes — download your trip as a PDF to take offline, or share a link so friends and family can see (and copy) the plan.' },
    { q: 'Does the planner suggest what to pack and budget?', a: 'Yes — generate a packing list tailored to your trip dates and destinations, and estimate a budget for accommodation, food and activities.' },
  ]
  write('/trip-planner', render({
    urlPath: '/trip-planner',
    title: 'Free holiday trip planner — build a day-by-day itinerary | myholidaypilot',
    description: 'Plan your holiday for free: pick places region by region, build a day-by-day itinerary on a map, and get packing lists and budget estimates. Export to PDF or share with friends.',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'myholidaypilot trip planner',
        url: `${SITE}/trip-planner`, applicationCategory: 'TravelApplication',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' } },
      { '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      breadcrumb([{ name: 'Home', url: SITE }, { name: 'Trip planner', url: `${SITE}/trip-planner` }]),
    ],
    bodyHtml: `<main><h1>Free holiday trip planner</h1>
<p>Build a day-by-day itinerary for your next holiday — pick from hand-curated places region by region, see each day on a map, and keep packing lists and budgets in one place.</p>
<h2>How it works</h2>
<ol>
<li><strong>Pick a destination</strong> — browse <a href="${SITE}/destinations">every country</a> region by region, each with its towns, landmarks and restaurants.</li>
<li><strong>Save the places you love</strong> — tap the heart on any place to add it to your trip.</li>
<li><strong>Arrange your days</strong> — drag places into a day-by-day itinerary and see each day mapped.</li>
<li><strong>Get ready</strong> — generate a packing list for your dates, estimate a budget, and export the whole plan as a PDF.</li>
</ol>
<h2>Everything in one place</h2>
<p>Festival calendars so you can time your trip, curated restaurants with the dish to order, honest local tips, and a timeline of each country's history — all connected to your plan.</p>
<h2>Frequently asked questions</h2>
${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}
<p><a href="${SITE}/plan">Start planning your trip</a> or <a href="${SITE}/destinations">browse destinations</a>.</p>
</main>`,
  }))
  pages++
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
      bodyHtml: `<main><h1>The journal</h1><p>Travel notes and guides — how to travel region by region, eat like a local, and time your trips.</p>`
        + `<ul>${posts.map((p) => {
            const ex = p.dek || (Array.isArray(p.body) ? p.body.find((x) => typeof x === 'string') : '') || ''
            const tag = p.tag ? `${esc(p.tag)} · ` : ''
            return `<li><a href="${SITE}/blog/${p.slug}">${esc(p.title)}</a>${ex ? `<br>${tag}${esc(truncate(ex, 140))}` : ''}</li>`
          }).join('')}</ul></main>`,
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
  const body = sitemapUrls.map((u) =>
    `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), xml)
  fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`)
  console.log(`✓ wrote sitemap.xml (${sitemapUrls.length} urls) + robots.txt`)
}

console.log(`✓ prerendered ${pages} content pages into dist/ (${countries.length} countries)`)
