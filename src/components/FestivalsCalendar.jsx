import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, CalendarRange } from 'lucide-react'
import { paths } from '../lib/paths.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const TYPE_EMOJI = { RELIGIOUS: '🙏', FOOD: '🍽️', MUSIC: '🎵', HISTORICAL: '⚔️', CULTURAL: '🎭', CARNIVAL: '🎭', NATIONAL: '🇮🇹' }
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase()

function daysInMonth(year, month) { return new Date(year, month, 0).getDate() } // month 1-12
function firstWeekday(year, month) { return (new Date(year, month - 1, 1).getDay() + 6) % 7 } // Monday=0

function dateLabel(f) {
  const ms = ABBR[f.month - 1]
  if (f.dayStart == null) return `All ${ms}`
  if (f.dayEnd != null && f.dayEnd !== f.dayStart) return `${f.dayStart}–${f.dayEnd} ${ms}`
  return `${f.dayStart} ${ms}`
}

export default function FestivalsCalendar({ festivals, regionMap = {}, country = 'italy', title, subtitle, eyebrow, backLabel }) {
  const now = new Date()
  const year = now.getFullYear()
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-12
  const [day, setDay] = useState(null)

  const counts = useMemo(() => {
    const c = Array(13).fill(0)
    for (const f of festivals) c[f.month]++
    return c
  }, [festivals])

  const monthFests = useMemo(() => {
    return festivals
      .filter((f) => f.month === month)
      .sort((a, b) => (a.isNational === b.isNational ? (a.dayStart ?? 99) - (b.dayStart ?? 99) : a.isNational ? -1 : 1))
  }, [festivals, month])

  const eventDays = useMemo(() => {
    const set = new Set()
    for (const f of monthFests) {
      if (f.dayStart == null) continue
      for (let d = f.dayStart; d <= (f.dayEnd ?? f.dayStart); d++) set.add(d)
    }
    return set
  }, [monthFests])

  const shown = day == null ? monthFests : monthFests.filter((f) => f.dayStart != null && day >= f.dayStart && day <= (f.dayEnd ?? f.dayStart))

  const pickMonth = (m) => { setMonth(m); setDay(null) }

  const lead = firstWeekday(year, month)
  const dim = daysInMonth(year, month)
  const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  const today = month === now.getMonth() + 1 ? now.getDate() : null

  return (
    <>
      <header className="sub-hero wrap fest-hero">
        <div className="fest-hero__text">
          <p className="eyebrow"><Link to={paths.country(country)} className="eyebrow__link">{eyebrow}</Link></p>
          <h1 className="sub-hero__title">{title}</h1>
          {subtitle && <p className="sub-hero__sub">{subtitle}</p>}
        </div>

        <div className="fest-hero__panel">
          <div className="fest-picker">
            <CalendarRange size={18} className="fest-picker__ic" />
            <select className="fest-picker__select" value={month} onChange={(e) => pickMonth(Number(e.target.value))} aria-label="Choose month">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m} {year}{counts[i + 1] ? ` — ${counts[i + 1]} event${counts[i + 1] === 1 ? '' : 's'}` : ''}</option>
              ))}
            </select>
            <ChevronDown size={18} className="fest-picker__chev" />
          </div>

          <div className="cal__grid fest-cal">
            <div className="cal__dows">{DOW.map((d, i) => <span key={i}>{d}</span>)}</div>
            {weeks.map((wk, wi) => (
              <div className="cal__week" key={wi}>
                {wk.map((d, di) => {
                  if (d == null) return <span key={di} className="cal__cell cal__cell--empty" />
                  const hasEv = eventDays.has(d)
                  const sel = d === day
                  const isToday = d === today
                  return (
                    <button key={di}
                      className={`cal__cell ${hasEv ? 'has-ev' : ''} ${sel ? 'is-sel' : ''} ${isToday && !sel ? 'is-today' : ''}`}
                      onClick={hasEv ? () => setDay(sel ? null : d) : undefined}
                      disabled={!hasEv} aria-label={`${d} ${MONTHS[month - 1]}`}>
                      {d}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="wrap fest-below">
        <p className="cal__hint">
          {day != null ? <>Showing {day} {MONTHS[month - 1]} · <button className="cal__clear" onClick={() => setDay(null)}>clear</button></>
            : `${monthFests.length} event${monthFests.length === 1 ? '' : 's'} in ${MONTHS[month - 1]}`}
        </p>

        {shown.length > 0 ? (
          <div className="fest-list">
            {shown.map((f) => <FestCard country={country} key={f.id} f={f} region={regionMap[f.regionId]} highlighted={day != null} />)}
          </div>
        ) : (
          <div className="cal__empty"><span className="cal__empty-emoji">🎭</span><p>No events this month.</p></div>
        )}

        <Link to={paths.country(country)} className="back" style={{ marginTop: 18 }}><ArrowLeft size={17} /> Back to {backLabel || 'destinations'}</Link>
      </main>
    </>
  )
}

function FestCard({ f, region, highlighted, country }) {
  const [open, setOpen] = useState(highlighted)
  return (
    <article className={`fcard ${highlighted ? 'is-hl' : ''}`} onClick={() => setOpen((o) => !o)}>
      <div className="fcard__head">
        <div className="fcard__tile">
          {f.dayStart != null ? <><b>{f.dayStart}</b><span>{ABBR[f.month - 1].toUpperCase()}</span></> : <CalendarRange size={18} />}
        </div>
        <div className="fcard__meta">
          <h3 className="fcard__name">{f.name}</h3>
          <p className="fcard__date">{dateLabel(f)}</p>
          <p className="fcard__where">
            {f.location} · {f.isNational ? 'National' : (region
              ? <Link to={paths.region(f.regionId, country)} className="fcard__region" onClick={(e) => e.stopPropagation()}>{region.emoji} {region.name}</Link>
              : f.regionName)}
          </p>
        </div>
        <span className={`fchip fchip--${f.type.toLowerCase()}`}>{TYPE_EMOJI[f.type] || '•'} {cap(f.type)}</span>
        <ChevronDown size={16} className={`fcard__chev ${open ? 'is-open' : ''}`} />
      </div>
      {open && <p className="fcard__desc">{f.description}</p>}
    </article>
  )
}
