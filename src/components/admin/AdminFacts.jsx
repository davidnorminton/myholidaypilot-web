import { useEffect, useState } from 'react'
import { Save, Wand2, Trash2 } from 'lucide-react'
import { COUNTRIES } from '../../lib/countries.js'
import { api } from '../../lib/api.js'

// Country facts — the strip under each country page hero. Stored as the
// countryFacts.<slug> site setting (JSON), so edits go live with no deploy
// and no JSON re-export. "Prefill draft" loads a hand-written starting point
// (below) for you to verify — check the emergency number and plugs especially
// before saving.
const FIELDS = [
  ['capital', 'Capital'],
  ['languages', 'Languages spoken'],
  ['currency', 'Currency'],
  ['timezone', 'Timezone'],
  ['plugs', 'Plugs & voltage'],
  ['emergency', 'Emergency number'],
]

const DRAFTS = {
  italy: { capital: 'Rome', languages: 'Italian', currency: 'Euro (€)', timezone: 'GMT+1 (CET)', plugs: 'Type C / F / L · 230V', emergency: '112' },
  spain: { capital: 'Madrid', languages: 'Spanish', currency: 'Euro (€)', timezone: 'GMT+1 (CET)', plugs: 'Type C / F · 230V', emergency: '112' },
  portugal: { capital: 'Lisbon', languages: 'Portuguese', currency: 'Euro (€)', timezone: 'GMT (WET)', plugs: 'Type C / F · 230V', emergency: '112' },
  france: { capital: 'Paris', languages: 'French', currency: 'Euro (€)', timezone: 'GMT+1 (CET)', plugs: 'Type C / E · 230V', emergency: '112' },
  germany: { capital: 'Berlin', languages: 'German', currency: 'Euro (€)', timezone: 'GMT+1 (CET)', plugs: 'Type C / F · 230V', emergency: '112' },
  greece: { capital: 'Athens', languages: 'Greek', currency: 'Euro (€)', timezone: 'GMT+2 (EET)', plugs: 'Type C / F · 230V', emergency: '112' },
  japan: { capital: 'Tokyo', languages: 'Japanese', currency: 'Japanese yen (¥)', timezone: 'GMT+9 (JST)', plugs: 'Type A / B · 100V', emergency: '110 police · 119 fire & ambulance' },
  netherlands: { capital: 'Amsterdam', languages: 'Dutch', currency: 'Euro (€)', timezone: 'GMT+1 (CET)', plugs: 'Type C / F · 230V', emergency: '112' },
  norway: { capital: 'Oslo', languages: 'Norwegian', currency: 'Norwegian krone (kr)', timezone: 'GMT+1 (CET)', plugs: 'Type C / F · 230V', emergency: '112' },
  poland: { capital: 'Warsaw', languages: 'Polish', currency: 'Złoty (zł)', timezone: 'GMT+1 (CET)', plugs: 'Type C / E · 230V', emergency: '112' },
  singapore: { capital: 'Singapore', languages: 'English, Malay, Mandarin, Tamil', currency: 'Singapore dollar (S$)', timezone: 'GMT+8 (SGT)', plugs: 'Type G · 230V', emergency: '999 police · 995 fire & ambulance' },
  south_korea: { capital: 'Seoul', languages: 'Korean', currency: 'South Korean won (₩)', timezone: 'GMT+9 (KST)', plugs: 'Type C / F · 220V', emergency: '112 police · 119 fire & ambulance' },
  sweden: { capital: 'Stockholm', languages: 'Swedish', currency: 'Swedish krona (kr)', timezone: 'GMT+1 (CET)', plugs: 'Type C / F · 230V', emergency: '112' },
  switzerland: { capital: 'Bern', languages: 'German, French, Italian, Romansh', currency: 'Swiss franc (CHF)', timezone: 'GMT+1 (CET)', plugs: 'Type C / J · 230V', emergency: '112' },
  thailand: { capital: 'Bangkok', languages: 'Thai', currency: 'Thai baht (฿)', timezone: 'GMT+7 (ICT)', plugs: 'Type A / B / C / O · 230V', emergency: '191 police · 1669 ambulance' },
  turkey: { capital: 'Ankara', languages: 'Turkish', currency: 'Turkish lira (₺)', timezone: 'GMT+3 (TRT)', plugs: 'Type C / F · 230V', emergency: '112' },
  united_kingdom: { capital: 'London', languages: 'English', currency: 'Pound sterling (£)', timezone: 'GMT / BST in summer', plugs: 'Type G · 230V', emergency: '999 or 112' },
  united_states: { capital: 'Washington, D.C.', languages: 'English', currency: 'US dollar ($)', timezone: 'GMT−5 to −10 (6 zones)', plugs: 'Type A / B · 120V', emergency: '911' },
}

