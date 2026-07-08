import { Link } from 'react-router-dom'
import { useSeo } from '../lib/seo.js'
import { paths } from '../lib/paths.js'
import { PageLoader } from '../components/Loading.jsx'
import { useFeaturedPlaces } from '../components/FeaturedDestinations.jsx'
import SmartImage from '../components/SmartImage.jsx'

// All the hand-picked featured places, as a full-page grid — same cards as the
// home carousel.
export default function FeaturedDestinationsScreen() {
  useSeo({
    title: 'Featured destinations — hand-picked places worth travelling for',
    description: 'Our current hand-picked featured destinations — standout towns, cities and places from our guides, chosen by the editors.',
    path: '/featured-destinations',
  })
  const resolved = useFeaturedPlaces()

  if (resolved === null) return <PageLoader label="Loading featured destinations" />
  return (
    <div className="page">
      <main className="wrap">
        <header className="gal__head gal__head--plain">
          <h1 className="gal__title">Featured destinations</h1>
        </header>
        {resolved.length === 0
          ? <p className="gal__empty">Nothing featured right now — <Link to={paths.destinations()}>browse all destinations</Link> instead.</p>
          : (
            <div className="featured__pagegrid">
              {resolved.map((f, i) => (
                <Link key={`${f.c}/${f.r}/${f.p || 'region'}`} to={f.isRegion ? paths.region(f.r, f.c) : paths.place(f.r, f.p, f.c)} className="featured__card">
                  <div className="featured__media">
                    {f.image
                      ? <SmartImage src={f.image} alt={f.name} width={600} priority={i < 4} />
                      : <span className="featured__blank" />}
                  </div>
                  <p className="featured__kicker">{f.countryName}{f.isRegion ? ' · Region' : ''}</p>
                  <h3 className="featured__name">{f.name}</h3>
                  <span className="featured__cta">{f.isRegion ? 'Explore region' : 'Discover'}</span>
                </Link>
              ))}
            </div>
          )}
      </main>
    </div>
  )
}
