import { useEffect, useState } from 'react'
import { Download, RefreshCw, Globe } from 'lucide-react'
import { getIndex, getPlacesIndex } from '../../lib/data.js'
import { api } from '../../lib/api.js'
import { POSTS as BUNDLED } from '../../lib/blog.js'
import { SITE, buildSitemap, buildRobots } from '../../lib/seo.js'

function downloadText(filename, text) {
  const blob = new Blob([text], { type: filename.endsWith('.xml') ? 'application/xml' : 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function AdminSeo() {
  const [url, setUrl] = useState(SITE.url)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)

  const load = () => {
    setData(null); setErr(false)
    Promise.all([
      getIndex().then((d) => d.regions || []),
      getPlacesIndex().then((d) => d || []),
      api.posts.list(),
      api.gallery.list().catch(() => [])
        .then((rows) => (rows || []).map((p) => ({ slug: p.slug, lastmod: p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : undefined })))
        .catch(() => BUNDLED.map((p) => ({ slug: p.slug, lastmod: p.date }))),
    ])
      .then(([regions, places, posts, gallery]) => setData({ regions, places, posts, gallery }))
      .catch(() => setErr(true))
  }
  useEffect(() => { load() }, [])

  const total = data ? 8 + data.regions.length + data.places.length + data.posts.length : 0

  return (
    <div className="cms">
      <div className="seo-field">
        <span className="admin-field__label"><Globe size={13} /> Site URL</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://myholidaypilot.com" style={{ fontFamily: 'var(--mono)' }} />
      </div>

      {err && (
        <p className="admin-empty">Couldn’t load the data to build the sitemap.{' '}
          <button className="btn btn--soft" onClick={load}><RefreshCw size={14} /> Retry</button>
        </p>
      )}

      {!data && !err && <p className="admin-empty">Loading…</p>}

      {data && (
        <>
          <ul className="seo-stats">
            <li><b>{data.regions.length}</b> regions</li>
            <li><b>{data.places.length}</b> places</li>
            <li><b>{data.posts.length}</b> blog posts</li>
            <li><b>{total}</b> total URLs</li>
          </ul>
          <div className="admin__bar">
            <button className="btn btn--primary" onClick={() => downloadText('sitemap.xml', buildSitemap({ url, ...data }))}>
              <Download size={15} /> Download sitemap.xml
            </button>
            <button className="btn btn--soft" onClick={() => downloadText('robots.txt', buildRobots(url))}>
              <Download size={15} /> Download robots.txt
            </button>
          </div>
        </>
      )}

      <p className="admin-note">
        Set the <b>Site URL</b> to your live domain, then download both files and commit them to <code>public/</code> — they’re served at the site root (<code>/sitemap.xml</code>, <code>/robots.txt</code>). Re-generate whenever you add regions, places, or posts.
      </p>
      <p className="admin-note">
        Note: these list clean URLs (e.g. <code>/italy/tuscany</code>), which go live once the site moves off hash routing. Submit the sitemap in Google Search Console after that switch.
      </p>
    </div>
  )
}
