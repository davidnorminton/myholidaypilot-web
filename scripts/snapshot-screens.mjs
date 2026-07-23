// Snapshot the "copy lives in JSX" screens into real HTML for the prerender.
//
// THE PROBLEM: pages like /privacy, /terms or /how-it-works have their entire
// content written in JSX. The prerender can't execute JSX, so until now it
// carried hand-written SUMMARIES of those pages — a second copy of the truth
// that drifted every time the screen was edited.
//
// THE FIX: render the actual components at build time and hand the prerender
// the real markup. Not with a headless browser — a browser at build is the
// flakiest step there is, needs a binary download, and this app's API doesn't
// exist at build time anyway. Vite's own SSR pipeline loads the same source
// files the client uses, React renders them to static HTML, done in seconds.
//
// What SSR can't capture: anything behind useEffect (data fetches, live
// settings). For these screens that's nothing — the copy IS the render. Screens
// that fetch their content are NOT snapshotted; the prerender's data-driven
// pages already handle those better than a browser could (direct DB access).
//
// Output: .snapshots.json at the repo root — prerender.mjs uses an entry when
// present and falls back to its summary when not, so a failure here can never
// take the build down; it just means that page keeps the old summary.
//
// Runs between `vite build` and prerender (see package.json "build").

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
// Deps are imported natively, not through ssrLoadModule: they're CJS packages
// (ambiguous-syntax errors under SSR transform), and Vite externalizes them for
// the loaded screens anyway — so this IS the same React instance the screens
// will use, which is what makes hooks work.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(root, '.snapshots.json')

// path → [module under src/, named export or 'default']
const SCREENS = {
  '/privacy': ['screens/LegalScreens.jsx', 'PrivacyScreen'],
  '/terms': ['screens/LegalScreens.jsx', 'TermsScreen'],
  '/cookies': ['screens/LegalScreens.jsx', 'CookiesScreen'],
  '/how-it-works': ['screens/HowItWorksScreen.jsx', 'default'],
  '/contact': ['screens/ContactScreen.jsx', 'default'],
}

const vite = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
})

const snapshots = {}
try {
  for (const [urlPath, [mod, name]] of Object.entries(SCREENS)) {
    try {
      const m = await vite.ssrLoadModule(`/src/${mod}`)
      const Screen = name === 'default' ? m.default : m[name]
      if (typeof Screen !== 'function') throw new Error(`${name} is not exported by ${mod}`)
      const html = renderToStaticMarkup(
        React.createElement(MemoryRouter, { initialEntries: [urlPath] },
          React.createElement(Screen)),
      )
      if (!html || html.length < 200) throw new Error(`suspiciously small render (${html.length} chars)`)
      snapshots[urlPath] = html
      console.log(`  ✓ ${urlPath}  (${(html.length / 1024).toFixed(1)}KB from ${mod})`)
    } catch (e) {
      // Per-screen: one broken screen shouldn't cost the others their snapshot.
      console.warn(`  ! ${urlPath}: ${String(e.message).split('\n')[0]} — prerender will use its summary`)
    }
  }
} finally {
  await vite.close()
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), snapshots }, null, 1))
console.log(`✓ .snapshots.json — ${Object.keys(snapshots).length}/${Object.keys(SCREENS).length} screens captured`)
