import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListaSpraw } from '@/components/skrzynka/ListaSpraw'
import type { Sprawa } from '@/lib/skrzynka/typy'

const klient = { sprawy: vi.fn(), szukaj: vi.fn(), zmien: vi.fn(), zmienWiele: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: {
    sprawy: (...a: unknown[]) => klient.sprawy(...a),
    szukaj: (...a: unknown[]) => klient.szukaj(...a),
    zmien: (...a: unknown[]) => klient.zmien(...a),
    zmienWiele: (...a: unknown[]) => klient.zmienWiele(...a),
  },
}))

const S = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
  id, temat: `Temat ${id}`, status: 'zalatwiona', oczekujeOd: null, nowa: false, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
  ostatnia: { kiedy: Date.UTC(2026, 8, 2), kierunek: 'oni', fragment: 'Dzień dobry' }, wiadomosci: 1, przypisana: null, kategoriaGmail: null, zmieniono: 1, ...n,
})

async function lista(p: Partial<Parameters<typeof ListaSpraw>[0]> = {}) {
  const onWybierz = vi.fn()
  await act(async () => {
    render(<ListaSpraw status="zalatwiona" szukane="" wybrana={null} onWybierz={onWybierz} wersja={0} {...p} />)
  })
  return onWybierz
}

beforeEach(() => Object.values(klient).forEach((f) => f.mockReset()))

describe('ListaSpraw', () => {
  it('wiersze: nadawca, organizacja, temat, fragment i znaczniki', async () => {
    klient.sprawy.mockResolvedValue({
      sprawy: [S('t1', { status: 'do-odpowiedzi', oczekujeOd: Date.UTC(2020, 0, 1), nowa: true, przypisana: 'Jula' })],
      nastepna: null,
    })
    await lista({ status: 'do-odpowiedzi' })
    expect(klient.sprawy).toHaveBeenCalledWith('do-odpowiedzi', null)
    const wiersz = screen.getByRole('button', { name: /Temat t1/ })
    expect(wiersz).toHaveTextContent('anna@firma.pl · firma.pl')
    expect(wiersz).toHaveTextContent('Dzień dobry')
    expect(wiersz).toHaveTextContent(/po terminie/i)
    expect(wiersz).toHaveTextContent(/nowa/i)
    expect(wiersz).toHaveTextContent('Jula')
  })

  it('wybór sprawy zdejmuje znacznik nowej od razu', async () => {
    klient.sprawy.mockResolvedValue({ sprawy: [S('t1', { nowa: true })], nastepna: null })
    const onWybierz = await lista()
    fireEvent.click(screen.getByRole('button', { name: /Temat t1/ }))
    expect(onWybierz).toHaveBeenCalledWith('t1')
    expect(screen.getByRole('button', { name: /Temat t1/ })).not.toHaveTextContent(/nowa/i)
  })

  it('kolejna strona po kursorze', async () => {
    klient.sprawy.mockResolvedValueOnce({ sprawy: [S('t1')], nastepna: 'k1' }).mockResolvedValueOnce({ sprawy: [S('t2')], nastepna: null })
    await lista()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }))
    })
    expect(klient.sprawy).toHaveBeenLastCalledWith('zalatwiona', 'k1')
    expect(screen.getByRole('button', { name: /Temat t2/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pokaż więcej' })).toBeNull()
  })

  it('wyszukiwanie, pusta lista i błąd', async () => {
    klient.szukaj.mockResolvedValue({ sprawy: [], nastepna: null })
    await lista({ szukane: 'oferta' })
    expect(klient.szukaj).toHaveBeenCalledWith('oferta')
    expect(screen.getByText('Nic nie znaleziono.')).toBeInTheDocument()
    klient.sprawy.mockRejectedValue(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    await lista()
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
  })
})

describe('ListaSpraw - Do przejrzenia i błędy', () => {
  it('Do przejrzenia: jednym kliknięciem do odpowiedzi albo do pominiętych; sprawa znika, rodzic odświeża liczby', async () => {
    klient.sprawy.mockResolvedValue({ sprawy: [S('t1', { status: 'do-przejrzenia' }), S('t2', { status: 'do-przejrzenia' })], nastepna: null })
    klient.zmien.mockResolvedValue({})
    const onZmiana = vi.fn()
    await lista({ status: 'do-przejrzenia', onZmiana })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Do odpowiedzi: Temat t1' }))
    })
    expect(klient.zmien).toHaveBeenCalledWith('t1', { status: 'do-odpowiedzi' })
    expect(screen.queryByRole('button', { name: /Temat t1/ })).toBeNull()
    expect(onZmiana).toHaveBeenCalledTimes(1)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pomiń: Temat t2' }))
    })
    expect(klient.zmien).toHaveBeenLastCalledWith('t2', { status: 'pominieta' })
  })

  it('inne zakładki bez szybkich akcji', async () => {
    klient.sprawy.mockResolvedValue({ sprawy: [S('t1')], nastepna: null })
    await lista()
    expect(screen.queryByRole('button', { name: /^Pomiń:/ })).toBeNull()
  })

  it('błąd przy „Pokaż więcej” zostawia wczytaną listę', async () => {
    klient.sprawy
      .mockResolvedValueOnce({ sprawy: [S('t1')], nastepna: 'k1' })
      .mockRejectedValueOnce(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    await lista()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
    expect(screen.getByRole('button', { name: /Temat t1/ })).toBeInTheDocument()
  })

  it('zaznaczanie: wszystkie albo wybrane, zbiorczo do Załatwionych, znikają z listy', async () => {
    klient.sprawy.mockResolvedValue({ sprawy: [S('t1', { status: 'do-odpowiedzi' }), S('t2', { status: 'do-odpowiedzi' }), S('t3', { status: 'do-odpowiedzi' })], nastepna: null })
    const onZmiana = vi.fn()
    await lista({ status: 'do-odpowiedzi', onZmiana })
    expect(screen.queryByRole('button', { name: /Załatwione \(/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Zaznacz wszystkie (3)' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Zaznacz: Temat t2' }))
    klient.zmienWiele.mockResolvedValue({ zmienione: 2 })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Załatwione (2)' }))
    })
    expect(klient.zmienWiele).toHaveBeenCalledWith(['t1', 't3'], 'zalatwiona')
    expect(screen.queryByRole('button', { name: /Temat t1/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Temat t2/ })).toBeInTheDocument()
    expect(onZmiana).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Załatwione \(/ })).not.toBeInTheDocument()
  })

  it('zbiorcze akcje bez obecnej zakładki; błąd serwera - sprawy zostają', async () => {
    klient.sprawy.mockResolvedValue({ sprawy: [S('t1', { status: 'do-przejrzenia' })], nastepna: null })
    await lista({ status: 'do-przejrzenia' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Zaznacz: Temat t1' }))
    expect(screen.getByRole('button', { name: 'Pominięte (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Do przejrzenia (1)' })).not.toBeInTheDocument()
    klient.zmienWiele.mockRejectedValue(new Error('Nie udało się zmienić spraw.'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Załatwione (1)' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się zmienić spraw.')
    expect(screen.getByText('Temat t1')).toBeInTheDocument()
  })
})
