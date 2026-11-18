import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import LoginPage from '@/app/login/page'
import { NAGLOWKI, OSTATNIA_TELEMETRIA } from '@/lib/deck/ekranLogowania'

const zalogujKodem = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => ({ rola: null, laduje: false, blad: null, zalogujHaslem: vi.fn(), zalogujKodem }),
}))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  zalogujKodem.mockReset()
})

describe('LoginPage', () => {
  it('marka D.E.C.K. z pełną nazwą zamiast starej', () => {
    render(<LoginPage />)
    expect(screen.getByText('D.E.C.K.')).toBeInTheDocument()
    expect(screen.getByText('Diagnostic Evaluation of Change & KPIs')).toBeInTheDocument()
    expect(screen.queryByText('SSUEW Analytics')).toBeNull()
  })

  it('liczby są dekoracją z neutralnymi podpisami, nie udają wskaźników', () => {
    render(<LoginPage />)
    for (const podpis of ['sygnał', 'szyfrowanie', 'węzły']) expect(screen.getByText(podpis)).toBeInTheDocument()
    expect(screen.queryByText('conversion')).toBeNull()
    expect(screen.queryByText('retention')).toBeNull()
  })

  it('telemetria pisze się po polsku i kończy na sejfie; formularz kodu zostaje', () => {
    vi.useFakeTimers()
    const { container } = render(<LoginPage />)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(container.textContent).toContain(OSTATNIA_TELEMETRIA)
    expect(screen.getByLabelText('Cyfra 1 z 6')).toBeInTheDocument()
  })

  it('nagłówek z puli, tło wylosowane, napisy bez angielskiego', () => {
    const { container } = render(<LoginPage />)
    const h1 = container.querySelector('h1')!
    expect(NAGLOWKI).toContain(h1.getAttribute('aria-label'))
    expect(container.querySelector('canvas[data-scena]')).not.toBeNull()
    for (const pl of ['kokpit szyfrowany', 'telemetria systemu', 'warstwa dostępu', 'NA ŻYWO']) {
      expect(screen.getByText(pl)).toBeInTheDocument()
    }
    expect(container.textContent).not.toMatch(/encrypted cockpit|system telemetry|access layer|LIVE/)
  })

  it('po dobrym kodzie strona przechodzi do kokpitu z animacją', async () => {
    zalogujKodem.mockResolvedValue(true)
    // jsdom nie ma Web Animations - ruch kratek wyłączamy jak przy „ogranicz ruch”.
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { container } = render(<LoginPage />)
    expect(container.querySelector('main')!.className).not.toContain('deck-wejscie')
    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`Cyfra ${i} z 6`), { target: { value: String(i) } })
    }
    await act(async () => {})
    expect(zalogujKodem).toHaveBeenCalledWith('123456')
    expect(container.querySelector('main')!.className).toContain('deck-wejscie')
    expect(screen.getByRole('status')).toHaveTextContent('Otwieram kokpit')
  })
})
