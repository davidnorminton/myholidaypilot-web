import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, Save, Download, RotateCcw, Compass, UtensilsCrossed } from 'lucide-react'
import { getRegion } from '../../lib/data.js'
import { saveRegion, clearRegion, regionOverride, download, uid } from '../../lib/cms.js'
import { Field, Num, Area, Select, RegionPicker } from './Bits.jsx'

const TYPES = ['CITY', 'TOWN', 'COAST', 'MOUNTAIN', 'LAKE', 'LANDMARK']

export default function AdminPlaces({ regions }) {
  const [regionId, setRegionId] = useState('')
  const [draft, setDraft] = useState(null)
  const [openPlace, setOpenPlace] = useState(null)
  const [openResto, setOpenResto] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!regionId) { setDraft(null); return }
    let live = true
    getRegion(regionId).then((r) => { if (live) { setDraft(structuredClone(r)); setOpenPlace(null); setOpenResto(null) } })
    return () => { live = false }
  }, [regionId])

  if (!draft) {
    return (
      <div className="cms">
        <RegionPicker regions={regions} value={regionId} onChange={setRegionId} />
        <p className="admin-empty">Pick a region to edit its places, activities and restaurants.</p>
      </div>
    )
  }

  const patch = (p) => setDraft({ ...draft, ...p })
  const setPlace = (i, p) => patch({ places: draft.places.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const addPlace = () => {
    const place = { id: uid('p'), name: 'New place', nameIt: '', lat: draft.lat, lng: draft.lng, type: 'TOWN', description: '', activities: [], food: [], culture: [] }
    patch({ places: [...(draft.places || []), place] }); setOpenPlace(draft.places.length)
  }
  const delPlace = (i) => { patch({ places: draft.places.filter((_, j) => j !== i) }); setOpenPlace(null) }

  const setResto = (i, p) => patch({ restaurants: draft.restaurants.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const addResto = () => {
    const r = { number: (draft.restaurants?.length || 0) + 1, id: uid('r'), name: 'New restaurant', address: '', neighbourhood: '', cuisine: '', priceRange: '€€', description: '', mustOrder: '', lat: draft.lat, lng: draft.lng }
    patch({ restaurants: [...(draft.restaurants || []), r] }); setOpenResto(draft.restaurants?.length || 0)
  }
  const delResto = (i) => { patch({ restaurants: draft.restaurants.filter((_, j) => j !== i) }); setOpenResto(null) }

  const persist = () => {
    const next = { ...draft, placeCount: (draft.places || []).length, restaurantCount: (draft.restaurants || []).length }
    saveRegion(regionId, next); setDraft(next); setSaved(true); setTimeout(() => setSaved(false), 1800)
  }
  const exportFile = () => download(`${regionId}.json`, { ...draft, placeCount: (draft.places || []).length, restaurantCount: (draft.restaurants || []).length })
  const revert = async () => { clearRegion(regionId); const r = await getRegion(regionId); setDraft(structuredClone(r)) }

  return (
    <div className="cms">
      <RegionPicker regions={regions} value={regionId} onChange={setRegionId} />

      <div className="cms-bar">
        <button className="btn btn--primary" onClick={persist}><Save size={15} /> {saved ? 'Saved ✓' : 'Save'}</button>
        <button className="btn btn--soft" onClick={exportFile}><Download size={15} /> Export {regionId}.json</button>
        {regionOverride(regionId) && <button className="btn btn--soft" onClick={revert}><RotateCcw size={15} /> Revert to original</button>}
        <span className="cms-bar__hint">{(draft.places || []).length} places · {(draft.restaurants || []).length} restaurants</span>
      </div>

      {/* PLACES */}
      <section className="cms-sec">
        <div className="cms-sec__head"><h3><Compass size={16} /> Places</h3><button className="cms-add" onClick={addPlace}><Plus size={15} /> Add place</button></div>
        <ul className="cms-rows">
          {(draft.places || []).map((p, i) => (
            <li key={p.id} className={`cms-acc ${openPlace === i ? 'is-open' : ''}`}>
              <button className="cms-acc__head" onClick={() => setOpenPlace(openPlace === i ? null : i)}>
                <span className="cms-acc__title">{p.name || 'Untitled'}</span>
                <span className="cms-acc__sub">{p.type}</span>
                <ChevronDown size={16} className="cms-acc__chev" />
              </button>
              {openPlace === i && (
                <div className="cms-acc__body">
                  <div className="admin-grid">
                    <Field label="Name" value={p.name} onChange={(v) => setPlace(i, { name: v })} />
                    <Field label="Italian name" value={p.nameIt} onChange={(v) => setPlace(i, { nameIt: v })} />
                    <Select label="Type" value={p.type} onChange={(v) => setPlace(i, { type: v })} options={TYPES} />
                    <div />
                    <Num label="Latitude" value={p.lat} onChange={(v) => setPlace(i, { lat: v })} />
                    <Num label="Longitude" value={p.lng} onChange={(v) => setPlace(i, { lng: v })} />
                    <Area label="Description" value={p.description} onChange={(v) => setPlace(i, { description: v })} rows={3} />
                  </div>
                  <ItemRows title="Things to do" geo items={p.activities || []} onChange={(v) => setPlace(i, { activities: v })} />
                  <ItemRows title="What to eat" items={p.food || []} onChange={(v) => setPlace(i, { food: v })} />
                  <ItemRows title="Local tips" items={p.culture || []} onChange={(v) => setPlace(i, { culture: v })} />
                  <button className="cms-del" onClick={() => delPlace(i)}><Trash2 size={14} /> Delete place</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* RESTAURANTS */}
      <section className="cms-sec">
        <div className="cms-sec__head"><h3><UtensilsCrossed size={16} /> Restaurants</h3><button className="cms-add" onClick={addResto}><Plus size={15} /> Add restaurant</button></div>
        <ul className="cms-rows">
          {(draft.restaurants || []).map((r, i) => (
            <li key={r.id} className={`cms-acc ${openResto === i ? 'is-open' : ''}`}>
              <button className="cms-acc__head" onClick={() => setOpenResto(openResto === i ? null : i)}>
                <span className="cms-acc__title">{r.name || 'Untitled'}</span>
                <span className="cms-acc__sub">{r.cuisine} {r.priceRange}</span>
                <ChevronDown size={16} className="cms-acc__chev" />
              </button>
              {openResto === i && (
                <div className="cms-acc__body">
                  <div className="admin-grid">
                    <Field label="Name" value={r.name} onChange={(v) => setResto(i, { name: v })} />
                    <Field label="Cuisine" value={r.cuisine} onChange={(v) => setResto(i, { cuisine: v })} />
                    <Field label="Address" value={r.address} onChange={(v) => setResto(i, { address: v })} full />
                    <Field label="Neighbourhood" value={r.neighbourhood} onChange={(v) => setResto(i, { neighbourhood: v })} />
                    <Field label="Price range" value={r.priceRange} onChange={(v) => setResto(i, { priceRange: v })} placeholder="€ · €€ · €€€" />
                    <Field label="Must order" value={r.mustOrder} onChange={(v) => setResto(i, { mustOrder: v })} full />
                    <Num label="Latitude" value={r.lat} onChange={(v) => setResto(i, { lat: v })} />
                    <Num label="Longitude" value={r.lng} onChange={(v) => setResto(i, { lng: v })} />
                    <Area label="Description" value={r.description} onChange={(v) => setResto(i, { description: v })} rows={2} />
                  </div>
                  <button className="cms-del" onClick={() => delResto(i)}><Trash2 size={14} /> Delete restaurant</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="admin-note">Edits show on the site immediately (this browser). <b>Save</b> keeps them across sessions; <b>Export</b> downloads <code>{regionId}.json</code> to commit into <code>public/data/regions/</code>.</p>
    </div>
  )
}

function ItemRows({ title, items, onChange, geo }) {
  const set = (i, p) => onChange(items.map((it, j) => (j === i ? { ...it, ...p } : it)))
  const add = () => onChange([...(items || []), { id: uid('i'), text: '', detail: '', ...(geo ? { lat: '', lng: '' } : {}) }])
  const rm = (i) => onChange(items.filter((_, j) => j !== i))
  return (
    <div className="cms-items">
      <div className="cms-items__head"><span>{title}</span><button className="cms-add cms-add--sm" onClick={add}><Plus size={13} /> Add</button></div>
      {(items || []).length === 0 && <p className="cms-items__empty">None yet.</p>}
      {(items || []).map((it, i) => (
        <div key={it.id || i} className="cms-item">
          <div className="cms-item__fields">
            <input className="cms-item__text" value={it.text ?? ''} placeholder="Title" onChange={(e) => set(i, { text: e.target.value })} />
            <input className="cms-item__detail" value={it.detail ?? ''} placeholder="Detail (optional)" onChange={(e) => set(i, { detail: e.target.value })} />
            {geo && (
              <div className="cms-item__geo">
                <input type="number" step="any" value={it.lat ?? ''} placeholder="lat" onChange={(e) => set(i, { lat: e.target.value === '' ? '' : parseFloat(e.target.value) })} />
                <input type="number" step="any" value={it.lng ?? ''} placeholder="lng" onChange={(e) => set(i, { lng: e.target.value === '' ? '' : parseFloat(e.target.value) })} />
              </div>
            )}
          </div>
          <button className="cms-item__rm" onClick={() => rm(i)} aria-label="Remove"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}
