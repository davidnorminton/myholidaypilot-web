import { useEffect, useRef, useState } from 'react'

// Reveals children when they scroll into view. Respects prefers-reduced-motion
// (no animation, just shows immediately). Returns [ref, shown].
export function useReveal(options = {}) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // reduced motion or no IntersectionObserver → show immediately
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduce || typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect() }
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px', ...options })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return [ref, shown]
}

// Wrapper: fades + slides its children up on first scroll into view.
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
  const [ref, shown] = useReveal()
  return (
    <Tag ref={ref} className={`reveal ${shown ? 'reveal--in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  )
}
