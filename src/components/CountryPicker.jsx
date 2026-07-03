import { X } from 'lucide-react'
import { COUNTRIES } from '../lib/countries.js'

// "Where to?" — the first question when starting a trip. Only launched
// countries are selectable; the rest show as coming soon.
export default function CountryPicker({ onPick, onClose }) {
  return (
    <div className="cpick__backdrop" onClick={onClose}>
      <div className="cpick" role="dialog" aria-label="Choose a country" onClick={(e) => e.stopPropagation()}>
        <header className="cpick__head">
          <h3>Where to?</h3>
          <button className="cpick__x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="cpick__grid">
          {COUNTRIES.map((c) => (
            <button key={c.slug} className={`cpick__item ${c.available ? '' : 'is-soon'}`}
              disabled={!c.available} onClick={() => onPick(c.slug)}>
              <span className="cpick__flag" aria-hidden>{c.flag}</span>
              <span className="cpick__name">{c.name}</span>
              {!c.available && <span className="cpick__soon">soon</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
