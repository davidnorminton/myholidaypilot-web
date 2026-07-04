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
  const [openRegion, setOpenRegion] = useState(null)   // regionId whose places are shown

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

  if (openRegion) {
    const reg = regions.find((r) => r.regionId === openRegion)
    if (reg) return <RegionPlaces countryId={countryId} region={reg} onBack={() => { setOpenRegion(null); load() }} />
  }

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
              onOpen={() => setOpenRegion(r.regionId)}
              onSaved={load} />
          ))}
        </div>
      </section>

      {regions.length > 0 && <GuidesPanel countryId={countryId} build={build} onSaved={load} />}
    </div>
  )
}

function RegionRow({ countryId, region, editing, onEdit, onClose, onOpen, onSaved }) {
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
          <span className="bld__rmeta"><MapPin size={11} /> {d.capital} · {region.placeCount ? `${region.placeCount} place${region.placeCount === 1 ? '' : 's'}` : 'no places yet'}</span>
        </span>
        {region.placeCount > 0 && <span className="bld__done">✓</span>}
        <button className="story__act" onClick={onEdit}><Pencil size={13} /> Edit</button>
        <button className="btn btn--soft bld__placesbtn" onClick={onOpen}><MapPin size={13} /> Places <ChevronRight size={14} /></button>
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

function RegionPlaces({ countryId, region, onBack }) {
  const [places, setPlaces] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailRun, setDetailRun] = useState(null)   // { current: placeId } while looping
  const [detailErr, setDetailErr] = useState('')
  const [imgRun, setImgRun] = useState(null)
  const [imgErr, setImgErr] = useState('')
  const [rstBusy, setRstBusy] = useState(false)
  const [rstMsg, setRstMsg] = useState('')
  const d = region.data

  const load = () => api.builder.region(countryId, region.regionId).then((r) => setPlaces(r.places)).catch(() => setPlaces(false))
  useEffect(() => { load() }, [region.regionId])

  // A place counts as "detailed" once it has any activities.
  const isDetailed = (p) => (p.data.activities || []).length > 0

  // Generate things-to-do + food + culture, ONE place at a time, in order.
  // Already-detailed places are skipped, so a failed run resumes cleanly.
  const generateDetails = async () => {
    setDetailErr('')
    const todo = (places || []).filter((p) => !isDetailed(p))
    for (const p of todo) {
      setDetailRun({ current: p.placeId })
      try {
        await api.builder.genDetail(countryId, region.regionId, p.placeId)
        // refresh just this place's flag by reloading the list (cheap, keeps ticks live)
        const r = await api.builder.region(countryId, region.regionId)
        setPlaces(r.places)
      } catch (e) {
        setDetailErr(`Stopped at ${p.data.name}: ${e.message}. Fixed the cause? Click again — done places are skipped.`)
        setDetailRun(null)
        return
      }
    }
    setDetailRun(null)
  }

  const hasImage = (p) => !!p.image
  const generateImages = async () => {
    setImgErr('')
    const todo = (places || []).filter((p) => !hasImage(p))
    const failed = []
    let rateLimited = false
    for (const p of todo) {
      setImgRun({ current: p.placeId })
      try {
        await api.builder.genImage(countryId, region.regionId, p.placeId)
        const r = await api.builder.region(countryId, region.regionId); setPlaces(r.places)
      } catch (e) {
        // Rate limit = stop early (retry after the hour); any other failure
        // (no photo found, etc.) = skip this place and keep going.
        if (/rate|429|limit/i.test(e.message)) { rateLimited = true; break }
        failed.push(p.data.name)
      }
    }
    setImgRun(null)
    if (rateLimited) setImgErr('Unsplash hourly limit hit — wait for the hour to roll over and click again; done places are skipped.')
    else if (failed.length) setImgErr(`No photo found for ${failed.length}: ${failed.join(', ')}. Add these manually below.`)
  }

  const generateRestaurants = async () => {
    setRstBusy(true); setRstMsg('')
    try { const r = await api.builder.genRestaurants(countryId, region.regionId); setRstMsg(`${r.count} restaurants added ✓`) }
    catch (e) { setRstMsg(e.message) } finally { setRstBusy(false) }
  }
  const generateProse = async () => {
    setRstBusy(true); setRstMsg('')
    try { await api.builder.genRegionProse(countryId, region.regionId); setRstMsg('Region history & notes added ✓') }
    catch (e) { setRstMsg(e.message) } finally { setRstBusy(false) }
  }

  const generate = async () => {
    setBusy(true); setError(''); setConfirm(false)
    try { await api.builder.genPlaces(countryId, region.regionId); await load() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const removePlace = async (placeId) => {
    if (!window.confirm('Remove this place?')) return
    await api.builder.deletePlace(countryId, region.regionId, placeId); load()
  }

  const has = places && places.length > 0

  return (
    <div className="bld">
      <div className="bld__head">
        <button className="story__act" onClick={onBack}><ArrowLeft size={14} /> Regions</button>
        <h2 className="bld__title">{d.emoji} {d.name}</h2>
      </div>

      <section className="bld__stage">
        <div className="bld__stagehead">
          <h3>2 · Places in {d.name}</h3>
          {!confirm ? (
            <button className="btn btn--soft" onClick={() => setConfirm(true)} disabled={busy}>
              {busy ? <><RefreshCw size={14} className="pk__spin" /> Generating…</>
                : has ? <><RefreshCw size={14} /> Regenerate places</>
                : <><Sparkles size={14} /> Generate places</>}
            </button>
          ) : (
            <span className="bld__confirm">
              {has ? 'Replace all places?' : `Generate places for ${d.name}?`}
              <button className="btn btn--primary" onClick={generate}><Check size={13} /> Yes</button>
              <button className="btn btn--soft" onClick={() => setConfirm(false)}><X size={13} /> No</button>
            </span>
          )}
        </div>
        {error && <p className="pk__warn">{error}</p>}
        {places === null && <p className="admin-empty">Loading…</p>}
        {places && !has && !busy && <p className="admin-empty">No places yet — generate 5–15 for this region.</p>}

        {has && (() => {
          const done = places.filter(isDetailed).length
          const running = !!detailRun
          return (
            <div className="bld__detailbar">
              <button className="btn btn--soft" onClick={generateDetails} disabled={running || busy}>
                {running ? <><RefreshCw size={14} className="pk__spin" /> Generating… ({done}/{places.length})</>
                  : done === places.length ? <><RefreshCw size={14} /> Regenerate missing (all done)</>
                  : done > 0 ? <><Sparkles size={14} /> Continue things to do &amp; eat ({done}/{places.length})</>
                  : <><Sparkles size={14} /> Generate things to do &amp; eat</>}
              </button>
              <span className="bld__detailnote">Runs place by place — each ticks green when done, so a failure never redoes finished places.</span>
            </div>
          )
        })()}
        {detailErr && <p className="pk__warn">{detailErr}</p>}

        {has && (() => {
          const done = places.filter(hasImage).length
          const running = !!imgRun
          return (
            <div className="bld__detailbar">
              <button className="btn btn--soft" onClick={generateImages} disabled={running || busy}>
                {running ? <><RefreshCw size={14} className="pk__spin" /> Fetching images… ({done}/{places.length})</>
                  : done === places.length ? <><RefreshCw size={14} /> Refresh missing images (all have one)</>
                  : done > 0 ? <><Sparkles size={14} /> Continue images ({done}/{places.length})</>
                  : <><Sparkles size={14} /> Add an image to each place</>}
              </button>
              <span className="bld__detailnote">One Unsplash photo per place — ticks as it goes, resumes on failure.</span>
            </div>
          )
        })()}
        {imgErr && <p className="pk__warn">{imgErr}</p>}

        {has && (
          <div className="bld__detailbar bld__detailbar--region">
            <button className="btn btn--soft" onClick={generateRestaurants} disabled={rstBusy}>
              {rstBusy ? <RefreshCw size={14} className="pk__spin" /> : <Sparkles size={14} />} Places to eat (region)
            </button>
            <button className="btn btn--soft" onClick={generateProse} disabled={rstBusy}>
              {rstBusy ? <RefreshCw size={14} className="pk__spin" /> : <Sparkles size={14} />} History &amp; notes (region)
            </button>
            {rstMsg && <span className="bld__detailnote">{rstMsg}</span>}
          </div>
        )}

        <div className="bld__regions">
          {(places || []).map((p) => (
            <PlaceRow key={p.id} countryId={countryId} regionId={region.regionId} place={p}
              detailed={(p.data.activities || []).length > 0}
              image={p.image}
              running={detailRun?.current === p.placeId || imgRun?.current === p.placeId}
              editing={editing === p.placeId}
              onEdit={() => setEditing(p.placeId)} onClose={() => setEditing(null)}
              onRemove={() => removePlace(p.placeId)} onSaved={load} />
          ))}
        </div>
      </section>
      {has && (() => {
        const missing = places.filter((p) => !p.image)
        if (!missing.length) return <p className="bld__hint">Every place has an image ✓</p>
        return <MissingImages countryId={countryId} regionId={region.regionId} places={missing} onSaved={load} />
      })()}
    </div>
  )
}

function MissingImages({ countryId, regionId, places, onSaved }) {
  const [vals, setVals] = useState({})
  const [busy, setBusy] = useState('')
  const save = async (placeId) => {
    const url = (vals[placeId] || '').trim()
    if (!url) return
    setBusy(placeId)
    try { await api.builder.setImage(countryId, regionId, placeId, url); await onSaved() }
    catch (e) { alert(e.message) } finally { setBusy('') }
  }
  return (
    <section className="bld__stage bld__missing">
      <div className="bld__stagehead"><h3>Missing images · {places.length}</h3></div>
      <p className="admin-note">No Unsplash photo was found for these. Paste an image URL for each (any public image link), or re-run the image button to retry Unsplash.</p>
      <div className="bld__regions">
        {places.map((p) => (
          <div key={p.id} className="bld__region">
            <span className="bld__rbody">
              <b>{p.data.name}</b>
              <span className="bld__rmeta">Suggested search: {p.data.imageQueries?.[0] || p.data.name}</span>
            </span>
            <input className="bld__input bld__missinput" placeholder="https://…image.jpg"
              value={vals[p.placeId] || ''} onChange={(e) => setVals({ ...vals, [p.placeId]: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && save(p.placeId)} />
            <button className="btn btn--soft" onClick={() => save(p.placeId)} disabled={busy === p.placeId || !(vals[p.placeId] || '').trim()}>
              {busy === p.placeId ? <RefreshCw size={13} className="pk__spin" /> : <Check size={13} />} Set
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function PlaceRow({ countryId, regionId, place, detailed, image, running, editing, onEdit, onClose, onRemove, onSaved }) {
  const [form, setForm] = useState(place.data)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setForm(place.data) }, [place.id])
  const set = (patch) => setForm({ ...form, ...patch })
  const save = async () => {
    setBusy(true)
    try { await api.builder.savePlace(countryId, regionId, place.placeId, form, place.image); await onSaved(); onClose() }
    finally { setBusy(false) }
  }
  const d = place.data

  if (!editing) {
    return (
      <div className={`bld__region ${running ? 'bld__region--running' : ''}`}>
        <span className="bld__ptick">
          {running ? <RefreshCw size={15} className="pk__spin" /> : detailed ? <span className="bld__done">✓</span> : <span className="bld__pdot" />}
        </span>
        <span className="bld__pthumb">{image?.url ? <img src={image.url} alt="" /> : <span className="bld__pthumb--empty" />}</span>
        <span className="bld__rbody">
          <b>{d.name}</b> <span className="bld__rlocal">{d.type?.toLowerCase()}</span>
          <span className="bld__rmeta">
            {detailed ? `${(d.activities || []).length} to do · ${(d.food || []).length} to eat · ${(d.culture || []).length} tips` : d.description?.slice(0, 70) + '…'}
          </span>
        </span>
        <button className="story__act" onClick={onEdit}><Pencil size={13} /> Edit</button>
        <button className="story__act bld__discard" onClick={onRemove}><Trash2 size={13} /></button>
      </div>
    )
  }
  return (
    <div className="bld__region bld__region--edit">
      <div className="bld__editgrid">
        <label>Name<input value={form.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label>Local name<input value={form.nameIt} onChange={(e) => set({ nameIt: e.target.value })} /></label>
        <label>Type<input value={form.type} onChange={(e) => set({ type: e.target.value.toUpperCase() })} /></label>
        <label>Lat<input type="number" value={form.lat} onChange={(e) => set({ lat: Number(e.target.value) })} /></label>
        <label>Lng<input type="number" value={form.lng} onChange={(e) => set({ lng: Number(e.target.value) })} /></label>
        <label className="bld__editfull">Description<textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} /></label>
      </div>
      <div className="bld__formacts">
        <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? <RefreshCw size={13} className="pk__spin" /> : <Check size={13} />} Save</button>
        <button className="btn btn--soft" onClick={onClose}><X size={13} /> Cancel</button>
      </div>
    </div>
  )
}

function GuidesPanel({ countryId, build, onSaved }) {
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const guides = build.guides || {}
  const run = async (topic) => {
    setBusy(topic); setMsg('')
    try { await api.builder.genGuide(countryId, topic); await onSaved(); setMsg(`${topic} guide generated ✓`) }
    catch (e) { setMsg(e.message) } finally { setBusy('') }
  }
  const items = [
    ['festivals', 'Festivals & events'],
    ['history', 'History'],
    ['food', 'Food & wine'],
    ['transport', 'Getting around'],
  ]
  return (
    <section className="bld__stage">
      <div className="bld__stagehead"><h3>7–10 · Country guides</h3></div>
      <p className="admin-note">One call each — the four guide pages every country has.</p>
      <div className="bld__guides">
        {items.map(([topic, label]) => (
          <button key={topic} className="btn btn--soft" onClick={() => run(topic)} disabled={!!busy}>
            {busy === topic ? <RefreshCw size={14} className="pk__spin" />
              : guides[topic] ? <RefreshCw size={14} /> : <Sparkles size={14} />}
            {label}{guides[topic] ? ' ✓' : ''}
          </button>
        ))}
      </div>
      {msg && <p className="bld__detailnote" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
