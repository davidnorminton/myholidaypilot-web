import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { getDb, schema } from './client.js'
import { sql } from 'drizzle-orm'

const db = getDb()

// 1) seed an admin user from ADMIN_EMAILS (first email), if provided
const adminEmail = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean)[0]
if (adminEmail) {
  await db.insert(schema.users).values({
    id: 'seed-admin', email: adminEmail, name: 'Admin', role: 'admin',
  }).onConflictDoNothing()
  console.log('✓ admin user:', adminEmail)
}

// 2) seed blog posts from the bundled sample posts (src/lib/blog.js)
//    We parse the POSTS array out of that file so there is a single source of truth.
const blogSrc = readFileSync(new URL('../src/lib/blog.js', import.meta.url), 'utf8')
const start = blogSrc.indexOf('[')
const end = blogSrc.lastIndexOf(']') + 1
// eslint-disable-next-line no-eval
const POSTS = (0, eval)(blogSrc.slice(start, end))

for (const p of POSTS) {
  const ts = p.date ? Date.parse(p.date) : Date.now()
  await db.insert(schema.blogPosts).values({
    slug: p.slug,
    title: p.title,
    dek: p.excerpt ?? null,
    coverImage: p.cover ?? null,
    tag: p.tag ?? null,
    author: p.author ?? null,
    body: p.body ?? [],
    tags: p.tag ? [p.tag] : [],
    status: 'published',
    publishedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  }).onConflictDoUpdate({
    target: schema.blogPosts.slug,
    set: { title: p.title, dek: p.excerpt ?? null, body: p.body ?? [], updatedAt: Date.now() },
  })
}
console.log(`✓ seeded ${POSTS.length} blog posts`)

const [{ c }] = await db.select({ c: sql`count(*)` }).from(schema.blogPosts)
console.log('  blog_posts rows:', c)
process.exit(0)
