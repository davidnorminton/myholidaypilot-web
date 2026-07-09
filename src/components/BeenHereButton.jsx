import { MapPinCheck } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useVisits, toggleVisit } from '../lib/visits.js'

// "Been here" — marks a whole region as visited on your travel map.
export default function BeenHereButton({ regionId, countryId = 'italy', className = '' }) {
  const { user } = useAuth()
  const { has } = useVisits()
  const active = has(regionId)

  const onClick = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { alert('Sign in (top right) to build your travel map.'); return }
    try { await toggleVisit(regionId, countryId) } catch { /* reverted in store */ }
  }

  return (
    <button className={`beenhere ${active ? 'beenhere--on' : ''} ${className}`} onClick={onClick}
      aria-pressed={active} title={active ? 'On your travel map — tap to remove' : 'Mark as visited'}>
      <MapPinCheck size={15} /> {active ? 'I have been here' : 'Have you been here?'}
    </button>
  )
}
