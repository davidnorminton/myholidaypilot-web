import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Bookmark, BookmarkCheck, Plus, Check, X } from 'lucide-react'
import { useTrips, addPlace, removePlace, createTrip, setActiveTrip, isInTrip } from '../lib/trips.js'
import { COUNTRIES } from '../lib/countries.js'
import { paths } from '../lib/paths.js'
import { useAuth } from '../lib/auth.jsx'

// Adding a place used to silently toggle it on the *active* trip. Now the
// button opens a picker so you can choose which of your trips to add it to
// (or spin up a new one) — the place can live in several trips at once.
export default function AddToTrip({ place, compact = false, countryId, triggerClass }) {
  const { user } = useAuth()
  const snap = useTrips()
  const [open, setOpen] = useState(false)

  const inCount = snap.trips.filter((t) => isInTrip(snap, t.id, place.regionId, place.placeId)).length

  const newTripName = () => {
    const name = COUNTRIES.find((c) => c.slug === countryId)?.name
    return name ? `My trip to ${name}` : 'My trip'
  }

  const openPicker = () => {
    if (!user) { alert('Sign in (top right) to plan trips — they save to your account.'); return }
    setOpen(true)
  }

  const toggle = (tripId) => {
    if (isInTrip(snap, tripId, place.regionId, place.placeId)) {
      removePlace(tripId, place.regionId, place.placeId)
    } else {
      addPlace(tripId, place)
      setActiveTrip(tripId)
    }
  }

  const createAndAdd = () => {
    const id = createTrip(newTripName(), countryId || 'italy')
    addPlace(id, place)
    setActiveTrip(id)
  }

  return (
    <div className="addtrip">
      <button
        className={triggerClass
          ? `${triggerClass} ${inCount ? 'is-on' : ''}`
          : `btn-add ${inCount ? 'btn-add--on' : ''} ${compact ? 'btn-add--sm' : ''}`}
        onClick={openPicker}
      >
        {inCount ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        {inCount ? `In ${inCount} trip${inCount > 1 ? 's' : ''}` : 'Add to trip'}
      </button>
      {!triggerClass && snap.trips.length > 0 && <Link to={paths.plan()} className="addtrip__manage">Plan</Link>}

      {open && createPortal(
        <div className="pk__backdrop" onClick={() => setOpen(false)}>
          <div className="pk atp" role="dialog" aria-label="Add to a trip" onClick={(e) => e.stopPropagation()}>
            <header className="pk__head">
              <h2><Bookmark size={18} /> Add to a trip</h2>
              <button className="pk__x" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            </header>
            <div className="atp__body">
              <p className="atp__place"><b>{place.name}</b>{place.regionName ? ` · ${place.regionName}` : ''}</p>

              {snap.trips.length > 0 ? (
                <ul className="atp__list">
                  {snap.trips.map((t) => {
                    const on = isInTrip(snap, t.id, place.regionId, place.placeId)
                    return (
                      <li key={t.id}>
                        <button className={`atp__trip ${on ? 'is-on' : ''}`} onClick={() => toggle(t.id)}>
                          <span className="atp__tripname">{t.name}</span>
                          <span className="atp__tripmeta">{t.places.length} place{t.places.length === 1 ? '' : 's'}</span>
                          <span className="atp__check">{on ? <Check size={16} /> : <Plus size={16} />}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="atp__empty">You don't have any trips yet — start one below.</p>
              )}

              <button className="atp__new" onClick={createAndAdd}>
                <Plus size={16} /> New trip: {newTripName()}
              </button>
            </div>
            <footer className="atp__foot">
              <Link className="btn btn--primary" to={paths.plan()} onClick={() => setOpen(false)}>Open planner</Link>
              <button className="btn btn--soft" onClick={() => setOpen(false)}>Done</button>
            </footer>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
