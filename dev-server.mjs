// Local-only API server for `npm run dev`. It serves the same /api/*.js handlers
// that Vercel runs in production, so the app works end-to-end on localhost.
// Vite proxies /api to this port (see vite.config.js). Not used in production.
import 'dotenv/config'
import http from 'node:http'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const PORT = process.env.API_PORT || 3001
const API_DIR = path.resolve('api')
const cache = new Map()

// Map a URL path to a handler file, supporting one [param] segment per folder
// (matches this project's routes: trips/[id], posts/[slug], comments/[id]).
async function resolve(segments) {
  const exact = path.join(API_DIR, ...segments) + '.js'
  if (existsSync(exact)) return { file: exact, params: {} }
  const dir = path.join(API_DIR, ...segments.slice(0, -1))
  if (existsSync(dir)) {
    const dyn = (await readdir(dir)).find((f) => /^\[.+\]\.js$/.test(f))
    if (dyn) return { file: path.join(dir, dyn), params: { [dyn.slice(1, -4)]: decodeURIComponent(segments.at(-1)) } }
  }
  return null
}

const json = (res, status, data) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)) }

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    if (!url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Not an API route' })
    const segments = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '').split('/')
    const hit = await resolve(segments)
    if (!hit) return json(res, 404, { error: `No handler for /api/${segments.join('/')}` })
    req.query = { ...Object.fromEntries(url.searchParams), ...hit.params }
    let mod = cache.get(hit.file)
    if (!mod) { mod = await import(pathToFileURL(hit.file).href); cache.set(hit.file, mod) }
    await mod.default(req, res)
  } catch (e) { json(res, 500, { error: e.message }) }
}).listen(PORT, () => console.log(`\u25B6 local API ready on http://localhost:${PORT}  (Vite proxies /api here)`))
