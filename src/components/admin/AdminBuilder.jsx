import { useEffect, useState } from 'react'
import {
  Globe2, Plus, RefreshCw, Sparkles, ChevronRight, Trash2, ArrowLeft,
  Pencil, Check, X, MapPin,
} from 'lucide-react'
import { api } from '../../lib/api.js'

// The country builder: a staged workspace that drafts a whole country with
// Claude, saves each stage to the DB, and (later) exports Italy-identical JSON.
// This screen currently drives Stage 0 (create) and Stage 1 (regions); further
// stages slot in as they're built.
const STAGES = [
  'Regions', 'Places', 'Activities', 'Restaurants', 'Images',
  'Region dining', 'Festivals', 'History', 'Food & wine', 'Getting around',
]

export default function AdminBuilder() {
  const [builds, setBuilds] = useState(null)
  const [active, setActive] = useState(null)   // countryId being viewed

  const load = () => { setBuilds(null); api.builder.list().then(setBuilds).catch(() => setBuilds(false)) }
  useEffect(load, [])

  if (active) return <BuildView countryId={active} onBack={() => { setActive(null); load() }} />

  if (builds === null) return <p className="admin-empty">Loading builds…</p>
  if (builds === false) return <p className="admin-empty">Couldn't load the builder.</p>

  return (
    <div className="bld">
      <p className="admin-note">
        Draft a whole new country with AI, stage by stage — regions, places, activities, dining and guides.
        Everything saves as you go and stays fully editable; a final export writes it into the site like Italy.
      </p>

      <div className="bld__grid">
        {builds.map((b) => (
          <button key={b.countryId} className="bld__card" onClick={() => setActive(b.countryId)}>
            <span className="bld__flag">{b.flag || '🏳️'}</span>
            <span className="bld__cardbody">
              <b>{b.name}</b>
              <span className="bld__meta">{b.regionCount} region{b.regionCount === 1 ? '' : 's'} · stage {b.stage}/10 · {STAGES[Math.min(b.stage, 9)]}</span>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
        <NewBuild onCreated={(c) => { load(); setActive(c) }} />
      </div>
    </div>
  )
}

function NewBuild({ onCreated }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [flag, setFlag] = useState('')
  const [blurb, setBlurb] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    setBusy(true); setError('')
    try {
      const b = await api.builder.create({ name: name.trim(), flag: flag.trim(), blurb: blurb.trim() })
      onCreated(b.countryId)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (!open) return <button className="bld__new" onClick={() => setOpen(true)}><Plus size={20} /> New country</button>

  return (
    <div className="bld__card bld__card--form">
      <input className="bld__input" autoFocus placeholder="Country name (e.g. Portugal)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="bld__row2">
        <input className="bld__input bld__input--flag" placeholder="🇵🇹" value={flag} onChange={(e) => setFlag(e.target.value)} />
        <input className="bld__input" placeholder="Short blurb" value={blurb} onChange={(e) => setBlurb(e.target.value)} />
      </div>
      {error && <p className="pk__warn">{error}</p>}
      <div className="bld__formacts">
        <button className="btn btn--primary" onClick={create} disabled={busy || !name.trim()}>
          {busy ? <RefreshCw size={14} className="pk__spin" /> : <Plus size={14} />} Create
        </button>
        <button className="btn btn--soft" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

function BuildView({ countryId, onBack }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)   // regionId being edited

  const load = () => api.builder.get(countryId).then(setData).catch(() => setData(false))
  useEffect(() => { load() }, [countryId])

  const genRegions = async () => {
    setBusy(true); setError('')
    try { await api.builder.genRegions(countryId); await load() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const discard = async () => {
    if (!confirm(`Discard the entire ${data.build.name} build? This cannot be undone.`)) return
    await api.builder.discard(countryId); onBack()
  }

  if (data === null) return <p className="admin-empty">Loading…</p>
  if (data === false) return <p className="admin-empty">Couldn't load this build.</p>

  const { build, regions } = data

  return (
    <div className="bld">
      <div className="bld__head">
        <button className="story__act" onClick={onBack}><ArrowLeft size={14} /> All builds</button>
        <h2 className="bld__title">{build.flag} {build.name}</h2>
        <button className="story__act bld__discard" onClick={discard}><Trash2 size={13} /> Discard</button>
      </div>

      {/* stage rail */}
      <ol className="bld__stages">
        {STAGES.map((label, i) => (
          <li key={i} className={i < build.stage ? 'is-done' : i === build.stage ? 'is-now' : ''}>
            <span className="bld__stageno">{i + 1}</span> {label}
          </li>
        ))}
      </ol>

      {/* stage 1: regions */}
      <section className="bld__stage">
        <div className="bld__stagehead">
          <h3>1 · Regions</h3>
          <button className="btn btn--soft" onClick={genRegions} disabled={busy}>
            {busy ? <><RefreshCw size={14} className="pk__spin" /> Generating…</>
              : regions.length ? <><RefreshCw size={14} /> Regenerate regions</>
              : <><Sparkles size={14} /> Generate regions</>}
          </button>
        </div>
        {error && <p className="pk__warn">{error}</p>}
        {!regions.length && !busy && <p className="admin-empty">No regions yet — generate them to begin.</p>}

        <div className="bld__regions">
          {regions.map((r) => (
            <RegionRow key={r.id} countryId={countryId} region={r}
              editing={editing === r.regionId}
              onEdit={() => setEditing(r.regionId)}
              onClose={() => setEditing(null)}
              onSaved={load} />
          ))}
        </div>
      </section>

      {regions.length > 0 && (
        <p className="bld__hint">
          Stages 2–10 (places, activities, dining, guides) build on these regions — coming as the builder grows.
          Edit any region above now; your changes are saved to the workspace.
        </p>
      )}
    </div>
  )
}

function RegionRow({ countryId, region, editing, onEdit, onClose, onSaved }) {
  const d = region.data
  const [form, setForm] = useState(d)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setForm(d) }, [region.id])   // reset when data changes

  const set = (patch) => setForm({ ...form, ...patch })
  const save = async () => {
    setBusy(true)
    try { await api.builder.saveRegion(countryId, region.regionId, form); await onSaved(); onClose() }
    finally { setBusy(false) }
  }

  if (!editing) {
    return (
      <div className="bld__region">
        <span className="bld__remoji">{d.emoji}</span>
        <span className="bld__rbody">
          <b>{d.name}</b> <span className="bld__rlocal">{d.nameIt}</span>
          <span className="bld__rmeta"><MapPin size={11} /> {d.capital} · {d.placeCount} place{region.placeCount === 1 ? '' : 's'}</span>
        </span>
        <button className="story__act" onClick={onEdit}><Pencil size={13} /> Edit</button>
      </div>
    )
  }

  return (
    <div className="bld__region bld__region--edit">
      <div className="bld__editgrid">
        <label>Name<input value={form.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label>Local name<input value={form.nameIt} onChange={(e) => set({ nameIt: e.target.value })} /></label>
        <label>Capital<input value={form.capital} onChange={(e) => set({ capital: e.target.value })} /></label>
        <label>Emoji<input value={form.emoji} onChange={(e) => set({ emoji: e.target.value })} /></label>
        <label>Lat<input type="number" value={form.lat} onChange={(e) => set({ lat: Number(e.target.value) })} /></label>
        <label>Lng<input type="number" value={form.lng} onChange={(e) => set({ lng: Number(e.target.value) })} /></label>
        <label className="bld__editfull">Best time to visit<input value={form.bestTimeToVisit} onChange={(e) => set({ bestTimeToVisit: e.target.value })} /></label>
      </div>
      <div className="bld__formacts">
        <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? <RefreshCw size={13} className="pk__spin" /> : <Check size={13} />} Save</button>
        <button className="btn btn--soft" onClick={onClose}><X size={13} /> Cancel</button>
      </div>
    </div>
  )
}
