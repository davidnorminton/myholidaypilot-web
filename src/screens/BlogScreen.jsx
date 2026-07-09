import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageLoader } from '../components/Loading.jsx'
import SmartImage from '../components/SmartImage.jsx'
import { usePublishedPosts } from '../lib/blogStore.js'
import { useSeo } from '../lib/seo.js'
import { paths } from '../lib/paths.js'

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

const BATCH = 9

export default function BlogScreen() {
  const posts = usePublishedPosts()
  useSeo({ title: 'The blog', description: 'Field notes, food and planning — short reads to make your Italy trip better.', path: '/blog' })

  // The lead article renders immediately; cards arrive nine at a time as the
  // reader nears the bottom (hooks live above the loading return).
  const [shown, setShown] = useState(BATCH)
  const moreRef = useRef(null)
  const rest = posts ? posts.slice(1) : []
  useEffect(() => {
    if (shown >= rest.length || !moreRef.current) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.min(n + BATCH, rest.length))
    }, { rootMargin: '400px' })
    io.observe(moreRef.current)
    return () => io.disconnect()
  }, [shown, rest.length])

  if (posts === null) return <PageLoader label="Loading the blog" />
  const lead = posts[0]

  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow">The blog</p>
        <h1 className="sub-hero__title">Notes from the road</h1>
        <p className="sub-hero__sub">Field notes, food and planning — short reads to make your trip better.</p>
      </header>
      <main className="wrap">
        {lead && (
          <Link to={paths.post(lead.slug)} className="post-lead">
            <div className="post-lead__media"><SmartImage src={lead.cover} alt={lead.title} width={700} priority /></div>
            <div className="post-lead__body">
              <span className="post-card__tag">{lead.tag}</span>
              <h2 className="post-lead__title">{lead.title}</h2>
              <p className="post-lead__excerpt">{lead.excerpt}</p>
              <span className="post-lead__meta">{fmt(lead.date)} · {lead.author}</span>
            </div>
          </Link>
        )}
        <div className="grid grid--posts">
          {rest.slice(0, shown).map((p) => (
            <Link key={p.slug} to={paths.post(p.slug)} className="post-card">
              <div className="post-card__media"><SmartImage src={p.cover} alt={p.title} width={400} /></div>
              <div className="post-card__body">
                <span className="post-card__tag">{p.tag}</span>
                <h3 className="post-card__title">{p.title}</h3>
                <p className="post-card__excerpt">{p.excerpt}</p>
                <span className="post-card__meta">{fmt(p.date)}</span>
              </div>
            </Link>
          ))}
          {shown < rest.length && <div ref={moreRef} className="blog-sentinel" aria-hidden />}
          </div>
      </main>
    </div>
  )
}
