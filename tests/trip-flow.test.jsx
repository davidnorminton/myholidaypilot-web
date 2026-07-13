// @vitest-environment jsdom
// Current planner flow: the basics form (destination select + dates) →
// Create trip → the builder sheet opens and the trip is persisted.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }))
vi.stubGlobal('IntersectionObserver', class { observe(){} disconnect(){} unobserve(){} })
vi.stubGlobal('ResizeObserver', class { observe(){} disconnect(){} unobserve(){} })
vi.mock('../src/components/MapView.jsx', () => ({ default: () => null }))

beforeEach(() => { localStorage.clear(); vi.resetModules() })
afterEach(cleanup)

describe('new trip flow', () => {
  it('fills the form, creates a trip, opens the builder sheet', async () => {
    const { default: PlanScreen } = await import('../src/screens/PlanScreen.jsx')
    render(<MemoryRouter><PlanScreen /></MemoryRouter>)

    // destination select
    const select = document.querySelector('.planform__select')
    expect(select).toBeTruthy()
    fireEvent.change(select, { target: { value: 'spain' } })

    // dates
    const dates = [...document.querySelectorAll('.planform__field input[type="date"]')]
    expect(dates.length).toBe(2)
    fireEvent.change(dates[0], { target: { value: '2026-08-01' } })
    fireEvent.change(dates[1], { target: { value: '2026-08-04' } })

    // nights derived label
    await waitFor(() => expect(document.body.textContent).toContain('3 nights'))

    // create → sheet opens, trip persisted
    const create = screen.getByRole('button', { name: /create trip/i })
    fireEvent.click(create)
    await waitFor(() => expect(document.querySelector('.plansheet')).toBeTruthy())

    const saved = JSON.parse(localStorage.getItem('mhp_trips_v1'))
    expect(saved.trips.length).toBe(1)
    expect(saved.trips[0].countryId).toBe('spain')
    expect(saved.trips[0].startDate).toBe('2026-08-01')
    expect(saved.schemaVersion).toBe(1)
  })

  it('a trip in progress shows Resume instead of Create', async () => {
    localStorage.setItem('mhp_trips_v1', JSON.stringify({
      schemaVersion: 1,
      trips: [{ id: 't1', name: 'Roma weekend', countryId: 'italy', createdAt: 1, places: [], startDate: '2026-09-01', endDate: '2026-09-03' }],
      activeTripId: 't1',
    }))
    const { default: PlanScreen } = await import('../src/screens/PlanScreen.jsx')
    render(<MemoryRouter><PlanScreen /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /resume building/i }).textContent).toContain('Roma weekend')
    expect(screen.queryByRole('button', { name: /create trip/i })).toBeFalsy()
  })
})
