import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarRange, Heart, MessageSquare, ArrowRight,
  MapPin, FileDown, Plus, Map as MapIcon,
} from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useTrips } from '../lib/trips.js'
import { useFavourites } from '../lib/favourites.js'
import { getPlacesIndex } from '../lib/data.js'
import { COUNTRIES } from '../lib/countries.js'
import { api } from '../lib/api.js'
// PDF generation (jspdf + html2canvas, ~760K) loads only when asked for
const downloadTripPdf = async (...a) => (await import('../lib/tripPdf.js')).downloadTripPdf(...a)
import { paths } from '../lib/paths.js'
import { useSeo } from '../lib/seo.js'
import BeenThereMap from '../components/BeenThereMap.jsx'

const fmtDate = (d) => (d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
const fmtTs = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trips', label: 'My trips', icon: CalendarRange },
  { id: 'saved', label: 'Saved places', icon: Heart },
  { id: 'comments', label: 'My comments', icon: MessageSquare },
  { id: 'map', label: 'Travel map', icon: MapIcon },
]

export default function AccountScreen() {
  const { section = 'overview' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const snap = useTrips()
  const { ids: favIds } = useFavourites()
  useSeo({ title: 'My home', description: 'Your trips, saved places and comments in one place.', path: '/account' })

  const [index, setIndex] = useState([])
  const [myComments, setMyComments] = useState(null)
  useEffect(() => {
    const avail = COUNTRIES.filter((c) => c.available).map((c) => c.slug)
    Promise.all(avail.map((slug) =>
      getPlacesIndex(slug).then((rows) => rows.map((p) => ({ ...p, countryId: slug }))).catch(() => [])
    )).then((lists) => setIndex(lists.flat()))
  }, [])
  useEffect(() => {
    let on = true
    api.comments.mine().then((r) => { if (on) setMyComments(r || []) }).catch(() => { if (on) setMyComments([]) })
    return () => { on = false }
  }, [])

  const byKey = useMemo(() => Object.fromEntries(index.map((p) => [`${p.regionId}/${p.placeId}`, p])), [index])
  const savedPlaces = useMemo(() => [...favIds].map((k) => byKey[k]).filter(Boolean), [favIds, byKey])
  const coverOf = (t) => {
    for (const p of t.places) { const u = byKey[`${p.regionId}/${p.placeId}`]?.image; if (u) return u }
    return null
  }
  const imgOf = (p) => byKey[`${p.regionId}/${p.placeId}`]?.image || p.image || null

  const active = SECTIONS.some((x) => x.id === section) ? section : 'overview'

  return (
    <div className="page wrap account">
      <header className="account__head">
        {user?.picture
          ? <img className="account__avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
          : <span className="account__avatar account__avatar--initial">{(user?.name || '?')[0]}</span>}
        <div>
          <h1 className="account__title">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
          <p className="account__sub">{user?.email}</p>
        </div>
      </header>

      <div className="account__layout">
        <nav className="account__nav" aria-label="Account sections">
          {SECTIONS.map((s) => (
            <button key={s.id} className={`account__navitem ${active === s.id ? 'is-on' : ''}`}
              onClick={() => navigate(`/account/${s.id}`)}>
              <s.icon size={16} /> {s.label}
              {s.id === 'trips' && snap.trips.length > 0 && <em>{snap.trips.length}</em>}
              {s.id === 'saved' && savedPlaces.length > 0 && <em>{savedPlaces.length}</em>}
              {s.id === 'comments' && (myComments?.length || 0) > 0 && <em>{myComments.length}</em>}
            </button>
          ))}
        </nav>

        <div className="account__content">
          {active === 'overview' && (
            <Overview trips={snap.trips} saved={savedPlaces} comments={myComments} coverOf={coverOf} navigate={navigate} />
          )}
          {active === 'trips' && <TripsPanel trips={snap.trips} activeId={snap.activeTripId} coverOf={coverOf} />}
          {active === 'saved' && <SavedPanel places={savedPlaces} imgOf={imgOf} />}
          {active === 'comments' && <CommentsPanel comments={myComments} byKey={byKey} />}
          {active === 'map' && <BeenThereMap />}
        </div>
      </div>
    </div>
  )
}

function Overview({ trips, saved, comments, coverOf, navigate }) {
  const stats = [
    { label: trips.length === 1 ? 'trip' : 'trips', value: trips.length, to: '/account/trips' },
    { label: saved.length === 1 ? 'saved place' : 'saved places', value: saved.length, to: '/account/saved' },
    { label: comments === null ? 'comments' : comments.length === 1 ? 'comment' : 'comments', value: comments === null ? '…' : comments.length, to: '/account/comments' },
  ]
  const recent = [...trips].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 3)
  return (
    <div>
      <div className="account__stats">
        {stats.map((s, i) => (
          <button key={i} className="account__stat" onClick={() => navigate(s.to)}>
            <b>{s.value}</b><span>{s.label}</span>
          </button>
        ))}
      </div>

      <h2 className="account__h2">Recent trips</h2>
      {recent.length === 0 ? (
        <p className="account__empty">No trips yet — <Link to={paths.plan()}>start planning</Link> and they'll appear here.</p>
      ) : (
        <div className="account__triplist">
          {recent.map((t) => <TripRow key={t.id} t={t} coverOf={coverOf} />)}
        </div>
      )}
      <p className="account__more"><Link to={paths.plan()}>Open the planner <ArrowRight size={14} /></Link></p>
    </div>
  )
}

