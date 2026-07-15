import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, Download, ArrowUp, ArrowDown, Search } from 'lucide-react'
import { getImages, getRegion, getPlacesIndex } from '../../lib/data.js'
import { saveImages, download } from '../../lib/cms.js'
import { RegionPicker } from './Bits.jsx'
import UploadButton from '../UploadButton.jsx'

function LegacyItalyImages({ regions }) {
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

// ── all-countries image manager ──────────────────────────────────────────────
// Country → regions → places, driven by the Country Builder DB (live, no
// deploy). The region hero can be picked from its places' images or set by
// URL/upload; each place image is editable by URL or upload. Italy predates
// the builder — when it has no build, the legacy static images.json editor
// above is used for it instead.
import { useCallback } from 'react'
import { ChevronLeft, ImageIcon, Check as CheckIcon } from 'lucide-react'
import { api } from '../../lib/api.js'

function PlaceImageRow({ country, region, place, onSaved }) {
  const current = place.image?.url || ''
  const [url, setUrl] = useState(current)
  const [credit, setCredit] = useState(place.image?.credit || '')
  const [busy, setBusy] = useState(false)
  const dirty = url !== current || credit !== (place.image?.credit || '')

  const save = async () => {
    if (!url.trim()) { alert('Paste an image URL or upload a file first.'); return }
    setBusy(true)
    // The server keeps any existing profile when the URL is unchanged, so
    // editing the credit text here can't wipe a backfilled username.
    try { await api.builder.setImage(country, region, place.placeId, url.trim(), credit.trim()); onSaved() }
    catch (e) { alert(e.message || 'Save failed') }
    finally { setBusy(false) }
  }

  return (
    <li className="cms-img">
      <div className="cms-img__thumb">
        {url ? <img src={url} alt="" loading="lazy" /> : <span className="cms-img__ph">No image</span>}
      </div>
      <div className="cms-img__fields">
        <b className="cms-img__name">{place.data?.name || place.placeId}</b>
        <div className="imgfield__row">
          <input value={url} placeholder="Image URL or upload" onChange={(e) => setUrl(e.target.value)} />
          <UploadButton onUploaded={setUrl} className="imgfield__btn" />
        </div>
        <input value={credit} placeholder="Photo credit" onChange={(e) => setCredit(e.target.value)} />
      </div>
      <div className="cms-img__actions">
        <button className="btn btn--primary cms-img__save" onClick={save} disabled={busy || !dirty}>
          <Save size={14} /> {busy ? '…' : 'Save'}
        </button>
      </div>
    </li>
  )
}

function RegionImages({ country, regionId, onBack }) {
  const [data, setData] = useState(null)
  const [heroUrl, setHeroUrl] = useState('')
  const [heroCredit, setHeroCredit] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.builder.region(country, regionId).then((d) => {
      setData(d)
      setHeroUrl(d.region?.data?.heroImage?.url || '')
      setHeroCredit(d.region?.data?.heroImage?.credit || '')
    }).catch(() => setData(false))
  }, [country, regionId])
  useEffect(() => { load() }, [load])

  if (data === null) return <p className="admin-empty">Loading region…</p>
  if (data === false) return <p className="admin-empty">Couldn't load that region.</p>

  const { region, places } = data
  const currentHero = region?.data?.heroImage?.url || ''
  const withImages = places.filter((p) => p.image?.url)

  // Carry the source photo's Unsplash profile across, not just the name — the
  // region page has to credit the photographer with a link, and a bare name
  // can't produce one.
  const setHero = async (url, credit = '', extra = {}) => {
    setBusy(true)
    try { await api.builder.setRegionHero(country, regionId, url, credit, extra); load() }
    catch (e) { alert(e.message || 'Save failed') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <button className="cms-backlink" onClick={onBack}><ChevronLeft size={15} /> All regions</button>
      <section className="cms-sec">
        <div className="cms-sec__head"><h3>Region image — {region?.data?.name || regionId}</h3></div>
        <p className="admin-note">Pick one of the region's place photos as its hero, or set a custom one. Shown on the region page and cards.</p>
        {withImages.length > 0 && (
          <ul className="cms-herogrid">
            {withImages.map((p) => {
              const u = p.image.url
              const on = u === currentHero
              return (
                <li key={p.placeId}>
                  <button className={`cms-heropick ${on ? 'is-on' : ''}`} disabled={busy}
                    onClick={() => setHero(u, p.image.credit || '', {
                      creditUsername: p.image.creditUsername || '', creditUrl: p.image.creditUrl || '',
                    })} title={`Use ${p.data?.name || p.placeId}'s photo`}>
                    <img src={u} alt="" loading="lazy" />
                    <span>{p.data?.name || p.placeId}</span>
                    {on && <em className="cms-heropick__on"><CheckIcon size={13} /> Region image</em>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {withImages.length === 0 && <p className="cms-items__empty">No place photos in this region yet — add some below, or set a custom hero.</p>}
        <div className="imgfield__row cms-herocustom">
          <input value={heroUrl} placeholder="Custom hero URL or upload" onChange={(e) => setHeroUrl(e.target.value)} />
          <UploadButton onUploaded={setHeroUrl} className="imgfield__btn" />
          <button className="btn btn--primary" disabled={busy || !heroUrl.trim() || heroUrl === currentHero}
            onClick={() => setHero(heroUrl.trim(), heroCredit.trim())}><Save size={14} /> Set</button>
          {currentHero && <button className="btn btn--soft" disabled={busy} onClick={() => setHero('')}>Clear</button>}
        </div>
      </section>

      <section className="cms-sec">
        <div className="cms-sec__head"><h3>Place images — {places.length} places</h3></div>
        <ul className="cms-imgs">
          {places.map((p) => (
            <PlaceImageRow key={p.placeId} country={country} region={regionId} place={p} onSaved={load} />
          ))}
        </ul>
      </section>
    </div>
  )
}

// Country main image: pick from every place photo in the country (live DB or
// static fallback via getImages), or set a custom URL/upload. Stored as the
// countryHero.<slug> site setting — used by the destinations cards and the
// country page hero.
function CountryHeroPicker({ countryId }) {
  const [imgs, setImgs] = useState(null)
  const [names, setNames] = useState({})
  const [current, setCurrent] = useState('')
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let on = true
    getImages(countryId).then((all) => on && setImgs(all || {})).catch(() => on && setImgs({}))
    getPlacesIndex(countryId).then((list) => {
      if (!on) return
      const m = {}
      for (const pl of (Array.isArray(list) ? list : (list?.places || []))) m[pl.id] = pl.name
      setNames(m)
    }).catch(() => {})
    api.settings.getAll().then((sAll) => on && setCurrent(sAll?.[`countryHero.${countryId}`] || '')).catch(() => {})
    return () => { on = false }
  }, [countryId])

  const options = useMemo(() => {
    if (!imgs) return []
    const out = []
    for (const [regionId, places] of Object.entries(imgs)) {
      if (regionId === '__regions') continue
      for (const [placeId, list] of Object.entries(places || {})) {
        const im = list?.[0]
        if (im?.url) out.push({ ...im, label: names[placeId] || placeId, regionId })
      }
    }
    return out
  }, [imgs, names])

  const [savedNote, setSavedNote] = useState(false)
  // countryHero.<slug> stays a plain URL string — the Destinations cards and the
  // country hero read it directly, and changing its shape would break them. The
  // photographer rides alongside in countryHeroCredit.<slug> as JSON, so the
  // country page can credit Unsplash the way their API terms require. A pasted
  // custom URL has no photographer, so the credit is cleared with it.
  const setHero = async (url, src = null) => {
    setBusy(true)
    try {
      const credit = src && src.credit
        ? JSON.stringify({ credit: src.credit, creditUsername: src.creditUsername || '', creditUrl: src.creditUrl || '' })
        : ''
      await api.settings.save({ [`countryHero.${countryId}`]: url, [`countryHeroCredit.${countryId}`]: credit })
      setCurrent(url); setCustom(''); setSavedNote(true)
    } catch (e) { alert(e.message || 'Save failed') }
    finally { setBusy(false) }
  }

  return (
    <section className="cms-sec">
      <div className="cms-sec__head"><h3>Country image</h3></div>
      <p className="admin-note">The country's main image — shown on the Destinations page cards and the country page hero. Pick one of its place photos, or set a custom one.</p>
      {savedNote && <p className="admin-note admin-note--hot">Saved — it shows on the next reload locally, and within ~5 minutes on the live site (edge cache).</p>}
      {imgs === null && <p className="admin-empty">Loading photos…</p>}
      {imgs !== null && options.length === 0 && <p className="cms-items__empty">No place photos in this country yet.</p>}
      {options.length > 0 && (
        <ul className="cms-herogrid">
          {options.map((o) => (
            <li key={`${o.regionId}/${o.label}/${o.url}`}>
              <button className={`cms-heropick ${o.url === current ? 'is-on' : ''}`} disabled={busy}
                onClick={() => setHero(o.url, o)} title={`Use ${o.label}'s photo`}>
                <img src={o.url} alt="" loading="lazy" />
                <span>{o.label}</span>
                {o.url === current && <em className="cms-heropick__on"><CheckIcon size={13} /> Country image</em>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="imgfield__row cms-herocustom">
        <input value={custom} placeholder="Custom image URL or upload" onChange={(e) => setCustom(e.target.value)} />
        <UploadButton onUploaded={setCustom} className="imgfield__btn" />
        <button className="btn btn--primary" disabled={busy || !custom.trim()} onClick={() => setHero(custom.trim())}><Save size={14} /> Set</button>
        {current && <button className="btn btn--soft" disabled={busy} onClick={() => setHero('')}>Clear</button>}
      </div>
    </section>
  )
}

export default function AdminImages({ regions, fixedCountry = '' }) {
  const [builds, setBuilds] = useState(null)
  const [countryId, setCountryId] = useState(fixedCountry)
  const [regionsData, setRegionsData] = useState(null)
  const [regionId, setRegionId] = useState('')

  useEffect(() => { api.builder.list().then(setBuilds).catch(() => setBuilds(false)) }, [])
  useEffect(() => {
    setRegionId(''); setRegionsData(null)
    if (!countryId || countryId === '__italy_static') return
    api.builder.get(countryId).then(setRegionsData).catch(() => setRegionsData(false))
  }, [countryId])

  if (builds === null) return <p className="admin-empty">Loading countries…</p>

  const buildList = Array.isArray(builds) ? builds : []
  const hasItalyBuild = buildList.some((b) => (b.countryId || b.id) === 'italy')

  return (
    <div className="cms">
      {!fixedCountry && (
        <div className="cms-pickrow">
          <label className="admin-field">
            <span className="admin-field__label">Country</span>
            <select value={countryId} onChange={(e) => setCountryId(e.target.value)}>
              <option value="">Choose a country…</option>
              {buildList.map((b) => {
                const id = b.countryId || b.id
                return <option key={id} value={id}>{b.flag ? `${b.flag} ` : ''}{b.name || id}</option>
              })}
              {!hasItalyBuild && <option value="__italy_static">🇮🇹 Italy (static images.json)</option>}
            </select>
          </label>
        </div>
      )}

      {!countryId && <p className="admin-empty">Pick a country to manage its region and place images.</p>}

      {countryId && <CountryHeroPicker countryId={countryId === '__italy_static' ? 'italy' : countryId} />}

      {countryId === '__italy_static' && <LegacyItalyImages regions={regions} />}

      {countryId && countryId !== '__italy_static' && !regionId && (
        regionsData === null ? <p className="admin-empty">Loading regions…</p>
        : regionsData === false ? <p className="admin-empty">Couldn't load that country.</p>
        : (
          <ul className="cms-regionlist">
            {(regionsData.regions || []).map((r) => (
              <li key={r.regionId}>
                <button className="cms-regionrow" onClick={() => setRegionId(r.regionId)}>
                  <span className="cms-regionrow__thumb">
                    {r.data?.heroImage?.url ? <img src={r.data.heroImage.url} alt="" loading="lazy" /> : <ImageIcon size={18} />}
                  </span>
                  <span className="cms-regionrow__name">{r.data?.name || r.regionId}</span>
                  <span className="cms-regionrow__meta">{r.imagedPlaces}/{r.placeCount} place photos{r.data?.heroImage?.url ? ' · hero set' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {countryId && countryId !== '__italy_static' && regionId && (
        <RegionImages country={countryId} regionId={regionId} onBack={() => setRegionId('')} />
      )}
    </div>
  )
}