const empty = () => Object.fromEntries(FIELDS.map(([k]) => [k, '']))

export default function AdminFacts() {
  const [slug, setSlug] = useState('')
  const [all, setAll] = useState(null)
  const [form, setForm] = useState(empty())
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [filling, setFilling] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => { api.settings.getAll().then((s) => setAll(s || {})).catch(() => setAll({})) }, [])
  useEffect(() => {
    if (!slug || all === null) return
    try { setForm({ ...empty(), ...(JSON.parse(all[`countryFacts.${slug}`] || 'null') || {}) }) }
    catch { setForm(empty()) }
    setSaved(false)
  }, [slug, all])

  if (all === null) return <p className="admin-empty">Loading settings…</p>

  const hasSaved = !!all[`countryFacts.${slug}`]
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  // AI fills the six fields; the hand-written draft is the fallback when AI
  // isn't configured or errors. Either way: review before saving.
  const fill = async () => {
    setFilling(true); setNote('')
    const name = COUNTRIES.find((c) => c.slug === slug)?.name || slug
    try {
      const { facts } = await api.ai.countryFacts({ country: name })
      setForm({ ...empty(), ...facts })
      setNote('Filled by AI — check every field before saving, especially the emergency number and plugs.')
    } catch (e) {
      if (DRAFTS[slug]) {
        setForm({ ...empty(), ...DRAFTS[slug] })
        setNote(`AI unavailable (${e.message || 'error'}) — loaded the built-in draft instead. Verify before saving.`)
      } else {
        setNote(`AI unavailable: ${e.message || 'error'}. Fill the fields manually.`)
      }
    } finally { setFilling(false) }
  }

  const save = async () => {
    setBusy(true)
    try {
      const val = JSON.stringify(form)
      await api.settings.save({ [`countryFacts.${slug}`]: val })
      setAll((a) => ({ ...a, [`countryFacts.${slug}`]: val }))
      setSaved(true); setTimeout(() => setSaved(false), 1800)
    } catch (e) { alert(e.message || 'Save failed') }
    finally { setBusy(false) }
  }
  const clear = async () => {
    setBusy(true)
    try {
      await api.settings.save({ [`countryFacts.${slug}`]: '' })
      setAll((a) => ({ ...a, [`countryFacts.${slug}`]: '' }))
      setForm(empty())
    } catch (e) { alert(e.message || 'Clear failed') }
    finally { setBusy(false) }
  }

  return (
    <div className="cms">
      <div className="cms-pickrow">
        <label className="admin-field">
          <span className="admin-field__label">Country</span>
          <select value={slug} onChange={(e) => setSlug(e.target.value)}>
            <option value="">Choose a country…</option>
            {COUNTRIES.map((c) => <option key={c.slug} value={c.slug}>{c.flag} {c.name}{all[`countryFacts.${c.slug}`] ? ' ✓' : ''}</option>)}
          </select>
        </label>
      </div>

      {!slug && <p className="admin-empty">Pick a country to edit the fact strip shown under its page hero. A ✓ means facts are already saved.</p>}

      {slug && (
        <section className="cms-sec">
          <div className="cms-sec__head">
            <h3>Facts — {COUNTRIES.find((c) => c.slug === slug)?.name}</h3>
            <button className="cms-add" onClick={fill} disabled={filling}><Wand2 size={15} /> {filling ? 'Filling…' : 'Fill with AI'}</button>
          </div>
          <p className="admin-note">These show as the fact strip under the country hero. <b>Verify the emergency number and plugs before saving</b> — AI drafts are a starting point, not a source of truth. Empty fields are simply not shown.</p>
          {note && <p className="admin-note admin-note--hot">{note}</p>}
          <div className="cfacts-form">
            {FIELDS.map(([k, label]) => (
              <label key={k} className="admin-field">
                <span className="admin-field__label">{label}</span>
                <input value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder="—" />
              </label>
            ))}
          </div>
          <div className="cms-bar">
            <button className="btn btn--primary" onClick={save} disabled={busy}><Save size={15} /> {saved ? 'Saved ✓' : 'Save'}</button>
            {hasSaved && <button className="btn btn--soft" onClick={clear} disabled={busy}><Trash2 size={15} /> Remove facts</button>}
          </div>
        </section>
      )}
    </div>
  )
}
