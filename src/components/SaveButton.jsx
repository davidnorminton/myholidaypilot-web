import { Heart } from 'lucide-react'
import { useFavourites, toggleFav } from '../lib/favourites.js'
import { useAuth } from '../lib/auth.jsx'

export default function SaveButton({ regionId, placeId, className = '', label = false }) {
  const { user } = useAuth()
  const { isFav } = useFavourites()
  const active = isFav(regionId, placeId)

  const onClick = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { alert('Sign in (top right) to save places.'); return }
    try { await toggleFav(regionId, placeId) } catch { alert('Could not update your saved places.') }
  }

  return (
    <button type="button" className={`save-btn ${active ? 'is-on' : ''} ${className}`} onClick={onClick}
      aria-pressed={active} aria-label={active ? 'Saved' : 'Save'} title={active ? 'Saved' : 'Save place'}>
      <Heart size={label ? 16 : 18} fill={active ? 'currentColor' : 'none'} />
      {label && <span>{active ? 'Saved' : 'Save'}</span>}
    </button>
  )
}
