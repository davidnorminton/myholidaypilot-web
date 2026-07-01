import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, ChevronRight, ChevronLeft, X, Check, Plus, MapPin, Sparkles, Lightbulb,
} from 'lucide-react'
import { getPlacesIndex, getIndex } from '../lib/data.js'
import { typeLabel } from '../lib/format.js'
import { useTrips, addPlace, removePlace, customPlaceId } from '../lib/trips.js'

const MODES = [
  { id: 'ideas', label: 'Ideas' },
  { id: 'search', label: 'Search' },
  { id: 'browse', label: 'Regions' },
  { id: 'custom', label: 'Add your own' },
]

const HIGHLIGHTS = ['Rome', 'Florence', 'Venice', 'Amalfi Coast', 'Cinque Terre', 'Pompeii']

const THEMES = [
  { id: 'highlights', emoji: '⭐', label: 'Iconic highlights', blurb: 'Six can’t-miss places to start', highlight: true },
  { id: 'coast', emoji: '🏖️', label: 'Coast & sea', blurb: 'Beaches, cliffs, harbour towns', types: ['COAST'] },
  { id: 'cities', emoji: '🏙️', label: 'Cities', blurb: 'Capitals and big hitters', types: ['CITY'] },
  { id: 'towns', emoji: '🏘️', label: 'Towns & villages', blurb: 'Hilltop gems, slow mornings', types: ['TOWN'] },
  { id: 'mountains', emoji: '⛰️', label: 'Mountains & lakes', blurb: 'Peaks, trails, lakeside calm', types: ['MOUNTAIN', 'LAKE'] },
  { id: 'sights', emoji: '🏛️', label: 'Landmarks', blurb: 'Icons and one-off wonders', types: ['LANDMARK'] },
]

