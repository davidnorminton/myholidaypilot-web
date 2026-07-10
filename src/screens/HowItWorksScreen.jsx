import { Link } from 'react-router-dom'
import { Globe2, CalendarRange, Plane, MapPin, Compass, Ticket, UtensilsCrossed, BedDouble, Check, GripVertical, FileDown } from 'lucide-react'
import { useSeo } from '../lib/seo.js'
import { paths } from '../lib/paths.js'

// A walkthrough of the planner, kept in step with how it actually works.
export default function HowItWorksScreen() {
  useSeo({
    title: 'How the trip planner works',
    description: 'Plan a holiday day by day: pick a destination and dates, choose things to do, experiences, food and hotels for each day, then book it all in one place.',
    path: '/how-it-works',
  })

  const steps = [
    { icon: Globe2, title: '1 · Pick a destination and dates', body: 'Choose a country and your travel dates. Add your flights if you know them — set your home airport once and it\'s remembered for every future trip. Then hit Create trip.' },
    { icon: CalendarRange, title: '2 · Plan day by day', body: 'Every day of your trip appears in the sidebar with its date. Click a day, search for the town or region you\'ll be in, and it\'s saved instantly. Staying put? One tap sets your base for the whole trip.' },
    { icon: Compass, title: '3 · Fill each day', body: 'Each day has four tabs: Things to do from our guides, bookable Experiences, places to Eat, and your Accommodation — search your hotel, add its address, and reuse it for the rest of the trip in one tap.' },
    { icon: GripVertical, title: '4 · Save and order the day', body: 'Save activities collapses the day to a clean summary — drag items to set the running order, then jump straight to the next day. Ticks in the sidebar show your progress at a glance.' },
    { icon: Ticket, title: '5 · Review & book', body: 'When the days are planned, Book your trip gathers everything bookable in one place: flights with your dates, each stay on its nights, and any experiences you picked — each linking to the booking site.' },
    { icon: FileDown, title: '6 · Take it with you', body: 'Download the whole plan as a PDF, share a read-only link with your travel companions, or publish it to Trip ideas so other travellers can copy it. Budget and packing-list tools are one click away throughout.' },
  ]

  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow">Guide</p>
        <h1 className="sub-hero__title">How the trip planner works</h1>
        <p className="sub-hero__sub">From "let's go somewhere" to a day-by-day plan you can book — in six steps.</p>
      </header>

      <main className="wrap hiw">
        <ol className="hiw__steps">
          {steps.map(({ icon: Icon, title, body }) => (
            <li key={title} className="hiw__step">
              <span className="hiw__icon"><Icon size={20} /></span>
              <div>
                <h2>{title}</h2>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="hiw__facts">
          <p><MapPin size={14} /> Everything you pick lands on the trip map — places, activities and hotels.</p>
          <p><BedDouble size={14} /> Trips sync to your account when you're signed in, and save in your browser when you're not.</p>
          <p><UtensilsCrossed size={14} /> Restaurant and activity picks come from our own destination guides.</p>
          <p><Check size={14} /> Changed your mind? Everything is editable — reopen any day and re-pick.</p>
        </div>

        <div className="hiw__cta">
          <Link className="btn btn--primary" to={paths.plan()}><Plane size={16} /> Start planning a trip</Link>
          <Link className="btn btn--soft" to={paths.gallery()}>Or copy a ready-made trip idea</Link>
        </div>
      </main>
    </div>
  )
}
