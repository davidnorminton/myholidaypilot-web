import { useEffect, useMemo, useState } from 'react'
import { Plus, Hammer, ImageIcon, Info, CalendarRange, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api.js'
import { BuildView, NewBuild } from './AdminBuilder.jsx'
import AdminImages from './AdminImages.jsx'
import AdminFacts from './AdminFacts.jsx'
import AdminDetails from './AdminDetails.jsx'

// One home for everything country-shaped: pick a country (or start a new
// build), see its coverage and what's missing at a glance, then work on it —
// the builder, images, facts and trip details all live here, scoped to the
// selected country. The composed tools are the same components as before,
// just with their own country pickers hidden.
const TOOLS = [
  { id: 'build', label: 'Build & content', icon: Hammer },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'facts', label: 'Facts', icon: Info },
  { id: 'details', label: 'Trip details', icon: CalendarRange },
]

function Stat({ label, value, warn }) {
  return (
    <div className={`cstat ${warn ? 'cstat--warn' : ''}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}

export default function AdminCountries({ regions }) {
  const [builds, setBuilds] = useState(null)
  const [settings, setSettings] = useState({})
  const [slug, setSlug] = useState('')
  const [adding, setAdding] = useState(false)
  const [tool, setTool] = useState('build')
  const [overview, setOverview] = useState(null)

  const load = () => { api.builder.list().then(setBuilds).catch(() => setBuilds(false)) }
  useEffect(() => { load(); api.settings.getAll().then((s) => setSettings(s || {})).catch(() => {}) }, [])

  const isItalyStatic = slug === '__italy_static'
  const realSlug = isItalyStatic ? 'italy' : slug

  useEffect(() => {
    setOverview(null)
    if (!slug || isItalyStatic) return
    api.builder.get(slug).then(setOverview).catch(() => setOverview(false))
  }, [slug])

  const stats = useMemo(() => {
    if (!overview?.regions) return null
    const rs = overview.regions
    const sum = (f) => rs.reduce((n, r) => n + (f(r) || 0), 0)
    const places = sum((r) => r.placeCount)
    const detailed = sum((r) => r.detailedPlaces)
    const imaged = sum((r) => r.imagedPlaces)
    return {
      stage: overview.build?.stage ?? 0,
      regions: rs.length,
      places,
      missingDetails: places - detailed,
      missingImages: places - imaged,
      regionsNoRestaurants: rs.filter((r) => !r.hasRestaurants).length,
      regionsNoProse: rs.filter((r) => !r.hasProse).length,
      regionsNoHero: rs.filter((r) => !r.data?.heroImage?.url).length,
    }
  }, [overview])

  if (builds === null) return <p className="admin-empty">Loading countries…</p>
  if (builds === false) return <p className="admin-empty">Couldn't load the builder.</p>

  const hasItalyBuild = builds.some((b) => b.countryId === 'italy')
  const factsSet = !!settings[`countryFacts.${realSlug}`]
  const heroSet = !!settings[`countryHero.${realSlug}`]

  return (
    <div className="cms">
      <div className="cms-pickrow chub__pickrow">
        <label className="admin-field">
          <span className="admin-field__label">Country</span>
          <select value={slug} onChange={(e) => { setSlug(e.target.value); setAdding(false); setTool('build') }}>
            <option value="">Choose a country…</option>
            {builds.map((b) => (
              <option key={b.countryId} value={b.countryId}>{b.flag ? `${b.flag} ` : ''}{b.name} · stage {b.stage}/10</option>
            ))}
            {!hasItalyBuild && <option value="__italy_static">🇮🇹 Italy (static, pre-builder)</option>}
          </select>
        </label>
        <button className="cms-add" onClick={() => { setAdding((v) => !v); setSlug('') }}>
          <Plus size={15} /> Add new country
        </button>
      </div>

      {adding && (
        <div className="bld__grid">
          <NewBuild onCreated={(c) => { setAdding(false); load(); setSlug(c) }} />
        </div>
      )}

      {!slug && !adding && (
        <p className="admin-empty">Pick a country to see its coverage and work on it — or add a new one to start a build.</p>
      )}

      {slug && !isItalyStatic && (
        overview === null ? <p className="admin-empty">Loading overview…</p>
        : overview === false ? <p className="admin-empty">Couldn't load that country.</p>
        : stats && (
          <div className="chub__stats">
            <Stat label="build stage" value={`${stats.stage}/10`} warn={stats.stage < 10} />
            <Stat label="regions" value={stats.regions} />
            <Stat label="places" value={stats.places} />
            <Stat label="missing images" value={stats.missingImages} warn={stats.missingImages > 0} />
            <Stat label="missing details" value={stats.missingDetails} warn={stats.missingDetails > 0} />
            <Stat label="regions w/o restaurants" value={stats.regionsNoRestaurants} warn={stats.regionsNoRestaurants > 0} />
            <Stat label="regions w/o prose" value={stats.regionsNoProse} warn={stats.regionsNoProse > 0} />
            <Stat label="regions w/o hero" value={stats.regionsNoHero} warn={stats.regionsNoHero > 0} />
            <Stat label="country facts" value={factsSet ? '✓' : '—'} warn={!factsSet} />
            <Stat label="country image" value={heroSet ? '✓' : '—'} warn={!heroSet} />
          </div>
        )
      )}

      {isItalyStatic && (
        <p className="admin-note">Italy predates the builder — its content lives in the static JSON, so build stats aren't available here. Images and facts below work as normal.</p>
      )}

      {slug && (
        <>
          <nav className="chub__tools" aria-label="Country tools">
            {TOOLS.filter((t) => !isItalyStatic || t.id === 'images' || t.id === 'facts').map(({ id, label, icon: Icon }) => (
              <button key={id} className={`chub__tool ${tool === id ? 'is-on' : ''}`} onClick={() => setTool(id)}>
                <Icon size={15} /> {label}
              </button>
            ))}
            <button className="chub__tool chub__tool--refresh" onClick={() => { load(); if (!isItalyStatic) api.builder.get(slug).then(setOverview) }} title="Refresh stats">
              <RefreshCw size={14} />
            </button>
          </nav>

          {tool === 'build' && !isItalyStatic && (
            <BuildView countryId={slug} embedded
              onBack={() => { setSlug(''); load() }} />
          )}
          {tool === 'images' && <AdminImages regions={regions} fixedCountry={slug} />}
          {tool === 'facts' && <AdminFacts fixedSlug={realSlug} />}
          {tool === 'details' && !isItalyStatic && <AdminDetails fixedCountry={slug} />}
        </>
      )}
    </div>
  )
}
