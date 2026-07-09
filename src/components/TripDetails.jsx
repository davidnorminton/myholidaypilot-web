import { Plane, CalendarDays, Sun, ChevronDown } from 'lucide-react'

// Trip-planning details generated in the admin (intro, getting there, how long,
// itinerary, FAQ) — rendered under the hero on region and country pages. The
// same content is prerendered for crawlers; this is the in-app view.
export default function TripDetails({ details, title = 'Plan your trip' }) {
  if (!details) return null
  const d = details
  const cells = [
    d.gettingThere && { icon: Plane, label: 'Getting there & around', text: d.gettingThere },
    d.daysNeeded && { icon: CalendarDays, label: 'How long to stay', text: d.daysNeeded },
    d.bestTime && { icon: Sun, label: 'When to go', text: d.bestTime },
  ].filter(Boolean)

  return (
    <section className="tripdetails">
      <p className="tripdetails__eyebrow">Plan your trip</p>
      <h2 className="tripdetails__title">{title}</h2>
      {d.intro && <p className="tripdetails__intro">{d.intro}</p>}

      {cells.length > 0 && (
        <div className="tripdetails__grid">
          {cells.map((c) => (
            <div key={c.label} className="tripdetails__cell">
              <div className="tripdetails__cellhead">
                <span className="tripdetails__chip"><c.icon size={30} /></span>
                <h3>{c.label}</h3>
              </div>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
      )}

      {Array.isArray(d.itinerary) && d.itinerary.length > 0 && (
        <div className="tripdetails__itin">
          <h3 className="tripdetails__sub">A perfect first visit</h3>
          <ol className="itin">
            {d.itinerary.map((it, i) => (
              <li key={i} className="itin__step">
                <span className="itin__num" aria-hidden>{it.day || i + 1}</span>
                <div className="itin__body">
                  <strong className="itin__name">{it.title || `Day ${it.day || i + 1}`}</strong>
                  <p>{it.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {Array.isArray(d.faq) && d.faq.length > 0 && (
        <div className="tripdetails__faq">
          <h3 className="tripdetails__sub">Good to know</h3>
          {d.faq.map((f, i) => (
            <details key={i} className="tripdetails__q">
              <summary>
                <span>{f.q}</span>
                <ChevronDown size={16} className="tripdetails__chev" aria-hidden />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
