import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, AlertTriangle, Coffee, Utensils, Star, Wine, TrainFront,
  Bus, TramFront, Car, Ship, Plane, Smartphone, Lightbulb,
} from 'lucide-react'
import { getGuide, getIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import { PageLoader } from '../components/Loading.jsx'
import FestivalsCalendar from '../components/FestivalsCalendar.jsx'
import { useSeo } from '../lib/seo.js'

const ICONS = {
  coffee: Coffee, restaurant: Utensils, dining: Utensils, star: Star, bar: Wine,
  train: TrainFront, transit: Bus, subway: TramFront, taxi: Car, boat: Ship,
  warning: AlertTriangle, flight: Plane, simcard: Smartphone,
}

function GuideItem({ it }) {
  const cls = it.kind === 'warn' ? 'gitem gitem--warn' : it.kind === 'tip' ? 'gitem gitem--tip' : 'gitem'
  const Icon = it.kind === 'warn' ? AlertTriangle : it.kind === 'tip' ? Lightbulb : null
  return (
    <li className={cls}>
      {Icon && <Icon size={15} className="gitem__icon" />}
      <span className="gitem__text">
        {it.label && <b className="gitem__label">{it.label}</b>}
        {it.label && it.text ? ' — ' : ''}
        {it.text}
      </span>
    </li>
  )
}

function Timeline({ items }) {
  return (
    <ol className="tl">
      {items.map((it, i) => (
        <li key={i} className="tl__row">
          <div className="tl__period">{(it.period || '').split('\n').map((p, j) => <span key={j}>{p}</span>)}</div>
          <div className="tl__card">
            {it.dates && <p className="tl__dates">{it.dates}</p>}
            <h3 className="tl__label">{it.label}</h3>
            {it.summary && <p className="tl__summary">{it.summary}</p>}
            {it.text && <p className="tl__text">{it.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function GuideScreen({ topic }) {
  const [data, setData] = useState(null)
  const [regionMap, setRegionMap] = useState({})

  const g = data && data !== false ? data : null
  useSeo({ title: g?.title, description: g?.subtitle || g?.intro, path: `/italy/${topic}` })

  useEffect(() => {
    let live = true
    setData(null)
    getGuide(topic).then((d) => live && setData(d)).catch(() => live && setData(false))
    getIndex().then((d) => {
      if (!live) return
      const m = {}
      for (const r of (d.regions || [])) m[r.id] = { name: r.name, emoji: r.emoji }
      setRegionMap(m)
    }).catch(() => {})
    return () => { live = false }
  }, [topic])

  if (data === null) return <PageLoader label="Opening guide" />
  if (data === false) {
    return (
      <div className="page wrap">
        <Link to={paths.country()} className="back" style={{ marginTop: 24 }}><ArrowLeft size={17} /> Italy</Link>
        <p className="empty">That guide could not be found.</p>
      </div>
    )
  }

  const isFestivals = Array.isArray(data.festivals)
  const sections = Array.isArray(data.sections) ? data.sections : []
  const isTimeline = sections.length > 0 && sections.every((s) => (s.items || []).every((it) => it.kind === 'era'))

  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow"><Link to={paths.country()} className="eyebrow__link">{data.eyebrow || 'Italy'}</Link></p>
        <h1 className="sub-hero__title">{data.title}</h1>
        {(data.subtitle || data.intro) && <p className="sub-hero__sub">{data.subtitle || data.intro}</p>}
      </header>

      <main className="wrap guide">
        {isFestivals && data.festivals.length > 0 && (
          <FestivalsCalendar festivals={data.festivals} regionMap={regionMap} />
        )}

        {isTimeline && <Timeline items={sections.flatMap((s) => s.items)} />}

        {!isTimeline && sections.length > 0 && (
          <div className="guide-body">
            {sections.map((sec, i) => {
              const Icon = ICONS[sec.icon]
              return (
                <section key={i} className="gsec">
                  {sec.title && <h2 className="gsec__title">{Icon && <Icon size={18} className="gsec__icon" />}{sec.title}</h2>}
                  <ul className="gsec__items">
                    {(sec.items || []).map((it, k) => <GuideItem key={k} it={it} />)}
                  </ul>
                </section>
              )
            })}
          </div>
        )}

        <Link to={paths.country()} className="back" style={{ marginTop: 8 }}><ArrowLeft size={17} /> Back to Italy</Link>
      </main>
    </div>
  )
}
