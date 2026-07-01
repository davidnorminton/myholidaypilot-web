// Admin-authored blog posts, persisted to localStorage. They merge with the
// bundled posts so they appear on the blog immediately. Use exportPosts() to
// download them and commit to src/lib/blog.js for permanent / shared publishing.
import { useSyncExternalStore } from 'react'
import { POSTS as BUNDLED } from './blog.js'

const KEY = 'mhp_posts_v1'

function load() {
  try { const r = localStorage.getItem(KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : [] }
  catch { return [] }
}
let state = load()
const listeners = new Set()
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ } }
function set(next) { state = next; persist(); listeners.forEach((l) => l()) }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export function slugify(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) }
export function getSnapshot() { return state }
export function usePosts() { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) }

function normalizeBody(body) {
  if (Array.isArray(body)) return body
  return String(body || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
}

export function savePost(input) {
  const today = new Date().toISOString().slice(0, 10)
  const id = input.id || uid()
  const post = {
    id,
    slug: (input.slug && input.slug.trim()) || slugify(input.title) || id,
    title: (input.title || '').trim() || 'Untitled',
    tag: (input.tag || '').trim() || 'Field notes',
    author: (input.author || '').trim() || 'The Pilot',
    date: input.date || today,
    cover: (input.cover || '').trim(),
    excerpt: (input.excerpt || '').trim(),
    body: normalizeBody(input.body),
    custom: true,
  }
  const idx = state.findIndex((p) => p.id === id)
  if (idx >= 0) { const next = [...state]; next[idx] = post; set(next) }
  else set([post, ...state])
  return post
}

export function deletePost(id) { set(state.filter((p) => p.id !== id)) }
export function exportPosts() { return JSON.stringify(state, null, 2) }

// Merge bundled + custom (custom wins on slug clash), newest first.
export function useAllPosts() {
  const custom = usePosts()
  const map = new Map()
  for (const p of BUNDLED) map.set(p.slug, p)
  for (const p of custom) map.set(p.slug, p)
  return [...map.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}
