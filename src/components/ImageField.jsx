import UploadButton from './UploadButton.jsx'

// A URL input + Upload button + preview, for admin image fields.
export default function ImageField({ label = 'Image', value, onChange, placeholder = 'https://… or upload a file', full }) {
  return (
    <label className={`admin-field imgfield ${full ? 'admin-field--full' : ''}`}>
      <span className="admin-field__label">{label}</span>
      <div className="imgfield__row">
        <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        <UploadButton onUploaded={onChange} className="imgfield__btn" />
      </div>
      {value && <img className="imgfield__preview" src={value} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
    </label>
  )
}
