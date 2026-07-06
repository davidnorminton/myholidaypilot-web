import { useState } from 'react'
import { imgUrl } from '../lib/imgUrl.js'

// An <img> that fades in when IT finishes loading (not when the whole grid does),
// so images appear individually as they arrive instead of popping in a batch.
// `priority` eager-loads + high-priority fetches above-the-fold images; the rest
// stay lazy. `width` picks the CDN resize bucket.
export default function SmartImage({ src, alt = '', width = 400, priority = false, className = '' }) {
  const [loaded, setLoaded] = useState(false)
  if (!src) return null
  return (
    <img
      src={imgUrl(src, width)}
      alt={alt}
      className={`${className} smartimg ${loaded ? 'is-loaded' : ''}`}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
    />
  )
}
