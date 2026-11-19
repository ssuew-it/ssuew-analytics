import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { FormularzWpisu } from './FormularzWpisu'

const wpisz = (etykieta: string, wartosc: string) => fireEvent.change(screen.getByLabelText(etykieta), { target: { value: wartosc } })
const zapisz = () => act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zapisz' })))

describe('FormularzWpisu', () => {
  it('strategia: dwa cele, okres, status', async () => {
    const onZapisz = vi.fn().mockResolvedValue(undefined)
    render(<FormularzWpisu dzial="strategia" onZapisz={onZapisz} onAnuluj={vi.fn()} />)
    wpisz('Tytuł', 'Strategia Cyfryzacji')
    wpisz('Okres od', '2026')
    wpisz('Okres do', '2027')
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj cel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj cel' }))
    const cele = screen.getAllByLabelText(/^Cel \d+$/)
    fireEvent.change(cele[0], { target: { value: 'Nowe konta' } })
    fireEvent.change(cele[1], { target: { value: 'Archiwum' } })
    await zapisz()
    expect(onZapisz).toHaveBeenCalledWith(expect.objectContaining({
      dzial: 'strategia', tytul: 'Strategia Cyfryzacji', okresOd: 2026, okresDo: 2027, status: 'projekt',
      cele: [{ id: '', tresc: 'Nowe konta' }, { id: '', tresc: 'Archiwum' }],
    }))
  })

  it('kalendarz pracy: podpowiedzi rozliczających plus inne po przecinku, dzień pusty = null', async () => {
    const onZapisz = vi.fn().mockResolvedValue(undefined)
    render(<FormularzWpisu dzial="cykl" onZapisz={onZapisz} onAnuluj={vi.fn()} />)
    wpisz('Tytuł', 'Sprawozdanie')
    wpisz('Miesiąc', '3')
    fireEvent.click(screen.getByLabelText('Obowiązkowe'))
    fireEvent.click(screen.getByLabelText('KR'))
    wpisz('Inni rozliczający (po przecinku)', 'Senat, Rektor')
    await zapisz()
    expect(onZapisz).toHaveBeenCalledWith({
      dzial: 'cykl', tytul: 'Sprawozdanie', tresc: '', miesiac: 3, dzien: null, wyprzedzenieTygodni: 2, obowiazkowe: true, rozlicza: ['KR', 'Senat', 'Rektor'],
    })
  })

  it('poprawka wypełnia pola wpisem i zachowuje id celów', async () => {
    const onZapisz = vi.fn().mockResolvedValue(undefined)
    render(<FormularzWpisu dzial="strategia" onZapisz={onZapisz} onAnuluj={vi.fn()} wpis={{
      id: 's', kadencjaId: 'k', utworzono: 1, zmieniono: 1, adnotacje: [], dzial: 'strategia', tytul: 'S', tresc: 'T',
      link: 'https://x.pl', okresOd: 2026, okresDo: 2028, status: 'przyjeta', uchwala: 'U 1', cele: [{ id: 'c1', tresc: 'A' }],
    }} />)
    expect(screen.getByLabelText('Tytuł')).toHaveValue('S')
    await zapisz()
    expect(onZapisz).toHaveBeenCalledWith(expect.objectContaining({ status: 'przyjeta', uchwala: 'U 1', cele: [{ id: 'c1', tresc: 'A' }] }))
  })

  it('błąd serwera widać nad przyciskiem, a formularz zostaje', async () => {
    render(<FormularzWpisu dzial="luka" onZapisz={vi.fn().mockRejectedValue(new Error('Tytuł jest wymagany'))} onAnuluj={vi.fn()} />)
    await zapisz()
    expect(screen.getByRole('alert')).toHaveTextContent('Tytuł jest wymagany')
    expect(screen.getByLabelText('Tytuł')).toBeInTheDocument()
  })

  it('licznik znaków treści - przemyślenie ma dłuższy limit', () => {
    render(<FormularzWpisu dzial="przemyslenie" onZapisz={vi.fn()} onAnuluj={vi.fn()} />)
    wpisz('Treść', 'abc')
    expect(screen.getByText('3 / 20000')).toBeInTheDocument()
  })
})
