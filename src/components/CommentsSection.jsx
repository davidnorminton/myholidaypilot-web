import { useEffect, useState, useCallback } from 'react'
import { MessageCircle, CornerDownRight, Trash2, Send } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  return new Date(ms).toLocaleDateString()
}

function Avatar({ name, src }) {
  if (src) return <img className="cmt__avatar" src={src} alt="" referrerPolicy="no-referrer" />
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
  return <span className="cmt__avatar cmt__avatar--ph">{initials || '?'}</span>
}

export default function CommentsSection({ countryId, targetType, regionId, placeId, areaName }) {
  const { user, isAdmin } = useAuth()
  const [list, setList] = useState(null) // null = loading, [] = loaded, false = error
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.comments.list({ countryId, targetType, regionId, placeId })
      .then(setList).catch(() => setList(false))
  }, [countryId, targetType, regionId, placeId])
  useEffect(() => { setList(null); setReplyTo(null); load() }, [load])

  const items = Array.isArray(list) ? list : []
  const tops = items.filter((c) => !c.parentId)
  const repliesOf = (id) => items.filter((c) => c.parentId === id)

  async function post(body, parentId) {
    if (!body.trim() || busy) return
    setBusy(true)
    try {
      await api.comments.add(parentId ? { parentId, body } : { countryId, targetType, regionId, placeId, body })
      if (parentId) { setReplyText(''); setReplyTo(null) } else setText('')
      load()
    } catch (e) { alert(e.message || 'Could not post comment') }
    finally { setBusy(false) }
  }
  async function remove(id) {
    if (!confirm('Delete this comment?')) return
    try { await api.comments.remove(id); load() } catch (e) { alert(e.message) }
  }

  return (
    <section className="cmt">
      <h2 className="cmt__h"><MessageCircle size={18} /> Comments{items.length ? ` (${items.length})` : ''}</h2>

      {user ? (
        <div className="cmt__compose">
          <Avatar name={user.name} src={user.picture} />
          <div className="cmt__composebox">
            <textarea className="cmt__input" rows={2} maxLength={4000}
              placeholder={`Share a tip about ${areaName || 'this place'}…`}
              value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn btn--primary cmt__send" disabled={!text.trim() || busy} onClick={() => post(text)}>
              <Send size={14} /> Post
            </button>
          </div>
        </div>
      ) : (
        <p className="cmt__signin">Sign in (top right) to join the conversation.</p>
      )}

      {list === null && <p className="cmt__muted">Loading comments…</p>}
      {list === false && <p className="cmt__muted">Comments aren’t available right now.</p>}
      {Array.isArray(list) && tops.length === 0 && <p className="cmt__muted">No comments yet — be the first.</p>}

      <ul className="cmt__list">
        {tops.map((c) => (
          <li key={c.id} className="cmt__item">
            <Comment c={c} canDelete={user && (c.userId === user.sub || isAdmin)} onDelete={() => remove(c.id)}
              onReply={user ? () => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText('') } : null} />

            {replyTo === c.id && (
              <div className="cmt__replybox">
                <textarea className="cmt__input" rows={2} maxLength={4000} autoFocus
                  placeholder="Write a reply…" value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                <div className="cmt__replyactions">
                  <button className="btn btn--soft" onClick={() => setReplyTo(null)}>Cancel</button>
                  <button className="btn btn--primary" disabled={!replyText.trim() || busy} onClick={() => post(replyText, c.id)}>Reply</button>
                </div>
              </div>
            )}

            {repliesOf(c.id).length > 0 && (
              <ul className="cmt__replies">
                {repliesOf(c.id).map((r) => (
                  <li key={r.id}>
                    <Comment c={r} reply canDelete={user && (r.userId === user.sub || isAdmin)} onDelete={() => remove(r.id)} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Comment({ c, reply, canDelete, onReply, onDelete }) {
  return (
    <div className={`cmt__c ${reply ? 'cmt__c--reply' : ''}`}>
      <Avatar name={c.authorName} src={c.authorPicture} />
      <div className="cmt__bodywrap">
        <p className="cmt__meta">
          <span className="cmt__name">{c.authorName || 'Guest'}</span>
          <span className="cmt__time">{timeAgo(c.createdAt)}</span>
        </p>
        <p className="cmt__text">{c.body}</p>
        <div className="cmt__actions">
          {onReply && <button className="cmt__act" onClick={onReply}><CornerDownRight size={13} /> Reply</button>}
          {canDelete && <button className="cmt__act cmt__act--del" onClick={onDelete}><Trash2 size={13} /> Delete</button>}
        </div>
      </div>
    </div>
  )
}
