import {
  Map, Route, BedDouble, CloudSun, UtensilsCrossed, FileDown,
  Share2, RefreshCw, Navigation, Sparkles,
} from 'lucide-react'

const FEATURES = [
  { icon: Map, title: 'A map for every day', text: 'Your places, activities and restaurants pinned day by day, plus a whole-trip overview map.' },
  { icon: Route, title: 'Best-route planning', text: 'Each day\u2019s stops ordered by proximity, with distances between every stop and a daily total.' },
  { icon: BedDouble, title: 'Your accommodation', text: 'Add your hotel, B&B or apartment — pinned on the map, and each day\u2019s route starts and ends there.' },
  { icon: UtensilsCrossed, title: 'Do & eat, per day', text: 'Pick things to do and where to eat for each day — including the dish each restaurant is known for.' },
  { icon: CloudSun, title: 'Weather on every day', text: 'A forecast chip on each day of your itinerary once the trip is within range.' },
  { icon: FileDown, title: 'PDF download', text: 'A printable itinerary with maps, routes and tick-boxes for every stop, activity and meal.' },
  { icon: Share2, title: 'Share the trip', text: 'One link sends the whole plan — travel mates see it read-only and can save their own copy.' },
  { icon: Navigation, title: 'On-trip mode', text: 'On travel days, today is highlighted with one-tap navigation to each stop in Google Maps.' },
  { icon: RefreshCw, title: 'Synced to your account', text: 'Trips save automatically and follow you across devices — plan on the laptop, use on your phone.' },
  { icon: Sparkles, title: 'Smart touches', text: 'Nearby ideas for empty days, a readiness checklist, drag-and-drop days and duplicate trips.' },
]

// The planner's feature grid — shown on the sign-in gate so visitors know
// exactly what's behind it.
export default function PlannerFeatures({ title = "What you'll get" }) {
  return (
    <section className="pfeat">
      <h3 className="pfeat__title">{title}</h3>
      <ul className="pfeat__grid">
        {FEATURES.map((f, i) => (
          <li key={i} className="pfeat__item">
            <f.icon size={17} className="pfeat__ic" />
            <div>
              <h4>{f.title}</h4>
              <p>{f.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
