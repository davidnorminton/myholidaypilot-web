import { useMemo } from 'react'
import { Plane, BedDouble, Ticket, ExternalLink } from 'lucide-react'
import { useAffiliates } from '../lib/affiliates.js'
import { skyscannerUrl, bookingUrl } from '../lib/bookingLinks.js'

// Everything bookable on the trip, gathered in one place: flights (Skyscanner),
// each stay (Booking.com with its real dates), and any Viator experiences the
// person picked. Pure links — nothing here writes to the trip.
export default function BookingsPanel({ trip }) {
  const affCfg = useAffiliates()
  const short = (pt) => (pt?.name || '').split(',')[0]

  const flights = useMemo(() => {
    const out = []
    if (trip.travel?.arrive || trip.travel?.home) {
      out.push({ which: 'arrive', label: `${short(trip.travel?.home) || 'Home'} → ${short(trip.travel?.arrive) || 'destination'}`, date: trip.startDate })
    }
    if (trip.travel?.depart || trip.travel?.home) {
      out.push({ which: 'depart', label: `${short(trip.travel?.depart) || 'Destination'} → ${short(trip.travel?.home) || 'home'}`, date: trip.endDate })
    }
    return out
  }, [trip])

  const viator = (trip.places || []).flatMap((p) =>
    (p.attractions || []).filter((a) => a.url && String(a.id).startsWith('viator-'))
      .map((a) => ({ ...a, placeName: p.name })))

  const fmt = (iso) => (iso ? new Date(iso + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
  const stays = trip.stays || []
  const nothing = flights.length === 0 && stays.length === 0 && viator.length === 0

  return (
    <div className="bookings">
      <h3 className="setloc__title">Review &amp; book</h3>
      <p className="setloc__sub">Everything from your plan that can be booked, in one place. Links open the partner site — booking through them may earn us a commission.</p>

      {nothing && <p className="pp-note">Nothing to book yet — add flights, a stay, or experiences to your days first.</p>}

      {flights.length > 0 && affCfg && (
        <section className="bookings__group">
          <h4><Plane size={15} /> Flights</h4>
          <ul>
            {flights.map((f) => (
              <li key={f.which}>
                <span className="bookings__what">{f.label}{f.date ? ` · ${fmt(f.date)}` : ''}</span>
                <a className="bookings__go" href={skyscannerUrl(affCfg, trip, f.which)} target="_blank" rel="noreferrer sponsored">
                  Search on Skyscanner <ExternalLink size={12} /><span className="planflights__ad">ad</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stays.length > 0 && affCfg && (
        <section className="bookings__group">
          <h4><BedDouble size={15} /> Stays</h4>
          <ul>
            {stays.map((s) => (
              <li key={s.id}>
                <span className="bookings__what">{s.name} <em>{s.type}</em>{s.from ? ` · ${fmt(s.from)}–${fmt(s.to || s.from)}` : ''}</span>
                <a className="bookings__go" href={bookingUrl(affCfg, { location: s.name, checkin: s.from || '', checkout: s.to || '' })}
                  target="_blank" rel="noreferrer sponsored">
                  Find on Booking.com <ExternalLink size={12} /><span className="planflights__ad">ad</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {viator.length > 0 && (
        <section className="bookings__group">
          <h4><Ticket size={15} /> Experiences</h4>
          <ul>
            {viator.map((a) => (
              <li key={a.id}>
                <span className="bookings__what">{a.text} <em>{a.placeName}</em></span>
                <a className="bookings__go" href={a.url} target="_blank" rel="noreferrer sponsored">
                  Book on Viator <ExternalLink size={12} /><span className="planflights__ad">ad</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
