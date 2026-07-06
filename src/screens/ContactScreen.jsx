import { useState } from 'react'
import { Send, Check } from 'lucide-react'
import { useSeo } from '../lib/seo.js'
import { api } from '../lib/api.js'
import PageHero from '../components/PageHero.jsx'

export default function ContactScreen() {
  useSeo({ title: 'Contact us', description: 'Questions, corrections or ideas — get in touch with the myholidaypilot team.', path: '/contact' })
  const [form, setForm] = useState({ name: '', email: '', subject: '', body: '', website: '' })
  const [mountedAt] = useState(() => Date.now())
  const [state, setState] = useState('idle')   // idle | sending | done
  const [err, setErr] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setErr('')
    if (!form.name.trim()) return setErr('Please add your name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErr('Please enter a valid email.')
    if (form.body.trim().length < 5) return setErr('Please add a message.')
    setState('sending')
    try {
      await api.contact.send({ ...form, ts: mountedAt })
      setState('done')
    } catch (e) { setErr(e.message || 'Something went wrong — please try again.'); setState('idle') }
  }

  return (
    <div className="page">
      <PageHero id="contact" eyebrow="myholidaypilot" title="Get in touch" emoji="✉️"
        sub="Questions, corrections, or a place we've missed — we'd love to hear from you." />
      <main className="wrap contact">
        <div className="contact__form">
          {state === 'done' ? (
            <div className="contact__done">
              <Check size={26} />
              <h3>Thanks — message received.</h3>
              <p>We read everything and reply when we can.</p>
            </div>
          ) : (
            <>
              <div className="contact__grid">
                <label className="contact__field">
                  <span>Your name</span>
                  <input value={form.name} onChange={set('name')} placeholder="Jane Traveller" />
                </label>
                <label className="contact__field">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
                </label>
              </div>
              <label className="contact__field">
                <span>Subject <em>(optional)</em></span>
                <input value={form.subject} onChange={set('subject')} placeholder="A correction, an idea, a country request…" />
              </label>
              <label className="contact__field">
                <span>Message</span>
                <textarea rows={6} value={form.body} onChange={set('body')} placeholder="Tell us what's on your mind…" />
              </label>
              {/* honeypot — hidden from humans, catches bots */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
                className="contact__hp" value={form.website} onChange={set('website')} />
              {err && <p className="contact__err">{err}</p>}
              <button className="btn btn--primary contact__submit" onClick={submit} disabled={state === 'sending'}>
                <Send size={16} /> {state === 'sending' ? 'Sending…' : 'Send message'}
              </button>
            </>
          )}
        </div>
        <div className="contact__notes">
          <p><strong>Spotted something wrong?</strong> Opening times, a closed restaurant, a changed train route — tell us the country and place and we'll fix it.</p>
          <p><strong>Want your country covered?</strong> We're adding new countries all the time. Let us know where you'd like to see next.</p>
          <p><strong>Press or partnerships?</strong> Put "press" or "partnership" in the subject line.</p>
        </div>
      </main>
    </div>
  )
}
