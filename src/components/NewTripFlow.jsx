import { useNavigate } from 'react-router-dom'
import CountryPicker from './CountryPicker.jsx'
import { useTrips, createTrip, setActiveTrip } from '../lib/trips.js'
import { paths } from '../lib/paths.js'

// The one true "start a new trip" flow — used by every screen so the
// behaviour is identical everywhere: pick a country, create the trip,
// make it active, land on the planner.
export default function NewTripFlow({ open, onClose }) {
  const navigate = useNavigate()
  const snap = useTrips()
  if (!open) return null
  const pick = (countryId) => {
    const id = createTrip(`Trip ${snap.trips.length + 1}`, countryId)
    setActiveTrip(id)
    onClose()
    navigate(paths.plan())
    }
  return <CountryPicker onPick={pick} onClose={onClose} />
}
