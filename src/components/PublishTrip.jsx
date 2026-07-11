import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Globe2, RefreshCw, Check, ExternalLink, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { paths } from '../lib/paths.js'
import { getImages } from '../lib/data.js'
import { useAuth, GoogleSignInButton } from '../lib/auth.jsx'

// Publish a trip to the public gallery. The server snapshots the SYNCED copy
// of the trip and sanitises it (relative days, no addresses, no personal
// fields) — so what strangers see is decided server-side, not here.
export default function PublishTrip({ trip, onClose }) {
  const { user } = useAuth()
  const [mine, setMine] = useState(undefined)      // my publications
  const [attribution, setAttribution] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)           // slug after publish
  const [covers, setCovers] = useState([])         // {regionId, placeId, name, url}
  const [cover, setCover] = useState(null)
  const [dayNotes, setDayNotes] = useState({})

  useEffect(() => {
    if (!user) { setMine([]); return }
    let on = true
    api.gallery.mine().then((rows) => on && setMine(rows || [])).catch(() => on && setMine([]))
    return () => { on = false }
  }, [user])

  // Cover candidates: the trip's places that have a resolvable photo.
  useEffect(() => {
    let on = true
    getImages(trip.countryId || 'italy').then((all) => {
      if (!on) return
      const out = trip.places
        .map((p) => ({ regionId: p.regionId, placeId: p.placeId, name: p.name,
          url: all?.[p.regionId]?.[p.placeId]?.[0]?.url || p.image || '' }))
        .filter((c) => c.url)
      setCovers(out)
      if (out.length) setCover({ regionId: out[0].regionId, placeId: out[0].placeId })
    }).catch(() => {})
    return () => { on = false }
  }, [trip])

  // The trip's planned days, for optional author notes.
  const noteDays = (() => {
    if (!trip.startDate) return []
    const out = []
    const start = new Date(trip.startDate + 'T12:00')
    const end = trip.endDate ? new Date(trip.endDate + 'T12:00') : start
    for (let d = new Date(start), n = 1; d <= end && n <= 21; d.setDate(d.getDate() + 1), n++) {
      const iso = d.toISOString().slice(0, 10)
      const has = trip.places.some((p) => p.date === iso ||
        (p.attractions || []).some((x) => x.date === iso) || (p.restaurants || []).some((x) => x.date === iso))
      if (has) out.push(n)
    }
    return out
  })()

  const existing = (mine || []).find((m) => m.tripId === trip.id)
  const slug = done || existing?.slug

  const publish = async () => {
    setBusy(true); setError('')
    try {
      const res = await api.gallery.publish(trip.id, attribution, cover, dayNotes)
      setDone(res.slug)
      const rows = await api.gallery.mine().catch(() => null)
      if (rows) setMine(rows)
    } catch (e) {
      setError(e.message || 'Could not publish')
    } finally { setBusy(false) }
  }

  const unpublish = async () => {
    setBusy(true); setError('')
    try {
      await api.gallery.unpublish(trip.id)
      setDone(null)
      setMine((rows) => (rows || []).filter((m) => m.tripId !== trip.id))
    } catch (e) {
      setError(e.message || 'Could not unpublish')
    } finally { setBusy(false) }
  }

  const dated = trip.places.filter((p) => p.date).length

  return createPortal(
    <div className="pk__backdrop" onClick={onClose}>
      <div className="pk pub" role="dialog" aria-label="Publish to gallery" onClick={(e) => e.stopPropagation()}>
        <header className="pk__head">
          <h2><Globe2 size={19} /> Publish to the gallery</h2>
          <button className="pk__x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        {!user ? (
          <div className="pub__body">
            <p className="pub__lede">
              Publishing to the gallery needs a free account — it's how the gallery credits your
              trip and lets you update or unpublish it later. Your trip is safe in this browser
              either way, and signing in also syncs it across your devices.
            </p>
            <div className="pub__signin"><GoogleSignInButton /></div>
          </div>
        ) : (
        <div className="pub__body">
          <p className="pub__lede">
            Share this itinerary as a public trip idea that anyone can browse and copy.
            Your dates become relative day numbers, and stay addresses, notes about travel,
            packing and budget stay private — only the plan itself is shown.
          </p>

          <ul className="pub__facts">
            <li><Check size={14} /> {trip.places.length} place{trip.places.length === 1 ? '' : 's'}, {dated} with days planned</li>
            <li><Check size={14} /> {trip.story?.text ? 'Includes your trip story' : 'No story yet — one makes it far more inviting'}</li>
          </ul>

          {covers.length > 1 && (
            <div className="pub__covers">
              <p className="pub__sectionlabel">Cover photo</p>
              <div className="pub__covergrid">
                {covers.slice(0, 8).map((c) => {
                  const on = cover && cover.placeId === c.placeId && cover.regionId === c.regionId
                  return (
                    <button key={`${c.regionId}/${c.placeId}`} className={`pub__cover ${on ? 'is-on' : ''}`}
                      onClick={() => setCover({ regionId: c.regionId, placeId: c.placeId })} title={c.name}>
                      <img src={c.url} alt={c.name} loading="lazy" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {noteDays.length > 0 && (
            <div className="pub__daynotes">
              <p className="pub__sectionlabel">Day notes <em>optional — a personal line under each day</em></p>
              {noteDays.map((n) => (
                <label key={n} className="pub__daynote">
                  <span>Day {n}</span>
                  <input maxLength={200} value={dayNotes[n] || ''} placeholder="e.g. Go early — the queue by 10am is brutal"
                    onChange={(e) => setDayNotes((d) => ({ ...d, [n]: e.target.value }))} />
                </label>
              ))}
            </div>
          )}

          {!existing && !done && (
            <label className="pub__attr">
              <input type="checkbox" checked={attribution} onChange={(e) => setAttribution(e.target.checked)} />
              Show my first name as the author (otherwise “by a traveller”)
            </label>
          )}

          {error && <p className="pk__warn">{error}</p>}

          <div className="pub__actions">
            {slug ? (
              <>
                <Link className="btn btn--primary" to={paths.galleryTrip(slug)} onClick={onClose}>
                  <ExternalLink size={15} /> View in gallery
                </Link>
                <button className="btn btn--soft" onClick={publish} disabled={busy || mine === undefined}>
                  {busy ? <RefreshCw size={14} className="pk__spin" /> : <RefreshCw size={14} />} Update snapshot
                </button>
                <button className="btn btn--soft pub__un" onClick={unpublish} disabled={busy}>
                  <EyeOff size={14} /> Unpublish
                </button>
              </>
            ) : (
              <button className="btn btn--primary" onClick={publish} disabled={busy || mine === undefined || !trip.places.length}>
                {busy ? <><RefreshCw size={15} className="pk__spin" /> Publishing…</> : <><Globe2 size={15} /> Publish this trip</>}
              </button>
            )}
          </div>

          {slug && <p className="pub__note">Published trips are a snapshot — edit your trip freely, then “Update snapshot” when you want the gallery to catch up.</p>}
        </div>
        )}
      </div>
    </div>,
    document.body
  )
}
