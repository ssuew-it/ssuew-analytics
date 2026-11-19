import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Dzial } from './Dzial'
import { TekstZLinkami } from './TekstZLinkami'
import type { Adnotacja, Ksiega, Wpis } from '@/lib/dziennik/typy'

const k = vi.hoisted(() => ({
  dodajWpis: vi.fn(), zmienWpis: vi.fn(), usunWpis: vi.fn(), dodajAdnotacje: vi.fn(), zmienAdnotacje: vi.fn(), usunAdnotacje: vi.fn(),
}))
vi.mock('@/lib/dziennik/klient', () => ({ klientDziennika: k }))

const DZIS = { rok: 2026, miesiac: 11, dzien: 19 }
const kad = (id: string, nazwa: string, autor: string, zamknieta: number | null) => ({ id, nazwa, autor, funkcja: null, otwarta: 1, zamknieta, kopia: null })
const baza = { tresc: '', utworzono: 1, zmieniono: 1, adnotacje: [] as Adnotacja[] }
const luka = (id: string, kadencjaId: string, x: object = {}): Wpis => ({ ...baza, id, kadencjaId, dzial: 'luka', tytul: id, ileCzasu: '', ...x }) as Wpis
const ksiega = (wpisy: Wpis[]): Ksiega => ({
  otwartaKadencjaId: 'nowa',
  kadencje: [kad('stara', '2025/26', 'Jan K.', 5), kad('nowa', '2026/27', 'Anna W.', null)],
  wpisy,
})
const pokaz = (dzial: Wpis['dzial'], k: Ksiega) =>
  act(async () => {
    render(<Dzial dzial={dzial} ksiega={k} odswiez={vi.fn()} dzis={DZIS} />)
  })

describe('Dzial', () => {
  beforeEach(() => Object.values(k).forEach((f) => f.mockReset()))

  it('wpis starej kadencji bez Popraw i Usuń, bieżącej z nimi; podpis kadencji i autora', async () => {
    await pokaz('luka', ksiega([luka('Stara luka', 'stara'), luka('Nowa luka', 'nowa')]))
    const stara = screen.getByRole('article', { name: 'Stara luka' })
    expect(stara).toHaveTextContent('2025/26 · Jan K.')
    expect(within(stara).queryByRole('button', { name: 'Popraw' })).toBeNull()
    expect(within(stara).queryByRole('button', { name: 'Usuń' })).toBeNull()
    const nowa = screen.getByRole('article', { name: 'Nowa luka' })
    expect(within(nowa).getByRole('button', { name: 'Popraw' })).toBeInTheDocument()
    expect(within(nowa).getByRole('button', { name: 'Usuń' })).toBeInTheDocument()
  })

  it('zamknięty wpis trafia do zwiniętych „Zamknięte (1)”', async () => {
    const zamknieta = luka('Zamknięta', 'stara', { adnotacje: [{ id: 'a', kadencjaId: 'nowa', stan: 'zamkniete', celId: null, stanCelu: null, komentarz: '', kiedy: 2 }] })
    await pokaz('luka', ksiega([zamknieta, luka('Otwarta', 'stara')]))
    const zwiniete = screen.getByText('Zamknięte (1)').closest('details')!
    expect(within(zwiniete).getByRole('article', { name: 'Zamknięta' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Otwarta' }).closest('details')).toBeNull()
  })

  it('kalendarz pracy: oś od bieżącego miesiąca, wpis pod swoim miesiącem', async () => {
    const marzec: Wpis = { ...baza, id: 'm', kadencjaId: 'nowa', dzial: 'cykl', tytul: 'Sprawozdanie', miesiac: 3, dzien: 15, wyprzedzenieTygodni: 2, obowiazkowe: true, rozlicza: ['KR'] }
    await pokaz('cykl', ksiega([marzec]))
    const naglowki = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(naglowki.slice(0, 3)).toEqual(['listopad', 'grudzień', 'styczeń'])
    expect(naglowki).toHaveLength(12)
    const sekcja = screen.getByRole('region', { name: 'marzec' })
    expect(within(sekcja).getByRole('article', { name: 'Sprawozdanie' })).toHaveTextContent('OBOWIĄZKOWE')
  })

  it('pusty dział mówi, co tu wpisać; bez otwartej kadencji nie ma „Dodaj wpis”', async () => {
    await pokaz('luka', ksiega([]))
    expect(screen.getByText('Gdzie coś kuleje i ile czasu trzeba, żeby to naprawić.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dodaj wpis' })).toBeInTheDocument()
    await act(async () => {
      document.body.innerHTML = ''
    })
    await pokaz('luka', { ...ksiega([]), otwartaKadencjaId: null })
    expect(screen.queryByRole('button', { name: 'Dodaj wpis' })).toBeNull()
  })

  it('usunięcie własnego wpisu dopiero po potwierdzeniu', async () => {
    k.usunWpis.mockResolvedValue({ ok: true })
    await pokaz('luka', ksiega([luka('Nowa luka', 'nowa')]))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Usuń' })))
    expect(k.usunWpis).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tak, usuń' })))
    expect(k.usunWpis).toHaveBeenCalledWith('Nowa luka')
  })

  it('adnotacja do wpisu starej kadencji', async () => {
    k.dodajAdnotacje.mockResolvedValue({ id: 'a1' })
    await pokaz('luka', ksiega([luka('Stara luka', 'stara')]))
    const karta = screen.getByRole('article', { name: 'Stara luka' })
    await act(async () => fireEvent.click(within(karta).getByRole('button', { name: 'Skomentuj' })))
    fireEvent.change(within(karta).getByLabelText('Stan wpisu'), { target: { value: 'przejmuje' } })
    fireEvent.change(within(karta).getByLabelText('Komentarz'), { target: { value: 'od marca' } })
    await act(async () => fireEvent.click(within(karta).getByRole('button', { name: 'Zapisz komentarz' })))
    expect(k.dodajAdnotacje).toHaveBeenCalledWith('Stara luka', { stan: 'przejmuje', celId: null, stanCelu: null, komentarz: 'od marca' })
  })

  it('adnotacje widać z kadencją i cudzysłowem; własną można usunąć, cudzej nie', async () => {
    const w = luka('L', 'stara', { adnotacje: [
      { id: 'a0', kadencjaId: 'stara', stan: 'aktualne', celId: null, stanCelu: null, komentarz: 'wciąż boli', kiedy: 1 },
      { id: 'a1', kadencjaId: 'nowa', stan: 'przejmuje', celId: null, stanCelu: null, komentarz: '', kiedy: 2 },
    ] })
    await pokaz('luka', ksiega([w]))
    const lista = screen.getByRole('list', { name: 'Komentarze' })
    const [pierwsza, druga] = within(lista).getAllByRole('listitem')
    expect(pierwsza).toHaveTextContent('2025/26: aktualne - „wciąż boli”')
    expect(within(pierwsza).queryByRole('button', { name: 'Usuń komentarz' })).toBeNull()
    expect(druga).toHaveTextContent('2026/27: przejmuję')
    expect(within(druga).getByRole('button', { name: 'Usuń komentarz' })).toBeInTheDocument()
  })
})

describe('TekstZLinkami', () => {
  it('tekst bez interpretacji HTML, adresy jako bezpieczne linki, akapity', () => {
    const { container } = render(<TekstZLinkami tekst={'<b>x</b> https://a.pl\n\nDrugi akapit'} />)
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText(/<b>x<\/b>/)).toBeInTheDocument()
    const a = screen.getByRole('link', { name: 'https://a.pl' })
    expect(a).toHaveAttribute('href', 'https://a.pl')
    expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })
})
