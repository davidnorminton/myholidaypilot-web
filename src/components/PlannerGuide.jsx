import { CalendarRange, MapPin, Utensils, Route } from 'lucide-react'

const STEPS = [
  { icon: CalendarRange, title: 'Start a trip', text: 'Name it and set your dates — every day of the trip gets its own page.' },
  { icon: MapPin, title: 'Add places', text: 'Tap “Add to trip” on any town you like the look of, or search from inside the planner.' },
  { icon: Utensils, title: 'Plan each day', text: 'Open a place to pick things to do and where to eat, day by day — and add where you\u2019re staying.' },
  { icon: Route, title: 'See it come together', text: 'Day maps with the best route between stops, weather, distances — then export a PDF or share the link.' },
]

// A compact how-it-works strip for the planner: shown to signed-out visitors
// and on the trips page before the first trip exists.
export default function PlannerGuide({ title = 'How the planner works' }) {
  return (
    <section className="pguide">
      <h3 className="pguide__title">{title}</h3>
      <ol className="pguide__steps">
        {STEPS.map((s, i) => (
          <li key={i} className="pguide__step">
            <span className="pguide__n">{i + 1}</span>
            <s.icon size={17} className="pguide__ic" />
            <h4>{s.title}</h4>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
