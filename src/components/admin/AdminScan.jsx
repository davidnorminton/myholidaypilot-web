import { useState } from 'react'
import { ScanSearch, Trash2, ImageIcon, Compass, UtensilsCrossed, Landmark, MapPin, AlignLeft } from 'lucide-react'
import { api } from '../../lib/api.js'

// Scan — data-quality checks across the builder. First check: places whose
// name appears in more than one region of the same country (the builder can
// legitimately produce e.g. "Positano" under two regions). Shows each
// occurrence's data figures so you can keep the richer one and delete the rest.
function Fig({ icon: Icon, label, value, ok }) {
  return (
    <span className={`scan__fig ${ok === false ? 'scan__fig--warn' : ''}`} title={label}>
      <Icon size={13} /> {value}
    </span>
  )
}

export default function AdminScan() {
  const [state, setState] = useState('idle')   // idle | busy | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState('')

  const run = async () => {
    setState('busy'); setError('')
    try {
      const r = await api.builder.scan()
      setResult(r.countries || [])
      setState('done')
    } catch (e) {
      setError(e.message || 'Scan failed'); setState('error')
    }
  }

  const remove = async (countryId, groupKey, p) => {
    const id = `${countryId}/${p.regionId}/${p.placeId}`
    if (!window.confirm(`Delete “${p.name}” from ${p.regionName}? Its details and image reference go with it. This can't be undone.`)) return
    setDeleting(id)
    try {
      await api.builder.deletePlace(countryId, p.regionId, p.placeId)
      setResult((rs) => rs.map((c) => {
        if (c.countryId !== countryId) return c
        const groups = c.groups
          .map((g) => (g.key !== groupKey ? g : { ...g, places: g.places.filter((x) => !(x.regionId === p.regionId && x.placeId === p.placeId)) }))
          .filter((g) => g.places.length > 1)
        return { ...c, groups }
      }).filter((c) => c.groups.length > 0))
    } catch (e) {
      alert(e.message || 'Delete failed')
    } finally { setDeleting('') }
  }

  return (
    <div className="cms">
      <div className="cms-sec__head">
        <h3>Duplicate places</h3>
        <button className="cms-add" onClick={run} disabled={state === 'busy'}>
          <ScanSearch size={15} /> {state === 'busy' ? 'Scanning…' : result ? 'Rescan' : 'Run scan'}
        </button>
      </div>
      <p className="admin-note">
        Finds places whose name appears in more than one region of the same country.
        Figures per occurrence: images · activities · food · culture · description length · coordinates.
        Keep the richer one; delete the other.
      </p>

      {state === 'error' && <p className="admin-empty">{error}</p>}
      {state === 'done' && result.length === 0 && <p className="admin-empty">No cross-region duplicates found. 🎉</p>}

      {result && result.map((c) => (
        <section key={c.countryId} className="cms-sec">
          <div className="cms-sec__head"><h3>{c.flag ? `${c.flag} ` : ''}{c.name} <span className="scan__count">{c.groups.length} duplicate{c.groups.length === 1 ? '' : 's'}</span></h3></div>
          {c.groups.map((g) => (
            <div key={g.key} className="scan__group">
              <p className="scan__groupname">{g.places[0]?.name}</p>
              <div className="scan__cards">
                {g.places.map((p) => {
                  const id = `${c.countryId}/${p.regionId}/${p.placeId}`
                  return (
                    <div key={id} className="scan__card">
                      <p className="scan__region"><MapPin size={13} /> {p.regionName}</p>
                      <p className="scan__pid">{p.placeId}</p>
                      <div className="scan__figs">
                        <Fig icon={ImageIcon} label="Images" value={p.images} ok={p.images > 0} />
                        <Fig icon={Compass} label="Activities" value={p.activities} ok={p.activities > 0} />
                        <Fig icon={UtensilsCrossed} label="Food" value={p.food} />
                        <Fig icon={Landmark} label="Culture" value={p.culture} />
                        <Fig icon={AlignLeft} label="Description characters" value={p.descriptionChars} ok={p.descriptionChars > 0} />
                        <Fig icon={MapPin} label="Coordinates" value={p.hasCoords ? '✓' : '—'} ok={p.hasCoords} />
                      </div>
                      <button className="btn btn--soft scan__del" disabled={deleting === id}
                        onClick={() => remove(c.countryId, g.key, p)}>
                        <Trash2 size={14} /> {deleting === id ? 'Deleting…' : 'Delete this one'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
