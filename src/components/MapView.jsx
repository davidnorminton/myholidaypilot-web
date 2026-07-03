import { useEffect, useRef, useState } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

/**
 * Interactive Mapbox map. If VITE_MAPBOX_TOKEN isn't set (or the SDK fails to
 * load) it degrades to a tidy placeholder with a link out to Google Maps, so
 * the app works with or without a token.
 *
 * props: center=[lng,lat], zoom, markers=[{lng,lat,label,color,onClick}], height
 */
export default function MapView({ center, zoom = 11, markers = [], height = 320, route = null }) {
  const ref = useRef(null)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(false)

  // Only initialise Mapbox once the container is actually scrolled into view.
  // Crawlers and bots that don't scroll never trigger a (billable) map load,
  // and real users save loads on maps they never reach.
  useEffect(() => {
    if (!TOKEN || !ref.current || visible) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() }
    }, { rootMargin: '200px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!TOKEN || !ref.current || !visible) return
    let map
    let cancelled = false
    ;(async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default
        if (cancelled) return
        mapboxgl.accessToken = TOKEN
        map = new mapboxgl.Map({
          container: ref.current,
          style: 'mapbox://styles/mapbox/outdoors-v12',
          center,
          zoom,
          attributionControl: true,
          // Scrolling the page over the map should scroll the page — zooming
          // needs Ctrl/Cmd + scroll (Mapbox shows the hint), and on touch
          // devices two fingers move the map while one scrolls the page.
          cooperativeGestures: true,
        })
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
        const bounds = new mapboxgl.LngLatBounds()
        markers.forEach((m) => {
          let mk
          if (m.number != null) {
            const el = document.createElement('div')
            el.className = 'map-pin'
            el.style.background = m.color || '#1f6f54'
            el.textContent = String(m.number)
            mk = new mapboxgl.Marker({ element: el }).setLngLat([m.lng, m.lat])
          } else {
            mk = new mapboxgl.Marker({ color: m.color || '#1f6f54' }).setLngLat([m.lng, m.lat])
          }
          if (m.label) mk.setPopup(new mapboxgl.Popup({ offset: 20, closeButton: false }).setText(m.label))
          mk.addTo(map)
          if (m.onClick) mk.getElement().addEventListener('click', m.onClick)
          bounds.extend([m.lng, m.lat])
        })
        if (markers.length > 1) {
          map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 0 })
        }
        if (route && route.length > 1) {
          map.on('load', () => {
            if (cancelled || !map.getStyle()) return
            map.addSource('day-route', { type: 'geojson', data: {
              type: 'Feature', geometry: { type: 'LineString', coordinates: route } } })
            map.addLayer({ id: 'day-route', type: 'line', source: 'day-route',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#a9762a', 'line-width': 2.5, 'line-dasharray': [1.4, 1.6], 'line-opacity': .85 } })
          })
        }
      } catch (e) {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => { cancelled = true; if (map) map.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, JSON.stringify(center), JSON.stringify(markers.map((m) => [m.lng, m.lat])), JSON.stringify(route)])

  if (!TOKEN || failed) {
    const [lng, lat] = center
    const href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    return (
      <div className="mapfallback" style={{ height }}>
        <MapPin size={22} />
        <p className="mapfallback__title">
          {markers.length > 1 ? `${markers.length} locations` : 'Map'}
        </p>
        <p className="mapfallback__hint">
          Add a <code>VITE_MAPBOX_TOKEN</code> to <code>.env</code> for an interactive map.
        </p>
        <a className="mapfallback__link" href={href} target="_blank" rel="noreferrer">
          Open in Google Maps <ExternalLink size={13} />
        </a>
      </div>
    )
  }
  return <div className="mapview" ref={ref} style={{ height }} />
}
