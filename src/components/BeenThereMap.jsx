import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ImageDown } from 'lucide-react'
import { useTrips } from '../lib/trips.js'
import { downloadMapImage } from '../lib/mapImage.js'
import { getIndex } from '../lib/data.js'
import { useVisits } from '../lib/visits.js'
import { COUNTRIES } from '../lib/countries.js'
import MapView from './MapView.jsx'

const fmtTs = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// "Been there": a scratch-map of everywhere you've ticked off across all
// your trips — pins on a map, a region grid that fills in as you go, and
// shareable bragging rights.
export default function BeenThereMap() {
  const snap = useTrips()
  const { ids: manualVisits } = useVisits()
  const [country, setCountry] = useState('italy')
  const countryMeta = COUNTRIES.find((c) => c.slug === country) || COUNTRIES[0]
  const [regions, setRegions] = useState([])
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    setRegions([])
    getIndex(country).then((d) => setRegions(d.regions || [])).catch(() => {})
  }, [country])

  const visited = useMemo(() => {
    const seen = new Map()   // regionId/placeId -> place (earliest visit wins)
    for (const t of snap.trips) {
      for (const p of t.places) {
        if (!p.done) continue
        const k = `${p.regionId}/${p.placeId}`
        if (!seen.has(k) || (p.visitedAt && p.visitedAt < (seen.get(k).visitedAt || Infinity))) seen.set(k, p)
      }
    }
    return [...seen.values()]
  }, [snap.trips])

  const regionIds = useMemo(() => new Set(regions.map((r) => r.id)), [regions])
  const visitedRegions = useMemo(() => {
    const out = new Set()
    for (const p of visited) if (regionIds.has(p.regionId)) out.add(p.regionId)
    for (const id of manualVisits) if (regionIds.has(id)) out.add(id)
    return out
  }, [visited, manualVisits, regionIds])
  const countryVisitedPlaces = useMemo(() => visited.filter((p) => regionIds.has(p.regionId)), [visited, regionIds])
  const firstVisit = useMemo(() => {
    const ts = visited.map((p) => p.visitedAt).filter(Boolean)
    return ts.length ? Math.min(...ts) : null
  }, [visited])

  const markers = countryVisitedPlaces.filter((p) => p.lat && p.lng)
    .map((p) => ({ lng: p.lng, lat: p.lat, label: p.name, color: '#a9762a' }))
  const hasMapbox = !!import.meta.env.VITE_MAPBOX_TOKEN

  const shareText = `I've explored ${visitedRegions.size} of ${regions.length || 20} regions of ${countryMeta.name} ${countryMeta.flag} — ${countryVisitedPlaces.length} place${countryVisitedPlaces.length === 1 ? '' : 's'} and counting, planned on myholidaypilot.`
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  const countrySelect = (
    <div className="bmap__countries">
      {COUNTRIES.map((c) => (
        <button key={c.slug} disabled={!c.available}
          className={`gq__chip ${country === c.slug ? 'is-on' : ''}`}
          onClick={() => setCountry(c.slug)}>
          {c.flag} {c.name}{c.available ? '' : ' · soon'}
        </button>
      ))}
    </div>
  )

  if (!visited.length && !visitedRegions.size) {
    return (
      <div>
        {countrySelect}
        <p className="account__empty">
          Nothing ticked off yet. Places you mark as done in your trips light up here —
          plan a trip, go, and start scratching {countryMeta.name} off the map.
        </p>
        <RegionGrid regions={regions} visitedRegions={visitedRegions} />
      </div>
    )
  }

  return (
    <div className="bmap">
      {countrySelect}
      <div className="account__stats">
        <div className="account__stat"><b>{visitedRegions.size}<em className="bmap__of">/{regions.length || 20}</em></b><span>regions explored</span></div>
        <div className="account__stat"><b>{countryVisitedPlaces.length}</b><span>{countryVisitedPlaces.length === 1 ? 'place visited' : 'places visited'}</span></div>
        {firstVisit && <div className="account__stat"><b className="bmap__since">{fmtTs(firstVisit)}</b><span>exploring since</span></div>}
      </div>

      {hasMapbox && markers.length > 0 && (
        <div className="bmap__map">
          <MapView height={300} center={[markers[0].lng, markers[0].lat]} zoom={5} markers={markers} />
        </div>
      )}

      <h3 className="account__h2" style={{ marginTop: 22 }}>Your {countryMeta.name}, region by region</h3>
      <RegionGrid regions={regions} visitedRegions={visitedRegions} />

      <button className="btn btn--soft" style={{ marginTop: 18 }} onClick={copy}>
        {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy your stats to share</>}
      </button>
      <button className="btn btn--soft" style={{ marginLeft: 10 }}
        onClick={() => downloadMapImage({ countryName: countryMeta.name, regions, visitedIds: visitedRegions, placeCount: countryVisitedPlaces.length })}>
        <ImageDown size={15} /> Download map image
      </button>
    </div>
  )
}

function RegionGrid({ regions, visitedRegions }) {
  if (!regions.length) return null
  return (
    <div className="bmap__grid">
      {regions.map((r) => {
        const on = visitedRegions.has(r.id)
        return (
          <div key={r.id} className={`bmap__region ${on ? 'is-on' : ''}`} title={on ? 'Been there' : 'Not yet'}>
            <span className="bmap__emoji" aria-hidden>{r.emoji}</span>
            <span className="bmap__name">{r.name}</span>
            {on && <Check size={13} className="bmap__tick" />}
          </div>
        )
      })}
    </div>
  )
}
