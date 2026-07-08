import { useEffect, useMemo, useState } from 'react'
import { Plus, X, ArrowUp, ArrowDown, Star } from 'lucide-react'
import { getPlacesIndex } from '../../lib/data.js'
import { COUNTRIES } from '../../lib/countries.js'

// Pick the places shown as "Featured destinations" on the home page.
// Value is a JSON array of {c: countrySlug, r: regionId, p: placeId},
// stored in the `featuredPlaces` site setting (order = display order,
// first pick renders as the large lead card).
// A pick is a place {c,r,p} or a whole region {c,r} (no placeId).
const keyOf = (x) => `${x.c}/${x.r}/${x.p || 'region'}`

export default function FeaturedPicker({ value, onChange }) {
  const picks = useMemo(() => { try { return JSON.parse(value || '[]') } catch { return [] } }, [value])
  const [country, setCountry] = useState(COUNTRIES.find((c) => c.available)?.slug || 'italy')
  const [places, setPlaces] = useState(null)
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('')
  const [labels, setLabels] = useState({})   // key → display label

  // load the picker country's places
  useEffect(() => {
    setPlaces(null)
    getPlacesIndex(country).then(setPlaces).catch(() => setPlaces([]))
  }, [country])

  // resolve labels for the current picks (across countries)
  useEffect(() => {
    const slugs = [...new Set(picks.map((x) => x.c))]
    Promise.all(slugs.map((slug) => getPlacesIndex(slug).then((l) => [slug, l]).catch(() => [slug, []])))
      .then((pairs) => {
        const byCountry = Object.fromEntries(pairs)
        const out = {}
        for (const x of picks) {
          const list = byCountry[x.c] || []
          const flag = COUNTRIES.find((c) => c.slug === x.c)?.flag || ''
          if (x.p) {
            const hit = list.find((pl) => pl.regionId === x.r && pl.placeId === x.p)
            out[keyOf(x)] = hit ? `${flag} ${hit.name} — ${hit.regionName}` : `${flag} ${x.p} (missing)`
          } else {
            const hit = list.find((pl) => pl.regionId === x.r)
            out[keyOf(x)] = hit ? `${flag} ${hit.regionName} — whole region` : `${flag} ${x.r} (region, missing)`
          }
        }
        setLabels(out)
      })
  }, [picks])

  const norm = (x) => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const results = useMemo(() => {
    if (!places || !q.trim()) return []
    const s = norm(q)
    return places.filter((p) => norm(p.name).includes(s) || norm(p.regionName).includes(s)).slice(0, 8)
  }, [places, q])

  const regions = useMemo(() => {
    if (!places) return []
    const m = new Map()
    for (const p of places) if (!m.has(p.regionId)) m.set(p.regionId, p.regionName)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [places])

  const save = (next) => onChange(JSON.stringify(next))
  const add = (p) => {
    const key = { c: country, r: p.regionId, p: p.placeId }
    if (picks.some((x) => x.c === key.c && x.r === key.r && x.p === key.p)) return
    save([...picks, key]); setQ('')
  }
  const addRegion = () => {
    if (!region) return
    if (picks.some((x) => x.c === country && x.r === region && !x.p)) return
    save([...picks, { c: country, r: region }]); setRegion('')
  }
  const remove = (i) => save(picks.filter((_, idx) => idx !== i))
  const move = (i, dir) => {
    const next = [...picks]; const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    save(next)
  }

  return (
    <div className="featpick">
      <div className="featpick__add">
        <select value={country} onChange={(e) => { setCountry(e.target.value); setRegion('') }}>
          {COUNTRIES.filter((c) => c.available).map((c) => <option key={c.slug} value={c.slug}>{c.flag} {c.name}</option>)}
        </select>
        <div className="featpick__search">
          <input placeholder={places === null ? 'Loading places…' : 'Search places to feature…'} value={q}
            onChange={(e) => setQ(e.target.value)} disabled={places === null} />
          {results.length > 0 && (
            <div className="featpick__results">
              {results.map((p) => (
                <button key={`${p.regionId}/${p.placeId}`} type="button" onClick={() => add(p)}>
                  <Plus size={13} /> {p.name} <span>· {p.regionName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="featpick__region">
        <select value={region} onChange={(e) => setRegion(e.target.value)} disabled={!regions.length}>
          <option value="">{regions.length ? 'Or feature a whole region…' : 'Loading regions…'}</option>
          {regions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <button type="button" className="featpick__addregion" onClick={addRegion} disabled={!region}>
          <Plus size={13} /> Add region
        </button>
      </div>
      {picks.length === 0
        ? <p className="admin-note">No featured places yet — the section stays hidden on the home page until you add some. The first pick shows as the large lead card.</p>
        : (
          <ul className="featpick__list">
            {picks.map((x, i) => (
              <li key={keyOf(x)} className="featpick__item">
                {i === 0 && <Star size={13} className="featpick__lead" title="Lead card" />}
                <span className="featpick__label">{labels[keyOf(x)] || keyOf(x)}</span>
                <span className="featpick__btns">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Move up"><ArrowUp size={13} /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === picks.length - 1} title="Move down"><ArrowDown size={13} /></button>
                  <button type="button" onClick={() => remove(i)} title="Remove"><X size={13} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
