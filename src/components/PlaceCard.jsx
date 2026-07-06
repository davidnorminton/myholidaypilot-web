import { Link } from 'react-router-dom'
import { typeLabel } from '../lib/format.js'
import { paths } from '../lib/paths.js'
import SaveButton from './SaveButton.jsx'
import SmartImage from './SmartImage.jsx'

export default function PlaceCard({ regionId, country, place, image, number, index = 99 }) {
  return (
    <Link to={paths.place(regionId, place.id, country)} className="pcard">
      <div className="pcard__media">
        {image
          ? <SmartImage src={image} alt={place.name} width={400} priority={index < 8} />
          : <div className="pcard__media--blank" aria-hidden>{place.name.charAt(0)}</div>}
        {number != null && <span className="pcard__num" aria-hidden>{number}</span>}
        <span className="chip pcard__type">{typeLabel(place.type)}</span>
        <SaveButton regionId={regionId} placeId={place.id} className="pcard__save" />
      </div>
      <div className="pcard__body">
        <h3 className="pcard__name">{place.name}</h3>
        <p className="pcard__desc">{place.description}</p>
      </div>
    </Link>
  )
}
