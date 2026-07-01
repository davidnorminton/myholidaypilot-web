# myholidaypilot

Handcrafted travel guides, region by region. A React (Vite) site with a small
serverless API and a libSQL/Turso database. Starts with Italy; built to grow to
more countries.

## Stack
- **Front end:** React 18 + Vite, React Router (hash routing for now)
- **API:** Vercel serverless functions in `/api`
- **Database:** libSQL + Drizzle ORM — a local file in dev, hosted Turso in prod
- **PWA:** installable, offline-capable app shell (vite-plugin-pwa)

## Run locally
```bash
npm install
cp .env.example .env        # DATABASE_URL=file:./local.db is the default
npm run db:migrate          # create the tables
npm run db:seed             # optional: sample admin + posts
npm run dev                 # app on http://localhost:5173, local API on :3001
```
`npm run dev` starts the web app **and** a local API server together, so
comments, favourites, the blog CMS, newsletter and uploads all work.

Build / preview (needed to test the PWA service worker):
```bash
npm run build && npm run preview
```

## Database
Full schema, scripts and Turso setup are in **[DATABASE.md](./DATABASE.md)**.
Tables: `users`, `favourites`, `trips` + `trip_places`, `blog_posts`,
`comments`, `subscribers`.

## Environment
See `.env.example`. Key vars:
- `DATABASE_URL` (+ `DATABASE_AUTH_TOKEN` for Turso in production)
- `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` + `VITE_ADMIN_EMAILS` / `ADMIN_EMAILS` — sign-in & admin
- `VITE_SITE_URL` — canonical URLs + sitemap
- `VITE_MAPBOX_TOKEN` (maps), `VITE_ADSENSE_CLIENT` (ads) — both optional

## Admin
Visit `/#/admin`. Locally, "Continue in dev mode" signs you in as admin.
Manage the blog, Italy page, places, images, affiliates, newsletter, and
generate the sitemap. Uploaded images are saved to `public/images/` (commit them).

## Deploy (Vercel)
Set the env vars in the Vercel dashboard, point `DATABASE_URL`/`DATABASE_AUTH_TOKEN`
at a Turso database, run `npm run db:migrate` against it once, and deploy. The
`/api/*` routes become serverless functions automatically.

_A Solara project._
