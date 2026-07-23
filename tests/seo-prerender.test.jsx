// @vitest-environment jsdom
// The useSeo ↔ prerender contract: a page whose head was written at build time
// (marked with <meta name="mhp-prerendered">) must NOT have that head
// overwritten by the client on first mount — the build's values are richer.
// The first client-side navigation hands ownership to the client for good.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useSeo, SITE } from '../src/lib/seo.js'

function Page({ title, description, path }) {
  useSeo({ title, description, path })
  return null
}

const RICH_TITLE = 'Italian food, region by region — 40 dishes worth travelling for | myholidaypilot'
const RICH_DESC = 'From Abruzzo\u2019s arrosticini to Sicilian granita: what to eat in every Italian region, where locals actually order it, and the stories behind the dishes.'

const seedPrerenderedHead = (path) => {
  document.head.innerHTML = `
    <meta name="mhp-prerendered" content="${path}">
    <meta name="description" content="${RICH_DESC}">
    <link rel="canonical" href="${SITE.url}${path}">
    <meta property="og:image" content="https://images.unsplash.com/photo-italy-food-hero?w=1200">
  `
  // After innerHTML, or the <title> element it creates would be wiped.
  document.title = RICH_TITLE
  window.history.replaceState(null, '', path)
}

describe('useSeo vs prerendered head', () => {
  beforeEach(() => { document.head.innerHTML = ''; document.title = '' })
  afterEach(cleanup)

  it('leaves the prerendered head alone on first mount', () => {
    seedPrerenderedHead('/italy/food')
    render(<Page title="Food" description="Eat like an Italian" path="/italy/food" />)
    // The thin client values must NOT have replaced the rich build ones.
    expect(document.title).toBe(RICH_TITLE)
    expect(document.head.querySelector('meta[name="description"]').content).toBe(RICH_DESC)
    expect(document.head.querySelector('meta[property="og:image"]').content).toContain('photo-italy-food-hero')
    // Marker still present: we're still on the prerendered page.
    expect(document.head.querySelector('meta[name="mhp-prerendered"]')).not.toBeNull()
  })

  it('takes over the head on the first client-side navigation', () => {
    seedPrerenderedHead('/italy/food')
    render(<Page title="Food" description="Eat like an Italian" path="/italy/food" />)
    // Navigate: different path mounts with different props.
    window.history.replaceState(null, '', '/italy/abruzzo')
    cleanup()
    render(<Page title="Abruzzo" description="Wild mountains, quiet coast" path="/italy/abruzzo" />)
    expect(document.title).toBe(`Abruzzo · ${SITE.name}`)
    expect(document.head.querySelector('meta[name="description"]').content).toBe('Wild mountains, quiet coast')
    // Marker gone: the client owns the head for the rest of the session.
    expect(document.head.querySelector('meta[name="mhp-prerendered"]')).toBeNull()
  })

  it('returning to the original path uses client values (build head is long gone)', () => {
    seedPrerenderedHead('/italy/food')
    render(<Page title="Food" description="Eat like an Italian" path="/italy/food" />)
    window.history.replaceState(null, '', '/italy/abruzzo')
    cleanup()
    render(<Page title="Abruzzo" description="Wild mountains" path="/italy/abruzzo" />)
    window.history.replaceState(null, '', '/italy/food')
    cleanup()
    render(<Page title="Food" description="Eat like an Italian" path="/italy/food" />)
    expect(document.title).toBe(`Food · ${SITE.name}`)
  })

  it('a non-prerendered load (no marker) behaves exactly as before', () => {
    window.history.replaceState(null, '', '/trip-planner')
    render(<Page title="Trip planner" description="Plan it properly" path="/trip-planner" />)
    expect(document.title).toBe(`Trip planner · ${SITE.name}`)
    expect(document.head.querySelector('link[rel="canonical"]').href).toBe(`${SITE.url}/trip-planner`)
  })
})
