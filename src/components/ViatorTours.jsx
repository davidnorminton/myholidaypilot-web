import { useEffect, useState } from 'react'
import { Star, Clock, ExternalLink } from 'lucide-react'
import { getViatorTours, getViatorPlaceTours } from '../lib/data.js'

// "Things to do" — Viator tours for a region or place, deep-linking to
// viator.com (a 30-day cookie accrues our commission). Rendered CLIENT-SIDE
// ONLY: the data is fetched at runtime (never prerendered) and its source path
// is disallowed in robots.txt, so Viator's unique content stays out of the
// search index — a contractual requirement. Renders nothing until tours load.
// With a placeId, shows that place's tours, falling back to the region's.
export default function ViatorTours({ country, regionId, placeId, name, embedded = false }) {
  const [tours, setTours] = useState(null)

  useEffect(() => {
    let live = true
    setTours(null)
    const load = placeId
      ? getViatorPlaceTours(placeId, country).then((t) => (t.length ? t : getViatorTours(regionId, country)))
      : getViatorTours(regionId, country)
    load.then((t) => live && setTours(t))
    return () => { live = false }
  }, [country, regionId, placeId])

  if (!tours || !tours.length) return null

  const price = (t) => {
    if (t.price == null) return ''
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: t.currency || 'GBP', maximumFractionDigits: 0 }).format(t.price) }
    catch { return `${t.currency || ''} ${t.price}` }
  }

  return (
    <section className="viator" data-nosnippet aria-label={`Tours and activities in ${name}`}>
      <div className="viator__head">
        {!embedded && <h2 className="viator__title">Things to do in {name}</h2>}
        <span className="viator__note">Tours by Viator — booking may earn us a commission, at no extra cost to you.</span>
      </div>
      <div className="viator__grid">
        {tours.map((t) => (
          <a key={t.code} className="viator__card" href={t.url} target="_blank" rel="nofollow noopener sponsored">
            <div className="viator__media">
              {t.image
                ? <img src={t.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                : <span className="viator__blank" />}
              {t.freeCancellation && <span className="viator__badge">Free cancellation</span>}
            </div>
            <div className="viator__cbody">
              <h3 className="viator__name">{t.title}</h3>
              <div className="viator__meta">
                {t.rating != null && (
                  <span className="viator__rating"><Star size={13} /> {Number(t.rating).toFixed(1)} <span className="viator__reviews">({t.reviews})</span></span>
                )}
                {t.duration && <span className="viator__dur"><Clock size={13} /> {t.duration}</span>}
              </div>
              <div className="viator__foot">
                {t.price != null && <span className="viator__price">from {price(t)}</span>}
                <span className="viator__cta">Book on Viator <ExternalLink size={13} /></span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
