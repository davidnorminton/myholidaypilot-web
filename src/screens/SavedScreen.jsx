import { useEffect, useMemo, useState } from 'react'
import { Heart } from 'lucide-react'
import { getPlacesIndex } from '../lib/data.js'
import { COUNTRIES } from '../lib/countries.js'
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

  useEffect(() => {
    // A saved place can belong to any available country — load each country's
    // index (which now carries each place's image) and tag entries so links
    // and thumbnails resolve to the right one. No separate image fetch.
    const avail = COUNTRIES.filter((c) => c.available).map((c) => c.slug)
    Promise.all(avail.map((slug) =>
      getPlacesIndex(slug).then((rows) => rows.map((p) => ({ ...p, countryId: slug }))).catch(() => [])
    )).then((lists) => setIndex(lists.flat()))
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
              <PlaceCard key={`${p.regionId}/${p.placeId}`} regionId={p.regionId} country={p.countryId}
                place={{ id: p.placeId, name: p.name, nameIt: p.nameIt, type: p.type }}
                image={p.image} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
