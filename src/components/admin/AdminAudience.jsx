import { useEffect, useState } from 'react'
import { Download, RefreshCw, Mail } from 'lucide-react'
import { api } from '../../lib/api.js'

export default function AdminAudience() {
  const [rows, setRows] = useState(null) // null=loading, []=ok, false=error
  const load = () => { setRows(null); api.subscribe.list().then(setRows).catch(() => setRows(false)) }
  useEffect(() => { load() }, [])

  const csv = () => {
    const text = 'email,subscribed_at\n' + rows.map((r) => `${r.email},${new Date(r.createdAt).toISOString()}`).join('\n')
    const blob = new Blob([text], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'subscribers.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (rows === false) return <p className="admin-empty">Couldn’t load subscribers. <button className="btn btn--soft" onClick={load}><RefreshCw size={14} /> Retry</button></p>
  if (rows === null) return <p className="admin-empty">Loading…</p>

  return (
    <div className="cms">
      <ul className="seo-stats"><li><b>{rows.length}</b> subscribers</li></ul>
      {rows.length > 0 && (
        <div className="admin__bar"><button className="btn btn--primary" onClick={csv}><Download size={15} /> Download CSV</button></div>
      )}
      <ul className="admin-rows">
        {rows.map((r) => (
          <li key={r.email} className="admin-row">
            <span className="admin-row__thumb admin-row__thumb--blank" style={{ display: 'grid', placeItems: 'center' }}><Mail size={16} /></span>
            <div className="admin-row__main">
              <span className="admin-row__title">{r.email}</span>
              <span className="admin-row__meta">{new Date(r.createdAt).toLocaleDateString('en-GB')}</span>
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="admin-empty">No subscribers yet. The signup form is in the site footer.</p>}
    </div>
  )
}
