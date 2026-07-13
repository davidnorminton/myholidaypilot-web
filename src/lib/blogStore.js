import { useEffect, useState } from 'react'
import { POSTS as BUNDLED } from './blog.js'
import { api } from './api.js'

// Posts store body as an HTML string (new) or a paragraph array (bundled/seeded).
import DOMPurify from 'dompurify'

// All blog body HTML passes through DOMPurify before it can reach
// dangerouslySetInnerHTML — admin-authored today, but AI-drafted content
// flows through here too, and sanitising at the source covers every render.
export function bodyToHtml(body) {
  const raw = Array.isArray(body) ? body.map((p) => `<p>${p}</p>`).join('\n') : String(body || '')
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
}

// Normalise a DB row OR a bundled post into one shape the blog screens use.
export function normalize(p) {
  const ms = p.publishedAt || (p.date ? Date.parse(p.date) : null)
  return {
    slug: p.slug,
    title: p.title,
    tag: p.tag || '',
    author: p.author || '',
    cover: p.coverImage || p.cover || '',
    excerpt: p.dek || p.excerpt || '',
    date: ms ? new Date(ms).toISOString().slice(0, 10) : (p.date || ''),
    bodyHtml: bodyToHtml(p.body),
    status: p.status || 'published',
  }
}

export function usePublishedPosts() {
  const [posts, setPosts] = useState(null) // null = loading
  useEffect(() => {
    let live = true
    api.posts.list().then((rows) => {
      if (!live) return
      const list = (rows || []).map(normalize)
      setPosts(list.length ? list : BUNDLED.map(normalize))
    }).catch(() => live && setPosts(BUNDLED.map(normalize)))
    return () => { live = false }
  }, [])
  return posts
}

export function usePost(slug) {
  const [post, setPost] = useState(undefined) // undefined = loading, null = not found
  useEffect(() => {
    let live = true
    api.posts.get(slug)
      .then((row) => live && setPost(normalize(row)))
      .catch(() => { const b = BUNDLED.find((p) => p.slug === slug); if (live) setPost(b ? normalize(b) : null) })
    return () => { live = false }
  }, [slug])
  return post
}
