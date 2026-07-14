import { useState } from 'react'
import { api } from '../../lib/api.js'
import { Download, RefreshCw } from 'lucide-react'
import { getImages, getAffiliates, getIndex, getRegion } from '../../lib/data.js'
import { useCms, download, imagesOverride, affiliatesOverride, buildIndex, buildPlacesIndex,  } from '../../lib/cms.js'

export default function AdminExport({ regions }) {
  useCms() // re-render when overrides change
  const [busy, setBusy] = useState('')
  const [allNote, setAllNote] = useState('')

  const exportImages = async () => { setBusy('images'); download('images.json', await getImages()); setBusy('') }
  const exportAffiliates = async () => { setBusy('aff'); download('affiliates.json', await getAffiliates()); setBusy('') }
  const exportIndex = async () => {
    setBusy('index')
    const [base, merged] = await Promise.all([getIndex(), Promise.all(regions.map((r) => getRegion(r.id)))])
    download('index.json', buildIndex(base, merged))
    setBusy('')
  }
  const exportPlacesIndex = async () => {
    setBusy('places-index')
    const merged = await Promise.all(regions.map((r) => getRegion(r.id)))
    download('places-index.json', buildPlacesIndex(merged))
    setBusy('')
  }

  const exportAllCountries = async () => {
    setBusy('all'); setAllNote('')
    try {
      const builds = await api.builder.list()
      let n = 0
      for (const b of (builds || [])) {
        setAllNote(`Exporting ${b.name}… (${n + 1}/${builds.length})`)
        const bundle = await api.builder.export(b.countryId)
        download(`${b.countryId}.json`, bundle)
        n++
        await new Promise((r) => setTimeout(r, 400))   // let the browser breathe between downloads
      }
      setAllNote(`Done — ${n} countr${n === 1 ? 'y' : 'ies'} downloaded. Drop them all into countries/ and run: node scripts/import-country.mjs`)
    } catch (e) { setAllNote(e.message || 'Failed') }
    finally { setBusy('') }
  }

  return (
    <div className="cms">
      <section className="cms-sec">
        <div className="cms-sec__head"><h3><Download size={16} /> All countries</h3></div>
        <p className="admin-note">
          Downloads one bundle per built country — the exact files the import script expects.
          Your browser will ask permission for multiple downloads the first time.
        </p>
        <button className="btn btn--primary" onClick={exportAllCountries} disabled={busy === 'all'}>
          <Download size={15} /> {busy === 'all' ? 'Exporting…' : 'Download all countries'}
        </button>
        {allNote && <p className="admin-note admin-note--hot" style={{ marginTop: 10 }}>{allNote}</p>}
      </section>

      <div className="exp-grid">
        <ExpCard title="index.json" sub="Region list, counts & totals — regenerated from your edits." onClick={exportIndex} busy={busy === 'index'} regen />
        <ExpCard title="places-index.json" sub="Flat search index — regenerated from all regions." onClick={exportPlacesIndex} busy={busy === 'places-index'} regen />
        <ExpCard title="images.json" sub="All photo URLs & credits." onClick={exportImages} busy={busy === 'images'} edited={!!imagesOverride()} />
        <ExpCard title="affiliates.json" sub="Booking partners & tracking params." onClick={exportAffiliates} busy={busy === 'aff'} edited={!!affiliatesOverride()} />
      </div>

      <div className="exp-where">
        <p>Commit exported files into their folders:</p>
        <ul>
          <li><code>index.json</code>, <code>places-index.json</code>, <code>images.json</code>, <code>affiliates.json</code> → <code>public/data/</code></li>
          <li><code>&lt;region&gt;.json</code> → <code>public/data/regions/</code></li>
        </ul>
      </div>
    </div>
  )
}

function ExpCard({ title, sub, onClick, busy, regen, edited }) {
  return (
    <button className="exp-card" onClick={onClick} disabled={busy}>
      <span className="exp-card__top">
        <span className="exp-card__name">{title}</span>
        {edited && <span className="exp-card__badge">edited</span>}
        {regen && <span className="exp-card__badge exp-card__badge--gen">regenerates</span>}
      </span>
      <span className="exp-card__sub">{sub}</span>
      <span className="exp-card__cta">{busy ? <><RefreshCw size={14} className="spin" /> Building…</> : <><Download size={14} /> Download</>}</span>
    </button>
  )
}
