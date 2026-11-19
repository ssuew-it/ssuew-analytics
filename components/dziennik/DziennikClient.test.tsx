import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, within, fireEvent } from '@testing-library/react'
import { DziennikClient, ZAKLADKI, type RenderDzial } from './DziennikClient'
import type { Ksiega } from '@/lib/dziennik/typy'

const k = vi.hoisted(() => ({
  ksiega: vi.fn(), rozpocznij: vi.fn(), kopia: vi.fn(), przekaz: vi.fn(),
  dodajWpis: vi.fn(), zmienWpis: vi.fn(), usunWpis: vi.fn(), dodajAdnotacje: vi.fn(), zmienAdnotacje: vi.fn(), usunAdnotacje: vi.fn(),
}))
vi.mock('@/lib/dziennik/klient', () => ({ klientDziennika: k }))

const DZIS = { rok: 2026, miesiac: 11, dzien: 19 }
const KAD = { id: 'k1', nazwa: '2025/26', autor: 'Jan K.', funkcja: null, otwarta: 1, zamknieta: null, kopia: null }
const OTWARTA: Ksiega = { otwartaKadencjaId: 'k1', kadencje: [KAD], wpisy: [] }
const BEZ: Ksiega = { otwartaKadencjaId: null, kadencje: [{ ...KAD, zamknieta: 2 }], wpisy: [
  { id: 'w', dzial: 'luka', ileCzasu: '', kadencjaId: 'k1', tytul: 'Archiwum', tresc: '', utworzono: 1, zmieniono: 1, adnotacje: [] },
] }

const pokaz = (renderDzial: RenderDzial = vi.fn(() => null)) =>
  act(async () => {
    render(<DziennikClient dzis={DZIS} komunikat={null} dzialStartowy={null} renderDzial={renderDzial} />)
  })
const klik = (el: HTMLElement) => act(async () => fireEvent.click(el))

describe('DziennikClient', () => {
  beforeEach(() => Object.values(k).forEach((f) => f.mockReset()))

  it('bez otwartej kadencji: formularz rozpoczęcia, brak przekazania, zakładki nadal do czytania', async () => {
    k.ksiega.mockResolvedValue(BEZ)
    const renderDzial = vi.fn(() => <p>treść działu</p>)
    await pokaz(renderDzial)
    expect(screen.getByRole('form', { name: 'Rozpocznij kadencję' })).toBeInTheDocument()
    expect(screen.getByText(/Księga ma 1 wpis z 1 kadencji/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Przekaż księgę' })).toBeNull()
    await klik(screen.getByRole('tab', { name: 'Luki' }))
    expect(renderDzial).toHaveBeenLastCalledWith('luka', BEZ, expect.any(Function))
    expect(screen.getByText('treść działu')).toBeInTheDocument()
  })

  it('rozpoczęcie kadencji wysyła pola i odświeża księgę', async () => {
    k.ksiega.mockResolvedValueOnce({ ...BEZ, wpisy: [] }).mockResolvedValue(OTWARTA)
    k.rozpocznij.mockResolvedValue(KAD)
    await pokaz()
    const f = screen.getByRole('form', { name: 'Rozpocznij kadencję' })
    fireEvent.change(within(f).getByLabelText('Nazwa kadencji'), { target: { value: '2026/27' } })
    fireEvent.change(within(f).getByLabelText('Autor'), { target: { value: 'Anna W.' } })
    await act(async () => fireEvent.submit(f))
    expect(k.rozpocznij).toHaveBeenCalledWith({ nazwa: '2026/27', autor: 'Anna W.', funkcja: '' })
    expect(await screen.findByRole('button', { name: 'Przekaż księgę' })).toBeInTheDocument()
  })

  it('zakładki w kolejności, domyślnie Najbliższe', async () => {
    k.ksiega.mockResolvedValue(OTWARTA)
    await pokaz()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(ZAKLADKI.map((z) => z.etykieta))
    expect(ZAKLADKI.map((z) => z.etykieta)).toEqual(['Najbliższe', 'Kalendarz pracy', 'Luki', 'Wątki w toku', 'Pole do innowacji', 'Strategie', 'Przemyślenia'])
    expect(screen.getByRole('tab', { name: 'Najbliższe' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/kadencja 2025\/26 · Jan K\./)).toBeInTheDocument()
  })

  it('przekazanie dopiero po potwierdzeniu, z opisem skutków', async () => {
    k.ksiega.mockResolvedValue(OTWARTA)
    k.przekaz.mockResolvedValue({ link: 'https://docs.google.com/document/d/f' })
    await pokaz()
    await klik(screen.getByRole('button', { name: 'Przekaż księgę' }))
    const okno = screen.getByRole('dialog', { name: 'Przekazanie księgi' })
    expect(okno).toHaveTextContent('kadencja 2025/26 zamknięta')
    expect(okno).toHaveTextContent('Tego nie da się cofnąć.')
    expect(k.przekaz).not.toHaveBeenCalled()
    await klik(within(okno).getByRole('button', { name: 'Anuluj' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await klik(screen.getByRole('button', { name: 'Przekaż księgę' }))
    await klik(within(screen.getByRole('dialog')).getByRole('button', { name: 'Przekaż' }))
    expect(k.przekaz).toHaveBeenCalledWith('k1')
    expect(await screen.findByRole('link', { name: /Kopia na Dysku/ })).toHaveAttribute('href', 'https://docs.google.com/document/d/f')
  })

  it('nieudana kopia pokazuje komunikat i link do pobrania pliku', async () => {
    k.ksiega.mockResolvedValue(OTWARTA)
    k.kopia.mockRejectedValue(new Error('Połącz Dysk w Skrzynka → Ustawienia albo pobierz plik'))
    await pokaz()
    await klik(screen.getByRole('button', { name: 'Zapisz kopię' }))
    expect(screen.getByText('Połącz Dysk w Skrzynka → Ustawienia albo pobierz plik')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pobierz plik' })).toHaveAttribute('href', '/api/dziennik/kopia')
  })

  it('błąd wczytania - komunikat i ponowienie', async () => {
    k.ksiega.mockRejectedValueOnce(new Error('Brak połączenia - spróbuj ponownie.')).mockResolvedValue(OTWARTA)
    await pokaz()
    expect(screen.getByText('Brak połączenia - spróbuj ponownie.')).toBeInTheDocument()
    await klik(screen.getByRole('button', { name: 'Spróbuj ponownie' }))
    expect(screen.getByRole('tab', { name: 'Najbliższe' })).toBeInTheDocument()
  })
})
