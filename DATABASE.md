# Database

libSQL (SQLite-compatible) + Drizzle ORM. The same driver and schema run two ways:

- **Local (Mac):** a plain file, `file:./local.db` — nothing to install or run.
- **Production (Vercel):** a hosted **Turso** database over HTTP — serverless-native, no connection pooling to manage.

## Tables (`db/schema.js`)

| Table | Purpose | Efficiency notes |
|---|---|---|
| `users` | account per Google sign-in (`id` = Google `sub`) | unique email index; `role` = user/admin |
| `favourites` | saved places per user | **unique (user_id, place_id)** stops dupes & indexes lookups; FK cascade |
| `trips` | a saved itinerary | indexed by `user_id`; `updated_at` for sorting |
| `trip_places` | places within a trip | **unique (trip_id, place_id)**; chosen attractions/restaurants stored as JSON (no extra join tables); FK cascade |
| `blog_posts` | journal posts | unique `slug`; composite `(status, published_at)` index for listing |
| `comments` | comments under each region & place | `country_id` + `target_type` + `region_id` + `place_id` pin the area (ready for more countries); `parent_id` gives two-level replies; composite area index |

## Run it on a Mac

```bash
cp .env.example .env          # DATABASE_URL=file:./local.db is the default
npm install
npm run db:migrate            # create the tables
npm run db:seed               # optional: admin user + sample posts
npm run dev                   # app + /api on http://localhost:5173
```

Useful scripts: `db:generate` (new migration from schema changes), `db:studio` (visual browser), `db:reset` (wipe + migrate + seed).

## Deploy on Vercel (Turso)

```bash
# one-time
brew install tursodatabase/tap/turso && turso auth login
turso db create italytravel
turso db show italytravel --url                 # -> DATABASE_URL
turso db tokens create italytravel              # -> DATABASE_AUTH_TOKEN
```

In Vercel → Project → Settings → Environment Variables, set `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`. Then run the migration once against Turso:

```bash
DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run db:migrate
```

The `/api/*` files deploy automatically as serverless functions; the Vite app is served as static files (HashRouter needs no rewrites).

## API

All write routes identify the user from a Google ID token (`Authorization: Bearer <credential>`), verified server-side. When Google isn't configured in local dev, an `x-dev-email` header is accepted instead (mirrors the app's dev sign-in). Admin routes require an email in `ADMIN_EMAILS` (empty = any signed-in user, same rule as the client gate).

```
POST   /api/me                         sync/return the signed-in user
GET    /api/favourites                 list mine
POST   /api/favourites                 { regionId, placeId }
DELETE /api/favourites?regionId&placeId
GET    /api/trips                      list mine (+ placeCount)
POST   /api/trips                      { name, startDate, endDate }
GET    /api/trips/:id                  { trip, places }
PATCH  /api/trips/:id                  { name?, startDate?, endDate? }
DELETE /api/trips/:id
POST   /api/trip-places                { tripId, regionId, placeId, date?, note?, sortOrder?, attractions?, restaurants? }
PATCH  /api/trip-places                { tripId, regionId, placeId, ...fields }
DELETE /api/trip-places?tripId&regionId&placeId
GET    /api/posts                      published (admins: ?all=1 for drafts too)
POST   /api/posts                      admin — create
GET    /api/posts/:slug
PATCH  /api/posts/:slug                admin
DELETE /api/posts/:slug                admin
GET    /api/comments?country&type&region[&place]   list for one area (public)
POST   /api/comments                   { countryId, targetType, regionId, placeId?, body }  or  { parentId, body } to reply
DELETE /api/comments/:id               own comment or admin (top-level deletes its replies)
```

`src/lib/api.js` is a ready-made client for these. The app's current screens still use the localStorage stores (`trips.js`, `posts.js`); switching them over to `api.*` is the next step and can be done one feature at a time.
