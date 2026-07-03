import React from 'react'

// Legacy links: the site launched on hash routing (#/italy/abruzzo). Any old
// bookmark or shared URL gets translated to the clean path before the app mounts.
if (window.location.hash.startsWith('#/')) {
  const clean = window.location.hash.slice(1) + window.location.search
  window.history.replaceState(null, '', clean)
}
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
