import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WezDoOrbity } from './WezDoOrbity'
import { KartaWpisu } from './KartaWpisu'
import type { Ksiega, Wpis, WpisCyklu } from '@/lib/dziennik/typy'

vi.mock('@/lib/dziennik/klient', () => ({ klientDziennika: {} }))

const DZIS = { rok: 2026, miesiac: 11, dzien: 20 }
const baza = { kadencjaId: 'k1', tresc: '', utworzono: 1, zmieniono: 1, adnotacje: [] }
const cykl: WpisCyklu = { ...baza, id: 'w1', dzial: 'cykl', tytul: 'Sprawozdanie', miesiac: 3, dzien: 15, wyprzedzenieTygodni: 2, obowiazkowe: true, rozlicza: ['KR'] }
const ksiega = (wpisy: Wpis[]): Ksiega => ({ otwartaKadencjaId: 'k1', kadencje: [], wpisy })

describe('WezDoOrbity', () => {
  it('to samo wystąpienie terminu już w Orbicie → „w Orbicie”', () => {
    render(<WezDoOrbity wpis={cykl} dzis={DZIS} zrodla={[{ wpisId: 'w1', termin: '2027-03-15', zadanieId: 'z' }]} />)
    expect(screen.getByRole('link', { name: 'w Orbicie' })).toHaveAttribute('href', '/orbita?widok=lista')
  })

  it('zeszłoroczne wystąpienie albo brak → „Weź do Orbity” z id wpisu', () => {
    render(<WezDoOrbity wpis={cykl} dzis={DZIS} zrodla={[{ wpisId: 'w1', termin: '2026-03-15', zadanieId: 'z' }]} />)
    expect(screen.getByRole('link', { name: 'Weź do Orbity' })).toHaveAttribute('href', '/orbita?zDziennika=w1')
  })

  it('błąd odczytu źródeł → „Weź do Orbity”', () => {
    render(<WezDoOrbity wpis={cykl} dzis={DZIS} zrodla={null} />)
    expect(screen.getByRole('link', { name: 'Weź do Orbity' })).toBeInTheDocument()
  })

  it('karta: wpis kalendarza ma przycisk, luka nie', () => {
    const luka: Wpis = { ...baza, id: 'l1', dzial: 'luka', tytul: 'Luka', ileCzasu: '' }
    const orbita = { dzis: DZIS, zrodla: null }
    render(<KartaWpisu wpis={cykl} ksiega={ksiega([cykl])} odswiez={vi.fn()} onPopraw={vi.fn()} orbita={orbita} />)
    render(<KartaWpisu wpis={luka} ksiega={ksiega([luka])} odswiez={vi.fn()} onPopraw={vi.fn()} orbita={orbita} />)
    expect(screen.getAllByRole('link', { name: 'Weź do Orbity' })).toHaveLength(1)
  })
})
