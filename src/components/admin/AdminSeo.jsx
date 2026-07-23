import { Globe } from 'lucide-react'
import { SITE } from '../../lib/seo.js'

// This section used to hand-build sitemap.xml/robots.txt for manual download —
// an Italy-era generator that knew one country and a fraction of the routes.
// Both files are now written by scripts/prerender.mjs on EVERY build, covering
// every live country, region, place, blog post, published trip and standalone
// page, with real lastmod dates. There is nothing to generate or commit here;
// committing a hand-made copy to public/ would only fight the build's version.
export default function AdminSeo() {
  return (
    <div className="cms">
      <h3><Globe size={16} /> Sitemap &amp; robots</h3>
      <p className="admin-note">
        <code>sitemap.xml</code> and <code>robots.txt</code> are generated automatically on every
        deploy — every country, region, place, blog post and published trip, with last-modified
        dates. Nothing to do here: add content, deploy, and the sitemap updates itself.
      </p>
      <p className="admin-note">
        Live files:{' '}
        <a href={`${SITE.url}/sitemap.xml`} target="_blank" rel="noopener noreferrer">{SITE.url}/sitemap.xml</a>
        {' · '}
        <a href={`${SITE.url}/robots.txt`} target="_blank" rel="noopener noreferrer">{SITE.url}/robots.txt</a>
        {' '}— submit the sitemap once in Google Search Console and it stays current.
      </p>
    </div>
  )
}
