import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PanelSkrzynki } from '@/components/skrzynka/PanelSkrzynki'
import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'

const refresh = vi.fn()
const klient = { importuj: vi.fn(), synchronizuj: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: { importuj: (...a: unknown[]) => klient.importuj(...a), synchronizuj: (...a: unknown[]) => klient.synchronizuj(...a) },
}))

const L: LicznikiSkrzynki = {
  stan: 'polaczona', doOdpowiedzi: 7, poTerminie: 2, doPrzejrzenia: 15, czekaNaNich: 4, wToku: 1,
  zalatwione: 0, pominiete: 0,
  ostatniaSynchronizacja: Date.UTC(2026, 9, 14, 8, 5),
}

beforeEach(() => {
  refresh.mockReset()
  Object.values(klient).forEach((f) => f.mockReset())
})

describe('PanelSkrzynki', () => {
  it('bez połączenia - przycisk zgody Google', () => {
    render(<PanelSkrzynki liczniki={{ ...L, stan: 'brak' }} postep={null} blad={null} />)
    expect(screen.getByRole('link', { name: 'Połącz skrzynkę' })).toHaveAttribute('href', '/api/skrzynka/polacz')
  })

  it('rozłączona - ostrzeżenie i ponowne połączenie', () => {
    render(<PanelSkrzynki liczniki={{ ...L, stan: 'rozlaczona' }} postep={null} blad={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/rozłączona/)
    expect(screen.getByRole('link', { name: 'Połącz ponownie' })).toHaveAttribute('href', '/api/skrzynka/polacz')
  })

  it('błąd z powrotu zgody i nieczytelny stan', () => {
    render(<PanelSkrzynki liczniki={{ ...L, stan: 'brak' }} postep={null} blad="inne-konto" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/kontakt@samorzad\.ue\.wroc\.pl/)
    render(<PanelSkrzynki liczniki={null} postep={null} blad={null} />)
    expect(screen.getAllByRole('alert').at(-1)).toHaveTextContent(/Nie udało się odczytać stanu skrzynki/)
  })

  it('połączona - liczniki statusów i czas synchronizacji', () => {
    render(<PanelSkrzynki liczniki={L} postep={null} blad={null} />)
    const liczby = screen.getByRole('region', { name: 'Sprawy według statusu' })
    expect(liczby).toHaveTextContent('Do odpowiedzi7')
    expect(liczby).toHaveTextContent('Po terminie2')
    expect(liczby).toHaveTextContent('Do przejrzenia15')
    expect(screen.getByText(/14\.10\.2026, 10:05/)).toBeInTheDocument()
  })

  it('Dociągnij - synchronizacja i odświeżenie; błąd widać', async () => {
    klient.synchronizuj.mockResolvedValueOnce({ stan: 'zrobione', watki: 2 })
    render(<PanelSkrzynki liczniki={L} postep={null} blad={null} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dociągnij' }))
    })
    expect(refresh).toHaveBeenCalled()
    klient.synchronizuj.mockRejectedValueOnce(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dociągnij' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
  })

})

describe('import skrzynki', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const start = (postep: { trwa: boolean; zrobione: number; razem: number; strona: string | null }) =>
    act(async () => {
      render(<PanelSkrzynki liczniki={L} postep={postep} blad={null} />)
    })
  const uplyw = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })

  it('strona po stronie, nie częściej niż co 6 s; na koniec odświeżenie', async () => {
    klient.importuj
      .mockResolvedValueOnce({ nastepnaStrona: 'p2', zrobione: 100, razem: 230 })
      .mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 230, razem: 230 })
    await start({ trwa: true, zrobione: 0, razem: 0, strona: null })
    expect(klient.importuj.mock.calls).toEqual([[null]])
    await uplyw(5_999)
    expect(klient.importuj).toHaveBeenCalledTimes(1)
    await uplyw(1)
    expect(klient.importuj.mock.calls).toEqual([[null], ['p2']])
    expect(screen.getByText('Importuję 230 z ok. 230 wątków')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('przerwany wcześniej (np. zamknięta karta) - rusza od zapisanej strony', async () => {
    klient.importuj.mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 300, razem: 300 })
    await start({ trwa: true, zrobione: 200, razem: 300, strona: 'p3' })
    expect(klient.importuj.mock.calls).toEqual([['p3']])
    expect(refresh).toHaveBeenCalled()
  })

  it('błąd - komunikat i wznowienie od strony, na której stanął', async () => {
    klient.importuj
      .mockResolvedValueOnce({ nastepnaStrona: 'p2', zrobione: 100, razem: 300 })
      .mockRejectedValueOnce(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    await start({ trwa: true, zrobione: 0, razem: 0, strona: null })
    await uplyw(6_000)
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
    klient.importuj.mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 300, razem: 300 })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }))
    })
    expect(klient.importuj.mock.calls).toEqual([[null], ['p2'], ['p2']])
    expect(refresh).toHaveBeenCalled()
  })

  it('limit Gmaila - komunikat i samo wznawia po minucie od tej samej strony', async () => {
    klient.importuj
      .mockRejectedValueOnce(Object.assign(new Error('Gmail chwilowo ogranicza tempo.'), { status: 429 }))
      .mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 5, razem: 5 })
    await start({ trwa: true, zrobione: 0, razem: 0, strona: 'p4' })
    expect(screen.getByRole('status')).toHaveTextContent(/wznowię import za minutę/)
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).toBeNull()
    await uplyw(59_999)
    expect(klient.importuj).toHaveBeenCalledTimes(1)
    await uplyw(1)
    expect(klient.importuj.mock.calls).toEqual([['p4'], ['p4']])
    expect(refresh).toHaveBeenCalled()
  })
})
