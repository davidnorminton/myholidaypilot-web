import { useEffect, useMemo, useState } from 'react'
import { Heart } from 'lucide-react'
import { getPlacesIndex, getImages } from '../lib/data.js'
import { useFavourites } from '../lib/favourites.js'
import { useAuth } from '../lib/auth.jsx'
import PlaceCard from '../components/PlaceCard.jsx'
import { CardSkeletons } from '../components/Loading.jsx'
import { useSeo } from '../lib/seo.js'

export default function SavedScreen() {
  useSeo({ title: 'Saved places', description: 'Places you’ve saved for your trip.', path: '/saved' })
  const { user } = useAuth()
  const { ids, ready } = useFavourites()
  const [index, setIndex] = useState(null)
  const [images, setImages] = useState({})

  useEffect(() => {
    getPlacesIndex().then(setIndex).catch(() => setIndex([]))
    getImages().then(setImages).catch(() => {})
  }, [])

  const saved = useMemo(() => {
    if (!index) return []
    return index.filter((p) => ids.has(`${p.regionId}/${p.placeId}`))
  }, [index, ids])

  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow">Your trip</p>
        <h1 className="sub-hero__title">Saved places</h1>
        <p className="sub-hero__sub">Tap the heart on any place to keep it here.</p>
      </header>

      <main className="wrap">
        {!user ? (
          <p className="empty">Sign in (top right) to save places and see them here.</p>
        ) : !index || !ready ? (
          <div className="grid grid--places"><CardSkeletons n={4} /></div>
        ) : saved.length === 0 ? (
          <div className="saved-empty">
            <Heart size={30} />
            <p>No saved places yet. Browse a region and tap the heart on the ones you like.</p>
          </div>
        ) : (
          <div className="grid grid--places">
            {saved.map((p) => (
              <PlaceCard key={`${p.regionId}/${p.placeId}`} regionId={p.regionId}
                place={{ id: p.placeId, name: p.name, nameIt: p.nameIt, type: p.type }}
                image={images[p.regionId]?.[p.placeId]?.[0]?.url} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
