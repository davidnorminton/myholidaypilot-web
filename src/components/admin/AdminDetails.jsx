import { useEffect, useState } from 'react'
import { Sparkles, Check, Trash2, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api.js'

// Generate SEO trip-planning details (intro, getting there, itinerary, FAQ)
// for a country and each of its regions. Stored in the builder DB; synced to
// the static files (and prerendered) on the next deploy.
export default function AdminDetails() {
  const [countries, setCountries] = useState(null)
  const [country, setCountry] = useState('')
  const [regions, setRegions] = useState(null)
  const [countryDetails, setCountryDetails] = useState(null)
  const [busy, setBusy] = useState('')      // '' | 'country' | regionId
  const [error, setError] = useState('')

  useEffect(() => {
    api.builder.list().then((rows) => {
      setCountries(rows || [])
      if (rows?.length && !country) setCountry(rows[0].countryId)
    }).catch(() => setCountries([]))
  }, [])

  useEffect(() => {
    if (!country) return
    setRegions(null); setCountryDetails(null)
    api.builder.get(country).then((d) => {
      setRegions(d.regions || [])
      setCountryDetails(d.build?.guides?.details || null)
    }).catch(() => setRegions([]))
  }, [country])

  const gen = async (regionId) => {
    setBusy(regionId || 'country'); setError('')
    try {
      const { details } = await api.builder.genDetails(country, regionId)
      if (regionId) {
        setRegions((rs) => rs.map((r) => r.regionId === regionId ? { ...r, data: { ...r.data, details } } : r))
      } else {
        setCountryDetails(details)
      }
    } catch (e) { setError(e.message || 'Generation failed') }
    finally { setBusy('') }
  }

  const clear = async (regionId) => {
    if (!confirm('Remove these details?')) return
    setBusy(regionId || 'country')
    try {
      await api.builder.setDetails(country, regionId, null)
      if (regionId) setRegions((rs) => rs.map((r) => r.regionId === regionId ? { ...r, data: { ...r.data, details: undefined } } : r))
      else setCountryDetails(null)
    } catch (e) { setError(e.message || 'Failed') }
    finally { setBusy('') }
  }

  const Row = ({ label, details, id }) => (
    <div className="details-row">
      <div className="details-row__info">
        <strong>{label}</strong>
        {details
          ? <span className="details-row__state details-row__state--on"><Check size={13} /> {details.faq?.length || 0} FAQs · itinerary · intro</span>
          : <span className="details-row__state">not generated</span>}
        {details?.intro && <p className="details-row__preview">{details.intro}</p>}
      </div>
      <div className="details-row__actions">
        <button className="btn btn--soft" onClick={() => gen(id)} disabled={!!busy}>
          {busy === (id || 'country') ? <><RefreshCw size={14} className="pk__spin" /> Generating…</> : <><Sparkles size={14} /> {details ? 'Regenerate' : 'Generate'}</>}
        </button>
        {details && <button className="btn btn--soft" onClick={() => clear(id)} disabled={!!busy} title="Remove"><Trash2 size={14} /></button>}
      </div>
    </div>
  )

  return (
    <div className="admin-details">
      <h3 className="admin-h3"><Sparkles size={16} /> Trip details (SEO)</h3>
      <p className="admin-note">
        Generates a "Plan your trip" block — intro, getting there, how long to stay, a suggested
        itinerary and five FAQs — shown under the hero on the country page and each region page,
        and prerendered for search engines (with FAQ structured data). Content goes live on the
        next deploy.
      </p>
      {countries && countries.length === 0 && <p className="admin-note">No builds yet — build a country first.</p>}
      {countries && countries.length > 0 && (
        <>
          <label className="admin-field">
            <span className="admin-field__label">Country</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.map((c) => <option key={c.countryId} value={c.countryId}>{c.flag ? `${c.flag} ` : ''}{c.name}</option>)}
            </select>
          </label>
          {error && <p className="admin-error">{error}</p>}
          {regions === null ? <p className="admin-note">Loading…</p> : (
            <div className="details-list">
              <Row label={`${countries.find((c) => c.countryId === country)?.name || country} — country page`} details={countryDetails} id={null} />
              {regions.map((r) => (
                <Row key={r.regionId} label={r.data?.name || r.regionId} details={r.data?.details} id={r.regionId} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
