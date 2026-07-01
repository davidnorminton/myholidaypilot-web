import { Link, useParams } from 'react-router-dom'
import AdSlot from '../components/AdSlot.jsx'
import { ArrowLeft } from 'lucide-react'
import { PageLoader } from '../components/Loading.jsx'
import { usePost } from '../lib/blogStore.js'
import { useSeo } from '../lib/seo.js'
import { paths } from '../lib/paths.js'

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

export default function BlogPostScreen() {
  const { slug } = useParams()
  const post = usePost(slug)

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
          <img src={post.cover} alt={post.title} onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <div className="post__veil" />
        </div>
      )}
      <div className="wrap post__wrap">
        <Link to={paths.blog()} className="back" style={{ marginTop: 18 }}><ArrowLeft size={17} /> The journal</Link>
        {post.tag && <span className="post__tag">{post.tag}</span>}
        <h1 className="post__title">{post.title}</h1>
        <p className="post__meta">{fmt(post.date)}{post.author ? ` · ${post.author}` : ''}</p>
        <div className="post__layout">
          <div className="post__main">
            <div className="post__body prose" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
            <AdSlot format="in-article" slot="post-inarticle" />
          </div>
          <aside className="post__rail">
            <AdSlot format="half-page" slot="post-rail" />
          </aside>
        </div>
      </div>
    </article>
  )
}
