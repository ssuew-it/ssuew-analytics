import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PlanKalendarza } from '@/lib/kalendarz/porownanie'
import type { WydarzenieGoogle } from '@/lib/kalendarz/wydarzenie'
import { WyslijDoKalendarza } from './WyslijDoKalendarza'

const fetchMock = vi.fn()
const odp = (status: number, dane: unknown) => new Response(JSON.stringify(dane), { status })

const g = (summary: string, dzien: number, czas = true): WydarzenieGoogle => ({
  summary,
  start: czas ? { dateTime: `2026-11-${dzien}T18:00:00`, timeZone: 'Europe/Warsaw' } : { date: `2026-11-${dzien}` },
  end: czas ? { dateTime: `2026-11-${dzien}T20:00:00`, timeZone: 'Europe/Warsaw' } : { date: `2026-11-${dzien + 1}` },
  extendedProperties: { private: { deck: '1', deckId: summary, deckSemestr: '2026Z' } },
})
const pusty: PlanKalendarza = { przejmij: [], dodaj: [], zmien: [], usun: [], doSprawdzenia: [] }
const MIESIACE = ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02']
const podsumowanie = (plan: PlanKalendarza, miesiac = '2026-11') => odp(200, { semestr: '2026Z', miesiace: MIESIACE, miesiac, plan })
const WSZYSTKIE = ['przejmij:Komisja Dydaktyczna', 'dodaj:Gala SSUEW', 'zmien:Projekt Juwenalia', 'usun:g3']
const PLAN: PlanKalendarza = {
  przejmij: [{ wpisId: 'r1', wydarzenie: g('Komisja Dydaktyczna', 21) }],
  dodaj: [g('Gala SSUEW', 25, false)],
  zmien: [{ wpisId: 'g2', wydarzenie: g('Projekt Juwenalia', 12) }],
  usun: [{ id: 'g3', summary: 'Stara komisja', start: { date: '2026-11-03' }, end: { date: '2026-11-04' }, location: null, deckId: 'x', deckSemestr: '2026Z' }],
  doSprawdzenia: [],
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const otworz = async () => {
  render(<WyslijDoKalendarza />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij do Kalendarza Samorządowicza' }))
  })
  return screen.getByRole('dialog', { name: 'Wysyłka do Kalendarza Samorządowicza' })
}

