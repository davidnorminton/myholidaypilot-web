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
// `image` sets og:image and, by default, preloads that same image as the hero.
// Pass preloadHero: false when og:image is only a representative share card and
// isn't what the page actually paints — preloading it would just waste bytes.
function render({ urlPath, title, description, image, jsonLd, bodyHtml, preloadImagesFor, preloadHero = true, ogType }) {
  let html = template
  const canonical = SITE + (urlPath === '/' ? '' : urlPath)
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(canonical)}$2`)
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
  // The template hardcodes og:type=website, which is right for most of the site
  // but wrong for the journal — articles want og:type=article so shares and
  // parsers treat them as writing with an author and a date.
  if (ogType) html = html.replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${esc(ogType)}$2`)
  if (image) {
    html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`)
    // Preload the hero at the size the app will render it (1600 bucket): the
    // browser starts downloading it the moment HTML arrives — before any JS.
    if (preloadHero) {
      const heroHref = imgUrl(image, 1600)
      html = html.replace('</head>', `  <link rel="preload" as="image" href="${esc(heroHref)}" fetchpriority="high" />\n  </head>`)
    }
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
  // inject crawler-readable content into #root, wrapped in the site header and
  // footer so every page carries the global nav. HEADER_HTML/FOOTER_HTML are
  // defined further down (they need the country list); safe because render() is
  // only ever *called* after that point.
  html = html.replace('<div id="root"></div>', `<div id="root">${HEADER_HTML}${bodyHtml}${FOOTER_HTML}</div>`)
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

// Mirrors dateLabel() in FestivalsCalendar.jsx, but spells the month out:
// "1–21 February" / "3 May" / "All August" (f.month is 1-12).
const FEST_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const festivalDate = (f) => {
  const ms = FEST_MONTHS[f.month - 1]
  if (!ms) return ''
  if (f.dayStart == null) return `All ${ms}`
  if (f.dayEnd != null && f.dayEnd !== f.dayStart) return `${f.dayStart}–${f.dayEnd} ${ms}`
  return `${f.dayStart} ${ms}`
}

// breadcrumb trail in search results instead of a bare URL.
const breadcrumb = (crumbs) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) })
const countries = fs.existsSync(dataDir)
  ? fs.readdirSync(dataDir).filter((d) => fs.existsSync(path.join(dataDir, d, 'index.json')))
  : []

// ── posts (collected up front) ──────────────────────────────────────────────
// Hoisted above the country loop because the country hubs link to their own
// tagged posts — the /blog pages further down render this same set.
// Bundled posts (src/lib/blog.js) always load. Published DB posts are
// best-effort: a missing or unreachable database NEVER fails the build — the
// bundled posts and every content page still ship.
const postSlugify = (s) => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// ── post bodies ─────────────────────────────────────────────────────────────
// Posts store their body as an array of paragraphs (bundled/seeded) OR as an
// HTML string (what the admin editor writes). Only the array branch was handled
// here, so every string-bodied post prerendered as a title + dek stub with no
// article text at all.
//
// blogStore.js sanitises body HTML at the source before it can reach
// dangerouslySetInnerHTML. Prerendering must do the same — arguably more so:
// this HTML is static and would run *before* React ever loads. Same library,
// same profile, so the prerendered markup matches what the app renders.
// If dompurify/jsdom can't be loaded we degrade to stripped, escaped text
// rather than ever emitting unsanitised HTML.
let purify = null
try {
  const [{ default: createDOMPurify }, { JSDOM }] = await Promise.all([import('dompurify'), import('jsdom')])
  purify = createDOMPurify(new JSDOM('').window)
} catch {
  console.warn('  blog: dompurify/jsdom unavailable — post bodies fall back to plain text')
}
const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
// Mirrors bodyToHtml() in blogStore.js.
const postBody = (body) => {
  const raw = Array.isArray(body) ? body.map((x) => `<p>${x}</p>`).join('\n') : String(body || '')
  if (!raw.trim()) return { html: '', text: '' }
  const html = purify ? purify.sanitize(raw, { USE_PROFILES: { html: true } }) : `<p>${esc(stripTags(raw))}</p>`
  return { html, text: stripTags(html) }
}
// Both shapes normalised once, at collection time, so nothing downstream has to
// care whether a body arrived as an array or a string.
const postBodyFields = (body) => {
  const { html, text } = postBody(body)
  return { bodyHtml: html, bodyText: text }
}

const POSTS_ALL = await (async () => {
  const bySlug = new Map()

  // 1. bundled posts
  // Bundled posts use excerpt/cover/date; DB rows use dek/coverImage/publishedAt.
  // Mirror blogStore.js normalize() so the prerendered HTML carries the same
  // excerpt, share image and date the app shows — without these fallbacks the
  // bundled posts prerender with no og:image and no datePublished.
  try {
    const mod = await import(path.join(root, 'src/lib/blog.js'))
    for (const p of (mod.POSTS || [])) {
      const s = postSlugify(p.slug || p.title)
      if (s) bySlug.set(s, { slug: s, title: p.title, dek: p.dek || p.excerpt, tag: p.tag, author: p.author,
        ...postBodyFields(p.body),
        coverImage: p.coverImage || p.cover,
        publishedAt: p.publishedAt || (p.date ? Date.parse(p.date) : null),
        tags: Array.isArray(p.tags) ? p.tags : [] })
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
        const s = postSlugify(r.slug || r.title)
        if (s) bySlug.set(s, { slug: s, title: r.title, dek: r.dek, tag: r.tag, author: r.author,
          ...postBodyFields(r.body),
          coverImage: r.coverImage, publishedAt: r.publishedAt, updatedAt: r.updatedAt,
          tags: Array.isArray(r.tags) ? r.tags : [] })
      }
      console.log(`  blog: ${rows.length} published posts from DB`)
    } catch (e) {
      console.warn(`  blog: skipped DB posts (${e.message.split('\n')[0]}) — bundled posts still prerendered`)
    }
  } else {
    console.log('  blog: no DATABASE_URL at build — only bundled posts prerendered')
  }

  return [...bySlug.values()]
})()

// ── site footer ─────────────────────────────────────────────────────────────
// Footer.jsx is React chrome rendered *outside* #root, so `curl` saw no footer
// at all: before JS ran the site had no global navigation, and every page's
// only outbound links were the ones in its own body. render() now appends this
// to every prerendered page. React replaces #root wholesale on mount
// (createRoot, not hydrateRoot), so this is crawler-only and cannot cause a
// hydration mismatch. Headings are <h2>: these are top-level sections of the
// document, and using <h3> (as Footer.jsx does visually) skipped a level on
// every page whose body has no h2 of its own.
// Two deliberate deviations from the component:
//   · "Top countries" is filtered to countries that actually have data. The
//     component hardcodes five; linking one that isn't imported yet would point
//     crawlers at a NotFound page.
//   · Personal pages (Saved places, My home, Your travel map) are skipped —
//     they render empty for a signed-out crawler and only burn crawl budget.
const FOOTER_TOP_COUNTRIES = ['france', 'italy', 'united_kingdom', 'united_states', 'spain']
const fLink = (href, label) => `<li><a href="${SITE}${href}">${esc(label)}</a></li>`
const FOOTER_HTML = (() => {
  const live = FOOTER_TOP_COUNTRIES.filter((c) => countries.includes(c))
  return `<footer><nav aria-label="Footer">`
    + `<h2>Explore</h2><ul>`
      + fLink('/destinations', 'Destinations') + fLink('/day-trips', 'Day-trip finder')
      + fLink('/trip-ideas', 'Trip ideas') + fLink('/blog', 'The blog')
    + `</ul><h2>Plan</h2><ul>`
      + fLink('/trip-planner', 'Trip planner') + fLink('/guided', 'Guided planner')
    + `</ul><h2>Discover</h2><ul>`
      + fLink('/featured-destinations', 'Featured destinations')
    + `</ul>`
    + (live.length ? `<h2>Top countries</h2><ul>${live.map((c) =>
        fLink(`/${c}`, nameFor(c, readJson(path.join(dataDir, c, 'country.json'), {})) || c)).join('')}</ul>` : '')
    + `<h2>More</h2><ul>`
      + fLink('/how-it-works', 'How the planner works') + fLink('/contact', 'Contact')
      + fLink('/privacy', 'Privacy policy') + fLink('/terms', 'Terms of use')
      + fLink('/cookies', 'Cookie policy')
    + `</ul></nav><p>© ${new Date().getFullYear()} myholidaypilot. All rights reserved.</p></footer>`
})()

// ── site header ─────────────────────────────────────────────────────────────
// TopBar.jsx is React chrome too, so `curl` saw no masthead and — more to the
// point — pages like blog posts carried no link back to the site at all. Mirrors
// TopBar's HEADER_LINKS (its drawer list is already covered by the footer).
// The brand link is plain text: the component's logo is an inline SVG.
const HEADER_HTML = `<header><a href="${SITE}/">myholidaypilot</a>`
  + `<nav aria-label="Primary"><ul>`
    + fLink('/destinations', 'Destinations') + fLink('/trip-planner', 'Trip planner')
    + fLink('/trip-ideas', 'Trip ideas')
  + `</ul></nav></header>`

// ── published trips (/trip-ideas) ────────────────────────────────────────────
// Live rows from public_trips. Same best-effort contract as the posts: no
// database at build simply means no /trip-ideas pages, never a failed build.
const TRIPS_ALL = await (async () => {
  if (!process.env.DATABASE_URL) return []
  try {
    const { getDb } = await import(path.join(root, 'db/client.js'))
    const schema = await import(path.join(root, 'db/schema.js'))
    const { eq } = await import('drizzle-orm')
    const db = getDb()
    const rows = await db.select().from(schema.publicTrips).where(eq(schema.publicTrips.status, 'live'))
    console.log(`  trip-ideas: ${rows.length} published trips from DB`)
    return rows
  } catch (e) {
    console.warn(`  trip-ideas: skipped (${e.message.split('\n')[0]})`)
    return []
  }
})()

// Posts belonging to one country. The country slug travels in the post's tags[]
// (written by the admin blog editor — see AdminBlog.jsx), so match on that.
// Mirrors BlogCarousel's matcher so the prerendered list and the client-rendered
// carousel agree: slug, or the display name with spaces underscored, or the bare
// display name — all case-insensitive.
const postsForCountry = (slug, name) => {
  const lower = String(name || '').toLowerCase()
  const want = new Set([slug, lower.replace(/\s+/g, '_'), lower].filter(Boolean))
  return POSTS_ALL.filter((p) => [p.tag, ...(Array.isArray(p.tags) ? p.tags : [])]
    .filter(Boolean)
    .map((t) => String(t).toLowerCase())
    .some((t) => want.has(t)))
}

// ── home page ───────────────────────────────────────────────────────────────
// Assembled from the static, high-value parts (headline, pitch, feature
// sections, destination list). Dynamic bits (live blog, rankings) stay
// client-side — crawlers get the substance, humans get the full SPA.
{
  const livePairs = countries
    .map((slug) => ({ slug, name: nameFor(slug, readJson(path.join(dataDir, slug, 'country.json'), {})) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  // Most recent posts, newest first. Bundled posts carry no publishedAt, so they
  // sort last rather than throwing the order.
  const homePosts = [...POSTS_ALL]
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .slice(0, 6)
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
    description: 'Plan your holiday region by region: handcrafted travel guides with things to do, where to eat and festival dates — plus a free day-by-day trip planner.',
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
      // Mirrors the home page's "From the blog" row. Without this nothing in the
      // prerendered HTML linked to /blog at all — the nav, footer and carousel
      // that link to it are React chrome, outside #root — so the journal and
      // every post were sitemap-only discoveries.
      + (homePosts.length ? `<h2>From the blog</h2><ul>${homePosts.map((p) => {
          const ex = p.dek || p.bodyText || ''
          return `<li><a href="${SITE}/blog/${p.slug}">${esc(p.title)}</a>${ex ? ` — ${esc(truncate(ex, 120))}` : ''}</li>`
        }).join('')}</ul><p><a href="${SITE}/blog">Read the journal</a></p>` : '')
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
  // Editorial top 10, baked into index.json by the exporter. Drop any entry
  // that can't form a real place URL, then order by rank (rank 1 = best).
  const top10 = (Array.isArray(index.top10) ? index.top10 : [])
    .filter((t) => t && t.name && t.regionId && t.placeId)
    .sort((a, b) => (a.rank || 0) - (b.rank || 0))
  const countryPosts = postsForCountry(slug, name)
  // The hub cards the screen actually renders (hub.json, with the same fallback
  // ItalyHubScreen uses). Prerendered as links so the guide pages are reachable
  // by crawl and not only via the sitemap. 'plan' is dropped on purpose: it's a
  // JS action that mints a trip and lands on the auth-gated planner.
  const hubJson = readJson(path.join(cDir, 'hub.json'), {})
  const hubSections = ((hubJson.sections || []).length ? hubJson.sections : [
    { id: 'regions', title: 'Regions', blurb: 'Every region — their towns, tables and stories.', link: `/${slug}/regions` },
    { id: 'festivals', title: 'Festivals & events', blurb: 'Celebrations and events, month by month.', link: `/${slug}/festivals` },
    { id: 'history', title: 'History', blurb: 'How the country came to be.', link: `/${slug}/history` },
    { id: 'food', title: 'Food & wine', blurb: 'What to order, region by region.', link: `/${slug}/food` },
    { id: 'transport', title: 'Getting around', blurb: 'Trains, driving and how to move around.', link: `/${slug}/transport` },
  ]).filter((s) => s && s.link && s.id !== 'plan')
  // Share card: the visible hero is the countryHero *setting* (a live overlay we
  // can't read at build), so fall back to the country's number-one destination —
  // a real photo of the place beats the generic site-wide default.
  const hubImage = (() => {
    const im = top10[0]?.image
    return (typeof im === 'string' ? im : im?.url) || null
  })()
  write(`/${slug}`, render({
    urlPath: `/${slug}`,
    preloadImagesFor: slug,
    image: hubImage || undefined,
    preloadHero: false,
    title: `${name} travel guide — regions, places & holiday planning | myholidaypilot`,
    description: truncate(`${blurb} ${regionNames.length ? 'Regions: ' + regionNames.join(', ') + '.' : ''}`),
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'TouristDestination', name, description: blurb, url: `${SITE}/${slug}` },
      // The ranking, made legible to crawlers. Positions ascend (1 = top pick),
      // each pointing at the real place page rather than an inline blob.
      ...(top10.length ? [{
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: `Top tourist destinations in ${name}`,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: top10.length,
        itemListElement: top10.map((t, i) => ({
          '@type': 'ListItem', position: t.rank || i + 1, name: t.name,
          url: `${SITE}/${slug}/${t.regionId}/${t.placeId}`,
        })),
      }] : []),
      ...(faqJsonLd(index.details) ? [faqJsonLd(index.details)] : []),
    ],
    bodyHtml: `<main><nav><a href="${SITE}/destinations">Destinations</a></nav><h1>${esc(name)}</h1><p>${esc(blurb)}</p>`
      + detailsHtml(index.details, `Plan your trip to ${name}`)
      // The hub cards, as crawlable links — previously the guide pages had no
      // inbound link from anywhere on the site.
      + (hubSections.length ? `<h2>Explore ${esc(name)}</h2><ul>${hubSections.map((s) =>
          `<li><a href="${SITE}${s.link}">${esc(s.title)}</a>${s.blurb ? ` — ${esc(s.blurb)}` : ''}</li>`).join('')}</ul>` : '')
      // Ranked list — <ol> so the order carries semantically, not just visually.
      + (top10.length ? `<h2>Top tourist destinations in ${esc(name)}</h2><ol>${top10.map((t) => {
          const where = t.regionName ? ` (${esc(t.regionName)})` : ''
          const d = t.description ? ` — ${esc(truncate(t.description, 140))}` : ''
          return `<li><a href="${SITE}/${slug}/${t.regionId}/${t.placeId}">${esc(t.name)}</a>${where}${d}</li>`
        }).join('')}</ol>` : '')
      + ((index.regions || []).length ? `<h2>Regions</h2><ul>${(index.regions || []).map((r) =>
          `<li><a href="${SITE}/${slug}/${r.id}">${esc(r.name)}</a></li>`).join('')}</ul>` : '')
      // Internal links from the hub to the country's journal posts. Silent until
      // posts are tagged with the country slug in the admin editor.
      + (countryPosts.length ? `<h2>Reading about ${esc(name)}</h2><ul>${countryPosts.map((p) => {
          const ex = p.dek || p.bodyText || ''
          return `<li><a href="${SITE}/blog/${p.slug}">${esc(p.title)}</a>${ex ? ` — ${esc(truncate(ex, 120))}` : ''}</li>`
        }).join('')}</ul>` : '')
      + `</main>`,
  }))
  addUrl(`/${slug}`, '0.9'); pages++

  // regions index — the "Regions" hub card's destination. A real SPA route
  // (RegionsScreen), but it was the one country-level URL with no prerendered
  // HTML and no sitemap entry.
  {
    const rs = index.regions || []
    write(`/${slug}/regions`, render({
      urlPath: `/${slug}/regions`,
      preloadImagesFor: slug,
      image: rs[0]?.cardImage || undefined,
      preloadHero: false,
      title: `Regions of ${name} — every region, mapped | myholidaypilot`,
      description: truncate(`All the regions of ${name} — their towns, tables and stories.${regionNames.length ? ' ' + regionNames.join(', ') + '.' : ''}`),
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `Regions of ${name}`, url: `${SITE}/${slug}/regions` },
        breadcrumb([{ name: 'Destinations', url: `${SITE}/destinations` }, { name, url: `${SITE}/${slug}` }, { name: 'Regions', url: `${SITE}/${slug}/regions` }]),
      ],
      bodyHtml: `<main><nav><a href="${SITE}/destinations">Destinations</a> › <a href="${SITE}/${slug}">${esc(name)}</a></nav>`
        + `<h1>Regions of ${esc(name)}</h1><p>All the regions of ${esc(name)} — their towns, tables and stories.</p>`
        + (rs.length ? `<ul>${rs.map((r) => {
            const bits = [r.capital ? `Capital: ${esc(r.capital)}` : '', r.placeCount ? `${r.placeCount} places` : '']
              .filter(Boolean).join(' · ')
            return `<li><a href="${SITE}/${slug}/${r.id}">${esc(r.name)}</a>${bits ? ` — ${bits}` : ''}</li>`
          }).join('')}</ul>` : '')
        + `</main>`,
    }))
    addUrl(`/${slug}/regions`, '0.8'); pages++
  }

  // country-level guide pages (festivals / history / food / transport)
  for (const topic of ['festivals', 'history', 'food', 'transport']) {
    const g = readJson(path.join(cDir, 'guide', `${topic}.json`))
    if (!g) continue
    let inner = ''
    if (topic === 'festivals' && Array.isArray(g.festivals)) {
      inner = `<ul>${g.festivals.map((f) => {
        // f.month is 1-12; printing it raw gave "(2, Veneto)". Mirror
        // FestivalsCalendar's dateLabel(), spelling the month out in full — the
        // calendar has room for "Feb", a search result does not.
        const when = festivalDate(f)
        // The calendar links the region; do the same so festivals feed the
        // region pages instead of being a dead end.
        const where = f.isNational ? 'National'
          : (f.regionName && f.regionId ? `<a href="${SITE}/${slug}/${f.regionId}">${esc(f.regionName)}</a>`
            : esc(f.regionName || ''))
        const meta = [when, esc(f.location || ''), where].filter(Boolean).join(' · ')
        const d = f.description || f.detail
        return `<li>${esc(f.name)}${meta ? ` (${meta})` : ''}${d ? ` — ${esc(truncate(d, 140))}` : ''}</li>`
      }).join('')}</ul>`
    } else if (Array.isArray(g.sections)) {
      inner = g.sections.map((sec) => {
        const items = (sec.items || []).map((it) => {
          const label = it.label || it.period || it.name || ''
          const text = it.text || it.detail || it.description || ''
          // Timeline eras (history) also carry dates + a summary lede, both of
          // which GuideScreen's <Timeline> shows and both of which were being
          // dropped here. `facts` is deliberately NOT rendered — the app
          // doesn't show it either, and prerendered HTML shouldn't invent
          // content the page never displays.
          const dates = it.dates ? ` (${esc(it.dates)})` : ''
          const prose = [it.summary, text].filter(Boolean).map(esc).join(' ')
          return `<li>${label ? `<strong>${esc(label)}</strong>` : ''}${dates}`
            + `${(label || dates) && prose ? ' — ' : ''}${prose}</li>`
        }).join('')
        // GuideScreen renders section titles as <h2 className="about__title">;
        // emitting <h3> here both diverged from the app and skipped a heading
        // level (these pages have no h2 of their own).
        // sec.body is GuideScreen's lede above the items. Italy's data has none,
        // but the other countries' guides may — without this it would silently
        // vanish from the prerendered page.
        return (sec.title ? `<h2>${esc(sec.title)}</h2>` : '')
          + (sec.body ? `<p>${esc(sec.body)}</p>` : '')
          + (items ? `<ul>${items}</ul>` : '')
      }).join('')
    }
    const gtitle = g.title || topic
    // The guide subtitles are display copy and often very short ("Eat like an
    // Italian" = 19 chars), which made for a thin meta description. Pad it out
    // with what the page actually covers.
    const gextra = topic === 'festivals' && Array.isArray(g.festivals)
      ? g.festivals.slice(0, 4).map((f) => f.name).filter(Boolean).join(', ')
      : (() => {
          const titles = (g.sections || []).map((s) => s.title).filter(Boolean)
          if (titles.length) return titles.slice(0, 5).join(', ')
          // Timeline guides (history) are one untitled section — name the eras.
          return (g.sections || []).flatMap((s) => (s.items || []).map((it) => it.label))
            .filter(Boolean).slice(0, 5).join(', ')
        })()
    // Titles like "History of Italy" already name the country; don't say it twice.
    const gLead = gtitle.toLowerCase().includes(String(name).toLowerCase()) ? gtitle : `${gtitle} in ${name}`
    const sentence = (s) => { const t = String(s || '').trim(); return t && !/[.!?…]$/.test(t) ? `${t}.` : t }
    const gdesc = truncate([
      sentence(gLead),
      sentence(g.subtitle),
      gextra ? sentence(`${topic === 'festivals' ? 'Including' : 'Covering'}: ${gextra}`) : '',
    ].filter(Boolean).join(' '))
    write(`/${slug}/${topic}`, render({
      urlPath: `/${slug}/${topic}`,
      title: `${gtitle} — ${name} travel guide | myholidaypilot`,
      description: gdesc,
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
    title: 'Holiday trip planner — build a day-by-day itinerary | myholidaypilot',
    description: 'Plan your holiday free: pick places region by region, build a day-by-day itinerary on a map, and get packing lists and budgets. Export as a PDF or share it.',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'myholidaypilot trip planner',
        url: `${SITE}/trip-planner`, applicationCategory: 'TravelApplication',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' } },
      { '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      breadcrumb([{ name: 'Home', url: SITE }, { name: 'Trip planner', url: `${SITE}/trip-planner` }]),
    ],
    bodyHtml: `<main><h1>Holiday trip planner</h1>
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
// Renders POSTS_ALL, collected once near the top (the country hubs need the same
// set to build their "Reading about …" links).
{
  const posts = POSTS_ALL
  if (posts.length) {
    // /blog index
    write('/blog', render({
      urlPath: '/blog',
      title: 'The journal — travel notes & guides | myholidaypilot',
      description: 'Travel writing from myholidaypilot: how to travel region by region, eat like a local, and time your trips.',
      jsonLd: { '@context': 'https://schema.org', '@type': 'Blog', name: 'myholidaypilot journal', url: `${SITE}/blog` },
      bodyHtml: `<main><h1>The journal</h1><p>Travel notes and guides — how to travel region by region, eat like a local, and time your trips.</p>`
        + `<ul>${posts.map((p) => {
            const ex = p.dek || p.bodyText || ''
            const tag = p.tag ? `${esc(p.tag)} · ` : ''
            return `<li><a href="${SITE}/blog/${p.slug}">${esc(p.title)}</a>${ex ? `<br>${tag}${esc(truncate(ex, 140))}` : ''}</li>`
          }).join('')}</ul></main>`,
    }))
    addUrl('/blog', '0.6', toDate(Math.max(0, ...posts.map((p) => p.updatedAt || p.publishedAt || 0))) || undefined); pages++

    // each post
    for (const p of posts) {
      const desc = truncate(p.dek || p.bodyText || p.title)
      write(`/blog/${p.slug}`, render({
        urlPath: `/blog/${p.slug}`,
        title: `${p.title} | myholidaypilot`,
        description: desc,
        image: p.coverImage,
        ogType: 'article',
        jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: p.title,
          description: desc, author: { '@type': p.author ? 'Person' : 'Organization', name: p.author || 'myholidaypilot' },
          image: p.coverImage || undefined, url: `${SITE}/blog/${p.slug}`,
          datePublished: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined,
          ...(p.bodyText ? { articleBody: p.bodyText, wordCount: p.bodyText.split(/\s+/).length } : {}) },
        // p.bodyHtml is already sanitised at collection time (same DOMPurify
        // profile the app uses) — it carries the post's real headings, lists
        // and links rather than the flattened paragraphs this used to emit.
        bodyHtml: `<main><article><h1>${esc(p.title)}</h1>`
          + (p.dek ? `<p>${esc(p.dek)}</p>` : '')
          + (p.author ? `<p>By ${esc(p.author)}</p>` : '')
          + (p.bodyHtml || '')
          + `</article></main>`,
      }))
      // lastmod means last *modified*. Stamping today on every build tells
      // crawlers the whole journal changed on every deploy, which devalues the
      // signal — use the post's own updated/published date.
      addUrl(`/blog/${p.slug}`, '0.6', toDate(p.updatedAt || p.publishedAt)); pages++
    }
  }
}

