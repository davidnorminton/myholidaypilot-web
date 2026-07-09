import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Lightbulb } from 'lucide-react'
import { getGuide, getIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import { COUNTRIES } from '../lib/countries.js'
import { PageLoader } from '../components/Loading.jsx'
import FestivalsCalendar from '../components/FestivalsCalendar.jsx'
import { useSeo } from '../lib/seo.js'

// Hub-card palette, reused for the guide section title panels (same as About).
const ABOUT_BG = ['#fe9ee8', '#fecf1e', '#87d2fe', '#9ee8a4', '#fec89e', '#c3a9fe']

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
  const { country = 'italy' } = useParams()
  const cmeta = COUNTRIES.find((c) => c.slug === country)
  const [data, setData] = useState(null)
  const [regionMap, setRegionMap] = useState({})

  const g = data && data !== false ? data : null
  useSeo({ title: g?.title, description: g?.subtitle || g?.intro, path: `/${country}/${topic}` })

  useEffect(() => {
    let live = true
    setData(null)
    getGuide(topic, country).then((d) => live && setData(d)).catch(() => live && setData(false))
    getIndex(country).then((d) => {
      if (!live) return
      const m = {}
      for (const r of (d.regions || [])) m[r.id] = { name: r.name, emoji: r.emoji }
      setRegionMap(m)
    }).catch(() => {})
    return () => { live = false }
  }, [topic, country])

  if (data === null) return <PageLoader label="Opening guide" />
  if (data === false) {
    return (
      <div className="page wrap">
        <Link to={paths.country(country)} className="back" style={{ marginTop: 24 }}><ArrowLeft size={17} /> {cmeta?.name}</Link>
        <p className="empty">That guide could not be found.</p>
      </div>
    )
  }

  const isFestivals = Array.isArray(data.festivals)
  const sections = Array.isArray(data.sections) ? data.sections : []
  const isTimeline = sections.some((s) => (s.items || []).length > 0) && sections.every((s) => (s.items || []).every((it) => it.kind === 'era'))

  if (isFestivals && data.festivals.length > 0) {
    return (
      <div className="page">
        <FestivalsCalendar
          festivals={data.festivals} regionMap={regionMap} country={country}
          title={data.title} subtitle={data.subtitle || data.intro}
          eyebrow={data.eyebrow || cmeta?.name} backLabel={cmeta?.name}
        />
      </div>
    )
  }

  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow"><Link to={paths.country(country)} className="eyebrow__link">{data.eyebrow || cmeta?.name}</Link></p>
        <h1 className="sub-hero__title">{data.title}</h1>
        {(data.subtitle || data.intro) && <p className="sub-hero__sub">{data.subtitle || data.intro}</p>}
      </header>

      <main className="wrap guide">
        {isTimeline && <Timeline items={sections.flatMap((s) => s.items)} />}

        {!isTimeline && sections.length > 0 && (
          <div className="about guide-about">
            {sections.map((sec, i) => (
              <section key={i} className={`about__block ${i % 2 === 1 ? 'about__block--flip' : ''}`}>
                <div className="about__panel" style={{ background: ABOUT_BG[i % ABOUT_BG.length] }}>
                  <h2 className="about__title">{sec.title}</h2>
                </div>
                <div className="about__text gsec__content">
                  {sec.body && <p className="gsec__body">{sec.body}</p>}
                  {(sec.items || []).length > 0 && (
                    <ul className="gsec__items">
                      {(sec.items || []).map((it, k) => <GuideItem key={k} it={it} />)}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        <Link to={paths.country(country)} className="back" style={{ marginTop: 8 }}><ArrowLeft size={17} /> Back to {cmeta?.name}</Link>
      </main>
    </div>
  )
}
