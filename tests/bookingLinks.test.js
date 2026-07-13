import { describe, it, expect } from 'vitest'
import { codeFor, skyscannerUrl, bookingUrl, skyCountry } from '../src/lib/bookingLinks.js'

const aff = { skyscanner: { urlTemplate: 'https://www.skyscanner.net/g/referrals/v1/flights/browse-view/?origin={origin}&destination={iata}&outboundDate={outboundDate}&adults={adults}&mediaPartnerId={mediaPartnerId}', params: { adults: '1', affiliateId: 'x' } },
              booking: { urlTemplate: 'https://www.booking.com/searchresults.html?ss={location}&checkin={checkin}&checkout={checkout}&group_adults={group_adults}&lang=en-gb&aid={aid}&label={label}', params: { group_adults: '2', aid: '', label: '' } } }

describe('codeFor', () => {
  it('prefers the explicit IATA code', () => {
    expect(codeFor({ iata: 'LBA', name: 'Leeds Bradford' }, 'xx')).toBe('lba')
  })
  it('parses (XXX) out of a name', () => {
    expect(codeFor({ name: 'Naples International (NAP)' }, 'xx')).toBe('nap')
  })
  it('falls back to the country code', () => {
    expect(codeFor({ name: 'Somewhere' }, 'it')).toBe('it')
  })
})

describe('skyscannerUrl', () => {
  const trip = { countryId: 'italy', startDate: '2026-07-10', endDate: '2026-07-13',
    travel: { home: { iata: 'LBA', name: 'Leeds' }, arrive: { name: 'Naples (NAP)' }, depart: { name: 'Naples (NAP)' } } }
  it('builds an arrive search LBA→NAP on the start date', () => {
    const u = skyscannerUrl(aff, trip, 'arrive')
    expect(u).toContain('origin=lba')
    expect(u).toContain('destination=nap')
    expect(u).toContain('outboundDate=2026-07-10')
  })
  it('converts gb to uk (Skyscanner rejects gb)', () => {
    expect(skyCountry('gb')).toBe('uk')
    expect(skyCountry('it')).toBe('it')
  })
  it('depart is a one-way FROM the destination on the end date', () => {
    const u = skyscannerUrl(aff, trip, 'depart')
    expect(u).toContain('origin=nap')
    expect(u).toContain('outboundDate=2026-07-13')
  })
})

describe('bookingUrl', () => {
  it('drops empty affiliate params so the link works uncommissioned', () => {
    const u = bookingUrl(aff, { location: 'Rome Lazio', checkin: '2026-07-10', checkout: '2026-07-13' })
    expect(u).toContain('ss=Rome')
    expect(u).not.toContain('aid=')
    expect(u).not.toContain('label=')
  })
  it('defaults checkout to one night when only checkin is known', () => {
    const u = bookingUrl(aff, { location: 'Rome', checkin: '2026-07-10' })
    expect(u).toContain('checkin=2026-07-10')
    expect(u).toContain('checkout=2026-07-11')
  })
})
