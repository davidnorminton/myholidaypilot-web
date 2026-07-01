import { Link } from 'react-router-dom'
import AdSlot from '../components/AdSlot.jsx'
import { PageLoader } from '../components/Loading.jsx'
import { usePublishedPosts } from '../lib/blogStore.js'
import { useSeo } from '../lib/seo.js'
import { paths } from '../lib/paths.js'

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

export default function BlogScreen() {
  const posts = usePublishedPosts()
  useSeo({ title: 'The journal', description: 'Field notes, food and planning — short reads to make your Italy trip better.', path: '/blog' })
  if (posts === null) return <PageLoader label="Loading the journal" />
  const [lead, ...rest] = posts

  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow">The journal</p>
        <h1 className="sub-hero__title">Notes from the road</h1>
        <p className="sub-hero__sub">Field notes, food and planning — short reads to make your trip better.</p>
      </header>
      <main className="wrap">
        {lead && (
          <Link to={paths.post(lead.slug)} className="post-lead">
            <div className="post-lead__media"><img src={lead.cover} alt={lead.title} onError={(e) => { e.currentTarget.style.display = 'none' }} /></div>
            <div className="post-lead__body">
              <span className="post-card__tag">{lead.tag}</span>
              <h2 className="post-lead__title">{lead.title}</h2>
              <p className="post-lead__excerpt">{lead.excerpt}</p>
              <span className="post-lead__meta">{fmt(lead.date)} · {lead.author}</span>
            </div>
          </Link>
        )}
        {rest.length > 0 && <AdSlot format="leaderboard" slot="blog-leaderboard" />}
        <div className="grid grid--posts">
          {rest.map((p) => (
            <Link key={p.slug} to={paths.post(p.slug)} className="post-card">
              <div className="post-card__media"><img src={p.cover} alt={p.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} /></div>
              <div className="post-card__body">
                <span className="post-card__tag">{p.tag}</span>
                <h3 className="post-card__title">{p.title}</h3>
                <p className="post-card__excerpt">{p.excerpt}</p>
                <span className="post-card__meta">{fmt(p.date)}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
