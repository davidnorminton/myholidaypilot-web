import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
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
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('My trip'),
  startDate: text('start_date'), // 'YYYY-MM-DD'
  endDate: text('end_date'),
  createdAt: integer('created_at').notNull().$defaultFn(now),
  updatedAt: integer('updated_at').notNull().$defaultFn(now),
}, (t) => ({
  byUser: index('trip_by_user').on(t.userId),
}))

// ── trip_places ─────────────────────────────────────────────────────────────
// Normalised per-place rows. The sparse, per-place selections (chosen
// attractions / restaurants) live as JSON to avoid two more join tables.
export const tripPlaces = sqliteTable('trip_places', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  regionId: text('region_id').notNull(),
  placeId: text('place_id').notNull(),
  date: text('date'),                                  // assigned day, null = unscheduled
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  note: text('note'),
  sortOrder: integer('sort_order').notNull().default(0),
  attractions: text('attractions', { mode: 'json' }).$type().default(sql`'[]'`),
  restaurants: text('restaurants', { mode: 'json' }).$type().default(sql`'[]'`),
}, (t) => ({
  tripPlace: uniqueIndex('tp_trip_place').on(t.tripId, t.placeId),
  byTrip: index('tp_by_trip').on(t.tripId),
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
