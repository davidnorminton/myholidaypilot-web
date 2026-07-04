import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'

// The pulse row: one glance at the whole site.
export default function AdminStats() {
  const [s, setS] = useState(null)
  useEffect(() => { api.stats().then(setS).catch(() => setS(false)) }, [])
  if (!s) return null
  const items = [
    ['Users', s.users], ['Trips', s.trips], ['Published posts', s.posts],
    ['Trip ideas', s.publications], ['Comments', s.comments, s.hiddenComments ? `${s.hiddenComments} hidden` : null],
    ['Subscribers', s.subscribers], ['Regions ticked', s.regionVisits],
  ]
  return (
    <div className="admin-stats">
      {items.map(([label, n, note]) => (
        <div key={label} className="admin-stats__item">
          <b>{n}</b><span>{label}</span>{note && <em>{note}</em>}
        </div>
      ))}
    </div>
  )
}