describe('WyslijDoKalendarza', () => {
  it('podsumowanie z przejęciem, dodaniem, zmianą i usunięciem; Wyślij wysyła POST i pokazuje wynik', async () => {
    fetchMock.mockResolvedValueOnce(podsumowanie(PLAN))
    const okno = await otworz()
    expect(fetchMock).toHaveBeenCalledWith('/api/planer/kalendarz', expect.objectContaining({ cache: 'no-store' }))
    expect(within(okno).getByText('Przejmę 1 · dodam 1 · zmienię 1 · usunę 1')).toBeInTheDocument()
    const lista = within(okno).getByRole('list', { name: 'Zmiany w kalendarzu' })
    const wiersze = within(lista).getAllByRole('listitem').map((li) => li.textContent)
    expect(wiersze).toEqual(['≈21.11Komisja Dydaktyczna', '+25.11Gala SSUEW', '~12.11Projekt Juwenalia', '-03.11Stara komisja'])

    fetchMock.mockResolvedValueOnce(odp(200, { udane: 4, nieudane: [] }))
    await act(async () => {
      fireEvent.click(within(okno).getByRole('button', { name: 'Wyślij zaznaczone (4)' }))
    })
    const [adres, opcje] = fetchMock.mock.calls.at(-1)!
    expect(adres).toBe('/api/planer/kalendarz')
    expect(opcje.method).toBe('POST')
    expect(JSON.parse(opcje.body)).toEqual({ miesiac: '2026-11', wybrane: WSZYSTKIE })
    expect(within(okno).getByRole('status')).toHaveTextContent('Wysłano: 4 zmiany')
  })

  it('odznaczone pozycje nie idą', async () => {
    fetchMock.mockResolvedValueOnce(podsumowanie(PLAN))
    const okno = await otworz()
    fireEvent.click(within(okno).getByRole('checkbox', { name: 'dodam 25.11 Gala SSUEW' }))
    fireEvent.click(within(okno).getByRole('checkbox', { name: 'usunę 03.11 Stara komisja' }))
    fetchMock.mockResolvedValueOnce(odp(200, { udane: 2, nieudane: [] }))
    await act(async () => {
      fireEvent.click(within(okno).getByRole('button', { name: 'Wyślij zaznaczone (2)' }))
    })
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).wybrane).toEqual(['przejmij:Komisja Dydaktyczna', 'zmien:Projekt Juwenalia'])
  })

  it('bez zaznaczonych przycisk nieaktywny', async () => {
    fetchMock.mockResolvedValueOnce(podsumowanie({ ...pusty, dodaj: [g('Gala SSUEW', 25)] }))
    const okno = await otworz()
    fireEvent.click(within(okno).getByRole('checkbox', { name: 'dodam 25.11 Gala SSUEW' }))
    expect(within(okno).getByRole('button', { name: 'Wyślij zaznaczone (0)' })).toBeDisabled()
  })

  it('domyślny miesiąc z serwera; zmiana miesiąca liczy podsumowanie od nowa', async () => {
    fetchMock.mockResolvedValueOnce(podsumowanie(pusty, '2026-12'))
    const okno = await otworz()
    expect(fetchMock).toHaveBeenCalledWith('/api/planer/kalendarz', expect.anything())
    const wybor = within(okno).getByRole('combobox', { name: 'Miesiąc' })
    expect(wybor).toHaveValue('2026-12')
    expect(within(wybor).getAllByRole('option').map((o) => o.textContent)).toEqual(['Październik 2026', 'Listopad 2026', 'Grudzień 2026', 'Styczeń 2027', 'Luty 2027'])
    fetchMock.mockResolvedValueOnce(podsumowanie({ ...pusty, dodaj: [g('Gala SSUEW', 25)] }, '2027-01'))
    await act(async () => {
      fireEvent.change(wybor, { target: { value: '2027-01' } })
    })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/planer/kalendarz?miesiac=2027-01', expect.anything())
    expect(within(okno).getByRole('combobox', { name: 'Miesiąc' })).toHaveValue('2027-01')
    expect(within(okno).getByText('Dodam 1')).toBeInTheDocument()
  })

  it('częściowa porażka - lista nieudanych', async () => {
    fetchMock.mockResolvedValueOnce(podsumowanie(PLAN))
    const okno = await otworz()
    fetchMock.mockResolvedValueOnce(odp(200, { udane: 3, nieudane: [{ tytul: 'Gala SSUEW', powod: 'limit Google - kliknij Wyślij ponownie za minutę' }] }))
    await act(async () => {
      fireEvent.click(within(okno).getByRole('button', { name: 'Wyślij zaznaczone (4)' }))
    })
    expect(within(okno).getByRole('status')).toHaveTextContent('Wysłano: 3 zmiany')
    expect(within(okno).getByRole('alert')).toHaveTextContent('Gala SSUEW - limit Google - kliknij Wyślij ponownie za minutę')
  })

  it('bez zmian - Kalendarz jest aktualny, bez przycisku Wyślij', async () => {
    fetchMock.mockResolvedValueOnce(podsumowanie(pusty))
    const okno = await otworz()
    expect(within(okno).getByText('Kalendarz jest aktualny')).toBeInTheDocument()
    expect(within(okno).queryByRole('button', { name: /Wyślij zaznaczone/ })).not.toBeInTheDocument()
  })

  it('do sprawdzenia ręcznie widoczne', async () => {
    fetchMock.mockResolvedValueOnce(podsumowanie({ ...pusty, doSprawdzenia: [{ wydarzenie: g('Komisja Dydaktyczna', 21), kandydaci: 2, spotkanie: false }] }))
    const okno = await otworz()
    const sekcja = within(okno).getByRole('region', { name: 'Do sprawdzenia ręcznie' })
    expect(sekcja).toHaveTextContent('21.11 Komisja Dydaktyczna - 2 pasujące wpisy w kalendarzu')
  })

  it('do sprawdzenia: pasujące spotkanie z gośćmi opisane wprost', async () => {
    fetchMock.mockResolvedValueOnce(podsumowanie({ ...pusty, doSprawdzenia: [{ wydarzenie: g('Komisja Dydaktyczna', 21), kandydaci: 1, spotkanie: true }] }))
    const okno = await otworz()
    expect(within(okno).getByRole('region', { name: 'Do sprawdzenia ręcznie' }))
      .toHaveTextContent('21.11 Komisja Dydaktyczna - w kalendarzu jest spotkanie z gośćmi albo zaproszenie o tym tytule')
  })

  it('błąd 409 - komunikat z odnośnikiem do Ustawień', async () => {
    fetchMock.mockResolvedValueOnce(odp(409, { error: 'Kalendarz niepołączony - połącz go w Ustawieniach skrzynki.' }))
    const okno = await otworz()
    expect(within(okno).getByRole('alert')).toHaveTextContent('Kalendarz niepołączony - połącz go w Ustawieniach skrzynki.')
    expect(within(okno).getByRole('link', { name: 'Ustawienia skrzynki' })).toHaveAttribute('href', '/skrzynka?ustawienia=1')
  })

  it('Zamknij chowa okno', async () => {
    fetchMock.mockResolvedValueOnce(podsumowanie(pusty))
    const okno = await otworz()
    fireEvent.click(within(okno).getByRole('button', { name: 'Zamknij' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
