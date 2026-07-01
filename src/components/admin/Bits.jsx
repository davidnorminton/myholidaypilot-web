// Small reusable form bits for the admin editors. Reuse the .admin-field styles.
export function Field({ label, value, onChange, placeholder, full, mono }) {
  return (
    <label className={`admin-field ${full ? 'admin-field--full' : ''}`}>
      <span className="admin-field__label">{label}</span>
      <input className={mono ? 'mono' : ''} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  )
}

export function Num({ label, value, onChange, step = 'any', placeholder }) {
  return (
    <label className="admin-field">
      <span className="admin-field__label">{label}</span>
      <input type="number" step={step} value={value ?? ''} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} />
    </label>
  )
}

export function Area({ label, value, onChange, rows = 3, full = true, hint, placeholder }) {
  return (
    <label className={`admin-field ${full ? 'admin-field--full' : ''}`}>
      <span className="admin-field__label">{label}{hint && <em> — {hint}</em>}</span>
      <textarea rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function Select({ label, value, onChange, options }) {
  return (
    <label className="admin-field">
      <span className="admin-field__label">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

export function RegionPicker({ regions, value, onChange }) {
  return (
    <div className="cms-regionpick">
      <label className="admin-field">
        <span className="admin-field__label">Region</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose a region…</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
        </select>
      </label>
    </div>
  )
}
