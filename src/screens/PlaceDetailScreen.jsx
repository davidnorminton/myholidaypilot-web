import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Compass, UtensilsCrossed, Sparkles } from 'lucide-react'
import { getRegion, placeImages } from '../lib/data.js'
import { regionColour } from '../lib/format.js'
import { paths } from '../lib/paths.js'
import { imgUrl } from '../lib/imgUrl.js'
import PlacePlaceholder from '../components/PlacePlaceholder.jsx'
import PhotoCredit from '../components/PhotoCredit.jsx'
import AddToTrip from '../components/AddToTrip.jsx'
import ViatorTours from '../components/ViatorTours.jsx'
import SaveButton from '../components/SaveButton.jsx'
import AffiliateSection from '../components/AffiliateSection.jsx'
import CommentsSection from '../components/CommentsSection.jsx'
import AskPlace from '../components/AskPlace.jsx'
import { useFrontendAi } from '../lib/settings.js'
import { useAffiliates, placeOffers } from '../lib/affiliates.js'
import { PageLoader } from '../components/Loading.jsx'
import { useSeo, canonicalUrl } from '../lib/seo.js'

export default function PlaceDetailScreen() {
  const aiOn = useFrontendAi()
  const { country = 'italy', regionId, placeId } = useParams()
  const [region, setRegion] = useState(null)
  const [images, setImages] = useState([])
  const [tab, setTab] = useState(null)
  const aff = useAffiliates()

  useEffect(() => {
    let live = true
    setTab(null)
    getRegion(regionId, country).then((d) => live && setRegion(d)).catch(() => live && setRegion(false))
    // Full gallery (multiple images) loads lazily and only matters for the
    // in-page gallery; the hero comes from the baked place.image below so it
    // shows immediately without waiting on the whole-country image set.
    placeImages(regionId, placeId, country).then((imgs) => live && setImages(imgs)).catch(() => {})
    return () => { live = false }
  }, [regionId, placeId, country])

  const place = useMemo(
    () => (region && region.places ? region.places.find((p) => p.id === placeId) : null),
    [region, placeId]
  )
  const accent = useMemo(() => regionColour(region?.colour), [region])

  useSeo({
    title: place ? `${place.name}, ${region.name} — things to do, food & tips` : undefined,
    description: place?.description,
    path: `/${country}/${regionId}/${placeId}`,
    image: place?.image || images[0]?.url,
    type: 'article',
    jsonLd: place ? [{
      '@context': 'https://schema.org', '@type': 'TouristAttraction', name: place.name,
      description: place.description,
      address: { '@type': 'PostalAddress', addressRegion: region.name, addressCountry: (country === 'italy' ? 'IT' : country === 'spain' ? 'ES' : '') },
      geo: { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lng },
    }, {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: country === 'italy' ? 'Italy' : country, item: canonicalUrl(`/${country}`) },
        { '@type': 'ListItem', position: 2, name: region.name, item: canonicalUrl(`/${country}/${regionId}`) },
        { '@type': 'ListItem', position: 3, name: place.name, item: canonicalUrl(`/italy/${regionId}/${placeId}`) },
      ],
    }] : undefined,
  })

  if (region === null) return <PageLoader label="Opening place" />
  if (region === false || (region && !place)) return <NotFound regionId={regionId} country={country} />

  const hero = place?.image || images[0]?.url || null
  // The baked place.image is only a URL; the credit for it lives in the image
  // manifest, so match the hero back to its record (falling back to the first
  // entry, which is what hero itself falls back to).
  const heroRecord = images.find((i) => i.url === hero) || (hero === images[0]?.url ? images[0] : null)
  const viewTabs = [
    { id: 'do', label: 'Things to do', icon: Compass },
    ...(place.food?.length ? [{ id: 'eat', label: 'What to eat', icon: UtensilsCrossed, count: place.food.length }] : []),
    ...(place.culture?.length ? [{ id: 'colour', label: 'Local tips', icon: Sparkles, count: place.culture.length }] : []),
  ]
  const active = tab && viewTabs.some((t) => t.id === tab) ? tab : 'do'

  return (
    <div className="page place" style={{ '--accent': accent }}>
      <header className={`sub-hero wrap plan-hero plan-hero--bleed place-hero ${hero ? '' : 'place-hero--noimg'}`}>
        <div className="plan-hero__text">
          <Link to={paths.region(regionId, country)} className="place-hero__crumb">
            <ArrowLeft size={15} /> <span aria-hidden>{region.emoji}</span> {region.name}
          </Link>
          <h1 className="sub-hero__title">{place.name}</h1>
          {place.nameIt && place.nameIt !== place.name && <p className="place-hero__alt">{place.nameIt}</p>}
          {place.description && <p className="sub-hero__sub">{place.description}</p>}
          <div className="place-hero__actions">
            <SaveButton regionId={regionId} placeId={placeId} className="pd-action" label />
            <AddToTrip
              place={{ regionId, placeId, name: place.name, regionName: region.name, type: place.type, image: hero }}
              countryId={country}
              triggerClass="pd-action"
            />
          </div>
        </div>
        <div className="plan-hero__media">
          {hero ? (
            <>
              <img src={imgUrl(hero, 800)} alt={place.name} loading="eager" fetchpriority="high" decoding="async"
                onError={(e) => { const m = e.currentTarget.closest('.plan-hero__media'); if (m) m.remove() }} />
              <PhotoCredit url={hero} credit={heroRecord?.credit}
                creditUrl={heroRecord?.creditUrl} creditUsername={heroRecord?.creditUsername} />
            </>
          ) : (
            <PlacePlaceholder iconSize={56} />
          )}
        </div>
      </header>

      <div className="pd-sheet">
        <main className="wrap pd-body">
          <nav className="tabs pd-tabs">
            {viewTabs.map((t) => {
              const Icon = t.icon
              return (
                <button key={t.id} className={`tab ${active === t.id ? 'tab--on' : ''}`} onClick={() => setTab(t.id)}>
                  <Icon size={15} strokeWidth={2.2} /> {t.label}
                  {t.count != null && <span className="tab__count">{t.count}</span>}
                </button>
              )
            })}
          </nav>

          <div className="pd-panel">
            {active === 'do' && <ViatorTours country={country} regionId={regionId} placeId={placeId} name={place.name} embedded />}
            {active === 'eat' && <Items items={place.food} />}
            {active === 'colour' && <Items items={place.culture} />}
          </div>

          {aff && (
            <AffiliateSection
              title={`Plan your visit to ${place.name}`}
              offers={placeOffers(aff, { placeName: place.name, regionName: region.name })}
            />
          )}

          {aiOn && <AskPlace place={place} regionName={region?.name || ''} />}

          <CommentsSection countryId={country} targetType="place" regionId={regionId} placeId={placeId} areaName={place.name} />
        </main>
      </div>
    </div>
  )
}

function Items({ items, numbered }) {
  return (
    <ul className={`dl__list pd-tabbody ${numbered ? 'dl__list--num' : ''}`}>
      {items.map((it, i) => (
        <li key={it.id} className={`dl__row ${numbered ? 'dl__row--num' : ''}`}>
          {!numbered && <span className="dl__marker" aria-hidden />}
          <div className="dl__main">
            <p className="dl__text">{it.text}</p>
            {it.detail && <p className="dl__detail">{it.detail}</p>}
          </div>
          {numbered && <span className="dl__num" aria-hidden>{i + 1}</span>}
        </li>
      ))}
    </ul>
  )
}

function NotFound({ regionId, country }) {
  return (
    <div className="page wrap">
      <Link to={paths.region(regionId, country)} className="back" style={{ marginTop: 24 }}>
        <ArrowLeft size={17} /> Back
      </Link>
      <p className="empty">That place could not be found.</p>
    </div>
  )
}
