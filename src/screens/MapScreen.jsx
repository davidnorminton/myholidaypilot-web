import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, X, ArrowRight } from 'lucide-react'
import { useSeo } from '../lib/seo.js'
import 'mapbox-gl/dist/mapbox-gl.css'
import '../styles/worldmap.css'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const WORLD = { center: [10, 24], zoom: 1.6 }

// Full-viewport world map — one point per live country, from the build-time
// map-index.json (one ~4KB fetch instead of 34 country indexes).
//
// v2:
// · Overlapping dots (Europe, at world zoom) are spread: dots whose projected
//   positions collide are fanned out in a small ring around their shared spot,
//   so UK/NL/DK/DE are all clickable instead of a pile.
// · Clicking a country zooms to it and shows its REGIONS as small dots —
//   clicking a region goes straight to the region guide. Closing the pane (or
//   clicking the sea) returns to the world view.
//
// Zoom gestures stay disabled on desktop (the world view IS the page; drill-in
// zooming is programmatic). Touch keeps pinch — fingers with no zoom is a trap.
export default function MapScreen() {
  const ref = useRef(null)
  const mapRef = useRef(null)
  const closeRef = useRef(null)       // set by the map effect; used by the pane
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
          ...WORLD,
          // Flat mercator, no globe atmosphere — the whole world, edge to edge.
          projection: 'mercator',
          attributionControl: true,
          renderWorldCopies: false,
        })
        map.on('style.load', () => { try { map.setFog(null) } catch { /* older SDK */ } })
        mapRef.current = map
        const touch = window.matchMedia('(pointer: coarse)').matches
        map.scrollZoom.disable()
        map.doubleClickZoom.disable()
        map.boxZoom.disable()
        map.keyboard.disable()
        if (!touch) map.touchZoomRotate.disable()
        map.dragRotate.disable()

        const countryMarkers = []
        let regionMarkers = []

        const clearRegions = () => {
          for (const m of regionMarkers) m.remove()
          regionMarkers = []
        }
        const closeAll = () => {
          setActive(null)
          clearRegions()
          map.easeTo({ ...WORLD, duration: 700 })
        }
        closeRef.current = closeAll

        // Country → its regions as small dots, camera fitted to them. Regions
        // come from the country's own index.json (name, lat/lng per region).
        const openCountry = async (c) => {
          setActive(c)
          clearRegions()
          let idx = null
          try {
            const r = await fetch(`${import.meta.env.BASE_URL}data/${c.slug}/index.json`)
            idx = r.ok ? await r.json() : null
          } catch { idx = null }
          const regions = (idx?.regions || []).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
          if (!regions.length) return         // pane still works; nothing to drill into
          const bounds = new mapboxgl.LngLatBounds()
          for (const r of regions) {
            bounds.extend([r.lng, r.lat])
            const el = document.createElement('button')
            el.className = 'worldmap__rdot'
            el.type = 'button'
            el.title = r.name
            el.setAttribute('aria-label', `${r.name} — open the region guide`)
            el.innerHTML = `<span class="worldmap__rdot-label">${r.name}</span>`
            el.addEventListener('click', (e) => { e.stopPropagation(); navigate(`/${c.slug}/${r.id}`) })
            regionMarkers.push(new mapboxgl.Marker({ element: el, anchor: 'center' })
              .setLngLat([r.lng, r.lat]).addTo(map))
          }
          // Leave room for the info pane on the left.
          map.fitBounds(bounds, { padding: { top: 90, bottom: 90, left: 360, right: 90 }, maxZoom: 6.5, duration: 900 })
        }

        // Spread colliding dots in a ring around their shared projected spot —
        // Europe at world zoom is otherwise a pile. Pixel-space, so recompute
        // whenever the camera moves (drill-in, touch pinch, resize).
        const spreadOverlaps = () => {
          const pts = countryMarkers.map(({ c, marker }) => ({ marker, p: map.project([c.lng, c.lat]) }))
          const used = new Set()
          for (let i = 0; i < pts.length; i++) {
            if (used.has(i)) continue
            const group = [i]
            for (let j = i + 1; j < pts.length; j++) {
              if (used.has(j)) continue
              const d = Math.hypot(pts[i].p.x - pts[j].p.x, pts[i].p.y - pts[j].p.y)
              if (d < 36) { group.push(j); used.add(j) }
            }
            used.add(i)
            if (group.length === 1) { pts[i].marker.setOffset([0, 0]); continue }
            const r = 20 + (group.length > 5 ? 8 : 0)
            group.forEach((gi, k) => {
              const a = (2 * Math.PI * k) / group.length - Math.PI / 2
              pts[gi].marker.setOffset([Math.cos(a) * r, Math.sin(a) * r])
            })
          }
        }

        map.on('load', () => {
          if (cancelled) return
          for (const c of countries) {
            const el = document.createElement('button')
            el.className = 'worldmap__dot'
            el.type = 'button'
            el.setAttribute('aria-label', `${c.name} — open details`)
            el.innerHTML = `<span class="worldmap__flag">${c.flag}</span>`
            el.addEventListener('click', (e) => { e.stopPropagation(); openCountry(c) })
            const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
              .setLngLat([c.lng, c.lat]).addTo(map)
            countryMarkers.push({ c, marker })
          }
          spreadOverlaps()
        })
        map.on('moveend', spreadOverlaps)
        map.on('resize', spreadOverlaps)
        map.on('click', closeAll)
        map.on('error', () => setFailed(true))
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      closeRef.current = null
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [countries, navigate])

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
          <button className="worldmap__close" type="button" aria-label="Close"
            onClick={() => (closeRef.current ? closeRef.current() : setActive(null))}>
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
          <p className="worldmap__hint">Tap a dot on the map to open that region.</p>
          <button className="btn worldmap__go" type="button" onClick={() => navigate(`/${active.slug}`)}>
            Open the {active.name} guide <ArrowRight size={15} />
          </button>
        </aside>
      )}
    </div>
  )
}
