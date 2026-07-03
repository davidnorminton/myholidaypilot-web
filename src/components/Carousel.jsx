import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Swipeable image carousel with arrows, dots, counter and credit caption.
 * props: images = [{ url, credit }], height
 */
export default function Carousel({ images = [], height = 460, label = '' }) {
  const [i, setI] = useState(0)
  const touch = useRef(null)
  const n = images.length
  const go = (next) => { if (n > 0) setI(() => (next + n) % n) }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(i - 1)
      if (e.key === 'ArrowRight') go(i + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, n])

  if (n === 0) return null

  const onTouchStart = (e) => { touch.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touch.current == null) return
    const dx = e.changedTouches[0].clientX - touch.current
    if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1)
    touch.current = null
  }

  return (
    <section className="carousel" style={{ height }} aria-roledescription="carousel">
      <div
        className="carousel__track"
        style={{ transform: `translateX(-${i * 100}%)` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {images.map((img, idx) => (
          <div className="carousel__slide" key={idx}>
            <img src={img.url} alt={img.credit ? `${label} — photo by ${img.credit}` : (label ? `${label} — photo ${idx + 1}` : '')} loading={idx === 0 ? 'eager' : 'lazy'} draggable="false" />
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button className="carousel__arrow carousel__arrow--prev" onClick={() => go(i - 1)} aria-label="Previous image">
            <ChevronLeft size={22} />
          </button>
          <button className="carousel__arrow carousel__arrow--next" onClick={() => go(i + 1)} aria-label="Next image">
            <ChevronRight size={22} />
          </button>
          <div className="carousel__counter">{i + 1} / {n}</div>
          <div className="carousel__dots">
            {images.map((_, idx) => (
              <button
                key={idx}
                className={`carousel__dot ${idx === i ? 'is-on' : ''}`}
                onClick={() => setI(idx)}
                aria-label={`Go to image ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {images[i]?.credit && <figcaption className="carousel__credit">Photo · {images[i].credit}</figcaption>}
    </section>
  )
}
