import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

const now = () => Date.now()

// ── users ───────────────────────────────────────────────────────────────────
// id = Google "sub" (stable per account) when signed in with Google.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  picture: text('picture'),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt: integer('created_at').notNull().$defaultFn(now),
})

// ── favourites ──────────────────────────────────────────────────────────────
// One row per saved place per user. Unique pair stops duplicates and doubles
// as the lookup index; a second index covers "all favourites for a user".
export const favourites = sqliteTable('favourites', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  placeId: text('place_id').notNull(),
  regionId: text('region_id').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(now),
}, (t) => ({
  userPlace: uniqueIndex('fav_user_place').on(t.userId, t.placeId),
  byUser: index('fav_by_user').on(t.userId),
}))

// ── trips ───────────────────────────────────────────────────────────────────
export const trips = sqliteTable('trips', {
  // The client generates trip ids; the same id is used locally and on the
  // server so sync is a simple upsert. The full trip (places, picks, stays,
  // notes) is stored as one JSON document in `data` — the client shape is the
  // source of truth and evolves without schema churn.
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('My trip'),
  data: text('data').notNull().default('{}'),
  createdAt: integer('created_at').notNull().$defaultFn(now),
  updatedAt: integer('updated_at').notNull().$defaultFn(now),
}, (t) => ({
  byUser: index('trip_by_user').on(t.userId),
}))

// ── comments ────────────────────────────────────────────────────────────────
// One table for every "area" a comment can attach to.
//   country_id  → ready for more countries (e.g. 'italy', 'france')
//   target_type → 'region' | 'place'  (which kind of area)
//   region_id   → always set (places live under a region)
//   place_id    → set only for place comments (null = a region comment)
// Threading is two levels: parent_id null = a top-level comment; otherwise it
// is a reply to a top-level comment (replies cannot themselves be replied to —
// enforced in the API). The composite index keys every lookup off the area.
export const comments = sqliteTable('comments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  countryId: text('country_id').notNull(),
  targetType: text('target_type', { enum: ['region', 'place'] }).notNull(),
  regionId: text('region_id').notNull(),
  placeId: text('place_id'),
  parentId: text('parent_id'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(now),
  updatedAt: integer('updated_at').notNull().$defaultFn(now),
}, (t) => ({
  byArea: index('cmt_by_area').on(t.countryId, t.targetType, t.regionId, t.placeId, t.createdAt),
  byParent: index('cmt_by_parent').on(t.parentId),
  byUser: index('cmt_by_user').on(t.userId),
}))

// ── blog_posts ──────────────────────────────────────────────────────────────
export const blogPosts = sqliteTable('blog_posts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  dek: text('dek'),                                    // excerpt / standfirst
  coverImage: text('cover_image'),
  tag: text('tag'),
  author: text('author'),
  body: text('body', { mode: 'json' }).$type().notNull(), // array of paragraphs
  tags: text('tags', { mode: 'json' }).$type().default(sql`'[]'`),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  publishedAt: integer('published_at'),
  createdAt: integer('created_at').notNull().$defaultFn(now),
  updatedAt: integer('updated_at').notNull().$defaultFn(now),
}, (t) => ({
  byStatusDate: index('post_status_date').on(t.status, t.publishedAt),
}))

// ── subscribers ─────────────────────────────────────────────────────────────
// Newsletter signups captured from the site footer.
export const subscribers = sqliteTable('subscribers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at').notNull().$defaultFn(now),
})

// ── airports ─────────────────────────────────────────────────────────────────
// Arrival/departure airports offered in the trip planner, per country.
export const airports = sqliteTable('airports', {
  id: text('id').primaryKey(),                       // IATA code
  countryId: text('country_id').notNull(),           // e.g. 'italy'
  name: text('name').notNull(),
  city: text('city').notNull(),
  iata: text('iata').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  address: text('address'),
}, (t) => ({
  byCountry: index('airport_by_country').on(t.countryId),
}))

// ── site settings ────────────────────────────────────────────────────────────
// Small key-value store for admin-editable site content (home hero, region
// hero overrides, headline copy).
export const siteSettings = sqliteTable('site_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull().$defaultFn(now),
})

// ── region visits ────────────────────────────────────────────────────────────
// "Been here": regions a user marks as visited (feeds the travel map,
// alongside places ticked off in trips).
export const regionVisits = sqliteTable('region_visits', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  countryId: text('country_id').notNull().default('italy'),
  regionId: text('region_id').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(now),
}, (t) => ({
  userRegion: uniqueIndex('visit_user_region').on(t.userId, t.regionId),
  byUser: index('visit_by_user').on(t.userId),
}))

// ── AI usage ─────────────────────────────────────────────────────────────────
// Per-user daily counter so AI features can be free without being abusable.
export const aiUsage = sqliteTable('ai_usage', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: text('day').notNull(),
  count: integer('count').notNull().default(0),
}, (t) => ({
  userDay: uniqueIndex('ai_usage_user_day').on(t.userId, t.day),
}))
