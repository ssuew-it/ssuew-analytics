import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Fabryki muszą być w `vi.hoisted`, bo `vi.mock` wędruje ponad importy
// i zwykła stała na górze pliku byłaby w tym momencie jeszcze niezainicjowana.
const dane = vi.hoisted(() => ({
  serie: [
    {
      kategoria: 'Koordynatorzy',
      nazwa: 'Adapciak',
      punkty: [2, 1, 3, 4, 6].map((v, i) => ({
        id: `a${i}`, okres: `${2020 + i}/${2021 + i}`, wartosc: v,
      })),
    },
    {
      kategoria: 'Koordynatorzy',
      nazwa: 'Gala',
      punkty: [4, 2].map((v, i) => ({
        id: `g${i}`, okres: `${2024 + i}/${2025 + i}`, wartosc: v,
      })),
    },
  ],
}))

vi.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => ({ rola: 'owner', laduje: false }),
}))

vi.mock('@/lib/useAnalyticsData', () => ({
  useAnalyticsData: () => ({
    rekrutacje: [], kohorty: [], kpiMetrics: [], serie: dane.serie,
    loading: false, addKpiMetric: vi.fn(), updateKpiMetric: vi.fn(),
  }),
}))

const { default: KpiClient } = await import('@/components/modules/KpiClient')

/**
 * Procenty pojawiają się też w kartach KPI strategicznych, więc asercje muszą
 * celować w konkretny wiersz listy. Wiersz rozpoznajemy po nazwie metryki,
 * która stoi w nim jako pierwszy `span`.
 */
function wiersz(container: HTMLElement, nazwa: string): HTMLElement {
  const el = [...container.querySelectorAll('.deck-row')].find(
    (r) => r.querySelector('span')?.textContent === nazwa,
  )
  if (!el) throw new Error(`Nie ma wiersza „${nazwa}”`)
  return el as HTMLElement
}

describe('KpiClient', () => {
  it('metryka z pięcioma latami zajmuje jeden wiersz, nie pięć', () => {
    render(<KpiClient />)
    expect(screen.getAllByText('Adapciak')).toHaveLength(1)
  })

  it('zmianę liczy z dwóch ostatnich punktów i podaje ją ze znakiem', () => {
    const { container } = render(<KpiClient />)
    // Adapciak kończy się na 4 → 6, czyli +50% - a nie +200% z 2 → 6.
    expect(within(wiersz(container, 'Adapciak')).getByText('+50%')).toBeInTheDocument()
    // Gala to 4 → 2, czyli -50% (iloraz 0,5).
    expect(within(wiersz(container, 'Gala')).getByText('-50%')).toBeInTheDocument()
  })

  it('nagłówek kategorii pokazuje zakres lat, nie pojedynczą parę', () => {
    render(<KpiClient />)
    expect(screen.getByText(/2020\/2021 → 2025\/2026/)).toBeInTheDocument()
  })

  it('rysuje po jednym wykresie na metrykę', () => {
    const { container } = render(<KpiClient />)
    const wykresy = [...container.querySelectorAll('svg[role="img"] title')]
      .map((t) => t.textContent ?? '')
      .filter((t) => t.startsWith('Adapciak') || t.startsWith('Gala'))
    expect(wykresy).toHaveLength(2)
  })

  it('do edycji podstawia ostatni punkt serii', () => {
    const { container } = render(<KpiClient />)
    // Ostatnia wartość Adapciaka to 6, a nie 2 z pierwszego roku.
    expect(within(wiersz(container, 'Adapciak')).getByDisplayValue('6')).toBeInTheDocument()
  })
})
