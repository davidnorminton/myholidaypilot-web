import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useSettings } from '../lib/settings.js'
import { getPlacesIndex } from '../lib/data.js'
import { COUNTRIES } from '../lib/countries.js'
import { paths } from '../lib/paths.js'
import SmartImage from './SmartImage.jsx'

// Featured destinations: places hand-picked in the admin (Site → Featured
// destinations), shown Lonely Planet-style — a horizontal row of equal cards,
// image on top, region label + place name below, and a Discover pill.
// Resolve the admin's featured picks ({c,r,p}) into display cards — shared by
// the home carousel and the /featured-destinations page.
export function useFeaturedPlaces() {
  const site = useSettings()
  const picks = useMemo(() => {
    try { return JSON.parse(site.featuredPlaces || '[]') } catch { return [] }
  }, [site.featuredPlaces])
  const [resolved, setResolved] = useState(null)

  useEffect(() => {
    if (!picks.length) { setResolved([]); return }
    let live = true
    const slugs = [...new Set(picks.map((x) => x.c))]
    Promise.all(slugs.map((slug) => getPlacesIndex(slug).then((l) => [slug, l]).catch(() => [slug, []])))
      .then((pairs) => {
        if (!live) return
        const byCountry = Object.fromEntries(pairs)
        const out = picks.map((x) => {
          const hit = (byCountry[x.c] || []).find((pl) => pl.regionId === x.r && pl.placeId === x.p)
          if (!hit) return null
          const country = COUNTRIES.find((c) => c.slug === x.c)
          return { ...x, name: hit.name, regionName: hit.regionName, image: hit.image, countryName: country?.name }
        }).filter(Boolean)
        setResolved(out)
      })
    return () => { live = false }
  }, [picks])
  return resolved
}

export default function FeaturedDestinations() {
  const resolved = useFeaturedPlaces()
  const scroller = useRef(null)

  const nudge = (dir) => {
    const el = scroller.current
    if (!el) return
    const card = el.querySelector('.featured__card')
    const step = card ? card.offsetWidth + 18 : 340
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  if (!resolved || resolved.length === 0) return null
  return (
    <section className="wrap featured">
      <div className="featured__head">
        <h2 className="featured__title">Featured destinations</h2>
        <div className="featured__ctrls">
          <Link to="/featured-destinations" className="featured__viewall">View all</Link>
          <button type="button" className="featured__arrow" onClick={() => nudge(-1)} aria-label="Scroll back"><ArrowLeft size={18} /></button>
          <button type="button" className="featured__arrow featured__arrow--fill" onClick={() => nudge(1)} aria-label="Scroll forward"><ArrowRight size={18} /></button>
        </div>
      </div>
      <div className="featured__scroller" ref={scroller}>
        {resolved.map((f, i) => (
          <Link key={`${f.c}/${f.r}/${f.p}`} to={paths.place(f.r, f.p, f.c)} className="featured__card">
            <div className="featured__media">
              {f.image
                ? <SmartImage src={f.image} alt={f.name} width={600} priority={i < 4} />
                : <span className="featured__blank" />}
            </div>
            <p className="featured__kicker">{f.countryName}</p>
            <h3 className="featured__name">{f.name}</h3>
            <span className="featured__cta">Discover</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
