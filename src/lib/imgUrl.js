// Resize images at the CDN edge instead of downloading full-size everywhere.
// Unsplash serves via imgix, so width/quality/format are URL parameters — a
// card shown at ~250px shouldn't download a 1080px file. This trims those
// requests dramatically (often 5-10x smaller) with no infrastructure.
//
//   imgUrl(url, 400)   → same photo, sized for a ~400px slot, WebP, retina-aware
//
// Unsplash/imgix URLs are resized here. Everything else is returned UNTOUCHED
// for now — those are the non-Unsplash images destined to be self-hosted and
// resized through Cloudflare. When that's ready, route them via the CF seam
// below (see cloudflareResize) and this one function covers every image.

const CDN = /(^https?:\/\/images\.unsplash\.com\/)|(\.imgix\.net\/)/i

// Standard slot sizes so the CDN caches a small set of variants rather than a
// unique URL per pixel. Round the requested width up to the next bucket.
const BUCKETS = [200, 300, 400, 600, 800, 1200, 1600, 2000]
const bucket = (w) => BUCKETS.find((b) => b >= w) || BUCKETS[BUCKETS.length - 1]

// ── Cloudflare seam (not active yet) ─────────────────────────────────────────
// Once images are self-hosted behind Cloudflare, flip CF_ENABLED to true and
// set CF_BASE to your zone. Cloudflare Image Resizing takes the form:
//   https://yourdomain.com/cdn-cgi/image/width=400,quality=70,format=auto/<origin-url>
// This is the ONLY place that needs to change to cover all non-Unsplash images.
const CF_ENABLED = false
const CF_BASE = ''   // e.g. 'https://myholidaypilot.com'
function cloudflareResize(url, width, quality) {
  const w = bucket(width)
  return `${CF_BASE}/cdn-cgi/image/width=${w},quality=${quality},format=auto,fit=cover/${url}`
}

export function imgUrl(url, width = 400, { quality = 70, dpr = 2 } = {}) {
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

  // Everything else: route through Cloudflare once self-hosting is live,
  // otherwise pass through untouched (full-size, but working).
  if (CF_ENABLED && CF_BASE && /^https?:\/\//i.test(url)) {
    try { return cloudflareResize(url, width, quality) } catch { return url }
  }
  return url
}
