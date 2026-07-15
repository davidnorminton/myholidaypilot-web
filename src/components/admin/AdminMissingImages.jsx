import { useEffect, useState } from 'react'
import { ChevronRight, RefreshCw, Search, Upload, Check, X, ImageOff } from 'lucide-react'
import { api } from '../../lib/api.js'
import ImageField from '../ImageField.jsx'

// Walks every build → region → place with no image. Collapsible tree with a
// count at each level. Click a place to open the Unsplash sidebar (search +
// pick) or upload directly. Setting an image removes the place from the list.
export default function AdminMissingImages() {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [openCountry, setOpenCountry] = useState(null)
  const [openRegion, setOpenRegion] = useState(null)
  const [active, setActive] = useState(null)   // { countryId, regionId, placeId, name, query }

  const load = async () => {
    setBusy(true)
    try { const r = await api.builder.missing(); setData(r.countries) }
    catch { setData([]) } finally { setBusy(false) }
  }
  useEffect(() => { load() }, [])

  const totalMissing = (data || []).reduce((n, c) => n + c.missing, 0)

  // when an image is set for the active place, drop it from the tree
  const onResolved = (countryId, regionId, placeId) => {
    setData((prev) => (prev || []).map((c) => {
      if (c.countryId !== countryId) return c
      const regions = c.regions.map((r) => {
        if (r.regionId !== regionId) return r
        const places = r.places.filter((p) => p.placeId !== placeId)
        return { ...r, places, missing: places.length }
      }).filter((r) => r.places.length)
      return { ...c, regions, missing: regions.reduce((n, r) => n + r.missing, 0) }
    }).filter((c) => c.regions.length))
    setActive(null)
  }

  return (
    <div className="mi">
      <div className="mi__head">
        <div>
          <h3 className="admin-h3" style={{ margin: 0 }}>Missing images</h3>
          <p className="admin-note" style={{ margin: '4px 0 0' }}>
            {busy ? 'Scanning…' : totalMissing ? `${totalMissing} places without an image across ${data.length} ${data.length === 1 ? 'country' : 'countries'}.` : 'Every place has an image. ✓'}
          </p>
        </div>
        <button className="btn btn--soft" onClick={load} disabled={busy}>
          <RefreshCw size={14} className={busy ? 'pk__spin' : ''} /> Rescan
        </button>
      </div>

      <div className="mi__layout">
        <div className="mi__tree">
          {(data || []).map((c) => {
            const cOpen = openCountry === c.countryId
            return (
              <div key={c.countryId} className="mi__country">
                <button className="mi__row mi__row--country" onClick={() => setOpenCountry(cOpen ? null : c.countryId)}>
                  <ChevronRight size={16} className={`mi__chev ${cOpen ? 'is-open' : ''}`} />
                  <span className="mi__flag">{c.flag}</span>
                  <span className="mi__name">{c.name}</span>
                  <span className="mi__count">{c.missing}</span>
                </button>
                {cOpen && c.regions.map((r) => {
                  const rKey = `${c.countryId}/${r.regionId}`
                  const rOpen = openRegion === rKey
                  return (
                    <div key={r.regionId} className="mi__region">
                      <button className="mi__row mi__row--region" onClick={() => setOpenRegion(rOpen ? null : rKey)}>
                        <ChevronRight size={15} className={`mi__chev ${rOpen ? 'is-open' : ''}`} />
                        <span className="mi__name">{r.name}</span>
                        <span className="mi__count">{r.missing}/{r.total}</span>
                      </button>
                      {rOpen && r.places.map((p) => {
                        const isActive = active && active.placeId === p.placeId && active.regionId === r.regionId && active.countryId === c.countryId
                        return (
                          <button key={p.placeId}
                            className={`mi__row mi__row--place ${isActive ? 'is-active' : ''}`}
                            onClick={() => setActive({ countryId: c.countryId, regionId: r.regionId, placeId: p.placeId, name: p.name, query: p.query })}>
                            <ImageOff size={13} className="mi__placeicon" />
                            <span className="mi__name">{p.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
          {data && !data.length && !busy && (
            <div className="mi__empty"><Check size={20} /> Nothing missing — every place has an image.</div>
          )}
        </div>

        <div className="mi__panel">
          {active
            ? <ImagePicker key={`${active.countryId}/${active.regionId}/${active.placeId}`} place={active}
                onClose={() => setActive(null)} onResolved={onResolved} />
            : <div className="mi__panelempty">
                <Search size={22} />
                <p>Select a place on the left to find or upload an image.</p>
              </div>}
        </div>
      </div>
    </div>
  )
}

// The right sidebar: Unsplash search grid + direct upload for one place.
function ImagePicker({ place, onClose, onResolved }) {
  const [query, setQuery] = useState(place.query || place.name)
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState('')

  const search = async () => {
    setBusy(true); setErr(''); setResults(null)
    try { const r = await api.builder.imageSearch(query); setResults(r.results) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  useEffect(() => { search() }, [])   // auto-search on open

  const choose = async (img) => {
    setSaving(img.url); setErr('')
    try {
      // Carry the photographer's profile through so the public pages can render
      // a compliant Unsplash credit, not just a name.
      await api.builder.setImage(place.countryId, place.regionId, place.placeId, img.url, img.credit,
        { creditUsername: img.creditUsername || '', creditUrl: img.creditUrl || '' })
      onResolved(place.countryId, place.regionId, place.placeId)
    } catch (e) { setErr(e.message); setSaving('') }
  }

  const uploadSet = async (url) => {
    if (!url) return
    setSaving(url); setErr('')
    try {
      await api.builder.setImage(place.countryId, place.regionId, place.placeId, url, '')
      onResolved(place.countryId, place.regionId, place.placeId)
    } catch (e) { setErr(e.message); setSaving('') }
  }

  return (
    <div className="mip">
      <div className="mip__head">
        <div>
          <span className="mip__eyebrow">{place.regionId}</span>
          <h4 className="mip__name">{place.name}</h4>
        </div>
        <button className="mip__x" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>

      <div className="mip__searchbar">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search Unsplash…" />
        <button className="btn btn--soft" onClick={search} disabled={busy}>
          {busy ? <RefreshCw size={14} className="pk__spin" /> : <Search size={14} />}
        </button>
      </div>

      {err && <p className="mip__err">{err}</p>}

      <div className="mip__grid">
        {busy && !results && <p className="admin-note">Searching…</p>}
        {results && results.map((img) => (
          <button key={img.url} className={`mip__thumb ${saving === img.url ? 'is-saving' : ''}`}
            onClick={() => choose(img)} disabled={!!saving} title={img.credit}>
            <img src={img.thumb} alt="" loading="lazy" />
            {saving === img.url && <span className="mip__saving"><Check size={16} /></span>}
          </button>
        ))}
        {results && !results.length && <p className="admin-note">No results — try a different search.</p>}
      </div>

      <div className="mip__upload">
        <span className="admin-field__label"><Upload size={13} /> Or upload / paste a URL</span>
        <ImageField label="" value="" onChange={uploadSet} />
      </div>
    </div>
  )
}
