import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, CalendarRange, FileDown, Globe2 } from 'lucide-react'
import Itinerary from './Itinerary.jsx'

const downloadTripPdf = async (...a) => (await import('../lib/tripPdf.js')).downloadTripPdf(...a)

// "View trip" slide-over: the day-by-day itinerary in a right-hand panel, so
// the person can peek at the trip without leaving the day they're planning.
export default function TripViewPanel({ trip, onPlan, onPublish, onClose }) {
  const [closing, setClosing] = useState(false)
  // Animated close: play the exit before telling the parent to unmount us.
  const close = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 220)
  }
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  return createPortal(
    <div className={`tvp__backdrop ${closing ? 'is-closing' : ''}`} onClick={close}>
      <aside className={`tvp ${closing ? 'is-closing' : ''}`} role="dialog" aria-label="View trip" onClick={(e) => e.stopPropagation()}>
        <header className="tvp__head">
          <h2><CalendarRange size={18} /> {trip.name}</h2>
          <div className="tvp__acts">
            <button className="tvp__act" onClick={() => downloadTripPdf(trip)}><FileDown size={14} /> PDF</button>
            <button className="tvp__act" onClick={onPublish}><Globe2 size={14} /> Add to trip ideas</button>
          </div>
          <button className="tvp__x" onClick={close} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="tvp__body">
          <Itinerary trip={trip} onPlan={onPlan} />
        </div>
      </aside>
    </div>,
    document.body,
  )
}
