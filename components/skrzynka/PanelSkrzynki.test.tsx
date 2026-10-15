import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PanelSkrzynki } from '@/components/skrzynka/PanelSkrzynki'
import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'

const refresh = vi.fn()
const klient = { importuj: vi.fn(), synchronizuj: vi.fn() }
const listaProps = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: { importuj: (...a: unknown[]) => klient.importuj(...a), synchronizuj: (...a: unknown[]) => klient.synchronizuj(...a) },
}))
vi.mock('@/components/skrzynka/ListaSpraw', () => ({
  ListaSpraw: (p: { status: string; szukane: string; onWybierz: (id: string) => void }) => {
    listaProps(p)
    return <button type="button" onClick={() => p.onWybierz('t1')}>sprawa t1</button>
  },
}))
vi.mock('@/components/skrzynka/WidokSprawy', () => ({
  WidokSprawy: (p: { id: string; onZmiana: (s: object) => void; onZamknij: () => void }) => (
    <div>
      widok {p.id}
      <button type="button" onClick={() => p.onZmiana({})}>zmień</button>
      <button type="button" onClick={p.onZamknij}>zamknij</button>
    </div>
  ),
}))

const L: LicznikiSkrzynki = {
  stan: 'polaczona', doOdpowiedzi: 7, poTerminie: 2, doPrzejrzenia: 15, czekaNaNich: 4, wToku: 1, zalatwione: 180, pominiete: 3,
  ostatniaSynchronizacja: Date.UTC(2026, 9, 14, 8, 5),
}
const EMAIL = 'kontakt@samorzad.ue.wroc.pl'
const panel = (n: Partial<Parameters<typeof PanelSkrzynki>[0]> = {}) =>
  render(<PanelSkrzynki liczniki={L} postep={null} blad={null} sklad={['Jula']} email={EMAIL} {...n} />)

beforeEach(() => {
  refresh.mockReset()
  listaProps.mockReset()
  Object.values(klient).forEach((f) => f.mockReset())
})

describe('PanelSkrzynki', () => {
  it('bez połączenia - przycisk zgody Google', () => {
    panel({ liczniki: { ...L, stan: 'brak' } })
    expect(screen.getByRole('link', { name: 'Połącz skrzynkę' })).toHaveAttribute('href', '/api/skrzynka/polacz')
  })

  it('rozłączona - ostrzeżenie i ponowne połączenie', () => {
    panel({ liczniki: { ...L, stan: 'rozlaczona' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/rozłączona/)
    expect(screen.getByRole('link', { name: 'Połącz ponownie' })).toHaveAttribute('href', '/api/skrzynka/polacz')
  })

  it('błąd z powrotu zgody i nieczytelny stan', () => {
    panel({ liczniki: { ...L, stan: 'brak' }, blad: 'inne-konto' })
    expect(screen.getByRole('alert')).toHaveTextContent(/kontakt@samorzad\.ue\.wroc\.pl/)
    panel({ liczniki: null })
    expect(screen.getAllByRole('alert').at(-1)).toHaveTextContent(/Nie udało się odczytać stanu skrzynki/)
  })

  it('zakładki z liczbami; domyślnie Do odpowiedzi; zmiana zakładki', () => {
    panel()
    const zakladki = screen.getByRole('tablist', { name: 'Statusy spraw' })
    expect(zakladki).toHaveTextContent('Do odpowiedzi7')
    expect(zakladki).toHaveTextContent('Załatwione180')
    expect(screen.getByRole('tab', { name: /Do odpowiedzi/ })).toHaveAttribute('aria-selected', 'true')
    expect(listaProps).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'do-odpowiedzi', szukane: '' }))
    fireEvent.click(screen.getByRole('tab', { name: /Załatwione/ }))
    expect(listaProps).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'zalatwiona' }))
  })

  it('wyszukiwanie i powrót do zakładek', () => {
    panel()
    fireEvent.change(screen.getByLabelText('Szukaj w skrzynce'), { target: { value: 'oferta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Szukaj' }))
    expect(listaProps).toHaveBeenLastCalledWith(expect.objectContaining({ szukane: 'oferta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść' }))
    expect(listaProps).toHaveBeenLastCalledWith(expect.objectContaining({ szukane: '' }))
  })

  it('wybór sprawy otwiera wątek; zmiana odświeża liczby; zamknięcie wraca do listy', () => {
    panel()
    fireEvent.click(screen.getByRole('button', { name: 'sprawa t1' }))
    expect(screen.getByText('widok t1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'zmień' }))
    expect(refresh).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'zamknij' }))
    expect(screen.queryByText('widok t1')).toBeNull()
  })

  it('Dociągnij - synchronizacja i odświeżenie; błąd widać', async () => {
    klient.synchronizuj.mockResolvedValueOnce({ stan: 'zrobione', watki: 2 })
    panel()
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
      panel({ postep })
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

  it('przerwany wcześniej - rusza od zapisanej strony', async () => {
    klient.importuj.mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 300, razem: 300 })
    await start({ trwa: true, zrobione: 200, razem: 300, strona: 'p3' })
    expect(klient.importuj.mock.calls).toEqual([['p3']])
    expect(refresh).toHaveBeenCalled()
  })

  it('limit Gmaila - komunikat i samo wznawia po minucie od tej samej strony', async () => {
    klient.importuj
      .mockRejectedValueOnce(Object.assign(new Error('Gmail chwilowo ogranicza tempo.'), { status: 429 }))
      .mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 5, razem: 5 })
    await start({ trwa: true, zrobione: 0, razem: 0, strona: 'p4' })
    expect(screen.getByRole('status')).toHaveTextContent(/wznowię import za minutę/)
    await uplyw(60_000)
    expect(klient.importuj.mock.calls).toEqual([['p4'], ['p4']])
    expect(refresh).toHaveBeenCalled()
  })
})
