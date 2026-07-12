import { useEffect, useState } from 'react'
import { Save, Check } from 'lucide-react'
import ImageField from '../ImageField.jsx'
import FeaturedPicker from './FeaturedPicker.jsx'
import { api } from '../../lib/api.js'
import { clearSettingsCache } from '../../lib/settings.js'

// Site-wide content: the home hero (image + headline + subline) and an
// optional hero image override per region (defaults to the region's first
// place photo when blank).

export default function AdminSite({ regions = [] }) {
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState({})

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

      <h3 className="admin-h3" style={{ marginTop: 28 }}>Featured destinations</h3>
      <p className="admin-note" style={{ marginTop: 4 }}>
        Hand-pick the places shown in the "Featured destinations" grid on the home page.
        Places only (not regions or countries). The first pick is the large lead card. Saves with the Save button.
      </p>
      <FeaturedPicker value={val('featuredPlaces')} onChange={(v) => setVal('featuredPlaces', v)} />

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
