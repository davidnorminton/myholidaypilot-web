import { useEffect, useState } from 'react'
import { Save, Check } from 'lucide-react'
import ImageField from '../ImageField.jsx'
import FeaturedPicker from './FeaturedPicker.jsx'
import { api } from '../../lib/api.js'
import { COUNTRIES } from '../../lib/countries.js'
import { clearSettingsCache } from '../../lib/settings.js'

// Site-wide content: the home hero (image + headline + subline) and an
// optional hero image override per region (defaults to the region's first
// place photo when blank).

const HUB_SECTIONS = [
  ['regions', 'Regions'], ['festivals', 'Festivals & events'], ['history', 'History'],
  ['food', 'Food & wine'], ['transport', 'Getting around'], ['plan', 'Plan a trip'],
]

export default function AdminSite({ regions = [] }) {
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState({})
  const [hubCountry, setHubCountry] = useState('default')

  useEffect(() => {
    api.settings.get().then((r) => setS(r || {})).catch(() => setS({}))
  }, [])

  if (s === null) return <p className="admin-note">Loading site settings…</p>

  const val = (k) => (k in dirty ? dirty[k] : s[k] || '')
  const setVal = (k, v) => { setDirty((d) => ({ ...d, [k]: v })); setSaved(false) }

  const save = async () => {
    setSaving(true)
    try {
      await api.settings.save(dirty)
      setS((prev) => ({ ...prev, ...dirty }))
      setDirty({})
      clearSettingsCache()
      setSaved(true)
    } catch (e) {
      alert(`Could not save: ${e.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  const changed = Object.keys(dirty).length > 0

  return (
    <div>
      <div className="admin__bar">
        <button className="btn btn--primary" onClick={save} disabled={!changed || saving}>
          {saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> {saving ? 'Saving…' : 'Save changes'}</>}
        </button>
        {changed && <span className="admin-note">{Object.keys(dirty).length} unsaved change{Object.keys(dirty).length === 1 ? '' : 's'}</span>}
      </div>

      <h3 className="admin-h3">Default place image</h3>
      <p className="admin-note" style={{ marginTop: 4 }}>
        Shown on any place that has no photo of its own — on place cards, region pages and place pages.
        Leave blank to fall back to the built-in placeholder. Applies site-wide, instantly, no redeploy.
      </p>
      <ImageField
        label="Default place image"
        value={val('defaultPlaceImage')}
        onChange={(v) => setVal('defaultPlaceImage', v)}
        full
      />

      <h3 className="admin-h3" style={{ marginTop: 28 }}>Featured destinations</h3>
      <p className="admin-note" style={{ marginTop: 4 }}>
        Hand-pick the places shown in the "Featured destinations" grid on the home page.
        Places only (not regions or countries). The first pick is the large lead card. Saves with the Save button.
      </p>
      <FeaturedPicker value={val('featuredPlaces')} onChange={(v) => setVal('featuredPlaces', v)} />

      <h3 className="admin-h3" style={{ marginTop: 28 }}>Country hub images</h3>
      <p className="admin-note">
        The pictures on each country's hub cards (Regions, Festivals, History, Food, Getting around, Plan).
        These override the country's hub.json, so they apply instantly — no redeploy needed.
      </p>
      <label className="admin-field" style={{ maxWidth: 260 }}>
        <span className="admin-field__label">Country</span>
        <select value={hubCountry} onChange={(e) => setHubCountry(e.target.value)}>
          <option value="default">🌍 Default — all countries</option>
          {COUNTRIES.filter((c) => c.available).map((c) => (
            <option key={c.slug} value={c.slug}>{c.flag} {c.name}</option>
          ))}
        </select>
      </label>
      <p className="admin-note" style={{ marginTop: 6 }}>
        {hubCountry === 'default'
          ? 'These images are used by every country that has no image of its own set below. Set six here and the whole site is covered.'
          : `Overrides for ${(COUNTRIES.find((c) => c.slug === hubCountry) || {}).name} only — leave blank to use the default image.`}
      </p>
      {hubCountry !== 'default' && (
        <button className="btn btn--soft" style={{ marginBottom: 12 }}
          onClick={() => {
            HUB_SECTIONS.forEach(([id]) => {
              const cur = val(`hub.${hubCountry}.${id}`)
              if (cur) setVal(`hub.default.${id}`, cur)
            })
            setHubCountry('default')
          }}>
          Copy these to Default (use for all countries)
        </button>
      )}
      <div className="admin-grid2">
        {HUB_SECTIONS.map(([id, label]) => (
          <ImageField key={`${hubCountry}.${id}`} label={label}
            value={val(`hub.${hubCountry}.${id}`)}
            onChange={(v) => setVal(`hub.${hubCountry}.${id}`, v)} />
        ))}
      </div>

      <h3 className="admin-h3">Home page hero</h3>
      <p className="admin-note">Leave any field blank to use the built-in default.</p>
      <ImageField label="Hero background image" value={val('home.hero')} onChange={(v) => setVal('home.hero', v)} full />
      <label className="admin-field admin-field--full">
        <span className="admin-field__label">Headline (use | for a line break)</span>
        <input value={val('home.title')} onChange={(e) => setVal('home.title', e.target.value)} placeholder="See more.|Plan less." />
      </label>
      <label className="admin-field admin-field--full">
        <span className="admin-field__label">Subline</span>
        <input value={val('home.sub')} onChange={(e) => setVal('home.sub', e.target.value)} placeholder="Default subline" />
      </label>

    </div>
  )
}
