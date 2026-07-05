import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }))
vi.stubGlobal('IntersectionObserver', class { observe(){} disconnect(){} unobserve(){} })
vi.stubGlobal('ResizeObserver', class { observe(){} disconnect(){} unobserve(){} })

describe('new trip flow', () => {
  it('opens picker and creates a trip', async () => {
    localStorage.setItem('mhp_trips_v1', JSON.stringify({
      trips: [{ id: 't1', name: 'Existing trip', countryId: 'italy', createdAt: 1, places: [] }],
      activeTripId: 't1',
    }))
    const { default: PlanScreen } = await import('../src/screens/PlanScreen.jsx')
    render(<MemoryRouter><PlanScreen /></MemoryRouter>)
    const btns = screen.queryAllByRole('button')
    const newBtn = btns.find((b) => /new trip/i.test(b.textContent))
    console.log('NEW BTN:', newBtn ? 'found' : 'MISSING — buttons: ' + btns.map((b) => b.textContent.trim()).filter(Boolean).slice(0, 12).join(' | '))
    expect(newBtn).toBeTruthy()
    fireEvent.click(newBtn)
    await waitFor(() => expect(document.querySelector('.cpick')).toBeTruthy())
    const items = [...document.querySelectorAll('.cpick__item')]
    console.log('PICKER:', items.length, 'countries, enabled:', items.filter((b) => !b.disabled).length)
    const spain = items.find((b) => b.textContent.includes('Spain'))
    fireEvent.click(spain)
    await waitFor(() => expect(document.querySelector('.cpick')).toBeFalsy())
    const saved = JSON.parse(localStorage.getItem('mhp_trips_v1'))
    console.log('TRIPS AFTER:', saved.trips.length, '| new trip country:', saved.trips.at(-1).countryId)
  })
})