export default function AddPlaceWizard({ tripId, initialQuery = '', initialMode = 'ideas', onClose }) {
  const snap = useTrips()
  const trip = snap.trips.find((t) => t.id === tripId)
  const [mode, setMode] = useState(initialQuery ? 'search' : initialMode)
  const [places, setPlaces] = useState(null)
  const [regions, setRegions] = useState(null)
  const [q, setQ] = useState(initialQuery)
  const [openRegion, setOpenRegion] = useState(null)
  const [openTheme, setOpenTheme] = useState(null)
  const searchRef = useRef(null)

  useEffect(() => {
    getPlacesIndex().then(setPlaces).catch(() => setPlaces([]))
    getIndex().then((d) => setRegions(d.regions || [])).catch(() => setRegions([]))
  }, [])
  useEffect(() => { if (mode === 'search') searchRef.current?.focus() }, [mode])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const has = (regionId, placeId) =>
    !!trip && trip.places.some((p) => p.regionId === regionId && p.placeId === placeId)

  const toggle = (entry) => {
    if (has(entry.regionId, entry.placeId)) removePlace(tripId, entry.regionId, entry.placeId)
    else addPlace(tripId, {
      regionId: entry.regionId, placeId: entry.placeId, name: entry.name,
      regionName: entry.regionName, type: entry.type, lat: entry.lat, lng: entry.lng,
    })
  }

  const results = useMemo(() => {
    if (!places) return []
    const s = q.trim().toLowerCase()
    if (!s) return []
    const scored = []
    for (const p of places) {
      const name = (p.name || '').toLowerCase()
      let score = -1
      if (name.startsWith(s)) score = 0
      else if (name.includes(s)) score = 1
      else if ((p.nameIt || '').toLowerCase().includes(s)) score = 2
      else if ((p.regionName || '').toLowerCase().includes(s)) score = 3
      if (score >= 0) scored.push([score, p])
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
    return scored.slice(0, 40).map((x) => x[1])
  }, [places, q])

  const themeCount = (theme) => {
    if (!places) return 0
    if (theme.highlight) return HIGHLIGHTS.length
    return places.filter((p) => theme.types.includes(p.type)).length
  }
  const themePlaces = useMemo(() => {
    if (!openTheme || !places) return []
    const list = openTheme.highlight
      ? places.filter((p) => HIGHLIGHTS.includes(p.name))
      : places.filter((p) => openTheme.types.includes(p.type))
    return [...list].sort((a, b) => (a.regionName || '').localeCompare(b.regionName || '') || a.name.localeCompare(b.name))
  }, [openTheme, places])

  const setModeReset = (m) => { setMode(m); setOpenRegion(null); setOpenTheme(null) }

  return createPortal(
    <div className="wiz-backdrop" onMouseDown={onClose}>
      <div className="wiz" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="wiz__head">
          <div>
            <h2 className="wiz__title">Add places{trip ? ` to ${trip.name}` : ''}</h2>
            <p className="wiz__sub">Not sure yet? Start with <b>Ideas</b>. Know the spot? <b>Search</b> it.</p>
          </div>
          <button className="wiz__x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="wiz__modes">
          {MODES.map((m) => (
            <button key={m.id} className={`wiz-seg ${mode === m.id ? 'wiz-seg--on' : ''}`} onClick={() => setModeReset(m.id)}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="wiz__body">
          {/* IDEAS */}
          {mode === 'ideas' && !openTheme && (
            <>
              <Hint icon={Lightbulb} text="Pick what you’re into and we’ll show places that fit. Add as many as you like." />
              <div className="wiz-themes">
                {THEMES.map((t) => (
                  <button key={t.id} className="wiz-theme" onClick={() => setOpenTheme(t)}>
                    <span className="wiz-theme__emoji">{t.emoji}</span>
                    <span className="wiz-theme__label">{t.label}</span>
                    <span className="wiz-theme__blurb">{t.blurb}</span>
                    <span className="wiz-theme__n">{themeCount(t)} places</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {mode === 'ideas' && openTheme && (
            <>
              <button className="wiz-back" onClick={() => setOpenTheme(null)}><ChevronLeft size={16} /> All ideas</button>
              <p className="wiz-crumb"><span>{openTheme.emoji} {openTheme.label}</span> <ChevronRight size={14} /> {themePlaces.length} places</p>
              <ul className="wiz-list">
                {themePlaces.map((p) => (
                  <ResultRow key={`${p.regionId}/${p.placeId}`} entry={p} added={has(p.regionId, p.placeId)} onToggle={() => toggle(p)} />
                ))}
              </ul>
            </>
          )}

          {/* SEARCH */}
          {mode === 'search' && (
            <>
              <label className="wiz-search">
                <Search size={18} />
                <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Search a city, town or sight — e.g. Florence" />
              </label>
              {q.trim() === '' && <Hint icon={Search} text="Type a place name to find it across all 20 regions." />}
              {q.trim() !== '' && results.length === 0 && places && (
                <Hint icon={Sparkles} text={`No match for “${q}”. Try “Add your own” to add it anyway.`} />
              )}
              <ul className="wiz-list">
                {results.map((p) => (
                  <ResultRow key={`${p.regionId}/${p.placeId}`} entry={p} added={has(p.regionId, p.placeId)} onToggle={() => toggle(p)} />
                ))}
              </ul>
            </>
          )}

          {/* BROWSE / DRILL */}
          {mode === 'browse' && !openRegion && (
            <>
              <p className="wiz-crumb"><span>Italy</span> <ChevronRight size={14} /> Pick a region</p>
              <ul className="wiz-regions">
                {(regions || []).map((r) => (
                  <li key={r.id}>
                    <button className="wiz-region" onClick={() => setOpenRegion(r)}>
                      <span className="wiz-region__emoji">{r.emoji}</span>
                      <span className="wiz-region__text">
                        <span className="wiz-region__name">{r.name}</span>
                        {shortSeason(r.bestTimeToVisit) && <span className="wiz-region__hint">Best {shortSeason(r.bestTimeToVisit)}</span>}
                      </span>
                      <span className="wiz-region__n">{r.placeCount}</span>
                      <ChevronRight size={16} className="wiz-region__go" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {mode === 'browse' && openRegion && (
            <>
              <button className="wiz-back" onClick={() => setOpenRegion(null)}><ChevronLeft size={16} /> All regions</button>
              <p className="wiz-crumb"><span>Italy</span> <ChevronRight size={14} /> {openRegion.name}</p>
              <ul className="wiz-list">
                {(places || []).filter((p) => p.regionId === openRegion.id).map((p) => (
                  <ResultRow key={p.placeId} entry={p} added={has(p.regionId, p.placeId)} onToggle={() => toggle(p)} hideRegion />
                ))}
              </ul>
            </>
          )}

          {/* CUSTOM */}
          {mode === 'custom' && <CustomForm tripId={tripId} regions={regions || []} />}
        </div>

        <footer className="wiz__foot">
          <span className="wiz__count">
            {trip ? `${trip.places.length} ${trip.places.length === 1 ? 'place' : 'places'} in this trip` : ''}
          </span>
          <button className="btn btn--primary" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function ResultRow({ entry, added, onToggle, hideRegion }) {
  return (
    <li className="wiz-row">
      <span className="wiz-row__emoji">{entry.regionEmoji}</span>
      <span className="wiz-row__text">
        <span className="wiz-row__name">{entry.name}</span>
        <span className="wiz-row__meta">
          {typeLabel(entry.type)}{!hideRegion && entry.regionName ? ` · ${entry.regionName}` : ''}
        </span>
      </span>
      <button className={`wiz-add ${added ? 'wiz-add--on' : ''}`} onClick={onToggle} aria-label={added ? 'Remove' : 'Add'}>
        {added ? <><Check size={15} /> Added</> : <><Plus size={15} /> Add</>}
      </button>
    </li>
  )
}

function CustomForm({ tripId, regions }) {
  const [name, setName] = useState('')
  const [regionId, setRegionId] = useState('')
  const [note, setNote] = useState('')
  const [added, setAdded] = useState(null)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const region = regions.find((r) => r.id === regionId)
    addPlace(tripId, {
      regionId: regionId || 'custom',
      regionName: region ? region.name : 'Your own places',
      placeId: customPlaceId(),
      name: trimmed, type: 'CUSTOM', isCustom: true, note: note.trim(),
    })
    setAdded(trimmed); setName(''); setNote('')
  }

  return (
    <div className="wiz-custom">
      <Hint icon={MapPin} text="Add anywhere the guide doesn’t cover — a hotel, a friend’s town, a hidden beach." />
      <label className="wiz-field">
        <span>Place name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Agriturismo La Quercia"
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }} autoFocus />
      </label>
      <label className="wiz-field">
        <span>Region <em>(optional)</em></span>
        <select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
          <option value="">Your own places</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <label className="wiz-field">
        <span>Note <em>(optional)</em></span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Booking ref, why you want to go…" />
      </label>
      <button className="btn btn--primary" onClick={submit} disabled={!name.trim()}>
        <Plus size={16} /> Add to trip
      </button>
      {added && <p className="wiz-added">Added “{added}”. Add another, or hit Done.</p>}
    </div>
  )
}

function Hint({ icon: Icon, text }) {
  return <div className="wiz-hint"><Icon size={18} /> <span>{text}</span></div>
}

function shortSeason(t) {
  if (!t) return ''
  const m = t.match(/([A-Z][a-z]+)\s+to\s+([A-Z][a-z]+)/)
  return m ? `${m[1]}–${m[2]}` : ''
}
