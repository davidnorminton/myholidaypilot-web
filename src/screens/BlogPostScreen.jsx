import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageLoader } from '../components/Loading.jsx'
import SmartImage from '../components/SmartImage.jsx'
import { usePost, usePublishedPosts } from '../lib/blogStore.js'
import { useSeo } from '../lib/seo.js'
import { paths } from '../lib/paths.js'

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

export default function BlogPostScreen() {
  const { slug } = useParams()
  const post = usePost(slug)
  const allPosts = usePublishedPosts()
  const more = (allPosts || []).filter((p) => p.slug !== slug).slice(0, 3)

  useSeo({
    title: post?.title,
    description: post?.excerpt,
    path: `/blog/${slug}`,
    image: post?.cover,
    type: 'article',
    jsonLd: post ? {
      '@context': 'https://schema.org', '@type': 'Article', headline: post.title,
      image: post.cover || undefined, datePublished: post.date || undefined,
      author: post.author ? { '@type': 'Person', name: post.author } : undefined,
    } : undefined,
  })

  if (post === undefined) return <PageLoader label="Opening post" />
  if (post === null) {
    return (
      <div className="page wrap">
        <Link to={paths.blog()} className="back" style={{ marginTop: 24 }}><ArrowLeft size={17} /> Blog</Link>
        <p className="empty">That post could not be found.</p>
      </div>
    )
  }

  return (
    <article className="page post">
      {post.cover && (
        <div className="post__hero">
          <SmartImage src={post.cover} alt={post.title} width={1200} priority />
          <div className="post__veil" />
        </div>
      )}
      <div className="wrap post__wrap">
        <Link to={paths.blog()} className="back" style={{ marginTop: 18 }}><ArrowLeft size={17} /> The blog</Link>
        {post.tag && <span className="post__tag">{post.tag}</span>}
        <h1 className="post__title">{post.title}</h1>
        <p className="post__meta">{fmt(post.date)}{post.author ? ` · ${post.author}` : ''}</p>
        <div className="post__layout">
          <div className="post__main">
            <div className="post__body prose" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
          </div>
          <aside className="post__rail">
          </aside>
        </div>

        {more.length > 0 && (
          <section className="post-more">
            <h2 className="post-more__title">More from the blog</h2>
            <div className="post-more__grid">
              {more.map((p) => (
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
            </div>
          </section>
        )}
      </div>
    </article>
  )
}
