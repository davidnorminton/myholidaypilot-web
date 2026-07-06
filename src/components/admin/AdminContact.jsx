import { useEffect, useState } from 'react'
import { Mail, Check, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api.js'

export default function AdminContact() {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setBusy(true)
    try { setRows(await api.contact.list()) }
    catch { setRows([]) } finally { setBusy(false) }
  }
  useEffect(() => { load() }, [])

  const toggle = async (m) => {
    try {
      await api.contact.setHandled(m.id, m.handled ? 0 : 1)
      setRows((prev) => prev.map((r) => (r.id === m.id ? { ...r, handled: m.handled ? 0 : 1 } : r)))
    } catch { /* ignore */ }
  }

  const unhandled = (rows || []).filter((r) => !r.handled).length

  return (
    <div>
      <div className="mi__head">
        <div>
          <h3 className="admin-h3" style={{ margin: 0 }}>Contact messages</h3>
          <p className="admin-note" style={{ margin: '4px 0 0' }}>
            {busy ? 'Loading…' : rows && rows.length ? `${rows.length} message${rows.length === 1 ? '' : 's'} · ${unhandled} unread` : 'No messages yet.'}
          </p>
        </div>
        <button className="btn btn--soft" onClick={load} disabled={busy}>
          <RefreshCw size={14} className={busy ? 'pk__spin' : ''} /> Refresh
        </button>
      </div>

      <div className="cmsg__list">
        {(rows || []).map((m) => (
          <div key={m.id} className={`cmsg ${m.handled ? 'is-handled' : ''}`}>
            <div className="cmsg__top">
              <div>
                <span className="cmsg__name">{m.name}</span>
                <a className="cmsg__email" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || 'your message')}`}>{m.email}</a>
              </div>
              <button className={`cmsg__mark ${m.handled ? 'is-on' : ''}`} onClick={() => toggle(m)}
                title={m.handled ? 'Mark unread' : 'Mark handled'}>
                <Check size={14} /> {m.handled ? 'Handled' : 'Mark handled'}
              </button>
            </div>
            {m.subject && <div className="cmsg__subject">{m.subject}</div>}
            <p className="cmsg__body">{m.body}</p>
            <div className="cmsg__meta">
              <Mail size={12} /> {new Date(m.createdAt).toLocaleString('en-GB')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
