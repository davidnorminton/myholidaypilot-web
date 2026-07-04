import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { getIndex } from '../lib/data.js'
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
  const [q, setQ] = useState('')

  useEffect(() => {
    getIndex(country).then((d) => setRegions(d.regions || [])).catch(() => setRegions([]))
  }, [country])

  const filtered = useMemo(() => {
    if (!regions) return null
    const s = q.trim().toLowerCase()
    if (!s) return regions
    return regions.filter((r) => `${r.name} ${r.capital || ''}`.toLowerCase().includes(s))
  }, [regions, q])

  const totalPlaces = useMemo(
    () => (regions ? regions.reduce((n, r) => n + (r.placeCount || 0), 0) : null),
    [regions]
  )

  return (
    <div className="page">
      <header className="hero">
        <div className="wrap hero__inner">
          <p className="eyebrow"><Link to={paths.country(country)} className="eyebrow__link">{meta?.name}</Link> · Regions</p>
          <h1 className="hero__title">Regions of Italy</h1>
          <p className="hero__sub">
            Twenty regions — their towns, their tables, their stories.
            {totalPlaces ? ` ${totalPlaces} places to wander.` : ''} Pick somewhere to begin.
          </p>
          <label className="search">
            <Search size={18} strokeWidth={2.2} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search regions or capitals"
              aria-label="Search regions"
            />
          </label>
        </div>
      </header>

      <main className="wrap">
        <div className="grid grid--regions">
          {filtered === null && <CardSkeletons count={9} kind="r" />}
          {filtered && filtered.map((r) => <RegionCard key={r.id} region={r} country={country} />)}
        </div>
        {filtered && filtered.length === 0 && (
          <p className="empty">No region matches “{q}”. Try a capital like Rome or Naples.</p>
        )}
      </main>

      <footer className="foot wrap">Browse · {regions ? regions.length : 20} regions</footer>
    </div>
  )
}
