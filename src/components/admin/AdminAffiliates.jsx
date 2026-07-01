import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, Download } from 'lucide-react'
import { getAffiliates } from '../../lib/data.js'
import { saveAffiliates, download } from '../../lib/cms.js'
import { Field, Area } from './Bits.jsx'

export default function AdminAffiliates() {
  const [draft, setDraft] = useState(null)
  const [activeId, setActiveId] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAffiliates().then((d) => { const c = structuredClone(d || {}); setDraft(c); setActiveId(Object.keys(c)[0] || '') })
  }, [])

  const ids = useMemo(() => (draft ? Object.keys(draft) : []), [draft])
  if (!draft) return <p className="admin-empty">Loading affiliates…</p>

  const a = draft[activeId]
  const setA = (p) => setDraft({ ...draft, [activeId]: { ...a, ...p } })
  const params = a?.params || {}

  const setParam = (key, value) => setA({ params: { ...params, [key]: value } })
  const renameParam = (oldKey, newKey) => {
    if (!newKey || newKey === oldKey) return
    const next = {}; for (const [k, v] of Object.entries(params)) next[k === oldKey ? newKey : k] = v
    setA({ params: next })
  }
  const addParam = () => setA({ params: { ...params, ['param' + (Object.keys(params).length + 1)]: '' } })
  const rmParam = (key) => { const next = { ...params }; delete next[key]; setA({ params: next }) }

  const persist = () => { saveAffiliates(draft); setSaved(true); setTimeout(() => setSaved(false), 1800) }
  const exportFile = () => download('affiliates.json', draft)

  return (
    <div className="cms">
      <div className="cms-tabs">
        {ids.map((id) => (
          <button key={id} className={`cms-tab ${activeId === id ? 'is-on' : ''}`} onClick={() => setActiveId(id)}>
            {draft[id].name || id}
          </button>
        ))}
      </div>

      <div className="cms-bar">
        <button className="btn btn--primary" onClick={persist}><Save size={15} /> {saved ? 'Saved ✓' : 'Save'}</button>
        <button className="btn btn--soft" onClick={exportFile}><Download size={15} /> Export affiliates.json</button>
      </div>

      {a && (
        <section className="cms-sec">
          {a._comment && <p className="cms-comment">{a._comment}</p>}
          <div className="admin-grid">
            <Field label="Name" value={a.name} onChange={(v) => setA({ name: v })} />
            <Field label="Category" value={a.category} onChange={(v) => setA({ category: v })} />
            <Field label="Register URL" value={a.registerUrl} onChange={(v) => setA({ registerUrl: v })} full />
            <Area label="URL template" hint="placeholders in {braces}" value={a.urlTemplate} onChange={(v) => setA({ urlTemplate: v })} rows={3} />
          </div>

          <div className="cms-items">
            <div className="cms-items__head"><span>Tracking params</span><button className="cms-add cms-add--sm" onClick={addParam}><Plus size={13} /> Add</button></div>
            {Object.keys(params).length === 0 && <p className="cms-items__empty">No params.</p>}
            {Object.entries(params).map(([k, v]) => (
              <div key={k} className="cms-param">
                <input className="cms-param__key" defaultValue={k} onBlur={(e) => renameParam(k, e.target.value.trim())} />
                <span className="cms-param__eq">=</span>
                <input className="cms-param__val" value={v ?? ''} onChange={(e) => setParam(k, e.target.value)} placeholder="your tracking id" />
                <button className="cms-item__rm" onClick={() => rmParam(k)} aria-label="Remove"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="admin-note">These ids feed the “Plan your visit” booking cards. Put your real affiliate / tracking ids in the params. <b>Export</b> downloads <code>affiliates.json</code> for <code>public/data/</code>.</p>
    </div>
  )
}
