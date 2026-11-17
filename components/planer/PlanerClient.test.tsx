import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { POLA_DOMYSLNE, type Semestr, type Wydarzenie } from '@/lib/planer/typy'

// Subskrypcje Firestore podstawione - test sam decyduje, kiedy przychodzi pierwszy obraz.
const { firestore, nic } = vi.hoisted(() => ({
  firestore: { wydarzenia: null as null | ((w: Wydarzenie[]) => void) },
  nic: () => () => {},
}))
vi.mock('@/lib/planer/zapis', () => ({
  subskrybujWydarzenia: (_s: string, gdy: (w: Wydarzenie[]) => void) => {
    firestore.wydarzenia = gdy
    return () => {}
  },
  subskrybujTrybWspolny: nic, subskrybujPropozycje: nic, subskrybujKomentarze: nic, subskrybujObecnosc: nic,
  dodajWydarzenie: vi.fn(), zmienWydarzenie: vi.fn(), usunWydarzenie: vi.fn(), ustawTrybWspolny: vi.fn(),
  przyjmijPropozycje: vi.fn(), odrzucPropozycje: vi.fn(), dodajKomentarz: vi.fn(), zapiszObecnosc: vi.fn(),
}))
vi.mock('@/lib/planer/serwer', () => ({
  dodajPrzezSerwer: vi.fn(), przeniesPrzezSerwer: vi.fn(), zglosKomentarz: vi.fn(), zglosNowe: vi.fn(),
  zglosObecnosc: vi.fn(), zglosPrzeniesienie: vi.fn(), zmienPrzezSerwer: vi.fn(),
}))
vi.mock('@/lib/planer/sklad', () => ({ subskrybujSklad: nic, zapiszSklad: vi.fn() }))

import { PlanerClient } from '@/components/planer/PlanerClient'

const SEMESTR: Semestr = {
  id: '2026Z',
  nazwa: 'Zimowy 2026/2027',
  miesiace: [{ m: 10, y: 2026 }, { m: 11, y: 2026 }, { m: 12, y: 2026 }, { m: 1, y: 2027 }, { m: 2, y: 2027 }],
  archiwalny: false,
}
const ZEBRANIE: Wydarzenie = {
  id: '1', tytul: 'ZEBRANIE ZARZĄDU', kategoria: 'ZEBRANIA',
  rok: 2026, miesiac: 11, dzien: 18, godzina: '18:00', sala: '110', osoby: ['wszyscy'],
  ...POLA_DOMYSLNE,
}

const planer = () =>
  render(<PlanerClient semestr={SEMESTR} rola="owner" kto="kontakt@samorzad.ue.wroc.pl" poczatkowy={null} naZywo />)

afterEach(() => {
  vi.useRealTimers()
  firestore.wydarzenia = null
})

describe('PlanerClient', () => {
  it('dopóki Firestore nie odpowie - „Wczytuję kalendarz”, nie „semestr jest pusty”', () => {
    planer()
    expect(screen.getByRole('status')).toHaveTextContent(/Wczytuję kalendarz/)
    expect(screen.queryByText(/jest jeszcze pusty/)).not.toBeInTheDocument()
    act(() => firestore.wydarzenia?.([]))
    expect(screen.getByText(/jest jeszcze pusty/)).toBeInTheDocument()
    expect(screen.queryByText(/Wczytuję kalendarz/)).not.toBeInTheDocument()
  })

  it('w trakcie semestru otwiera się na bieżącym miesiącu, nie na pierwszym', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 17, 12)))
    planer()
    act(() => firestore.wydarzenia?.([ZEBRANIE]))
    expect(screen.getByText('Listopad 2026')).toBeInTheDocument()
    expect(screen.queryByText('Październik 2026')).not.toBeInTheDocument()
  })
})
