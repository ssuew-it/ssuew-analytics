import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Suspense } from 'react'
import { PanelStron } from '@/components/strony/PanelStron'
import type { StatystykiStrony, WynikStrony } from '@/lib/strony/model'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
// Recharts w jsdom nie ma rozmiaru - wykres sprawdza build i oko na produkcji.
vi.mock('@/components/strony/WykresStrony', () => ({ WykresStrony: () => <div data-testid="wykres" /> }))

const EMAIL = 'deck@p.iam.gserviceaccount.com'

const stat = (nadpisz: Partial<StatystykiStrony> = {}): StatystykiStrony => ({
  witryna: 'sc-domain:jwk26.pl',
  nazwa: 'jwk26.pl',
  okres: { od: '2026-09-04', do: '2026-10-01' },
  biezace: { klikniecia: 60, wyswietlenia: 2000, ctr: 0.03, pozycja: 7.3 },
  poprzednie: { klikniecia: 100, wyswietlenia: 2000, ctr: 0.05, pozycja: 8.1 },
  zmiana: { klikniecia: -0.4, wyswietlenia: 0 },
  dzienne: [],
  zapytania: [{ tekst: 'juwenalia wrocław', klikniecia: 20, wyswietlenia: 300, pozycja: 4.2 }],
  podstrony: [{ adres: 'https://jwk26.pl/zapisy', klikniecia: 30, wyswietlenia: 900, pozycja: 3.1 }],
  alert: true,
  ...nadpisz,
})

const JWK: WynikStrony = { ok: true, dane: stat() }
const SAMORZAD: WynikStrony = {
  ok: false, witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'samorzad.ue.wroc.pl', blad: 'brak-dostepu',
  komunikat: `Brak dostępu. Dodaj ${EMAIL}, uprawnienie „Ograniczone”.`,
}

const drzewo = (wyniki: WynikStrony[] | null) => (
  <Suspense fallback={null}>
    <PanelStron wyniki={Promise.resolve(wyniki)} email={EMAIL} />
  </Suspense>
)

async function panel(wyniki: WynikStrony[] | null) {
  let wynik!: ReturnType<typeof render>
  await act(async () => {
    wynik = render(drzewo(wyniki))
  })
  return wynik
}

describe('PanelStron', () => {
  it('lista nieczytelna - komunikat', async () => {
    await panel(null)
    expect(screen.getByRole('alert')).toHaveTextContent(/Nie udało się odczytać listy stron/)
  })

  it('pusta lista - instrukcja konfiguracji z adresem konta', async () => {
    await panel([])
    expect(screen.getByText('Nie ma jeszcze żadnej strony')).toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
  })

  it('zakładka strony: alert, liczby ze zmianą, wykres, zapytania i podstrony', async () => {
    await panel([JWK, SAMORZAD])
    expect(screen.getByRole('tab', { name: /jwk26\.pl/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Kliknięcia spadły o 40% wobec poprzednich 28 dni.')
    expect(screen.getAllByText('-40%').length).toBeGreaterThan(0)
    expect(screen.getByText('-2,0 p.p.')).toBeInTheDocument()
    expect(screen.getByText('-0,8')).toBeInTheDocument()
    expect(screen.getByTestId('wykres')).toBeInTheDocument()
    expect(screen.getByText('juwenalia wrocław')).toBeInTheDocument()
    expect(screen.getByText('jwk26.pl/zapisy')).toBeInTheDocument()
  })

  it('podsumowanie liczy alerty i strony z błędem', async () => {
    await panel([JWK, SAMORZAD])
    const podsumowanie = screen.getByRole('region', { name: 'Podsumowanie wszystkich stron' })
    expect(podsumowanie).toHaveTextContent('Kliknięcia razem60')
    expect(podsumowanie).toHaveTextContent('Alerty spadku1')
    expect(podsumowanie).toHaveTextContent('1 z błędem')
  })

  it('zakładka z błędem pokazuje instrukcję i pozwala usunąć stronę; reszta działa', async () => {
    await panel([JWK, SAMORZAD])
    fireEvent.click(screen.getByRole('tab', { name: /samorzad/ }))
    expect(screen.getByRole('alert')).toHaveTextContent(EMAIL)
    expect(screen.getByRole('button', { name: /Usuń z listy/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /jwk26\.pl/ })).toBeInTheDocument()
  })

  it('po usunięciu wybranej strony panel wraca na pierwszą', async () => {
    const { rerender } = await panel([JWK, SAMORZAD])
    fireEvent.click(screen.getByRole('tab', { name: /samorzad/ }))
    await act(async () => {
      rerender(drzewo([JWK]))
    })
    expect(screen.getByRole('tab', { name: /jwk26\.pl/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('juwenalia wrocław')).toBeInTheDocument()
  })
})
