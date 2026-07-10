import { Camera } from 'lucide-react'

// Placeholder for places without a photo: flat brand purple with a centred
// white camera icon.
export default function PlacePlaceholder({ className = '', iconSize = 40 }) {
  return (
    <div className={`placeph ${className}`} aria-hidden>
      <Camera size={iconSize} className="placeph__cam" />
    </div>
  )
}
