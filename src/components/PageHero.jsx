import { useSettings } from '../lib/settings.js'

// A page hero matching the Plan page: eyebrow + title + summary on the left,
// a settable image (or emoji-on-gradient fallback) on the right. The image is
// set per page in Admin → Site → Page images, under the key `page.<id>`.
export default function PageHero({ id, eyebrow, title, sub, emoji = '🧭', bleed = false }) {
  const site = useSettings()
  const img = site[`page.${id}`] || ''
  return (
    <header className={`sub-hero wrap plan-hero${bleed ? ' plan-hero--bleed' : ''}`}>
      <div className="plan-hero__text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="sub-hero__title">{title}</h1>
        {sub && <p className="sub-hero__sub">{sub}</p>}
      </div>
      <div className="plan-hero__media" data-emoji={emoji}>
        {img && <img src={img} alt="" />}
      </div>
    </header>
  )
}
