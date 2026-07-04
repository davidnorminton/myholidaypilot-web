import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Wand2, ArrowRight, ArrowLeft, RefreshCw, CalendarRange, MapPin,
  Compass, Utensils, Check, PencilRuler, Globe2,
} from 'lucide-react'
import { getIndex, getPlacesIndex, getRegion } from '../lib/data.js'
import { COUNTRIES } from '../lib/countries.js'
import { generatePlan, INTERESTS, PACES, STYLES } from '../lib/generateTrip.js'
import { createTrip, setTripDates, addPlace, setPlaceDate, togglePlaceItem, setActiveTrip } from '../lib/trips.js'
import { useAuth, GoogleSignInButton } from '../lib/auth.jsx'
import { paths } from '../lib/paths.js'
import { useSeo } from '../lib/seo.js'

const fmtShort = (d) => new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const defaultStart = () => { const d = new Date(); d.setDate(d.getDate() + 21); return d.toISOString().slice(0, 10) }

export default function GuidedPlannerScreen() {
  useSeo({
    title: 'Guided planner — a ready-made trip in 30 seconds',
    description: 'Answer five quick questions and get a complete day-by-day itinerary — places, things to do, where to eat — ready to fine-tune.',
    path: '/guided',
  })
  const navigate = useNavigate()
  const { user, configured, isDev, devSignIn } = useAuth()

  const [step, setStep] = useState(0)
  const [quiz, setQuiz] = useState({ country: 'italy', startDate: defaultStart(), nights: 4, pace: 'balanced', interests: [], style: 'base' })
  const [deps, setDeps] = useState(null)
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState([])   // regions already shown (for regenerate)
  const [seed, setSeed] = useState(1)

  useEffect(() => {
    setDeps(null)
    Promise.all([getIndex(quiz.country), getPlacesIndex(quiz.country)])
      .then(([index, placesIndex]) => setDeps({ index, placesIndex, getRegion: (id) => getRegion(id, quiz.country) }))
      .catch(() => setDeps(null))
  }, [quiz.country])

  const toggleInterest = (id) => setQuiz((q) => ({
    ...q, interests: q.interests.includes(id) ? q.interests.filter((x) => x !== id) : [...q.interests, id],
  }))

  const generate = async (opts = {}) => {
    if (!deps) return
    setBusy(true)
    const p = await generatePlan(quiz, deps, { seed: opts.seed ?? seed, exclude: opts.exclude ?? [] })
    setPlan(p)
    if (p) setTried((t) => [...new Set([...t, p.region.id])])
    setBusy(false)
    setStep(5)
  }

  const regenerate = () => {
    const nextSeed = seed + 1
    setSeed(nextSeed)
    generate({ seed: nextSeed, exclude: tried })
  }

  const saveTrip = () => {
    if (!plan) return
    const id = createTrip(plan.name, quiz.country)
    setTripDates(id, plan.startDate, plan.endDate)
    for (const day of plan.days) {
      for (const p of day.places) {
        addPlace(id, { regionId: p.regionId, regionName: p.regionName, placeId: p.placeId, name: p.name, type: p.type, lat: p.lat, lng: p.lng })
        setPlaceDate(id, p.regionId, p.placeId, day.date)
        for (const a of p.attractions) togglePlaceItem(id, p.regionId, p.placeId, 'attractions', a, day.date)
        for (const r of p.restaurants) togglePlaceItem(id, p.regionId, p.placeId, 'restaurants', r, day.date)
      }
    }
    setActiveTrip(id)
    navigate(paths.plan())
  }

  const steps = ['Where', 'When', 'Pace', 'Interests', 'Style']
  const canNext = step !== 3 || quiz.interests.length > 0

  return (
    <div className="page wrap guided">
      <header className="guided__head">
        <p className="eyebrow">Guided planner</p>
        <h1 className="guided__title">A ready-made trip in five questions</h1>
        <p className="guided__sub">
          Answer a handful of questions and we'll draft the whole thing — days, sights, dinners —
          from our hand-curated guides. Then fine-tune every detail in the <Link to={paths.plan()}>planner</Link>.
        </p>
      </header>

      {step < 5 && (
        <div className="gq">
          <div className="gq__progress">
            {steps.map((s, i) => (
              <span key={s} className={`gq__dot ${i === step ? 'is-on' : ''} ${i < step ? 'is-done' : ''}`}>{s}</span>
            ))}
          </div>

          {step === 0 && (
            <section className="gq__step">
              <h2><Globe2 size={19} /> Where to?</h2>
              <div className="gq__cards">
                {COUNTRIES.map((c) => (
                  <button key={c.slug} disabled={!c.available}
                    className={`gq__card ${quiz.country === c.slug ? 'is-on' : ''} ${c.available ? '' : 'gq__card--soon'}`}
                    onClick={() => setQuiz((q) => ({ ...q, country: c.slug }))}>
                    <b>{c.flag} {c.name}</b><span>{c.available ? (c.blurb || '') : 'Coming soon'}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="gq__step">
              <h2><CalendarRange size={19} /> When are you going?</h2>
              <div className="gq__row">
                <label className="gq__field">
                  <span>First day</span>
                  <input type="date" value={quiz.startDate} onChange={(e) => setQuiz((q) => ({ ...q, startDate: e.target.value }))} />
                </label>
                <label className="gq__field">
                  <span>Nights</span>
                  <div className="gq__chips">
                    {[2, 3, 4, 6, 9].map((n) => (
                      <button key={n} className={`gq__chip ${quiz.nights === n ? 'is-on' : ''}`}
                        onClick={() => setQuiz((q) => ({ ...q, nights: n }))}>{n + 1} days</button>
                    ))}
                    <label className={`gq__chip gq__chip--custom ${![2, 3, 4, 6, 9].includes(quiz.nights) ? 'is-on' : ''}`}>
                      custom
                      <input type="number" min="1" max="29" value={quiz.nights + 1}
                        onChange={(e) => {
                          const days = Math.max(2, Math.min(30, Number(e.target.value) || 2))
                          setQuiz((q) => ({ ...q, nights: days - 1 }))
                        }} />
                      days
                    </label>
                  </div>
                </label>
              </div>
              <p className="gq__hint">The month matters — we match regions to their best season.</p>
            </section>
          )}

          {step === 2 && (
            <section className="gq__step">
              <h2><PencilRuler size={19} /> What pace suits you?</h2>
              <div className="gq__cards">
                {PACES.map((p) => (
                  <button key={p.id} className={`gq__card ${quiz.pace === p.id ? 'is-on' : ''}`}
                    onClick={() => setQuiz((q) => ({ ...q, pace: p.id }))}>
                    <b>{p.label}</b><span>{p.blurb}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="gq__step">
              <h2><Compass size={19} /> What are you into?</h2>
              <p className="gq__hint">Pick as many as you like.</p>
              <div className="gq__chips gq__chips--big">
                {INTERESTS.map((i) => (
                  <button key={i.id} className={`gq__chip ${quiz.interests.includes(i.id) ? 'is-on' : ''}`}
                    onClick={() => toggleInterest(i.id)}>
                    <span aria-hidden>{i.emoji}</span> {i.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="gq__step">
              <h2><MapPin size={19} /> How do you like to travel?</h2>
              <div className="gq__cards">
                {STYLES.map((s) => (
                  <button key={s.id} className={`gq__card ${quiz.style === s.id ? 'is-on' : ''}`}
                    onClick={() => setQuiz((q) => ({ ...q, style: s.id }))}>
                    <b>{s.label}</b><span>{s.blurb}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="gq__nav">
            {step > 0 && <button className="btn btn--soft" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Back</button>}
            {step < 4 && <button className="btn btn--primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next <ArrowRight size={15} /></button>}
            {step === 4 && (
              <button className="btn btn--primary" disabled={!deps || busy} onClick={() => generate()}>
                <Wand2 size={16} /> {busy ? 'Drafting your trip…' : 'Draft my trip'}
              </button>
            )}
          </div>
        </div>
      )}

      {step === 5 && plan && (
        <div className="gplan">
          <header className="gplan__head">
            <span className="gplan__emoji" aria-hidden>{plan.region.emoji}</span>
            <div>
              <h2 className="gplan__title">{plan.name}</h2>
              <p className="gplan__meta">
                {fmtShort(plan.startDate)} – {fmtShort(plan.endDate)} · {plan.placeCount} places · ≈ {plan.km} km
              </p>
            </div>
            <button className="btn btn--soft gplan__redo" onClick={regenerate} disabled={busy}>
              <RefreshCw size={15} /> {busy ? 'Redrafting…' : 'Try another'}
            </button>
          </header>

          <div className="gplan__days">
            {plan.days.map((d, i) => (
              <article key={d.date} className="gplan__day">
                <header><b>Day {i + 1}</b> <span>{fmtShort(d.date)}</span></header>
                {d.places.length === 0 ? (
                  <p className="gplan__free">Free day — beach, wander, do nothing at all.</p>
                ) : d.places.map((p) => (
                  <div key={p.placeId} className="gplan__place">
                    <h3><MapPin size={14} /> {p.name}</h3>
                    <ul>
                      {p.attractions.map((a) => <li key={a.id}><Compass size={12} /> {a.text}</li>)}
                      {p.restaurants.map((r) => <li key={r.id}><Utensils size={12} /> {r.name}{r.cuisine ? ` · ${r.cuisine}` : ''}</li>)}
                    </ul>
                  </div>
                ))}
              </article>
            ))}
          </div>

          <footer className="gplan__foot">
            {user ? (
              <button className="btn btn--primary" onClick={saveTrip}>
                <Check size={16} /> Save &amp; open in the planner
              </button>
            ) : (
              <div className="gplan__signin">
                {configured ? <GoogleSignInButton />
                  : isDev ? <button className="btn btn--primary" onClick={devSignIn}>Continue in dev mode</button>
                  : <p className="gq__hint">Sign-in isn't configured yet.</p>}
              </div>
            )}
            <button className="btn btn--soft" onClick={() => { setStep(0); setPlan(null); setTried([]) }}>Start over</button>
            {!user && <p className="gplan__savenote">Sign in to save this trip to your account and fine-tune every day.</p>}
          </footer>
        </div>
      )}

      {step === 5 && !plan && !busy && (
        <p className="gq__hint">Couldn't draft a trip — try different answers.</p>
      )}
    </div>
  )
}
