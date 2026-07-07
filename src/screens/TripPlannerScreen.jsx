import { Link } from 'react-router-dom'
import { MapPin, Heart, CalendarRange, Luggage, ChevronDown } from 'lucide-react'
import { useSeo } from '../lib/seo.js'
import { paths } from '../lib/paths.js'

const FAQ = [
  { q: 'Is the myholidaypilot trip planner free?', a: 'Yes — building itineraries, saving places, packing lists and budgets are all free. Sign in with Google or email to save trips across devices.' },
  { q: 'Can I plan a multi-day holiday itinerary?', a: 'Yes. Pick the places you want to visit and arrange them into a day-by-day itinerary, with a map of each day and travel times between stops.' },
  { q: 'Does it work for any destination?', a: 'The planner covers every country on myholidaypilot — each broken into regions, with hand-picked places, restaurants and festivals to add to your trip.' },
  { q: 'Can I export or share my itinerary?', a: 'Yes — download your trip as a PDF to take offline, or share a link so friends and family can see (and copy) the plan.' },
  { q: 'Does the planner suggest what to pack and budget?', a: 'Yes — generate a packing list tailored to your trip dates and destinations, and estimate a budget for accommodation, food and activities.' },
]

const STEPS = [
  { icon: MapPin, title: 'Pick a destination', text: 'Browse every country region by region — towns, landmarks and restaurants, all hand-curated.' },
  { icon: Heart, title: 'Save the places you love', text: 'Tap the heart on any place to add it to your trip.' },
  { icon: CalendarRange, title: 'Arrange your days', text: 'Drag places into a day-by-day itinerary and see each day mapped.' },
  { icon: Luggage, title: 'Get ready', text: 'Generate a packing list, estimate a budget, and export the plan as a PDF.' },
]

export default function TripPlannerScreen() {
  useSeo({
    title: 'Free holiday trip planner — build a day-by-day itinerary',
    description: 'Plan your holiday for free: pick places region by region, build a day-by-day itinerary on a map, and get packing lists and budget estimates.',
    path: '/trip-planner',
  })
  return (
    <div className="page">
      <header className="hero">
        <div className="wrap hero__inner">
          <p className="eyebrow">Trip planner</p>
          <h1 className="hero__title">Free holiday trip planner</h1>
          <p className="hero__sub">Build a day-by-day itinerary — hand-curated places, maps for every day, packing lists and budgets in one place.</p>
          <p style={{ marginTop: 18 }}>
            <Link to={paths.plan()} className="btn btn--primary">Start planning</Link>
            {' '}
            <Link to={paths.destinations()} className="btn btn--soft">Browse destinations</Link>
          </p>
        </div>
      </header>
      <main className="wrap">
        <section className="tripdetails">
          <h2 className="tripdetails__title">How it works</h2>
          <div className="tripdetails__grid">
            {STEPS.map((s2) => (
              <div key={s2.title} className="tripdetails__cell">
                <h3><s2.icon size={16} /> {s2.title}</h3>
                <p>{s2.text}</p>
              </div>
            ))}
          </div>
          <div className="tripdetails__faq">
            <h3>Frequently asked questions</h3>
            {FAQ.map((f, i) => (
              <details key={i} className="tripdetails__q">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
