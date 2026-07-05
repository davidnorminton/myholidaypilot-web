import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Trash2, X, Check, MapPin, StickyNote, CalendarRange,
  Sparkles, Search, Star, Lightbulb, ChevronRight, CalendarCheck, ArrowLeft, FileDown, Share2, Pencil, Luggage, Coins, Globe2 } from 'lucide-react'
import {
  useTrips, activeTrip, createTrip, deleteTrip, renameTrip, setActiveTrip,
  removePlace, togglePlaceDone, updateNote, setTripDates, addPlace,
  healTripCoords,
} from '../lib/trips.js'
import { downloadTripPdf } from '../lib/tripPdf.js'
import { shareUrl } from '../lib/tripShare.js'
import TripReadiness from '../components/TripReadiness.jsx'
import StaysEditor from '../components/StaysEditor.jsx'
import TravelEditor from '../components/TravelEditor.jsx'
import NewTripFlow from '../components/NewTripFlow.jsx'
import { getPlacesIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import { typeLabel } from '../lib/format.js'
import MapView from '../components/MapView.jsx'
import AddPlaceWizard from '../components/AddPlaceWizard.jsx'
import PlacePlanner from '../components/PlacePlanner.jsx'
import PackingList from '../components/PackingList.jsx'
import BudgetPanel from '../components/BudgetPanel.jsx'
import PublishTrip from '../components/PublishTrip.jsx'
import Itinerary from '../components/Itinerary.jsx'

const SUGGESTIONS = ['Rome', 'Florence', 'Venice', 'Naples', 'Amalfi', 'Milan']
const HIGHLIGHTS = ['Rome', 'Florence', 'Venice', 'Amalfi Coast', 'Cinque Terre', 'Pompeii']

export default function PlanScreen() {
  useEffect(() => { getPlacesIndex().then(healTripCoords).catch(() => {}) }, [])
  const snap = useTrips()
  const trip = activeTrip(snap)
  const [wizard, setWizard] = useState(null)
  const [planFor, setPlanFor] = useState(null)
  const [view, setView] = useState('build')
  const [shared, setShared] = useState(false)
  const [pickingCountry, setPickingCountry] = useState(false)
  const [packingOpen, setPackingOpen] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const share = async () => {
    try { await navigator.clipboard.writeText(shareUrl(trip)); setShared(true); setTimeout(() => setShared(false), 2000) }
    catch { prompt('Copy this trip link:', shareUrl(trip)) }
  }

  const ensureTrip = () => (trip ? trip.id : createTrip('My trip'))
  const openWizard = ({ query = '', mode = 'ideas' } = {}) => setWizard({ query, mode, tripId: ensureTrip() })

  const addHighlights = async () => {
    const id = ensureTrip()
    try {
      const idx = await getPlacesIndex()
      idx.filter((p) => HIGHLIGHTS.includes(p.name)).forEach((p) =>
        addPlace(id, { regionId: p.regionId, regionName: p.regionName, placeId: p.placeId, name: p.name, type: p.type, lat: p.lat, lng: p.lng }))
    } catch (e) { /* ignore */ }
  }

  const groups = useMemo(() => {
    if (!trip) return []
    const map = new Map()
    for (const p of trip.places) {
      const key = p.isCustom ? 'Your own places' : (p.regionName || p.regionId)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    }
    return [...map.entries()].sort((a, b) =>
      a[0] === 'Your own places' ? 1 : b[0] === 'Your own places' ? -1 : a[0].localeCompare(b[0]))
  }, [trip])

  const mapMarkers = useMemo(() => {
    if (!trip) return []
    const out = []
    for (const p of trip.places) {
      if (p.lat && p.lng) out.push({ lng: p.lng, lat: p.lat, label: p.name, color: '#a9762a' })
      for (const a of (p.attractions || [])) if (a.lat && a.lng) out.push({ lng: a.lng, lat: a.lat, label: a.text, color: '#1f6f54' })
      for (const r of (p.restaurants || [])) if (r.lat && r.lng) out.push({ lng: r.lng, lat: r.lat, label: r.name, color: '#bb3a2c' })
    }
    return out
  }, [trip])
  const doneCount = trip ? trip.places.filter((p) => p.done).length : 0
  const regionCount = groups.filter(([k]) => k !== 'Your own places').length

  const tip = !trip ? null
    : !trip.startDate ? 'Add your travel dates to start shaping the days.'
    : doneCount === 0 ? 'Tick the circle on a place once it’s locked in.'
    : 'Open any place for things to do, where to eat, and booking links.'

  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow">myholidaypilot</p>
        <h1 className="sub-hero__title">Plan my trip</h1>
        <p className="sub-hero__sub">
          However you like to plan — by mood, by map, or by a place you already love — start here.
          Saved on this device for now.
        </p>
      </header>

      <main className="wrap">
        {snap.trips.length > 0 && (
          <div className="trip-bar">
            <Link to={paths.trips()} className="trip-pill trip-pill--all">All trips</Link>
            {snap.trips.map((t) => (
              <button key={t.id} className={`trip-pill ${t.id === snap.activeTripId ? 'trip-pill--on' : ''}`}
                onClick={() => { setActiveTrip(t.id); setView('build') }}>
                {t.name}<span className="trip-pill__n">{t.places.length}</span>
              </button>
            ))}
            <button className="trip-pill trip-pill--new" onClick={() => setPickingCountry(true)}>
              <Plus size={15} /> New trip
            </button>
          </div>
        )}

        {/* Guided start for the unsure user */}
        {(!trip || trip.places.length === 0) && (
          <div className="plan-start">
            <h2 className="plan-start__title">{trip ? `“${trip.name}” is empty` : 'Where do you want to go?'}</h2>
            <p className="plan-start__sub">
              You don’t need a plan yet. Pick whichever feels easiest — you can mix and match, and nothing is final.
            </p>
            <div className="start-cards">
              <button className="start-card" onClick={() => openWizard({ mode: 'ideas' })}>
                <span className="start-card__ic"><Sparkles size={20} /></span>
                <span className="start-card__title">Show me ideas</span>
                <span className="start-card__sub">Browse by coast, cities, food towns, mountains…</span>
                <span className="start-card__go">Get inspired <ChevronRight size={15} /></span>
              </button>
              <button className="start-card" onClick={() => openWizard({ mode: 'search' })}>
                <span className="start-card__ic"><Search size={20} /></span>
                <span className="start-card__title">I know a place</span>
                <span className="start-card__sub">Search any city, town or sight and add it.</span>
                <span className="start-card__go">Search <ChevronRight size={15} /></span>
              </button>
              <button className="start-card" onClick={addHighlights}>
                <span className="start-card__ic"><Star size={20} /></span>
                <span className="start-card__title">Just start me off</span>
                <span className="start-card__sub">Drop in six classic places to react to and edit.</span>
                <span className="start-card__go">Add highlights <ChevronRight size={15} /></span>
              </button>
            </div>
            <div className="plan-start__chips">
              <span className="plan-start__chiplabel">Or jump to:</span>
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip-suggest" onClick={() => openWizard({ query: s, mode: 'search' })}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Active trip with places */}
        {trip && trip.places.length > 0 && (
          <section className="trip">
            <div className="trip__head">
              <span className="trip__namewrap">
                <input className="trip__name" value={trip.name}
                  onChange={(e) => renameTrip(trip.id, e.target.value)} aria-label="Trip name" />
                <Pencil size={15} className="trip__pencil" aria-hidden />
              </span>
              {view === 'build' ? (
                <>
                  <button className="trip__view" onClick={() => setView('itinerary')}><CalendarRange size={16} /> View trip</button>
                  <button className="trip__view" onClick={() => downloadTripPdf(trip)}><FileDown size={16} /> PDF</button>
                  <button className="trip__view" onClick={() => setPackingOpen(true)}><Luggage size={16} /> Packing</button>
                  <button className="trip__view" onClick={() => setBudgetOpen(true)}><Coins size={16} /> Budget</button>
                  <button className="trip__view" onClick={share}><Share2 size={16} /> {shared ? 'Link copied ✓' : 'Share'}</button>
                  <button className="btn btn--primary trip__add" onClick={() => openWizard({ mode: 'ideas' })}><Plus size={16} /> Add places</button>
                </>
              ) : (
                <>
                  <button className="trip__view" onClick={() => setView('build')}><ArrowLeft size={16} /> Edit trip</button>
                  <button className="trip__view" onClick={() => setPackingOpen(true)}><Luggage size={16} /> Packing</button>
                  <button className="trip__view" onClick={() => setBudgetOpen(true)}><Coins size={16} /> Budget</button>
                  <button className="trip__view" onClick={() => downloadTripPdf(trip)}><FileDown size={16} /> PDF</button>
                  <button className="trip__view" onClick={() => setPublishOpen(true)}><Globe2 size={16} /> Publish</button>
                  <button className="trip__view" onClick={share}><Share2 size={16} /> {shared ? 'Link copied ✓' : 'Share'}</button>
                </>
              )}
              <button className="trip__del" onClick={() => { if (confirm(`Delete “${trip.name}”?`)) deleteTrip(trip.id) }} aria-label="Delete trip">
                <Trash2 size={16} />
              </button>
            </div>

            {view === 'build' && (<>
            <div className="trip-status">
              <TripReadiness trip={trip} />
              <p className="trip__summary">
                <b>{trip.places.length}</b> {trip.places.length === 1 ? 'place' : 'places'}
                {regionCount > 0 && <> across <b>{regionCount}</b> {regionCount === 1 ? 'region' : 'regions'}</>}
                {doneCount > 0 && <> · {doneCount} locked in</>} — looking good.
              </p>
              <div className="trip__dates">
                <span className="trip__dateslabel"><CalendarRange size={15} /> Trip dates</span>
                <label>Arriving <input type="date" value={trip.startDate || ''} onChange={(e) => setTripDates(trip.id, e.target.value, trip.endDate || '')} /></label>
                <span className="trip__datesarrow">→</span>
                <label>Leaving <input type="date" value={trip.endDate || ''} onChange={(e) => setTripDates(trip.id, trip.startDate || '', e.target.value)} /></label>
                <span className="trip__dateshint">Moving the arrival date shifts the whole trip with it.</span>
              </div>
            </div>


            <StaysEditor trip={trip} />
            <TravelEditor trip={trip} />

            {tip && <div className="trip-tip"><Lightbulb size={16} /> {tip}</div>}

            {mapMarkers.length > 0 && (
              <>
                <MapView height={330} center={[mapMarkers[0].lng, mapMarkers[0].lat]} zoom={6} markers={mapMarkers} />
                <p className="trip-maplegend">
                  <span className="lg lg--p" /> places
                  <span className="lg lg--a" /> things to do
                  <span className="lg lg--r" /> restaurants
                </p>
              </>
            )}

            {groups.map(([groupName, places]) => (
              <div key={groupName} className="trip-group">
                <h3 className="trip-group__title">{groupName}</h3>
                <ul className="trip-list">
                  {places.map((p) => <PlaceRow country={trip.countryId} key={`${p.regionId}/${p.placeId}`} tripId={trip.id} place={p} onPlan={() => setPlanFor(p)} />)}
                </ul>
              </div>
            ))}

            <button className="trip-addmore" onClick={() => openWizard({ mode: 'ideas' })}>
              <Plus size={16} /> Add more places
            </button>
            </>)}
            {view === 'itinerary' && <Itinerary trip={trip} onPlan={(p) => setPlanFor(p)} />}
          </section>
        )}
      </main>

      {wizard && (
        <AddPlaceWizard tripId={wizard.tripId} initialQuery={wizard.query} initialMode={wizard.mode} onClose={() => setWizard(null)} />
      )}
      {packingOpen && trip && <PackingList trip={trip} onClose={() => setPackingOpen(false)} />}
      {budgetOpen && trip && <BudgetPanel trip={trip} onClose={() => setBudgetOpen(false)} />}
      {publishOpen && trip && <PublishTrip trip={trip} onClose={() => setPublishOpen(false)} />}
      <NewTripFlow open={pickingCountry} onClose={() => setPickingCountry(false)} />
      {planFor && trip && (
        <PlacePlanner key={`${planFor.regionId}/${planFor.placeId}`} tripId={trip.id} regionId={planFor.regionId} placeId={planFor.placeId}
          range={{ start: trip.startDate, end: trip.endDate }} onClose={() => setPlanFor(null)} />
      )}
    </div>
  )
}

function fmtDay(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
}

function PlaceRow({ tripId, country, place: p, onPlan }) {
  const [editing, setEditing] = useState(false)
  const hasNote = p.note && p.note.trim() !== ''
  const nA = (p.attractions || []).length
  const nR = (p.restaurants || []).length
  const planned = p.date || nA || nR
  const summary = [p.date && fmtDay(p.date), nA && `${nA} to do`, nR && `${nR} to eat`].filter(Boolean).join(' · ')
  return (
    <li className={`trip-row ${p.done ? 'trip-row--done' : ''}`}>
      <div className="trip-row__top">
        <button className="trip-row__check" onClick={() => togglePlaceDone(tripId, p.regionId, p.placeId)}
          aria-label={p.done ? 'Mark not visited' : 'Mark visited'}>
          {p.done && <Check size={14} />}
        </button>
        {p.image
          ? <img className="trip-row__thumb" src={p.image} alt="" loading="lazy" />
          : <span className="trip-row__thumb trip-row__thumb--blank"><MapPin size={15} /></span>}
        <div className="trip-row__main">
          {p.isCustom
            ? <span className="trip-row__name">{p.name}</span>
            : <Link to={paths.place(p.regionId, p.placeId, country || 'italy')} className="trip-row__name trip-row__name--link">{p.name}</Link>}
          <span className="trip-row__type">{typeLabel(p.type)}{p.isCustom ? ' · your own' : ''}</span>
          {planned
            ? <button className="trip-row__plan-meta" onClick={onPlan}>{summary}</button>
            : <button className="trip-row__plan-prompt" onClick={onPlan}>+ Pick a day, sights & restaurants</button>}
        </div>
        <button className="trip-row__plan" onClick={onPlan} aria-label="Plan this place"><CalendarCheck size={15} /> Plan</button>
        <button className={`trip-row__note ${hasNote ? 'is-on' : ''}`} onClick={() => setEditing((v) => !v)}>
          <StickyNote size={15} /> <span className="trip-row__notelabel">{hasNote ? 'Edit note' : 'Make note'}</span>
        </button>
        <button className="trip-row__rm" onClick={() => removePlace(tripId, p.regionId, p.placeId)} aria-label="Remove">
          <X size={16} />
        </button>
      </div>
      {(editing || hasNote) && (
        <textarea className="trip-row__notebox" defaultValue={p.note || ''}
          placeholder="Add a note — opening times, booking ref, why you saved it…"
          onBlur={(e) => updateNote(tripId, p.regionId, p.placeId, e.target.value)} rows={2} />
      )}
    </li>
  )
}
