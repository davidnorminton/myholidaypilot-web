import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { COUNTRIES } from '../lib/countries.js'

// "Where to?" — the first question when starting a trip. Only launched
// countries are selectable; the rest show as coming soon.
//
// Critical layout styles are INLINE so the modal renders correctly even if
// the stylesheet is stale or missing — a modal that can render invisibly is
// a modal that will, eventually, somewhere.
const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(20,17,12,.45)',
    display: 'grid', placeItems: 'center', padding: 20,
  },
  panel: {
    background: 'var(--paper, #faf7f2)', border: '1px solid var(--line, #e5ded2)',
    borderRadius: 16, width: 'min(440px, 100%)', padding: 18,
    boxShadow: '0 24px 60px rgba(0,0,0,.25)', maxHeight: '80vh', overflow: 'auto',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  item: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px',
    border: '1px solid var(--line, #e5ded2)', borderRadius: 11,
    background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit',
  },
}

export default function CountryPicker({ onPick, onClose }) {
  const modal = (
    <div className="cpick__backdrop" style={S.backdrop} onClick={onClose}>
      <div className="cpick" style={S.panel} role="dialog" aria-label="Choose a country" onClick={(e) => e.stopPropagation()}>
        <header className="cpick__head" style={S.head}>
          <h3 style={{ margin: 0 }}>Where to?</h3>
          <button className="cpick__x" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 0, cursor: 'pointer', padding: 6 }}><X size={18} /></button>
        </header>
        <div className="cpick__grid" style={S.grid}>
          {COUNTRIES.map((c) => (
            <button key={c.slug} className={`cpick__item ${c.available ? '' : 'is-soon'}`}
              style={{ ...S.item, ...(c.available ? {} : { opacity: .5, cursor: 'not-allowed' }) }}
              disabled={!c.available} onClick={() => onPick(c.slug)}>
              <span className="cpick__flag" aria-hidden style={{ fontSize: 20 }}>{c.flag}</span>
              <span className="cpick__name">{c.name}</span>
              {!c.available && <span className="cpick__soon" style={{ marginLeft: 'auto', fontSize: 11, color: '#a89f8f' }}>soon</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal
}
