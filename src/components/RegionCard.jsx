import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { regionColour } from '../lib/format.js'
import { paths } from '../lib/paths.js'
import SmartImage from './SmartImage.jsx'
import PlacePlaceholder from './PlacePlaceholder.jsx'

export default function RegionCard({ region, country, image, index = 99 }) {
  const accent = regionColour(region.colour)
  const src = image || region.heroImage?.url || null
  return (
    <Link to={paths.region(region.id, country)} className="rcard" style={{ '--accent': accent }}>
      <div className="rcard__media">
        {src
          ? <SmartImage src={src} alt={region.name} width={400} priority={index < 4} />
          : <PlacePlaceholder />}
        <span className="rcard__emoji" aria-hidden>{region.emoji}</span>
      </div>
      <div className="rcard__body">
        <h2 className="rcard__name">{region.name}</h2>
        <p className="rcard__meta">
          <MapPin size={13} strokeWidth={2.2} /> {region.capital}
          <span className="rcard__dot" />
          {region.placeCount} {region.placeCount === 1 ? 'place' : 'places'}
        </p>
      </div>
    </Link>
  )
}
