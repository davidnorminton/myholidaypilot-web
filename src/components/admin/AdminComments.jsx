import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Trash2, RefreshCw, ExternalLink } from 'lucide-react'
import { api } from '../../lib/api.js'

const when = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// Comment moderation: everything, newest first. Hide is reversible (the
// thread keeps its shape); delete is permanent and takes replies with it.
export default function AdminComments() {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState('')

  const load = () => { setRows(null); api.commentsAdmin.list().then(setRows).catch(() => setRows(false)) }
  useEffect(load, [])

  const setStatus = async (id, status) => {
    setBusy(id)
    try { await api.commentsAdmin.setStatus(id, status); load() } catch (e) { alert(e.message) } finally { setBusy('') }
  }
  const remove = async (id) => {
    if (!confirm('Delete this comment (and its replies) permanently?')) return
    setBusy(id)
    try { await api.commentsAdmin.remove(id); load() } catch (e) { alert(e.message) } finally { setBusy('') }
  }

  if (rows === null) return <p className="admin-empty">Loading comments…</p>
  if (rows === false) return <p className="admin-empty">Couldn't load comments.</p>
  if (!rows.length) return <p className="admin-empty">No comments yet.</p>

  return (
    <div className="admin-gal">
      <p className="admin-note">{rows.length} most recent · hidden comments stay out of public threads</p>
      <table className="admin-gal__table">
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className={c.status === 'hidden' ? 'is-hidden' : ''}>
              <td>
                <b>{c.authorName || 'Unknown'} <span className="admin-gal__meta" style={{display:'inline'}}>· {when(c.createdAt)}{c.parentId ? ' · reply' : ''}</span></b>
                <span className="admin-cmt__body">{c.body.slice(0, 220)}{c.body.length > 220 ? '…' : ''}</span>
                <span className="admin-gal__meta">
                  on <Link to={c.targetType === 'place' ? `/${c.countryId}/${c.regionId}/${c.placeId}` : `/${c.countryId}/${c.regionId}`}>
                    {c.targetType === 'place' ? c.placeId : c.regionId} <ExternalLink size={10} />
                  </Link>
                </span>
              </td>
              <td className="admin-gal__acts">
                <button title={c.status === 'hidden' ? 'Unhide' : 'Hide'}
                  disabled={busy === c.id}
                  onClick={() => setStatus(c.id, c.status === 'hidden' ? 'visible' : 'hidden')}>
                  {c.status === 'hidden' ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button title="Delete permanently" className="admin-gal__del" disabled={busy === c.id} onClick={() => remove(c.id)}>
                  {busy === c.id ? <RefreshCw size={15} className="pk__spin" /> : <Trash2 size={15} />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
