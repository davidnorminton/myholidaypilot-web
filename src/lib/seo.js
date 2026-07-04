import { useEffect } from 'react'

// Central SEO config. Set VITE_SITE_URL to your production origin (no trailing
// slash), e.g. https://myholidaypilot.com — used for canonical URLs + sitemap.
export const SITE = {
  name: 'myholidaypilot',
  url: (import.meta.env.VITE_SITE_URL || 'https://myholidaypilot.com').replace(/\/+$/, ''),
  description: 'Handcrafted travel guides, region by region — where to go, what to do and eat, and the stories behind it.',
  ogImage: 'https://images.unsplash.com/photo-1476362174823-3a23f4aa6d76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200',
}

export const canonicalUrl = (path = '/') => SITE.url + (path === '/' ? '' : path)

function upsertMeta(attr, key, content) {
  if (content == null) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el) }
  el.setAttribute('content', content)
}
function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el) }
  el.setAttribute('href', href)
}
function setJsonLd(obj) {
  let el = document.head.querySelector('script[type="application/ld+json"][data-seo]')
  if (!obj) { if (el) el.remove(); return }
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.setAttribute('data-seo', ''); document.head.appendChild(el) }
  el.textContent = JSON.stringify(obj)
}

// Sets <title>, description, canonical, Open Graph, Twitter card and optional
// JSON-LD for the current page. Migration-ready: canonical/og:url use clean
// paths, which become live once the site moves off hash routing.
export function useSeo({ title, description, path = '/', image, type = 'website', jsonLd } = {}) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : ''
  useEffect(() => {
    const desc = description || SITE.description
    const url = canonicalUrl(path)
    const img = image || SITE.ogImage
    document.title = title ? `${title} · ${SITE.name}` : `${SITE.name} — travel, region by region`
    upsertMeta('name', 'description', desc)
    upsertLink('canonical', url)
    upsertMeta('property', 'og:title', title || SITE.name)
    upsertMeta('property', 'og:description', desc)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:site_name', SITE.name)
    upsertMeta('property', 'og:image', img)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title || SITE.name)
    upsertMeta('name', 'twitter:description', desc)
    upsertMeta('name', 'twitter:image', img)
    setJsonLd(jsonLd || null)
  }, [title, description, path, image, type, ld])
}

// ── sitemap + robots generation (used by the admin SEO tool) ─────────────────
const GUIDE_TOPICS = ['festivals', 'history', 'food', 'transport']

export function buildSitemap({ url, regions = [], places = [], posts = [], gallery = [] }) {
  const base = url.replace(/\/+$/, '')
  const today = new Date().toISOString().slice(0, 10)
  const rows = []
  const add = (loc, priority, lastmod = today) => rows.push({ loc: base + loc, lastmod, priority })

  add('/', '1.0')
  add('/destinations', '0.5')
  add('/italy', '0.9')
  add('/italy/regions', '0.8')
  GUIDE_TOPICS.forEach((t) => add(`/italy/${t}`, '0.7'))
  regions.forEach((r) => add(`/italy/${r.id}`, '0.8'))
  places.forEach((p) => add(`/italy/${p.regionId}/${p.placeId}`, '0.6'))
  add('/blog', '0.6')
  posts.forEach((p) => add(`/blog/${p.slug}`, '0.6', p.lastmod || today))
  add('/gallery', '0.7')
  gallery.forEach((g) => add(`/gallery/${g.slug}`, '0.6'))
  add('/app', '0.5')

  const body = rows.map((u) =>
    `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

export function buildRobots(url) {
  const base = url.replace(/\/+$/, '')
  return `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`
}
