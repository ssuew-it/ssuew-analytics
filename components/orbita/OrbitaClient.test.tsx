import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { OrbitaClient } from './OrbitaClient'

const k = vi.hoisted(() => ({ zadania: vi.fn() }))
vi.mock('@/lib/orbita/klient', () => ({ klientOrbity: k }))
vi.mock('@/components/deck/MatrixRain', () => ({ MatrixRain: () => null }))

describe('OrbitaClient', () => {
  afterEach(() => vi.useRealTimers())

  it('karta otwarta przez noc - po powrocie do karty dzień się zmienia i zadania odświeżają', async () => {
    k.zadania.mockReset().mockResolvedValue([])
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-20T21:00:00Z'))
    await act(async () => {
      render(<OrbitaClient dzis={{ rok: 2026, miesiac: 11, dzien: 20 }} widok="dzis" zDziennika={null} />)
    })
    expect(screen.getByText('piątek 20 listopada')).toBeInTheDocument()
    vi.setSystemTime(new Date('2026-11-21T07:00:00Z'))
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.getByText('sobota 21 listopada')).toBeInTheDocument()
    expect(k.zadania).toHaveBeenCalledTimes(2)
  })
})
