import { useState } from 'react'
import { Download, RefreshCw, AlertTriangle, FileJson } from 'lucide-react'
import { getRegion, getImages, getAffiliates, getIndex } from '../../lib/data.js'
import {
  useCms, download, editedRegionIds, imagesOverride, affiliatesOverride,
  buildIndex, buildPlacesIndex, resetAll,
} from '../../lib/cms.js'

export default function AdminExport({ regions }) {
  useCms() // re-render when overrides change
  const [busy, setBusy] = useState('')
  const [pickRegion, setPickRegion] = useState(regions[0]?.id || '')
  const edited = editedRegionIds()

  const exportRegion = async (id) => {
    setBusy(id)
    const r = await getRegion(id)
    download(`${id}.json`, { ...r, placeCount: (r.places || []).length, restaurantCount: (r.restaurants || []).length })
    setBusy('')
  }
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

  return (
    <div className="cms">
      <div className="exp-grid">
        <ExpCard title="index.json" sub="Region list, counts & totals — regenerated from your edits." onClick={exportIndex} busy={busy === 'index'} regen />
        <ExpCard title="places-index.json" sub="Flat search index — regenerated from all regions." onClick={exportPlacesIndex} busy={busy === 'places-index'} regen />
        <ExpCard title="images.json" sub="All photo URLs & credits." onClick={exportImages} busy={busy === 'images'} edited={!!imagesOverride()} />
        <ExpCard title="affiliates.json" sub="Booking partners & tracking params." onClick={exportAffiliates} busy={busy === 'aff'} edited={!!affiliatesOverride()} />
      </div>

      <section className="cms-sec">
        <div className="cms-sec__head"><h3><FileJson size={16} /> Region files</h3></div>
        <div className="exp-region">
          <select value={pickRegion} onChange={(e) => setPickRegion(e.target.value)}>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name}{edited.includes(r.id) ? ' • edited' : ''}</option>)}
          </select>
          <button className="btn btn--primary" onClick={() => exportRegion(pickRegion)} disabled={busy === pickRegion}>
            <Download size={15} /> Export {pickRegion}.json
          </button>
        </div>
        {edited.length > 0 && (
          <div className="exp-edited">
            <span className="exp-edited__label">Edited regions:</span>
            {edited.map((id) => (
              <button key={id} className="exp-chip" onClick={() => exportRegion(id)}>{id}.json <Download size={12} /></button>
            ))}
          </div>
        )}
      </section>

      <div className="exp-where">
        <p>Commit exported files into their folders:</p>
        <ul>
          <li><code>index.json</code>, <code>places-index.json</code>, <code>images.json</code>, <code>affiliates.json</code> → <code>public/data/</code></li>
          <li><code>&lt;region&gt;.json</code> → <code>public/data/regions/</code></li>
        </ul>
      </div>

      <div className="exp-reset">
        <AlertTriangle size={16} />
        <div>
          <b>Reset local edits</b> — clears all CMS overrides from this browser (does not touch exported files).
          <button className="exp-reset__btn" onClick={() => { if (confirm('Clear all local CMS edits?')) resetAll() }}>Reset all overrides</button>
        </div>
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
