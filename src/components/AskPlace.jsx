import { useState } from 'react'
import { Sparkles, RefreshCw, CornerDownLeft } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth, GoogleSignInButton } from '../lib/auth.jsx'

// Scoped Q&A on a place page. The guide's own content travels with the
// question, so answers stay grounded in what we actually publish.
export default function AskPlace({ place, regionName }) {
  const { user, configured, isDev, devSignIn } = useAuth()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [thread, setThread] = useState([])   // [{q, a}]

  const context = [
    place.description,
    place.activities?.length ? `Things to do: ${place.activities.map((a) => a.text || a).join('; ')}` : '',
    place.food?.length ? `Food: ${place.food.map((f) => f.text || f).join('; ')}` : '',
    place.tips?.length ? `Local tips: ${place.tips.map((t) => t.text || t).join('; ')}` : '',
  ].filter(Boolean).join('\n')

  const ask = async () => {
    const question = q.trim()
    if (!question) return
    setBusy(true); setError('')
    try {
      const res = await api.ai.place({ question, placeName: `${place.name} (${regionName})`, context })
      setThread((t) => [...t, { q: question, a: res.answer }])
      setQ('')
    } catch (e) {
      setError(e.message || 'Could not answer that')
    } finally { setBusy(false) }
  }

  return (
    <section className="ask">
      <h2 className="ask__title"><Sparkles size={17} /> Ask about {place.name}</h2>
      <p className="ask__sub">Pushchair-friendly? Best month? When's the market? Ask anything about visiting.</p>

      {thread.map((t, i) => (
        <div key={i} className="ask__qa">
          <p className="ask__q">{t.q}</p>
          <p className="ask__a">{t.a}</p>
        </div>
      ))}

      {user ? (
        <div className="ask__row">
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={300}
            placeholder={`e.g. Is ${place.name} doable as a day trip?`}
            onKeyDown={(e) => e.key === 'Enter' && !busy && ask()} />
          <button className="btn btn--primary" onClick={ask} disabled={busy || !q.trim()}>
            {busy ? <RefreshCw size={15} className="pk__spin" /> : <CornerDownLeft size={15} />}
          </button>
        </div>
      ) : (
        <div className="ask__signin">
          {configured ? <GoogleSignInButton />
            : isDev ? <button className="btn btn--primary" onClick={devSignIn}>Continue in dev mode</button>
            : <p className="gq__hint">Sign-in isn't configured yet.</p>}
          <span>Sign in to ask — free, a few questions a day.</span>
        </div>
      )}
      {error && <p className="pk__warn">{error}</p>}
    </section>
  )
}
