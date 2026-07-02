import { Link } from 'react-router-dom'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useTrips, activeTrip, addPlace, removePlace, createTrip } from '../lib/trips.js'
import { paths } from '../lib/paths.js'
import { useAuth } from '../lib/auth.jsx'

export default function AddToTrip({ place }) {
  const { user } = useAuth()
  const snap = useTrips()
  const trip = activeTrip(snap)
  const inTrip = trip && trip.places.some((p) => p.regionId === place.regionId && p.placeId === place.placeId)

  const onClick = () => {
    if (!user) { alert('Sign in (top right) to plan trips — they save to your account.'); return }
    if (!trip) {
      const id = createTrip('My trip')
      addPlace(id, place)
    } else if (inTrip) {
      removePlace(trip.id, place.regionId, place.placeId)
    } else {
      addPlace(trip.id, place)
    }
  }

  return (
    <div className="addtrip">
      <button className={`btn-add ${inTrip ? 'btn-add--on' : ''}`} onClick={onClick}>
        {inTrip ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        {inTrip ? `Saved to ${trip.name}` : trip ? `Add to ${trip.name}` : 'Add to trip'}
      </button>
      {snap.trips.length > 0 && <Link to={paths.plan()} className="addtrip__manage">Plan</Link>}
    </div>
  )
}
