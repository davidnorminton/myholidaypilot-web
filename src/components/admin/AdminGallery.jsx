import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Eye, EyeOff, Trash2, RefreshCw, ExternalLink } from 'lucide-react'
import { api } from '../../lib/api.js'
import { paths } from '../../lib/paths.js'

// Moderation for the public trip gallery: feature the best, hide the junk,
// remove the unacceptable. Hidden trips stay in the table (the owner can see
// theirs); removed ones are gone.
export default function AdminGallery() {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState('')

  const load = () => {
    setRows(null)
    api.gallery.adminList().then(setRows).catch(() => setRows(false))
  }
  useEffect(load, [])

  const patch = async (id, p) => {
    setBusy(id)
    try { await api.gallery.adminPatch(id, p); load() } catch (e) { alert(e.message) } finally { setBusy('') }
  }
  const remove = async (id, title) => {
    if (!confirm(`Remove “${title}” from the gallery permanently?`)) return
    setBusy(id)
    try { await api.gallery.adminRemove(id); load() } catch (e) { alert(e.message) } finally { setBusy('') }
  }

  if (rows === null) return <p className="admin-empty">Loading gallery…</p>
  if (rows === false) return <p className="admin-empty">Couldn't load the gallery — are you signed in as an admin?</p>
  if (!rows.length) return <p className="admin-empty">Nothing published yet. Publish one of your own trips from the planner to seed the gallery.</p>

  return (
    <div className="admin-gal">
      <p className="admin-note">{rows.length} publication{rows.length === 1 ? '' : 's'} · featured trips lead the gallery</p>
      <table className="admin-gal__table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.status === 'hidden' ? 'is-hidden' : ''}>
              <td>
                <b>{r.title}</b>
                <span className="admin-gal__meta">
                  {r.days}d · {r.placeCount} places · {r.authorName || 'anonymous'} · copied {r.copies}×
                </span>
              </td>
              <td className="admin-gal__acts">
                <Link to={paths.galleryTrip(r.slug)} title="View live"><ExternalLink size={15} /></Link>
                <button title={r.featured ? 'Unfeature' : 'Feature'} className={r.featured ? 'is-on' : ''}
                  disabled={busy === r.id} onClick={() => patch(r.id, { featured: !r.featured })}>
                  <Star size={15} />
                </button>
                <button title={r.status === 'hidden' ? 'Unhide' : 'Hide from gallery'}
                  disabled={busy === r.id} onClick={() => patch(r.id, { status: r.status === 'hidden' ? 'live' : 'hidden' })}>
                  {r.status === 'hidden' ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button title="Remove permanently" className="admin-gal__del"
                  disabled={busy === r.id} onClick={() => remove(r.id, r.title)}>
                  {busy === r.id ? <RefreshCw size={15} className="pk__spin" /> : <Trash2 size={15} />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
