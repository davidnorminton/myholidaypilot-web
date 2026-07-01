import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, Download, ArrowUp, ArrowDown, Search } from 'lucide-react'
import { getImages, getRegion } from '../../lib/data.js'
import { saveImages, download } from '../../lib/cms.js'
import { RegionPicker } from './Bits.jsx'
import UploadButton from '../UploadButton.jsx'

export default function AdminImages({ regions }) {
  const [draft, setDraft] = useState(null)
  const [regionId, setRegionId] = useState('')
  const [region, setRegion] = useState(null)
  const [placeId, setPlaceId] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { getImages().then((d) => setDraft(structuredClone(d || {}))) }, [])
  useEffect(() => {
    if (!regionId) { setRegion(null); setPlaceId(''); return }
    getRegion(regionId).then((r) => { setRegion(r); setPlaceId(r.places?.[0]?.id || '') })
  }, [regionId])

  const list = useMemo(() => (draft?.[regionId]?.[placeId]) || [], [draft, regionId, placeId])

  if (!draft) return <p className="admin-empty">Loading images…</p>

  const setList = (next) => {
    const reindexed = next.map((im, i) => ({ ...im, index: i }))
    setDraft({ ...draft, [regionId]: { ...(draft[regionId] || {}), [placeId]: reindexed } })
  }
  const add = () => setList([...list, { index: list.length, assetPath: '', isLocal: false, url: '', credit: '' }])
  const set = (i, p) => setList(list.map((im, j) => (j === i ? { ...im, ...p } : im)))
  const rm = (i) => setList(list.filter((_, j) => j !== i))
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; const n = [...list];[n[i], n[j]] = [n[j], n[i]]; setList(n) }

  const persist = () => { saveImages(draft); setSaved(true); setTimeout(() => setSaved(false), 1800) }
  const exportFile = () => download('images.json', draft)

  const placeName = region?.places?.find((p) => p.id === placeId)?.name || placeId

  return (
    <div className="cms">
      <div className="cms-pickrow">
        <RegionPicker regions={regions} value={regionId} onChange={setRegionId} />
        {region && (
          <label className="admin-field">
            <span className="admin-field__label">Place</span>
            <select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
              {(region.places || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="cms-bar">
        <button className="btn btn--primary" onClick={persist}><Save size={15} /> {saved ? 'Saved ✓' : 'Save'}</button>
        <button className="btn btn--soft" onClick={exportFile}><Download size={15} /> Export images.json</button>
        {placeId && (
          <a className="cms-bar__link" href={`https://unsplash.com/s/photos/${encodeURIComponent(placeName)}`} target="_blank" rel="noreferrer">
            <Search size={14} /> Find photos of {placeName}
          </a>
        )}
      </div>

      {!regionId && <p className="admin-empty">Pick a region and place to manage its photos.</p>}

      {regionId && placeId && (
        <section className="cms-sec">
          <div className="cms-sec__head"><h3>{placeName} — {list.length} {list.length === 1 ? 'image' : 'images'}</h3><button className="cms-add" onClick={add}><Plus size={15} /> Add image</button></div>
          {list.length === 0 && <p className="cms-items__empty">No images. Paste an image URL below.</p>}
          <ul className="cms-imgs">
            {list.map((im, i) => (
              <li key={i} className="cms-img">
                <div className="cms-img__thumb">
                  {im.url ? <img src={im.url} alt="" loading="lazy" /> : <span className="cms-img__ph">No image</span>}
                </div>
                <div className="cms-img__fields">
                  <div className="imgfield__row">
                    <input value={im.url ?? ''} placeholder="Image URL or upload" onChange={(e) => set(i, { url: e.target.value })} />
                    <UploadButton onUploaded={(url) => set(i, { url })} className="imgfield__btn" />
                  </div>
                  <input value={im.credit ?? ''} placeholder="Photo credit" onChange={(e) => set(i, { credit: e.target.value })} />
                </div>
                <div className="cms-img__actions">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={14} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
                  <button className="cms-img__rm" onClick={() => rm(i)} aria-label="Remove"><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="admin-note">The first image is used as the place’s hero. <b>Save</b> applies live; <b>Export</b> downloads <code>images.json</code> for <code>public/data/</code>. Hosting many Unsplash URLs directly may breach their hotlink guidelines — for production, run the earlier download script to self-host.</p>
    </div>
  )
}
