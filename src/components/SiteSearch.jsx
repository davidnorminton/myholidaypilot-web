import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, MapPin, Map as MapIcon, Globe2 } from 'lucide-react'
import { COUNTRIES } from '../lib/countries.js'
import { getPlacesIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'

// Live search across countries, regions and places. Indexes load lazily on
// first focus (one small JSON per live country) and are cached for the session.
let INDEX_CACHE = null
async function loadIndex() {
  if (INDEX_CACHE) return INDEX_CACHE
  const live = COUNTRIES.filter((c) => c.available)
  const bySlug = new Map(live.map((c) => [c.slug, c]))

  // One combined lean index (baked by gen-countries.mjs) instead of fetching
  // every country's full places-index — one request, half the bytes.
  try {
    const r = await fetch('/data/search-index.json')
    if (r.ok) {
      const lean = await r.json()
      const regions = []
      const places = []
      const seen = new Set()
      for (const e of lean) {
        const country = bySlug.get(e.c)
        if (!country) continue
        if (!seen.has(`${e.c}/${e.r}`)) {
          seen.add(`${e.c}/${e.r}`)
          regions.push({ id: e.r, name: e.rn, emoji: e.re || '', country })
        }
        places.push({ placeId: e.p, name: e.n, nameIt: e.nl || '', regionId: e.r, regionName: e.rn, regionEmoji: e.re || '', country })
      }
      if (places.length) {
        INDEX_CACHE = { regions, places }
        return INDEX_CACHE
      }
    }
  } catch { /* fall through to per-country */ }

  // Fallback: the old per-country fetch (pre-index deploys, partial data).
  const perCountry = await Promise.all(live.map(async (c) => {
    try {
      const places = await getPlacesIndex(c.slug)
      return { country: c, places: places || [] }
    } catch { return { country: c, places: [] } }
  }))
  const regions = []
  const places = []
  for (const { country, places: pl } of perCountry) {
    const seen = new Set()
    for (const p of pl) {
      if (!seen.has(p.regionId)) {
        seen.add(p.regionId)
        regions.push({ id: p.regionId, name: p.regionName, emoji: p.regionEmoji || '', country })
      }
      places.push({ ...p, country })
    }
  }
  INDEX_CACHE = { regions, places }
  return INDEX_CACHE
}

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export default function SiteSearch() {
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const [idx, setIdx] = useState(null)
  const [sel, setSel] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  // lazy-load on first focus
  useEffect(() => { if (focus && !idx) loadIndex().then(setIdx) }, [focus, idx])

  // close on outside click
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setFocus(false); setExpanded(false) } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(() => {
    const term = norm(q.trim())
    if (!term || term.length < 2) return null
    const countries = COUNTRIES.filter((c) => c.available && norm(c.name).includes(term)).slice(0, 3)
      .map((c) => ({ kind: 'country', label: c.name, sub: 'Country', icon: c.flag, to: paths.country(c.slug) }))
    if (!idx) return countries.length ? countries : null
    const starts = (s) => norm(s).startsWith(term)
    const has = (s) => norm(s).includes(term)
    const regions = idx.regions
      .filter((r) => has(r.name))
      .sort((a, b) => starts(b.name) - starts(a.name))
      .slice(0, 4)
      .map((r) => ({ kind: 'region', label: r.name, sub: `Region · ${r.country.name}`, icon: r.emoji || r.country.flag, to: paths.region(r.id, r.country.slug) }))
    const places = idx.places
      .filter((p) => has(p.name) || has(p.nameIt))
      .sort((a, b) => (starts(b.name) - starts(a.name)))
      .slice(0, 6)
      .map((p) => ({ kind: 'place', label: p.name, sub: `${p.regionName} · ${p.country.name}`, icon: null, to: paths.place(p.regionId, p.placeId, p.country.slug) }))
    const all = [...countries, ...regions, ...places]
    return all.length ? all : []
  }, [q, idx])

  useEffect(() => { setSel(0) }, [q])

  const go = (r) => { setQ(''); setFocus(false); setExpanded(false); navigate(r.to) }

  const onKey = (e) => {
    if (e.key === 'Escape') { setFocus(false); setExpanded(false); return }
    if (!results || !results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[sel]) }
  }

  const open = focus && q.trim().length >= 2

  return (
    <div className={`sitesearch ${focus ? 'is-focus' : ''} ${expanded ? 'is-expanded' : ''}`} ref={boxRef} role="search">
      {/* mobile: collapsed icon-only trigger */}
      <button className="sitesearch__trigger" aria-label="Search"
        onClick={() => { setExpanded(true); setFocus(true); requestAnimationFrame(() => inputRef.current?.focus()) }}>
        <Search size={18} />
      </button>

      <Search size={15} className="sitesearch__icon" aria-hidden />
      <input ref={inputRef} className="sitesearch__input" placeholder="Search places…" value={q}
        onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onKeyDown={onKey}
        aria-label="Search countries, regions and places" />
      {expanded && (
        <button className="sitesearch__cancel" aria-label="Close search"
          onClick={() => { setExpanded(false); setFocus(false); setQ('') }}>
          <X size={18} />
        </button>
      )}
      {open && (
        <div className="sitesearch__drop" role="listbox">
          {results === null && <div className="sitesearch__empty">Searching…</div>}
          {results && results.length === 0 && <div className="sitesearch__empty">Nothing found for “{q.trim()}”</div>}
          {results && results.map((r, i) => (
            <button key={`${r.kind}-${r.to}`} role="option" aria-selected={i === sel}
              className={`sitesearch__row ${i === sel ? 'is-sel' : ''}`}
              onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
              <span className="sitesearch__rowicon" aria-hidden>
                {r.icon || (r.kind === 'place' ? <MapPin size={14} /> : r.kind === 'region' ? <MapIcon size={14} /> : <Globe2 size={14} />)}
              </span>
              <span className="sitesearch__rowlabel">{r.label}</span>
              <span className="sitesearch__rowsub">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
