import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { api } from '../lib/api.js'
import { normalize } from '../lib/blogStore.js'
import { POSTS as BUNDLED } from '../lib/blog.js'
import { paths } from '../lib/paths.js'

const PAGE = 4

// "From the blog" on the home page — styled identically to the Featured
// destinations row (same classes), with the next arrow lazily fetching more
// posts from the API as you page through.
export default function BlogCarousel() {
  const [posts, setPosts] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const scroller = useRef(null)

  useEffect(() => {
    let live = true
    api.posts.page(PAGE, 0).then((rows) => {
      if (!live) return
      const list = (rows || []).map(normalize)
      if (list.length) { setPosts(list); setHasMore(rows.length === PAGE) }
      else { setPosts(BUNDLED.map(normalize)); setHasMore(false) }
    }).catch(() => { if (live) { setPosts(BUNDLED.map(normalize)); setHasMore(false) } })
    return () => { live = false }
  }, [])

  const loadMore = async () => {
    if (loading || !hasMore || !posts) return
    setLoading(true)
    try {
      const rows = await api.posts.page(PAGE, posts.length)
      const more = (rows || []).map(normalize)
      setPosts((p) => [...p, ...more])
      setHasMore(more.length === PAGE)
    } catch { setHasMore(false) }
    finally { setLoading(false) }
  }

  const nudge = async (dir) => {
    const el = scroller.current
    if (!el) return
    // paging forward near the end? fetch the next batch first so it's there
    if (dir > 0 && hasMore && el.scrollLeft + el.clientWidth >= el.scrollWidth - el.clientWidth) {
      await loadMore()
    }
    const card = el.querySelector('.featured__card')
    const step = card ? card.offsetWidth + 18 : 340
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  if (!posts || posts.length === 0) return null
  return (
    <section className="wrap featured">
      <div className="featured__head">
        <h2 className="featured__title">From the blog</h2>
        <div className="featured__ctrls">
          <Link to={paths.blog()} className="featured__viewall">View all</Link>
          <button type="button" className="featured__arrow" onClick={() => nudge(-1)} aria-label="Scroll back"><ArrowLeft size={18} /></button>
          <button type="button" className="featured__arrow featured__arrow--fill" onClick={() => nudge(1)} aria-label="Scroll forward" disabled={loading}><ArrowRight size={18} /></button>
        </div>
      </div>
      <div className="featured__scroller" ref={scroller}>
        {posts.map((p) => (
          <Link key={p.slug} to={paths.post(p.slug)} className="featured__card">
            <div className="featured__media">
              {p.cover ? <img src={p.cover} alt="" loading="lazy" /> : <span className="featured__blank" />}
            </div>
            <p className="featured__kicker">{p.tag || 'Journal'}</p>
            <h3 className="featured__name featured__name--post">{p.title}</h3>
            <span className="featured__cta">Read</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
