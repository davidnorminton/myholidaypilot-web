import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Plus, Trash2, X, Check, StickyNote, CalendarRange, Lightbulb, ChevronRight, CalendarCheck, FileDown, Share2, Pencil, Luggage, Coins, Globe2, Ticket } from 'lucide-react'
import {
  useTrips, activeTrip, createTrip, deleteTrip, renameTrip,
  removePlace, togglePlaceDone, updateNote, setTripDates,
  setTravelPoint, removeStay, setTripCountry, setDaySaved, clearSavedDays,
  healTripCoords,
} from '../lib/trips.js'
import { useSettings } from '../lib/settings.js'
import { imgUrl } from '../lib/imgUrl.js'
import { useSeo } from '../lib/seo.js'
// PDF generation (jspdf + html2canvas, ~760K) loads only when asked for
const downloadTripPdf = async (...a) => (await import('../lib/tripPdf.js')).downloadTripPdf(...a)
import { shareUrl } from '../lib/tripShare.js'
import TravelEditor from '../components/TravelEditor.jsx'
import { getPlacesIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import { COUNTRIES, isAvailableCountry } from '../lib/countries.js'
import { typeLabel } from '../lib/format.js'
import MapView from '../components/MapView.jsx'
import AddPlaceWizard from '../components/AddPlaceWizard.jsx'
import PlacePlanner from '../components/PlacePlanner.jsx'
import DayLocationPicker from '../components/DayLocationPicker.jsx'
import TripViewPanel from '../components/TripViewPanel.jsx'
import BookingsPanel from '../components/BookingsPanel.jsx'
import PackingList from '../components/PackingList.jsx'
import BudgetPanel from '../components/BudgetPanel.jsx'
import PublishTrip from '../components/PublishTrip.jsx'
import Itinerary from '../components/Itinerary.jsx'


// Remember the hero draft (destination + dates) across reloads, before a trip
// is created.
const lsGet = (k) => { try { return localStorage.getItem(k) || '' } catch { return '' } }

export default function PlanScreen() {
  useSeo({ title: 'Holiday trip planner — build your itinerary', description: 'A free holiday trip planner: pick places, build a day-by-day itinerary, and get packing lists and budgets for your trip.', path: '/trip-planner' })
  useEffect(() => { getPlacesIndex().then(healTripCoords).catch(() => {}) }, [])
  const snap = useTrips()
  const trip = activeTrip(snap)
  const site = useSettings()
  const [wizard, setWizard] = useState(null)
  const [planFor, setPlanFor] = useState(null)
  const [step, setStep] = useState('setloc')   // setloc | places | days
  const [shared, setShared] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  // Hero form (destination + holiday dates). Dates drive the active trip; the
  // country selection is captured here for now (wiring it to create/switch
  // trips comes next).
  const [heroCountry, setHeroCountry] = useState(trip?.countryId || lsGet('planHero.country'))
  const [heroStart, setHeroStart] = useState(trip?.startDate || lsGet('planHero.start'))
  const [heroEnd, setHeroEnd] = useState(trip?.endDate || lsGet('planHero.end'))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetClosing, setSheetClosing] = useState(false)
  // Explicit open/close — deliberately NOT in browser history: the builder is
  // a tool state on the trip, not a page. Closing never destroys anything;
  // the hero shows "Resume building" whenever a trip is in progress.
  const closeSheet = () => {
    if (!sheetOpen || sheetClosing) return
    setSheetClosing(true)
    setTimeout(() => { setSheetOpen(false); setSheetClosing(false) }, 240)
  }
  const [selectedDay, setSelectedDay] = useState(() => parseInt(lsGet('planHero.selDay'), 10) || 1)
  const [confirmClear, setConfirmClear] = useState(false)
  useEffect(() => {
    if (trip) { setHeroCountry(trip.countryId || lsGet('planHero.country')); setHeroStart(trip.startDate || lsGet('planHero.start')); setHeroEnd(trip.endDate || lsGet('planHero.end')) }
  }, [trip?.id]) // sync hero form when the active trip changes
  useEffect(() => {
    try { localStorage.setItem('planHero.country', heroCountry); localStorage.setItem('planHero.start', heroStart); localStorage.setItem('planHero.end', heroEnd) } catch { /* ignore */ }
  }, [heroCountry, heroStart, heroEnd])
  useEffect(() => { try { localStorage.setItem('planHero.selDay', String(selectedDay)) } catch { /* ignore */ } }, [selectedDay])
  const share = async () => {
    try { await navigator.clipboard.writeText(shareUrl(trip)); setShared(true); setTimeout(() => setShared(false), 2000) }
    catch { prompt('Copy this trip link:', shareUrl(trip)) }
  }

  const ensureTrip = () => (trip ? trip.id : createTrip('My trip'))
  const openWizard = ({ query = '', mode = 'ideas' } = {}) => setWizard({ query, mode, tripId: ensureTrip() })


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

  const availCountries = useMemo(() => COUNTRIES.filter((c) => isAvailableCountry(c.slug)), [])
  const heroCountryName = (COUNTRIES.find((c) => c.slug === heroCountry) || {}).name || ''
  const setHeroDates = (s, e) => { setHeroStart(s); setHeroEnd(e); if (trip) setTripDates(trip.id, s, e) }
  // Builder stays hidden until a destination + dates are set and "Create" is
  // tapped; an existing trip with places is already past that point.
  const canResume = !!(trip && (trip.places.length > 0 || (trip.startDate && trip.countryId)))
  const nights = heroStart && heroEnd ? Math.max(0, Math.round((new Date(heroEnd) - new Date(heroStart)) / 86400000)) : 0
  const heroImg = heroCountry ? (site[`countryHero.${heroCountry}`] || '') : ''

  // Esc closes; page behind doesn't scroll while the sheet is up.
  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e) => { if (e.key === 'Escape') closeSheet() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [sheetOpen])
  // One entry per day of the holiday, numbered with its date.
  const dayList = useMemo(() => {
    if (!trip?.startDate) return []
    const start = new Date(trip.startDate + 'T12:00')
    const end = trip.endDate ? new Date(trip.endDate + 'T12:00') : start
    const out = []
    for (let d = new Date(start), n = 1; d <= end && n <= 60; d.setDate(d.getDate() + 1), n++) {
      out.push({ n, date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) })
    }
    return out
  }, [trip?.startDate, trip?.endDate])
  useEffect(() => {
    if (dayList.length && selectedDay > dayList.length) setSelectedDay(1)
  }, [dayList.length]) // trip dates shortened — snap back to Day 1
  // Changing destination forks a fresh trip for the new country once the
  // current one holds anything beyond the country itself (dates, places,
  // flights or stays) — the old trip stays saved in "previous planned trips".
  // Nothing is written to the new trip until the user picks something for it.
  const onCountryChange = (v) => {
    setHeroCountry(v)
    if (!trip || !v || trip.countryId === v) return
    const hasContent = !!trip.startDate || trip.places.length > 0 || (trip.stays || []).length > 0 ||
      !!trip.travel?.arrive || !!trip.travel?.depart || !!trip.travel?.home
    const cName = availCountries.find((c) => c.slug === v)?.name || 'my destination'
    if (!hasContent) {
      // Untouched trip: switch it in place (no trip spam), keeping the
      // auto-generated name honest. A custom name is left alone.
      const oldName = availCountries.find((c) => c.slug === trip.countryId)?.name
      setTripCountry(trip.id, v)
      if (trip.name === 'My trip' || (oldName && trip.name === `My trip to ${oldName}`)) renameTrip(trip.id, `My trip to ${cName}`)
      return
    }
    createTrip(`My trip to ${cName}`, v)
    setSelectedDay(1)
  }
  const onCreate = () => {
    let id = trip?.id
    if (!id) id = createTrip(`My trip to ${heroCountryName || 'my destination'}`, heroCountry)
    if (heroStart) setTripDates(id, heroStart, heroEnd)
    setSheetOpen(true)
  }
  const onClear = () => {
    setHeroCountry('')
    setHeroDates('', '')
    if (trip) {
      setTravelPoint(trip.id, 'arrive', null)
      setTravelPoint(trip.id, 'depart', null)
      setTravelPoint(trip.id, 'home', null)
      for (const s of (trip.stays || [])) removeStay(trip.id, s.id)
      clearSavedDays(trip.id)
    }
  }

  const tip = !trip ? null
    : !trip.startDate ? 'Add your travel dates to start shaping the days.'
    : doneCount === 0 ? 'Tick the circle on a place once it’s locked in.'
    : 'Open any place for things to do, where to eat, and booking links.'

  return (
    <div className="page">
      <div className="wrap">
        <header className="planpage__head planpage__head--split">
          <div className="planpage__headtext">
            <h1 className="planpage__title">Trip planner</h1>
            <p className="planpage__sub">Build your day-by-day itinerary — pick the places, arrange the days, and add packing and budget as you go.</p>
            <Link to={paths.trips()} className="planpage__prevlink">View previous planned trips <ChevronRight size={15} /></Link>
          </div>
          <div className={`planpage__form ${heroImg ? 'planpage__form--img' : ''}`}
            style={heroImg ? { backgroundImage: `linear-gradient(rgba(12,14,18,.45), rgba(12,14,18,.58)), url(${imgUrl(heroImg, 1200)})` } : undefined}>
            <div className="planform">
              <label className="planform__field">
                <span className="planform__label">Destination</span>
                <select className="planform__select" value={heroCountry} onChange={(e) => onCountryChange(e.target.value)}>
                  <option value="">Select a destination</option>
                  {availCountries.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </label>
              <div className="planform__dates">
                <label className="planform__field">
                  <span className="planform__label">From</span>
                  <input type="date" value={heroStart} onChange={(e) => setHeroDates(e.target.value, heroEnd)} />
                </label>
                <label className="planform__field">
                  <span className="planform__label">To{nights > 0 ? ` · ${nights} night${nights === 1 ? '' : 's'}` : ''}</span>
                  <input type="date" value={heroEnd} onChange={(e) => setHeroDates(heroStart, e.target.value)} />
                </label>
              </div>

              {trip && (
                <details className="planform__flights" open={!!(trip.travel?.home || trip.travel?.arrive || trip.travel?.depart)}>
                  <summary><Plus size={14} /> Add flights <em>optional</em></summary>
                  <TravelEditor trip={trip} />
                </details>
              )}

              {canResume ? (
                <button className="planform__create" onClick={() => setSheetOpen(true)}>
                  Resume building — {trip.name} <ChevronRight size={16} />
                </button>
              ) : heroCountry && heroStart && heroEnd ? (
                <button className="planform__create" onClick={onCreate}>Create trip <ChevronRight size={16} /></button>
              ) : null}

              {(heroCountry || heroStart || trip) && (
                confirmClear ? (
                  <span className="planform__confirm">
                    Clear everything?
                    <button className="planform__confirmyes" onClick={() => { onClear(); setConfirmClear(false) }}>Clear</button>
                    <button className="planform__confirmno" onClick={() => setConfirmClear(false)}>Keep</button>
                  </span>
                ) : (
                  <button className="planform__clear planform__clear--quiet" onClick={() => setConfirmClear(true)}>Clear and start over</button>
                )
              )}
            </div>
          </div>
        </header>
      </div>

      {sheetOpen && trip && createPortal(
      <div className={`plansheet ${sheetClosing ? 'is-closing' : ''}`} role="dialog" aria-label="Trip builder">
        <div className="planbuild__titlebar">
          <div className="planbuild__title">
            <span className="planbuild__titlelabel">Set trip title:</span>
            <span className="trip__namewrap">
              <input className="trip__name" value={trip.name} onChange={(e) => renameTrip(trip.id, e.target.value)} aria-label="Trip name" />
              <Pencil size={20} className="trip__pencil" aria-hidden />
            </span>
          </div>
          <div className="planbuild__actions">
            <button className="planbuild__act" onClick={() => setViewOpen(true)}><CalendarRange size={16} /> View trip</button>
            <button className="planbuild__act" onClick={() => downloadTripPdf(trip)}><FileDown size={16} /> Download</button>
            <button className="planbuild__act" onClick={share}><Share2 size={16} /> {shared ? 'Link copied ✓' : 'Share'}</button>
            <button className="planbuild__act" onClick={() => setPublishOpen(true)}><Globe2 size={16} /> Add to trip ideas</button>
            <button className="planbuild__act planbuild__act--del" onClick={() => { if (confirm(`Delete “${trip.name}”?`)) { deleteTrip(trip.id); closeSheet() } }} aria-label="Delete trip"><Trash2 size={16} /></button>
            <button className="planbuild__act planbuild__act--close" onClick={closeSheet} aria-label="Close builder"><X size={18} /></button>
          </div>
        </div>
        <section className="planws planws--sheet">
          <aside className="planws__side">
            {dayList.length > 0 && (<>
              <p className="planws__sidelabel">Set locations</p>
              {dayList.map((d) => {
                const saved = !!(trip.savedDays || {})[d.date]
                const hasContent = trip.places.some((p) => p.date === d.date ||
                  (p.attractions || []).some((x) => x.date === d.date) || (p.restaurants || []).some((x) => x.date === d.date))
                return (
                  <button key={d.n} className={`planws__step ${step === 'setloc' && selectedDay === d.n ? 'is-on' : ''} ${saved ? 'is-done' : ''}`}
                    onClick={() => { setSelectedDay(d.n); setStep('setloc') }}>
                    <span className="planws__stepnum">{saved ? <Check size={13} /> : d.n}</span>
                    <span className="planws__daylabel">{d.label}</span>
                    {!saved && hasContent && <span className="planws__daydot" aria-label="In progress" />}
                  </button>
                )
              })}
            </>)}

            <p className="planws__sidelabel">Book</p>
            <button className={`planws__step ${step === 'book' ? 'is-on' : ''}`} onClick={() => setStep('book')}>
              <span className="planws__stepnum"><Ticket size={13} /></span> Book your trip
            </button>
            <p className="planws__sidelabel planws__sidelabel--opt">Optional</p>
            <button className={`planws__step planws__step--opt ${step === 'budget' ? 'is-on' : ''}`} onClick={() => setStep('budget')}>
              <span className="planws__stepnum"><Coins size={13} /></span> Budget
            </button>
            <button className={`planws__step planws__step--opt ${step === 'packing' ? 'is-on' : ''}`} onClick={() => setStep('packing')}>
              <span className="planws__stepnum"><Luggage size={13} /></span> Packing list
            </button>
          </aside>
          <div className="planws__main">
            <div className="planws__maininner">
            {step === 'setloc' && selectedDay && dayList[selectedDay - 1] && (
              <DayLocationPicker key={selectedDay} tripId={trip.id} countryId={trip.countryId}
                day={dayList[selectedDay - 1].date} dayNumber={selectedDay} dayLabel={dayList[selectedDay - 1].label}
                saved={!!(trip.savedDays || {})[dayList[selectedDay - 1].date]}
                setSaved={(v) => setDaySaved(trip.id, dayList[selectedDay - 1].date, v)}
                nextDay={selectedDay < dayList.length ? dayList[selectedDay] : null}
                onNext={selectedDay < dayList.length ? () => { setSelectedDay(selectedDay + 1); setStep('setloc') } : null}
                onReview={() => setStep('book')} />
            )}
            {step === 'setloc' && (!selectedDay || !dayList[selectedDay - 1]) && (
              <p className="setloc__hint">Set your trip dates above to plan day by day.</p>
            )}

            {step === 'places' && (<>
              {tip && <div className="trip-tip"><Lightbulb size={16} /> {tip}</div>}
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

            {step === 'book' && <BookingsPanel trip={trip} />}

            {step === 'budget' && <BudgetPanel key={trip.id} trip={trip} inline />}

            {step === 'packing' && <PackingList key={trip.id} trip={trip} inline />}

            {step === 'days' && <Itinerary trip={trip} onPlan={(p) => setPlanFor(p)} />}
            </div>
          </div>

          <aside className="planws__map">
            {mapMarkers.length > 0
              ? <MapView height="100%" center={[mapMarkers[0].lng, mapMarkers[0].lat]} zoom={6} markers={mapMarkers} />
              : <div className="planws__mapempty">Add places to see them on the map</div>}
            <p className="planws__legend">
              <span className="lg lg--p" /> places
              <span className="lg lg--a" /> things to do
              <span className="lg lg--r" /> restaurants
            </p>
          </aside>
        </section>
      </div>,
      document.body)}

      {wizard && (
        <AddPlaceWizard tripId={wizard.tripId} initialQuery={wizard.query} initialMode={wizard.mode} onClose={() => setWizard(null)} />
      )}
      {publishOpen && trip && <PublishTrip trip={trip} onClose={() => setPublishOpen(false)} />}
      {viewOpen && trip && <TripViewPanel trip={trip} onPlan={(p) => { setViewOpen(false); setPlanFor(p) }} onPublish={() => { setViewOpen(false); setPublishOpen(true) }} onClose={() => setViewOpen(false)} />}
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
        {p.image && <img className="trip-row__thumb" src={p.image} alt="" loading="lazy" />}
        <div className="trip-row__id">
          {p.isCustom
            ? <span className="trip-row__name">{p.name}</span>
            : <Link to={paths.place(p.regionId, p.placeId, country || 'italy')} className="trip-row__name trip-row__name--link">{p.name}</Link>}
          <span className="trip-row__type">{typeLabel(p.type)}{p.isCustom ? ' · your own' : ''}</span>
        </div>
        <button className="trip-row__rm" onClick={() => removePlace(tripId, p.regionId, p.placeId)} aria-label="Remove">
          <X size={16} />
        </button>
      </div>
      <div className="trip-row__summary">
        {planned
          ? <button className="trip-row__plan-meta" onClick={onPlan}>{summary}</button>
          : <button className="trip-row__plan-prompt" onClick={onPlan}>+ Pick a day, sights &amp; restaurants</button>}
      </div>
      <div className="trip-row__actions">
        <button className="trip-row__plan" onClick={onPlan}><CalendarCheck size={15} /> Plan</button>
        <button className={`trip-row__note ${hasNote ? 'is-on' : ''}`} onClick={() => setEditing((v) => !v)}>
          <StickyNote size={15} /> <span className="trip-row__notelabel">{hasNote ? 'Edit note' : 'Make note'}</span>
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
