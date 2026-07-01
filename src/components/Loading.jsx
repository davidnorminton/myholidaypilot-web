export function CardSkeletons({ count = 8, kind = 'r' }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className={`skel skel--${kind}`}>
      <div className="skel__media shimmer" />
      <div className="skel__line shimmer" style={{ width: '70%' }} />
      <div className="skel__line shimmer" style={{ width: '45%' }} />
    </div>
  ))
}

export function PageLoader({ label = 'Loading' }) {
  return <div className="page-loader"><span className="spinner" />{label}…</div>
}
