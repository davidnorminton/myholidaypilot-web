export default function Logo({ size = 18, className = '' }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d="M24 6 L27.8 20.2 L42 24 L27.8 27.8 L24 42 L20.2 27.8 L6 24 L20.2 20.2 Z" fill="currentColor" />
      <circle cx="24" cy="24" r="2.3" fill="var(--gold)" />
    </svg>
  )
}
