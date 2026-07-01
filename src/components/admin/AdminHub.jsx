import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Download, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react'
import { getHub } from '../../lib/data.js'
import { saveHub, clearHub, hubOverride, download, uid } from '../../lib/cms.js'
import { Field, Area } from './Bits.jsx'
import ImageField from '../ImageField.jsx'

export default function AdminHub() {
  const [draft, setDraft] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { getHub().then((d) => setDraft(structuredClone(d || { sections: [] }))) }, [])
  if (!draft) return <p className="admin-empty">Loading…</p>

  const secs = draft.sections || []
  const setSec = (i, p) => setDraft({ ...draft, sections: secs.map((s, j) => (j === i ? { ...s, ...p } : s)) })
  const add = () => setDraft({ ...draft, sections: [...secs, { id: uid('sec'), title: 'New section', blurb: '', link: '/italy', image: '' }] })
  const del = (i) => setDraft({ ...draft, sections: secs.filter((_, j) => j !== i) })
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= secs.length) return; const n = [...secs];[n[i], n[j]] = [n[j], n[i]]; setDraft({ ...draft, sections: n }) }

  const persist = () => { saveHub(draft); setSaved(true); setTimeout(() => setSaved(false), 1800) }
  const exportFile = () => download('hub.json', draft)
  const revert = async () => { clearHub(); const d = await getHub(); setDraft(structuredClone(d)) }

  return (
    <div className="cms">
      <div className="cms-bar">
        <button className="btn btn--primary" onClick={persist}><Save size={15} /> {saved ? 'Saved ✓' : 'Save'}</button>
        <button className="btn btn--soft" onClick={exportFile}><Download size={15} /> Export hub.json</button>
        {hubOverride() && <button className="btn btn--soft" onClick={revert}><RotateCcw size={15} /> Revert</button>}
        <button className="cms-add" onClick={add}><Plus size={15} /> Add section</button>
      </div>

      <ul className="cms-rows">
        {secs.map((s, i) => (
          <li key={s.id || i} className="hubedit">
            <div className="hubedit__media">
              {s.image ? <img src={s.image} alt="" onError={(e) => { e.currentTarget.style.opacity = '.2' }} /> : <span className="hubedit__ph">No image</span>}
            </div>
            <div className="hubedit__fields">
              <div className="admin-grid">
                <Field label="Title" value={s.title} onChange={(v) => setSec(i, { title: v })} />
                <Field label="Link (path)" value={s.link} onChange={(v) => setSec(i, { link: v })} placeholder="/italy/festivals" mono />
                <Area label="Blurb" value={s.blurb} onChange={(v) => setSec(i, { blurb: v })} rows={2} />
                <ImageField label="Image" value={s.image} onChange={(v) => setSec(i, { image: v })} full />
              </div>
            </div>
            <div className="hubedit__actions">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Up"><ArrowUp size={14} /></button>
              <button onClick={() => move(i, 1)} disabled={i === secs.length - 1} aria-label="Down"><ArrowDown size={14} /></button>
              <button className="hubedit__rm" onClick={() => del(i)} aria-label="Delete"><Trash2 size={14} /></button>
            </div>
          </li>
        ))}
      </ul>

      <p className="admin-note">These are the cards on the <b>/italy</b> page (image on top, title &amp; blurb under). Edits show live; <b>Export</b> downloads <code>hub.json</code> for <code>public/data/</code>.</p>
    </div>
  )
}
