import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../lib/settings.js'
import { getPlacesIndex } from '../lib/data.js'
import { COUNTRIES } from '../lib/countries.js'
import { paths } from '../lib/paths.js'
import SmartImage from './SmartImage.jsx'

// Featured destinations: places (not regions/countries) hand-picked in the
// admin (Site → Featured destinations), shown as a large image grid on the
// home page — Lonely Planet style. Stored as a JSON list of
// {c: countrySlug, r: regionId, p: placeId} in the `featuredPlaces` setting.
export default function FeaturedDestinations() {
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
          return { ...x, name: hit.name, regionName: hit.regionName, image: hit.image, flag: country?.flag, countryName: country?.name }
        }).filter(Boolean)
        setResolved(out)
      })
    return () => { live = false }
  }, [picks])

  if (!resolved || resolved.length === 0) return null
  return (
    <section className="wrap featured">
      <div className="home-sec__head">
        <h2 className="sec-title">Featured destinations</h2>
      </div>
      <div className="featured__grid">
        {resolved.map((f, i) => (
          <Link key={`${f.c}/${f.r}/${f.p}`} to={paths.place(f.r, f.p, f.c)} className={`featured__card ${i === 0 ? 'featured__card--lead' : ''}`}>
            {f.image
              ? <SmartImage src={f.image} alt={f.name} width={i === 0 ? 800 : 400} priority={i < 3} />
              : <span className="featured__blank" />}
            <span className="featured__veil" />
            <span className="featured__label">
              <strong>{f.name}</strong>
              <span>{f.flag} {f.regionName}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
