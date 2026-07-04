import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Globe2, RefreshCw, Check, ExternalLink, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { paths } from '../lib/paths.js'

// Publish a trip to the public gallery. The server snapshots the SYNCED copy
// of the trip and sanitises it (relative days, no addresses, no personal
// fields) — so what strangers see is decided server-side, not here.
export default function PublishTrip({ trip, onClose }) {
  const [mine, setMine] = useState(undefined)      // my publications
  const [attribution, setAttribution] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)           // slug after publish

  useEffect(() => {
    let on = true
    api.gallery.mine().then((rows) => on && setMine(rows || [])).catch(() => on && setMine([]))
    return () => { on = false }
  }, [])

  const existing = (mine || []).find((m) => m.tripId === trip.id)
  const slug = done || existing?.slug

  const publish = async () => {
    setBusy(true); setError('')
    try {
      const res = await api.gallery.publish(trip.id, attribution)
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
      </div>
    </div>,
    document.body
  )
}