function TripRow({ t, coverOf }) {
  const cover = coverOf(t)
  return (
    <div className="account__trip">
      {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="account__trip-ph"><MapPin size={16} /></span>}
      <div className="account__trip-main">
        <Link to={paths.plan()} className="account__trip-name">{t.name}</Link>
        <span className="account__trip-meta">
          {t.startDate ? `${fmtDate(t.startDate)} – ${fmtDate(t.endDate || t.startDate)} · ` : ''}
          {t.places.length} place{t.places.length === 1 ? '' : 's'}
        </span>
      </div>
      <button className="account__trip-act" onClick={() => downloadTripPdf(t)} title="Download PDF"><FileDown size={15} /></button>
    </div>
  )
}

function TripsPanel({ trips, coverOf }) {
  if (!trips.length) {
    return <p className="account__empty">No trips yet — <Link to={paths.plan()}>start one in the planner</Link>.</p>
  }
  return (
    <div>
      <div className="account__triplist">
        {trips.map((t) => <TripRow key={t.id} t={t} coverOf={coverOf} />)}
      </div>
      <p className="account__more">
        <Link to={paths.trips()}>Manage trips <ArrowRight size={14} /></Link>
        <Link to={paths.plan()}><Plus size={14} /> Plan a trip</Link>
      </p>
    </div>
  )
}

function SavedPanel({ places, imgOf }) {
  if (!places.length) {
    return <p className="account__empty">Nothing saved yet — tap the heart on any place to keep it here.</p>
  }
  return (
    <div>
      <div className="account__savedgrid">
        {places.map((p) => (
          <Link key={`${p.regionId}/${p.placeId}`} to={paths.place(p.regionId, p.placeId, p.countryId)} className="account__saved">
            {imgOf(p) && <img src={imgOf(p)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
            <span className="account__saved-name">{p.name}</span>
            <span className="account__saved-region">{p.regionName}</span>
          </Link>
        ))}
      </div>
      <p className="account__more"><Link to={paths.saved()}>Open saved places <ArrowRight size={14} /></Link></p>
    </div>
  )
}

function CommentsPanel({ comments, byKey }) {
  if (comments === null) return <p className="account__empty">Loading your comments…</p>
  if (!comments.length) return <p className="account__empty">No comments yet — join the conversation on any region or place page.</p>
  return (
    <ul className="account__comments">
      {comments.map((c) => {
        const place = c.placeId ? byKey[`${c.regionId}/${c.placeId}`] : null
        const to = c.targetType === 'place' && c.placeId ? paths.place(c.regionId, c.placeId, c.countryId || 'italy') : paths.region(c.regionId, c.countryId || 'italy')
        const where = place ? `${place.name}, ${place.regionName}` : c.regionId.replace(/-/g, ' ')
        return (
          <li key={c.id} className="account__comment">
            <p className="account__comment-body">“{c.body}”</p>
            <span className="account__comment-meta">
              on <Link to={to}>{where}</Link> · {fmtTs(c.createdAt)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
