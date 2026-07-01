import { BedDouble, Plane, Train, Shield, Wifi, Ticket, ArrowUpRight } from 'lucide-react'

const ICONS = { hotel: BedDouble, plane: Plane, train: Train, shield: Shield, wifi: Wifi, ticket: Ticket }
const REL = 'noopener noreferrer sponsored nofollow'

export default function AffiliateSection({ title, offers, note = 'Booking through these links may earn us a commission — at no extra cost to you.' }) {
  const usable = (offers || []).filter((o) => o.kind === 'providers' ? o.providers?.length : o.url)
  if (usable.length === 0) return null
  return (
    <section className="aff">
      <div className="aff__head">
        <h2 className="aff__title">{title}</h2>
        <span className="aff__note">{note}</span>
      </div>
      <div className="aff__grid">
        {usable.map((o, i) => (o.kind === 'providers'
          ? <ProvidersCard key={i} offer={o} />
          : <PrimaryCard key={i} offer={o} />))}
      </div>
    </section>
  )
}

function PrimaryCard({ offer }) {
  const Icon = ICONS[offer.icon] || Ticket
  return (
    <a className="aff-card" href={offer.url} target="_blank" rel={REL}>
      <span className="aff-card__ic"><Icon size={19} strokeWidth={2} /></span>
      <span className="aff-card__text">
        <span className="aff-card__title">{offer.title}</span> <span className="aff-card__sub">{offer.sub}</span>
      </span>
      <span className="aff-card__cta">{offer.cta} <ArrowUpRight size={15} /></span>
    </a>
  )
}

function ProvidersCard({ offer }) {
  return (
    <div className="aff-card aff-card--providers">
      <span className="aff-card__ic"><Ticket size={19} strokeWidth={2} /></span>
      <span className="aff-card__text">
        <span className="aff-card__title">{offer.title}</span> <span className="aff-card__sub">{offer.sub}</span>
      </span>
      <span className="aff-card__providers">
        {offer.providers.map((p) => (
          <a key={p.id} className="aff-prov" href={p.url} target="_blank" rel={REL}>
            {p.name} <ArrowUpRight size={13} />
          </a>
        ))}
      </span>
    </div>
  )
}