// ── /trip-ideas: published itineraries ──────────────────────────────────────
// Real, unique content — other people's day-by-day plans — that until now only
// existed behind a client-side fetch. Each trip's places link back to the real
// place pages, so the gallery feeds the guides rather than being a dead end.
{
  const tripCard = (t) => {
    const regions = Array.isArray(t.regionNames) ? t.regionNames : []
    const bits = [
      t.days ? `${t.days} day${t.days === 1 ? '' : 's'}` : '',
      t.placeCount ? `${t.placeCount} place${t.placeCount === 1 ? '' : 's'}` : '',
      regions.length ? regions.join(', ') : '',
    ].filter(Boolean).join(' · ')
    return `<li><a href="${SITE}/trip-ideas/${esc(t.slug)}">${esc(t.title)}</a>${bits ? ` — ${esc(bits)}` : ''}</li>`
  }

  write('/trip-ideas', render({
    urlPath: '/trip-ideas',
    title: 'Trip ideas — real itineraries to copy | myholidaypilot',
    description: 'Real trips, planned day by day by real travellers — browse by region and length, then copy one into your own planner.',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Trip ideas', url: `${SITE}/trip-ideas` },
      breadcrumb([{ name: 'Home', url: SITE }, { name: 'Trip ideas', url: `${SITE}/trip-ideas` }]),
    ],
    bodyHtml: `<main><h1>Trip ideas</h1>`
      + `<p>Real trips, planned day by day by real travellers. Browse by region and length, then copy one straight into your own planner and make it yours.</p>`
      + (TRIPS_ALL.length ? `<h2>Published itineraries</h2><ul>${TRIPS_ALL.map(tripCard).join('')}</ul>` : '')
      + `<p><a href="${SITE}/destinations">Browse every destination</a> or <a href="${SITE}/trip-planner">start your own plan</a>.</p>`
      + `</main>`,
  }))
  addUrl('/trip-ideas', '0.7'); pages++

  for (const t of TRIPS_ALL) {
    const d = (t.data && typeof t.data === 'object') ? t.data : {}
    const places = Array.isArray(d.places) ? d.places : []
    const regions = Array.isArray(t.regionNames) ? t.regionNames : []
    const story = t.story || d.story || ''
    const desc = truncate(story || `A real ${t.days}-day itinerary${regions.length ? ` through ${regions.join(', ')}` : ''}, planned day by day — copy it into your own planner.`)
    // Places, in day order, each linking to its guide page.
    const byDay = [...places].sort((a, b) => (a.day || 0) - (b.day || 0))
    write(`/trip-ideas/${t.slug}`, render({
      urlPath: `/trip-ideas/${t.slug}`,
      title: `${t.title} — a ${t.days}-day trip to copy | myholidaypilot`,
      description: desc,
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'Article', headline: `${t.title} — a ${t.days}-day trip`,
          description: desc, url: `${SITE}/trip-ideas/${t.slug}`,
          author: { '@type': t.authorName ? 'Person' : 'Organization', name: t.authorName || 'myholidaypilot' },
          datePublished: t.createdAt ? new Date(t.createdAt).toISOString() : undefined },
        ...(byDay.length ? [{
          '@context': 'https://schema.org', '@type': 'ItemList',
          name: `Places on this ${t.days}-day trip`,
          numberOfItems: byDay.length,
          itemListElement: byDay.map((pl, i) => ({
            '@type': 'ListItem', position: i + 1, name: pl.name,
            url: `${SITE}/${t.countryId}/${pl.regionId}/${pl.placeId}`,
          })),
        }] : []),
        breadcrumb([{ name: 'Home', url: SITE }, { name: 'Trip ideas', url: `${SITE}/trip-ideas` },
          { name: t.title, url: `${SITE}/trip-ideas/${t.slug}` }]),
      ],
      bodyHtml: `<main><nav><a href="${SITE}/trip-ideas">Trip ideas</a></nav>`
        + `<h1>${esc(t.title)}</h1>`
        + `<p>A ${esc(String(t.days))}-day trip${regions.length ? ` through ${esc(regions.join(', '))}` : ''}`
        + `${t.authorName ? `, planned by ${esc(t.authorName)}` : ''}.</p>`
        + (story ? `<p>${esc(story)}</p>` : '')
        + (byDay.length ? `<h2>The itinerary</h2><ol>${byDay.map((pl) => {
            const acts = (pl.attractions || []).map((a) => a.text).filter(Boolean)
            const day = pl.day ? `Day ${esc(String(pl.day))}: ` : ''
            const url = `${SITE}/${t.countryId}/${pl.regionId}/${pl.placeId}`
            return `<li>${day}<a href="${url}">${esc(pl.name)}</a>`
              + `${pl.regionName ? ` (${esc(pl.regionName)})` : ''}`
              + `${acts.length ? ` — ${esc(acts.slice(0, 4).join('; '))}` : ''}</li>`
          }).join('')}</ol>` : '')
        + `<p><a href="${SITE}/trip-planner">Copy this trip into your own planner</a>.</p>`
        + `</main>`,
    }))
    addUrl(`/trip-ideas/${t.slug}`, '0.6', toDate(t.updatedAt || t.createdAt)); pages++
  }
}

