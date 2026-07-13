import { useEffect, useState } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react'
import { api } from '../../lib/api.js'

// Makes the dual-store drift visible: for each built country, compares the
// last change in the builder DB against the exportedAt stamp baked into
// public/data/<country>/index.json. DB-ahead = edits (including Scan
// deletions) that visitors can't see until you Export → replace → deploy.
const ago = (ms) => {
  if (!ms) return ''
  const m = Math.round((Date.now() - ms) / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function AdminFreshness() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const builds = await api.builder.list()
        const out = await Promise.all((builds || []).map(async (b) => {
          let exportedAt = null, baked = false
          try {
            const r = await fetch(`/data/${b.countryId}/index.json`, { cache: 'no-cache' })
            if (r.ok) {
              baked = true
              const j = await r.json()
              exportedAt = j.exportedAt ? Date.parse(j.exportedAt) : null
            }
          } catch { /* no bake */ }
          const state = !baked ? 'none'
            : !exportedAt ? 'unknown'
            : b.lastChange > exportedAt ? 'ahead'
            : 'ok'
          return { id: b.countryId, name: b.name, flag: b.flag, lastChange: b.lastChange, exportedAt, state }
        }))
        if (live) setRows(out.sort((a, z) => (a.state === 'ahead' ? -1 : 1) - (z.state === 'ahead' ? -1 : 1)))
      } catch { if (live) setRows([]) }
    })()
    return () => { live = false }
  }, [])

  if (!rows) return null
  if (!rows.length) return null
  const stale = rows.filter((r) => r.state === 'ahead').length

  return (
    <section className="fresh">
      <h3 className="admin-h3">Export freshness</h3>
      <p className="admin-note">
        {stale
          ? `${stale} countr${stale === 1 ? 'y has' : 'ies have'} DB changes the live site can't see — Export → replace public/data → deploy.`
          : 'Every built country\u2019s bake matches the builder DB.'}
      </p>
      <div className="fresh__rows">
        {rows.map((r) => (
          <div key={r.id} className={`fresh__row fresh__row--${r.state}`}>
            <span className="fresh__name">{r.flag ? `${r.flag} ` : ''}{r.name}</span>
            {r.state === 'ok' && <span className="fresh__state"><CheckCircle2 size={14} /> Up to date</span>}
            {r.state === 'ahead' && <span className="fresh__state"><AlertTriangle size={14} /> DB ahead — changed {ago(r.lastChange)}, exported {ago(r.exportedAt)}</span>}
            {r.state === 'unknown' && <span className="fresh__state"><CircleDashed size={14} /> Bake predates tracking — re-export once to enable</span>}
            {r.state === 'none' && <span className="fresh__state"><RefreshCw size={14} /> Never exported</span>}
          </div>
        ))}
      </div>
    </section>
  )
}
