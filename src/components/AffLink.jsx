import { ExternalLink } from 'lucide-react'

// A single, clearly-marked affiliate line — the only ad format allowed
// inside the planner.
export default function AffLink({ href, children }) {
  if (!href) return null
  return (
    <p className="aff-line">
      <a href={href} target="_blank" rel="noreferrer sponsored">{children} <ExternalLink size={11} /></a>
      <span className="aff-line__ad">ad</span>
    </p>
  )
}

// A one-line, multi-provider offer: "Experiences & tickets in X: GetYourGuide · Viator …"
export function AffProviders({ title, providers }) {
  const live = (providers || []).filter((p) => p.url)
  if (!live.length) return null
  return (
    <p className="aff-line aff-line--providers">
      <span className="aff-line__title">{title}</span>
      {live.map((pr, i) => (
        <span key={pr.id || i}>
          <a href={pr.url} target="_blank" rel="noreferrer sponsored">{pr.name} <ExternalLink size={10} /></a>
          {i < live.length - 1 && <i className="aff-line__sep">·</i>}
        </span>
      ))}
      <span className="aff-line__ad">ad</span>
    </p>
  )
}
