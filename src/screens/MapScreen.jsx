import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, X, ArrowRight } from 'lucide-react'
import { useSeo } from '../lib/seo.js'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// Full-viewport world map — one point per live country. Clicking a point opens
// an info pane (flag, capital, region/place counts); the pane's button goes to
// the country guide.
//
// Data is public/data/map-index.json, precomputed by scripts/build-map-index.mjs
// at build time — one ~4KB fetch instead of pulling 34 country indexes to draw
// 34 dots.
//
// Zoom is deliberately disabled on desktop (scroll wheel fights page scroll and
// the page IS the viewport, so there's nowhere to scroll to — the world at zoom
// ~1.6 is the whole point). Panning stays. On touch devices pinch-zoom stays
// enabled: fingers on a fixed map with no zoom is a trap.
export default function MapScreen() {
  const ref = useRef(null)
  const mapRef = useRef(null)
  const navigate = useNavigate()
  const [countries, setCountries] = useState([])
  const [active, setActive] = useState(null)
  const [failed, setFailed] = useState(false)

  useSeo({
    title: 'World map — every country we cover',
    description: 'Every country on myholidaypilot, on one map — tap a point for regions, places and the full guide.',
  })

  useEffect(() => {
    let live = true
    fetch(`${import.meta.env.BASE_URL}data/map-index.json`)
      .then((r) => (r.ok ? r.json() : { countries: [] }))
      .then((j) => { if (live) setCountries(j.countries || []) })
      .catch(() => { if (live) setCountries([]) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!TOKEN || !ref.current || !countries.length || mapRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default
        if (cancelled || !ref.current) return
        mapboxgl.accessToken = TOKEN
        const map = new mapboxgl.Map({
          container: ref.current,
          style: 'mapbox://styles/mapbox/outdoors-v12',
          center: [10, 24],
          zoom: 1.6,
          // Recent Mapbox styles default to the 3D globe; this page wants the
          // whole world visible at once, edge to edge — flat mercator, and no
          // atmosphere/fog haze that comes bundled with globe.
          projection: 'mercator',
          attributionControl: true,
          renderWorldCopies: false,
        })
        map.on('style.load', () => { try { map.setFog(null) } catch { /* older SDK */ } })
        mapRef.current = map
        // Desktop: the map is a picture of the whole world, not a viewport to
        // wander — kill every zoom gesture. Touch keeps pinch (see header note).
        const touch = window.matchMedia('(pointer: coarse)').matches
        map.scrollZoom.disable()
        map.doubleClickZoom.disable()
        map.boxZoom.disable()
        map.keyboard.disable()
        if (!touch) map.touchZoomRotate.disable()
        map.dragRotate.disable()

        map.on('load', () => {
          if (cancelled) return
          for (const c of countries) {
            const el = document.createElement('button')
            el.className = 'worldmap__dot'
            el.type = 'button'
            el.setAttribute('aria-label', `${c.name} — open details`)
            el.innerHTML = `<span class="worldmap__flag">${c.flag}</span>`
            el.addEventListener('click', (e) => { e.stopPropagation(); setActive(c) })
            new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([c.lng, c.lat]).addTo(map)
          }
        })
        map.on('click', () => setActive(null))
        map.on('error', () => setFailed(true))
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [countries])

  // No token / SDK failure: keep the page useful rather than blank.
  if (!TOKEN || failed) {
    return (
      <div className="worldmap worldmap--fallback">
        <h1>Every country we cover</h1>
        <ul>
          {countries.map((c) => (
            <li key={c.slug}>
              <Link to={`/${c.slug}`}>{c.flag} {c.name}</Link>
              {' '}— {c.regions} regions · {c.places} places
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="worldmap">
      <div ref={ref} className="worldmap__map" />
      {active && (
        <aside className="worldmap__pane" aria-label={`${active.name} details`}>
          <button className="worldmap__close" type="button" aria-label="Close" onClick={() => setActive(null)}>
            <X size={16} />
          </button>
          <div className="worldmap__pane-flag" aria-hidden="true">{active.flag}</div>
          <h2>{active.name}</h2>
          {active.capital && (
            <p className="worldmap__fact"><MapPin size={14} /> Capital: {active.capital}</p>
          )}
          <p className="worldmap__counts">
            <span><strong>{active.regions}</strong> region{active.regions === 1 ? '' : 's'}</span>
            <span><strong>{active.places}</strong> place{active.places === 1 ? '' : 's'}</span>
          </p>
          <button className="btn worldmap__go" type="button" onClick={() => navigate(`/${active.slug}`)}>
            Open the {active.name} guide <ArrowRight size={15} />
          </button>
        </aside>
      )}
    </div>
  )
}
