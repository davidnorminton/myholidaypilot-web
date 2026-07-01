// Builds affiliate URLs from public/data/affiliates.json — same templates and
// params the Android app uses (AffiliateConfig). Substitutes {dynamic} +
// {params}, drops blank params, URL-encodes values.
import { useEffect, useState } from 'react'
import { getAffiliates } from './data.js'

export function buildUrl(entry, dynamic = {}) {
  if (!entry || !entry.urlTemplate) return fallback(entry, dynamic)
  const subs = { ...(entry.params || {}), ...dynamic }
  const tpl = entry.urlTemplate
  const qIdx = tpl.indexOf('?')
  let path = qIdx >= 0 ? tpl.slice(0, qIdx) : tpl
  const query = qIdx >= 0 ? tpl.slice(qIdx + 1) : ''

  for (const [k, v] of Object.entries(subs)) path = path.split(`{${k}}`).join(encodeURIComponent(v ?? ''))
  path = path.replace(/\{[^}]+\}/g, '')

  const pairs = []
  if (query) {
    for (const pair of query.split('&')) {
      if (!pair) continue
      const eq = pair.indexOf('=')
      if (eq < 0) { pairs.push(pair); continue }
      const key = pair.slice(0, eq)
      const raw = pair.slice(eq + 1)
      const m = raw.match(/^\{([^}]+)\}$/)
      const val = m ? (subs[m[1]] ?? '') : raw
      if (String(val).trim() !== '') pairs.push(`${key}=${encodeURIComponent(val)}`)
    }
  }
  return pairs.length ? `${path}?${pairs.join('&')}` : path
}

function fallback(entry, dynamic) {
  const q = Object.values(dynamic).join(' ') || entry?.id || 'italy'
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

export function useAffiliates() {
  const [cfg, setCfg] = useState(null)
  useEffect(() => {
    let live = true
    getAffiliates().then((d) => live && setCfg(d || {})).catch(() => live && setCfg({}))
    return () => { live = false }
  }, [])
  return cfg
}

// Region → nearest major airport IATA (best-effort, for flight links).
export const REGION_IATA = {
  abruzzo: 'PSR', basilicata: 'BRI', calabria: 'SUF', campania: 'NAP',
  emilia_romagna: 'BLQ', friuli: 'TRS', lazio: 'FCO', liguria: 'GOA',
  lombardy: 'MXP', marche: 'AOI', molise: 'NAP', piedmont: 'TRN',
  puglia: 'BRI', sardinia: 'CAG', sicily: 'PMO', trentino: 'VRN',
  tuscany: 'PSA', umbria: 'PEG', vda: 'TRN', veneto: 'VCE',
}

const experiences = (cfg, query, sub) => ({
  kind: 'providers', title: 'Experiences & tickets', sub,
  providers: [
    { id: 'getyourguide', name: 'GetYourGuide', url: buildUrl(cfg.getyourguide, { query }) },
    { id: 'viator', name: 'Viator', url: buildUrl(cfg.viator, { query }) },
    { id: 'civitatis', name: 'Civitatis', url: buildUrl(cfg.civitatis, { query }) },
  ],
})
const insurance = (cfg) => ({
  kind: 'primary', icon: 'shield', title: 'Travel insurance', sub: 'Cover for your trip',
  cta: 'Get a quote', url: buildUrl(cfg.worldnomads, {}),
})
const esim = (cfg) => ({
  kind: 'primary', icon: 'wifi', title: 'Italy eSIM', sub: 'Data the moment you land',
  cta: 'Get connected', url: buildUrl(cfg.airalo, {}),
})

export function placeOffers(cfg, { placeName, regionName }) {
  if (!cfg) return []
  return [
    { kind: 'primary', icon: 'hotel', title: 'Hotels', sub: `in ${placeName}`,
      cta: 'Find stays', url: buildUrl(cfg.booking, { location: `${placeName} ${regionName}` }) },
    experiences(cfg, placeName, `in ${placeName}`),
    insurance(cfg),
    esim(cfg),
  ]
}

export function regionOffers(cfg, { regionId, regionName, capital }) {
  if (!cfg) return []
  const iata = REGION_IATA[regionId]
  const offers = [
    { kind: 'primary', icon: 'hotel', title: 'Hotels', sub: `in ${capital}`,
      cta: 'Find stays', url: buildUrl(cfg.booking, { location: `${capital} ${regionName}` }) },
    experiences(cfg, regionName, `across ${regionName}`),
  ]
  if (iata) offers.push({
    kind: 'primary', icon: 'plane', title: 'Flights', sub: `to ${regionName}`,
    cta: 'Compare fares', url: buildUrl(cfg.skyscanner, { iata }),
  })
  offers.push(
    { kind: 'primary', icon: 'train', title: 'Trains', sub: `to ${capital}`,
      cta: 'Book rail', url: buildUrl(cfg.trainline, { destination: capital }) },
    insurance(cfg),
    esim(cfg),
  )
  return offers
}
