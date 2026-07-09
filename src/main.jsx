import React from 'react'

// Legacy links: the site launched on hash routing (#/italy/abruzzo). Any old
// bookmark or shared URL gets translated to the clean path before the app mounts.
if (window.location.hash.startsWith('#/')) {
  const clean = window.location.hash.slice(1) + window.location.search
  window.history.replaceState(null, '', clean)
}

// After a deploy, a tab running the old bundle may lazy-load a hashed chunk
// that no longer exists — Vite fires this event when that import fails. One
// reload fetches the fresh index.html (and chunks); the guard stops a loop if
// reloading doesn't fix it (e.g. genuinely offline).
window.addEventListener('vite:preloadError', (e) => {
  const KEY = 'mhp.chunkReload'
  if (sessionStorage.getItem(KEY)) return   // already tried once this session
  sessionStorage.setItem(KEY, '1')
  e.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => {
  // Only forget the "already reloaded once" guard after the page has survived
  // a while — clearing it immediately could reload-loop on a persistent failure.
  setTimeout(() => { try { sessionStorage.removeItem('mhp.chunkReload') } catch { /* ignore */ } }, 10000)
})
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
