import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Compass, UtensilsCrossed, Sparkles, ArrowUpRight, ChevronRight, Info, Image as ImageIcon } from 'lucide-react'
import { getRegion, placeImages } from '../lib/data.js'
import { regionColour, typeLabel, mapsUrl } from '../lib/format.js'
import { paths } from '../lib/paths.js'
import MapView from '../components/MapView.jsx'
import Carousel from '../components/Carousel.jsx'
import AddToTrip from '../components/AddToTrip.jsx'
import SaveButton from '../components/SaveButton.jsx'
import AffiliateSection from '../components/AffiliateSection.jsx'
import CommentsSection from '../components/CommentsSection.jsx'
import AskPlace from '../components/AskPlace.jsx'
import { useAffiliates, placeOffers } from '../lib/affiliates.js'
import { PageLoader } from '../components/Loading.jsx'
import { useSeo, canonicalUrl } from '../lib/seo.js'

export default function PlaceDetailScreen() {
  const { country = 'italy', regionId, placeId } = useParams()
  const [region, setRegion] = useState(null)
  const [images, setImages] = useState([])
  const [tab, setTab] = useState(null)
  const aff = useAffiliates()

  useEffect(() => {
    let live = true
    setTab(null)
    getRegion(regionId, country).then((d) => live && setRegion(d)).catch(() => live && setRegion(false))
    placeImages(regionId, placeId, country).then((imgs) => live && setImages(imgs)).catch(() => {})
    return () => { live = false }
  }, [regionId, placeId, country])

  const place = useMemo(
    () => (region && region.places ? region.places.find((p) => p.id === placeId) : null),
    [region, placeId]
  )
  const accent = useMemo(() => regionColour(region?.colour), [region])

  useSeo({
    title: place ? `${place.name}, ${region.name}` : undefined,
    description: place?.description,
    path: `/italy/${regionId}/${placeId}`,
    image: images[0]?.url,
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

  const hero = images[0]?.url
  const viewTabs = [
    { id: 'info', label: 'Info', icon: Info },
    ...(images.length ? [{ id: 'photos', label: 'Photos', icon: ImageIcon }] : []),
    ...(place.activities?.length ? [{ id: 'do', label: 'Things to do', icon: Compass, count: place.activities.length }] : []),
    ...(place.food?.length ? [{ id: 'eat', label: 'What to eat', icon: UtensilsCrossed, count: place.food.length }] : []),
    ...(place.culture?.length ? [{ id: 'colour', label: 'Local tips', icon: Sparkles, count: place.culture.length }] : []),
  ]
  const active = tab && viewTabs.some((t) => t.id === tab) ? tab : 'info'

  return (
    <div className="page place" style={{ '--accent': accent }}>
      <header className="pd-hero">
        {hero && <img className="pd-hero__img" src={hero} alt={place.name} onError={(e) => { e.currentTarget.style.display = 'none' }} />}
        <div className="pd-hero__veil" />
        <SaveButton regionId={regionId} placeId={placeId} className="pd-save" label />
        <div className="wrap pd-hero__content">
          <div className="pd-hero__bottom">
            <span className="chip chip--solid">{typeLabel(place.type)}</span>
            <h1 className="pd-hero__name">{place.name}</h1>
            {place.nameIt && place.nameIt !== place.name && (
              <p className="pd-hero__alt">{place.nameIt}</p>
            )}
          </div>
        </div>
      </header>

      <div className="pd-sheet">
        <nav className="wrap pd-crumb">
          <Link to={paths.region(regionId, country)} className="pd-crumb__back">
            <span className="pd-crumb__emoji" aria-hidden>{region.emoji}</span>
            {region.name}
          </Link>
          <ChevronRight size={14} className="pd-crumb__sep" aria-hidden />
          <span className="pd-crumb__here">{place.name}</span>
        </nav>
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
            {active === 'info' && (
              <>
                <p className="pd-lede">{place.description}</p>
                <dl className="pd-glance">
                  <div className="pd-glance__row"><dt>Type</dt><dd>{typeLabel(place.type)}</dd></div>
                  <div className="pd-glance__row">
                    <dt>Region</dt>
                    <dd>
                      <Link to={paths.region(regionId, country)} className="pd-glance__region">
                        <span className="pd-glance__emoji" aria-hidden>{region.emoji}</span> {region.name}
                      </Link>
                    </dd>
                  </div>
                  <div className="pd-glance__row"><dt>Coordinates</dt><dd className="mono">{place.lat.toFixed(3)}, {place.lng.toFixed(3)}</dd></div>
                </dl>
                <AddToTrip place={{
                  regionId, placeId, name: place.name, regionName: region.name, type: place.type, image: hero,
                }} />
              </>
            )}

            {active === 'photos' && images.length > 0 && <Carousel images={images} label={place.name} />}

            {active === 'do' && (() => {
              const acts = (place.activities || []).map((a, i) => ({ ...a, n: i + 1 }))
              return (
                <>
                  <MapView height={360} center={[place.lng, place.lat]} zoom={12}
                    markers={[
                      { lng: place.lng, lat: place.lat, label: place.name, color: accent },
                      ...acts.filter((a) => a.lat && a.lng)
                        .map((a) => ({ lng: a.lng, lat: a.lat, number: a.n, label: `${a.n}. ${a.text}`, color: '#1f6f54' })),
                    ]} />
                  <a className="pd-maplink" href={mapsUrl(place.lat, place.lng)} target="_blank" rel="noreferrer">
                    <MapPin size={15} /> Open in Maps <ArrowUpRight size={14} />
                  </a>
                  <div className="pd-tabmaplist"><Items items={acts} numbered /></div>
                </>
              )
            })()}
            {active === 'eat' && <Items items={place.food} />}
            {active === 'colour' && <Items items={place.culture} />}
          </div>

          {aff && (
            <AffiliateSection
              title={`Plan your visit to ${place.name}`}
              offers={placeOffers(aff, { placeName: place.name, regionName: region.name })}
            />
          )}

          <AskPlace place={place} regionName={region?.name || ''} />
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
