// Trip-planning details generated in the admin (intro, getting there, how long,
// itinerary, FAQ) — rendered under the hero on region and country pages. The
// same content is prerendered for crawlers; this is the in-app view.
export default function TripDetails({ details, title = 'Plan your trip' }) {
  if (!details) return null
  const d = details
  return (
    <section className="tripdetails">
      <h2 className="tripdetails__title">{title}</h2>
      {d.intro && <p className="tripdetails__intro">{d.intro}</p>}
      <div className="tripdetails__grid">
        {d.gettingThere && (
          <div className="tripdetails__cell">
            <h3>Getting there &amp; around</h3>
            <p>{d.gettingThere}</p>
          </div>
        )}
        {d.daysNeeded && (
          <div className="tripdetails__cell">
            <h3>How long to stay</h3>
            <p>{d.daysNeeded}</p>
          </div>
        )}
        {d.bestTime && (
          <div className="tripdetails__cell">
            <h3>When to go</h3>
            <p>{d.bestTime}</p>
          </div>
        )}
      </div>
      {Array.isArray(d.itinerary) && d.itinerary.length > 0 && (
        <div className="tripdetails__itin">
          <h3>Suggested itinerary</h3>
          <ol>
            {d.itinerary.map((it, i) => (
              <li key={i}><strong>{it.title || `Day ${it.day}`}</strong> — {it.text}</li>
            ))}
          </ol>
        </div>
      )}
      {Array.isArray(d.faq) && d.faq.length > 0 && (
        <div className="tripdetails__faq">
          <h3>Frequently asked questions</h3>
          {d.faq.map((f, i) => (
            <details key={i} className="tripdetails__q">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
