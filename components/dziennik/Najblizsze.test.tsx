import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Najblizsze } from './Najblizsze'
import type { Ksiega, Wpis } from '@/lib/dziennik/typy'

const DZIS = { rok: 2026, miesiac: 11, dzien: 19 }
const baza = { kadencjaId: 'k1', tresc: '', utworzono: 1, zmieniono: 1, adnotacje: [] }
const cykl = (id: string, x: object): Wpis => ({ ...baza, id, dzial: 'cykl', tytul: id, miesiac: 12, dzien: 10, wyprzedzenieTygodni: 2, obowiazkowe: false, rozlicza: [], ...x }) as Wpis
const ksiega = (wpisy: Wpis[]): Ksiega => ({ otwartaKadencjaId: 'k1', kadencje: [], wpisy })

describe('Najblizsze', () => {
  it('obowiązkowy z podmiotami, termin i początek przygotowań', () => {
    render(<Najblizsze ksiega={ksiega([cykl('Sprawozdanie dla KR', { obowiazkowe: true, rozlicza: ['KR', 'RUSS'] })])} dzis={DZIS} onIdzDo={vi.fn()} />)
    expect(screen.getByText('Sprawozdanie dla KR')).toBeInTheDocument()
    expect(screen.getByText('OBOWIĄZKOWE')).toBeInTheDocument()
    expect(screen.getByText(/KR · RUSS/)).toBeInTheDocument()
    expect(screen.getByText(/do 10 grudnia/)).toBeInTheDocument()
    expect(screen.getByText(/przygotuj od 26 listopada/)).toBeInTheDocument()
  })

  it('dzień null - sam miesiąc; przygotowania w toku oznaczone', () => {
    render(<Najblizsze ksiega={ksiega([cykl('Budżet', { miesiac: 11, dzien: null })])} dzis={DZIS} onIdzDo={vi.fn()} />)
    expect(screen.getByText(/listopad \(do końca miesiąca\)/)).toBeInTheDocument()
    expect(screen.getByText('trwa')).toBeInTheDocument()
  })

  it('liczy otwarte wątki i luki', () => {
    const watek: Wpis = { ...baza, id: 'w', dzial: 'watek', tytul: 'W', zostalo: '' }
    const luka: Wpis = { ...baza, id: 'l', dzial: 'luka', tytul: 'L', ileCzasu: '' }
    const zamknieta: Wpis = { ...luka, id: 'z', adnotacje: [{ id: 'a', kadencjaId: 'k', stan: 'zamkniete', celId: null, stanCelu: null, komentarz: '', kiedy: 1 }] }
    render(<Najblizsze ksiega={ksiega([watek, luka, zamknieta])} dzis={DZIS} onIdzDo={vi.fn()} />)
    expect(screen.getByText('W toku: 1 wątek, 1 luka')).toBeInTheDocument()
  })

  it('każda pozycja ma przejście do Orbity', () => {
    render(
      <Najblizsze
        ksiega={ksiega([cykl('A', {}), cykl('B', { dzien: 12 })])}
        dzis={DZIS}
        onIdzDo={vi.fn()}
        zrodla={[{ wpisId: 'A', termin: '2026-12-10', zadanieId: 'z' }]}
      />,
    )
    expect(screen.getByRole('link', { name: 'w Orbicie' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Weź do Orbity' })).toHaveAttribute('href', '/orbita?zDziennika=B')
  })

  it('pusto - zdanie i przejście do kalendarza pracy', () => {
    const onIdzDo = vi.fn()
    render(<Najblizsze ksiega={ksiega([])} dzis={DZIS} onIdzDo={onIdzDo} />)
    expect(screen.getByText('W ciągu 30 dni nic z kalendarza pracy.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz kalendarz pracy' }))
    expect(onIdzDo).toHaveBeenCalledWith('cykl')
  })
})
