import { describe, it, expect } from 'vitest'
import { buildPackingSeed } from '../src/lib/packingSeed.js'

const cats = (trip, facts) => buildPackingSeed(trip, facts)
const flat = (c) => c.flatMap((x) => x.items.map((i) => i.text)).join(' | ')

describe('buildPackingSeed', () => {
  it('Japan in July is hot with rain gear and no laundry kit under 7 nights', () => {
    const c = cats({ countryId: 'japan', startDate: '2026-07-20', endDate: '2026-07-24' })
    expect(c.find((x) => x.name.includes('hot'))).toBeTruthy()
    expect(flat(c)).toContain('rain')
    expect(flat(c)).not.toContain('Laundry kit')
  })
  it('Norway in January is cold', () => {
    const c = cats({ countryId: 'norway', startDate: '2026-01-10', endDate: '2026-01-14' })
    expect(c.find((x) => x.name.includes('cold'))).toBeTruthy()
  })
  it('long trips add a laundry kit', () => {
    const c = cats({ countryId: 'italy', startDate: '2026-06-01', endDate: '2026-06-12' })
    expect(flat(c)).toContain('Laundry kit')
  })
  it('country facts feed the adapter line', () => {
    const c = cats({ countryId: 'japan', startDate: '2026-07-20', endDate: '2026-07-24' }, { plugs: 'Type A / B · 100V' })
    expect(flat(c)).toContain('Travel adapter (Type A / B · 100V)')
  })
  it('flights add boarding-pass items', () => {
    const c = cats({ countryId: 'italy', startDate: '2026-06-01', endDate: '2026-06-04', travel: { home: { name: 'Leeds' } } })
    expect(flat(c)).toContain('Boarding passes')
  })
})
