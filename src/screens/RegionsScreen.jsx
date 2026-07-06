import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { getIndex, getImages, getPlacesIndex } from '../lib/data.js'
import { COUNTRIES } from '../lib/countries.js'
import RegionCard from '../components/RegionCard.jsx'
import { CardSkeletons } from '../components/Loading.jsx'
import { useSeo } from '../lib/seo.js'
import { paths } from '../lib/paths.js'

export default function RegionsScreen() {
  const { country = 'italy' } = useParams()
  const meta = COUNTRIES.find((c) => c.slug === country)
  useSeo({ title: `Regions of ${meta?.name || ''}`, description: `All the regions of ${meta?.name || ''} — their towns, tables and stories.`, path: `/${country}/regions` })
  const [regions, setRegions] = useState(null)
  const [images, setImages] = useState({})
  const [placesByRegion, setPlacesByRegion] = useState({})
  const [q, setQ] = useState('')

  useEffect(() => {
    getIndex(country).then((d) => setRegions(d.regions || [])).catch(() => setRegions([]))
    getImages(country).then(setImages).catch(() => setImages({}))
    getPlacesIndex(country).then((list) => {
      const byRegion = {}
      for (const p of (list || [])) {
        (byRegion[p.regionId] = byRegion[p.regionId] || []).push(p.name, p.nameIt)
      }
      setPlacesByRegion(byRegion)
    }).catch(() => setPlacesByRegion({}))
  }, [country])

  // Resolve a card image per region: explicit heroImage, else the first place
  // in that region that actually has an image (images keyed region → place).
  const firstImage = (r) => {
    if (r.heroImage?.url) return r.heroImage.url
    const reg = images[r.id]
    if (!reg) return null
    for (const placeId of Object.keys(reg)) {
      const u = reg[placeId]?.[0]?.url
      if (u) return u
    }
    return null
  }

  const filtered = useMemo(() => {
    if (!regions) return null
    const norm = (x) => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const s = norm(q.trim())
    if (!s) return regions
    return regions.filter((r) => {
      if (norm(`${r.name} ${r.capital || ''}`).includes(s)) return true
      // also match any place (town/city/landmark) within this region
      const names = placesByRegion[r.id] || []
      return names.some((n) => norm(n).includes(s))
    })
  }, [regions, q, placesByRegion])

  const totalPlaces = useMemo(
    () => (regions ? regions.reduce((n, r) => n + (r.placeCount || 0), 0) : null),
    [regions]
  )

  return (
    <div className="page">
      <header className="hero">
        <div className="wrap hero__inner">
          <p className="eyebrow"><Link to={paths.country(country)} className="eyebrow__link">{meta?.name}</Link> · Regions</p>
          <h1 className="hero__title">Regions of {meta?.name}</h1>
          <p className="hero__sub">
            {regions ? `${regions.length} regions` : 'The regions'} — their towns, their tables, their stories.
            {totalPlaces ? ` ${totalPlaces} places to wander.` : ''} Pick somewhere to begin.
          </p>
          <label className="search">
            <Search size={18} strokeWidth={2.2} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search regions, capitals or places"
              aria-label="Search regions"
            />
          </label>
        </div>
      </header>

      <main className="wrap">
        <div className="grid grid--regions">
          {filtered === null && <CardSkeletons count={9} kind="r" />}
          {filtered && filtered.map((r, idx) => <RegionCard key={r.id} region={r} country={country} image={firstImage(r)} index={idx} />)}
        </div>
        {filtered && filtered.length === 0 && (
          <p className="empty">No region matches “{q}”. Try a capital like Rome or Naples.</p>
        )}
      </main>

      <footer className="foot wrap">Browse · {regions ? regions.length : 20} regions</footer>
    </div>
  )
}