// ── standalone screens ──────────────────────────────────────────────────────
// These routes were served by the SPA fallback: a crawler got an empty #root.
// Their copy lives inside JSX components, so rather than duplicate it here (two
// sources of truth — a bad trade for a privacy policy especially) each gets its
// real title/description — lifted from the screen's own useSeo() — a heading,
// an accurate summary and onward links. React still renders the full page.
{
  const screens = [
    { path: '/how-it-works', priority: '0.7',
      title: 'How the trip planner works | myholidaypilot',
      description: 'Plan a holiday day by day: pick a destination and dates, choose things to do, experiences, food and hotels for each day, then book it all in one place.',
      h1: 'How the trip planner works',
      body: `<p>From “let’s go somewhere” to a day-by-day plan you can book — in six steps.</p>`
        + `<ol>`
        + `<li><strong>Pick a destination and dates</strong> — choose a country and your travel dates, and add your flights if you know them.</li>`
        + `<li><strong>Plan day by day</strong> — every day of your trip gets its own date in the sidebar.</li>`
        + `<li><strong>Fill each day</strong> — things to do, bookable experiences, places to eat, and where you’re staying.</li>`
        + `<li><strong>Save and order the day</strong> — drag items into the running order and track your progress.</li>`
        + `<li><strong>Review &amp; book</strong> — everything bookable gathered in one place, each linking out to the booking site.</li>`
        + `<li><strong>Take it with you</strong> — export a PDF, share a read-only link, or publish it to Trip ideas.</li>`
        + `</ol>`,
      links: [['/trip-planner', 'Start planning'], ['/destinations', 'Browse destinations']] },
    { path: '/featured-destinations', priority: '0.7',
      title: 'Featured destinations — hand-picked places worth travelling for | myholidaypilot',
      description: 'Our current hand-picked featured destinations — standout towns, cities and places from our guides, chosen by the editors.',
      h1: 'Featured destinations',
      body: `<p>Standout towns, cities and places from across our guides, hand-picked by the editors — the ones worth building a trip around. The selection changes as we add countries and find new favourites.</p>`,
      links: [['/destinations', 'Browse every destination'], ['/trip-ideas', 'See real itineraries']] },
    { path: '/day-trips', priority: '0.7',
      title: 'Day-trip finder — every trip within reach of your base | myholidaypilot',
      description: 'Pick your base and see every worthwhile day trip within reach — ranked by distance, with drive times.',
      h1: 'Day-trip finder',
      body: `<p>Pick the town or city you’re based in and see every worthwhile day trip within reach — ranked by distance, with drive times and the nearest station, so you can tell in seconds what’s an easy morning out and what needs a whole day.</p>`,
      links: [['/destinations', 'Pick a destination'], ['/trip-planner', 'Plan a trip']] },
    { path: '/guided', priority: '0.7',
      title: 'Guided planner — a ready-made trip in 30 seconds | myholidaypilot',
      description: 'Answer five quick questions and get a complete day-by-day itinerary — places, things to do, where to eat — ready to fine-tune.',
      h1: 'Guided planner',
      body: `<p>Answer five quick questions — where, how long, what you’re into, what pace, what style — and get a complete day-by-day itinerary built from our guides: places, things to do and where to eat, ready to fine-tune in the planner.</p>`,
      links: [['/trip-planner', 'Open the planner'], ['/trip-ideas', 'Browse trip ideas']] },
    { path: '/map', priority: '0.6',
      title: 'World map — every country we cover | myholidaypilot',
      description: 'Every country on myholidaypilot on one interactive map — tap a point for regions, places and the full guide.',
      h1: 'Every country, one map',
      body: `<p>One point per country we cover. Tap a point for the capital, how many regions and places we’ve mapped, and a link straight into the full guide.</p>`,
      links: [['/destinations', 'Browse every destination'], ['/trip-planner', 'Plan a trip']] },
    { path: '/contact', priority: '0.4',
      title: 'Contact us | myholidaypilot',
      description: 'Questions, corrections or ideas — get in touch with the myholidaypilot team.',
      h1: 'Contact us',
      body: `<p>Questions, corrections or ideas — get in touch and we’ll come back to you. If you’ve spotted something wrong in a guide, tell us which place and what’s off, and we’ll fix it.</p>`,
      links: [['/how-it-works', 'How the planner works']] },
    { path: '/privacy', priority: '0.3',
      title: 'Privacy policy | myholidaypilot',
      description: 'How myholidaypilot collects, uses and protects your information.',
      h1: 'Privacy policy',
      body: `<p>What information we hold when you use myholidaypilot, why we hold it, and the choices you have. Browse without signing in and your draft trips stay in your own browser and never reach our servers.</p>`,
      links: [['/terms', 'Terms of use'], ['/cookies', 'Cookie policy'], ['/contact', 'Contact us']] },
    { path: '/terms', priority: '0.3',
      title: 'Terms of use | myholidaypilot',
      description: 'The terms that apply when you use myholidaypilot.',
      h1: 'Terms of use',
      body: `<p>The terms that apply when you use myholidaypilot — what you can expect from us, what we ask of you, and the limits of what a travel guide can promise.</p>`,
      links: [['/privacy', 'Privacy policy'], ['/cookies', 'Cookie policy'], ['/contact', 'Contact us']] },
    { path: '/cookies', priority: '0.3',
      title: 'Cookie policy | myholidaypilot',
      description: 'How myholidaypilot uses cookies and browser storage.',
      h1: 'Cookie policy',
      body: `<p>How myholidaypilot uses cookies and browser storage — what’s strictly needed to keep you signed in and your trips saved, and what isn’t.</p>`,
      links: [['/privacy', 'Privacy policy'], ['/terms', 'Terms of use'], ['/contact', 'Contact us']] },
  ]
  for (const s of screens) {
    write(s.path, render({
      urlPath: s.path,
      title: s.title,
      description: s.description,
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'WebPage', name: s.h1, description: s.description, url: SITE + s.path },
        breadcrumb([{ name: 'Home', url: SITE }, { name: s.h1, url: SITE + s.path }]),
      ],
      bodyHtml: `<main><h1>${esc(s.h1)}</h1>${s.body}`
        + `<p>${s.links.map(([h, l]) => `<a href="${SITE}${h}">${esc(l)}</a>`).join(' · ')}</p>`
        + `</main>`,
    }))
    addUrl(s.path, s.priority); pages++
  }
}

// ── sitemap.xml + robots.txt (complete, all countries) ───────────────────────
{
  const body = sitemapUrls.map((u) =>
    `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), xml)
  // Private / personal / thin routes. None of them have prerendered content, and
  // every one of them answers 200 with an empty SPA shell (the Vercel rewrite),
  // so left crawlable they burn budget and look like thin duplicates of each
  // other. The public marketing routes (/trip-planner, /trip-ideas, /day-trips,
  // /guided, /featured-destinations) are deliberately NOT listed.
  const disallow = ['/admin', '/account', '/saved', '/trips', '/login', '/signup', '/api/']
  fs.writeFileSync(path.join(dist, 'robots.txt'),
    `User-agent: *\nAllow: /\n${disallow.map((d) => `Disallow: ${d}`).join('\n')}\n\nSitemap: ${SITE}/sitemap.xml\n`)
  console.log(`✓ wrote sitemap.xml (${sitemapUrls.length} urls) + robots.txt`)
}

console.log(`✓ prerendered ${pages} content pages into dist/ (${countries.length} countries)`)
