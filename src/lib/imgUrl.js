// Resize images at the CDN edge instead of downloading full-size everywhere.
// Unsplash serves via imgix, so width/quality/format are URL parameters — a
// card shown at ~250px shouldn't download a 1080px file. This trims those
// requests dramatically (often 5-10x smaller) with no infrastructure.
//
//   imgUrl(url, 400)   → same photo, sized for a ~400px slot, WebP, retina-aware
//
// Unsplash/imgix URLs are resized with query params (imgix does the work).
// Everything else — our own uploads under /images/ — goes through Cloudflare
// Image Transformations. One function, every image.

const CDN = /(^https?:\/\/images\.unsplash\.com\/)|(\.imgix\.net\/)/i

// Standard slot sizes so the CDN caches a small set of variants rather than a
// unique URL per pixel. Round the requested width up to the next bucket.
const BUCKETS = [200, 300, 400, 600, 800, 1200, 1600, 2000]
const bucket = (w) => BUCKETS.find((b) => b >= w) || BUCKETS[BUCKETS.length - 1]

// ── Cloudflare Image Transformations ─────────────────────────────────────────
// Resizes our self-hosted images at the edge, the same job imgix does for
// Unsplash. Free plan includes 5,000 unique transformations a month; we have ~32
// images across ~6 widths, so ~200 — but note the Free ceiling FAILS (error
// 9422) rather than billing, hence onerror=redirect below.
//
// TURN THIS ON ONLY ONCE THE DOMAIN IS PROXIED THROUGH CLOUDFLARE (orange cloud)
// AND Transformations are enabled for the zone. Until then /cdn-cgi/image/… is
// just a path Vercel knows nothing about, and every one of these images 404s.
const CF_ENABLED = false
// Same-origin images use a relative /cdn-cgi/image/… path — no host to keep in
// sync, and no risk of the edge fetching the origin back through itself. Only
// set CF_BASE if you ever transform images on another host.
const CF_BASE = ''

// Cloudflare wants the source after the options, as either a path on this zone
// or an absolute URL:
//   /cdn-cgi/image/width=800,quality=70,format=auto/images/foo.webp
function cloudflareResize(url, width, quality, dpr) {
  // width here is CSS pixels; the file has to cover the device's pixels, and
  // Cloudflare has no dpr option of its own — so multiply it in ourselves. The
  // Unsplash branch gets this from imgix's dpr param.
  const w = bucket(width) * dpr
  const opts = [
    `width=${w}`,
    `quality=${quality}`,
    'format=auto',        // AVIF/WebP by Accept header, with a safe fallback
    'fit=scale-down',     // never upscale past the original
    'onerror=redirect',   // transformation failed (or 9422)? serve the original
  ].join(',')
  const src = url.startsWith('/') ? url.slice(1) : url
  return `${CF_BASE}/cdn-cgi/image/${opts}/${src}`
}

// The device's real pixel density, clamped to [1, 2]. dpr used to be a flat 2,
// which meant every 1× screen (most desktop monitors) downloaded FOUR TIMES the
// pixels it could display — on the site's heaviest asset class. Above 2 is
// clamped too: 3× phone screens gain nothing visible over 2× photos and the
// bytes triple. Fractional ratios (1.25/1.5 laptops) round to the nearest whole
// step because imgix bills fractional dpr the same and caches worse.
// Node (the prerender) has no window; it passes dpr explicitly per use.
const screenDpr = () => {
  if (typeof window === 'undefined' || !window.devicePixelRatio) return 2
  return Math.min(2, Math.max(1, Math.round(window.devicePixelRatio)))
}

export function imgUrl(url, width = 400, { quality = 70, dpr = screenDpr() } = {}) {
  if (!url || typeof url !== 'string') return url

  // Unsplash / imgix — resize via query params.
  if (CDN.test(url)) {
    try {
      const u = new URL(url)
      const w = bucket(width)
      u.searchParams.set('w', String(w))
      u.searchParams.set('q', String(quality))
      u.searchParams.set('auto', 'format')     // WebP/AVIF to browsers that support it
      u.searchParams.set('fit', 'crop')        // fill the slot cleanly
      u.searchParams.set('dpr', String(dpr))   // crisp on retina (w stays the CSS size)
      u.searchParams.delete('fm')              // let auto=format choose; drop forced jpg
      return u.toString()
    } catch {
      return url
    }
  }

  // Our own images: /images/foo.webp, or an absolute URL on a host we transform.
  // Deliberately NOT `/^https?:/` only — that was the old guard, and it excluded
  // the relative paths our uploads actually use, so the seam never fired on the
  // images it was built for. Data URLs and blobs are left well alone.
  if (CF_ENABLED && (url.startsWith('/') || /^https?:\/\//i.test(url))) {
    try { return cloudflareResize(url, width, quality, dpr) } catch { return url }
  }
  return url
}
