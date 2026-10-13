import { describe, it, expect } from 'vitest'
import { zbudujKontekst, type DaneProjektu } from '@/lib/asystent/kontekst'
import { POLA_DOMYSLNE, type Wydarzenie } from '@/lib/planer/typy'
import type { StatystykiStrony } from '@/lib/strony/model'

const DZIS = { rok: 2026, miesiac: 10, dzien: 2 }

function w(nadpisz: Partial<Wydarzenie>): Wydarzenie {
  return {
    id: 'x', tytul: 'A', kategoria: 'ZEBRANIA', rok: 2026, miesiac: 10, dzien: 5,
    godzina: null, sala: null, osoby: [], ...POLA_DOMYSLNE, ...nadpisz,
  }
}

function dane(nadpisz: Partial<DaneProjektu> = {}): DaneProjektu {
  return {
    rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [],
    semestr: { id: '2026Z', nazwa: 'Zimowy 2026/2027' },
    wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, notatki: [], strony: [],
    ...nadpisz,
  }
}

describe('zbudujKontekst', () => {
  it('ten sam stan danych daje ten sam obraz', () => {
    const d = dane({ wydarzenia: [w({ id: 'a', tytul: 'Zebranie' })] })
    expect(zbudujKontekst(d, DZIS)).toEqual(zbudujKontekst(d, DZIS))
  })

  it('bez danych - puste sekcje, nie wyjątek', () => {
    const k = zbudujKontekst(dane(), DZIS)
    expect(k.kpi).toEqual([])
    expect(k.projekty).toBeNull()
    expect(k.planer.wydarzenia).toEqual([])
    expect(k.meta).toEqual({ data: '02.10.2026', dzienTygodnia: 'piątek' })
  })

  it('Planer: tylko 21 dni od dziś, także wielodniowe zaczęte wcześniej', () => {
    const k = zbudujKontekst(dane({
      wydarzenia: [
        w({ id: 'dzis', tytul: 'Dziś', dzien: 2, godzina: '18:00' }),
        w({ id: 'za-daleko', tytul: 'Za daleko', dzien: 30 }),
        w({ id: 'wczoraj', tytul: 'Minione', dzien: 1 }),
        w({ id: 'wyjazd', tytul: 'Wyjazd', dzien: 30, miesiac: 9, dni: 4 }),
      ],
    }), DZIS)
    expect(k.planer.wydarzenia.map((x) => x.tytul)).toEqual(['Wyjazd', 'Dziś'])
  })

  it('KPI: ostatnia wartość, rok do roku i kierunek', () => {
    const k = zbudujKontekst(dane({
      punkty: [
        { id: '1', kategoria: 'SKS', nazwa: 'Listopad', okres: '2024/2025', wartosc: 50, created_at: '' },
        { id: '2', kategoria: 'SKS', nazwa: 'Listopad', okres: '2025/2026', wartosc: 30, created_at: '' },
      ],
    }), DZIS)
    expect(k.kpi[0]).toMatchObject({ nazwa: 'Listopad', wartosc: 30, rokDoRoku: 0.6, kierunek: 'spadek' })
  })

  it('notatki trafiają do obrazu jako pewne ustalenia', () => {
    const k = zbudujKontekst(dane({ notatki: ['Zebrania zarządu w środy'] }), DZIS)
    expect(k.notatki).toEqual(['Zebrania zarządu w środy'])
  })

  it('strony: liczby, zmiana w procentach, alert i 3 najlepsze zapytania', () => {
    const strona: StatystykiStrony = {
      witryna: 'sc-domain:jwk26.pl', nazwa: 'jwk26.pl', okres: { od: '2026-09-01', do: '2026-09-28' },
      biezace: { klikniecia: 60, wyswietlenia: 2000, ctr: 0.03, pozycja: 7.26 },
      poprzednie: { klikniecia: 100, wyswietlenia: 2000, ctr: 0.05, pozycja: 8.1 },
      zmiana: { klikniecia: -0.4, wyswietlenia: 0 }, dzienne: [],
      zapytania: ['jwk', 'jwk 2026', 'juwenalia', 'czwarte'].map((tekst) => ({ tekst, klikniecia: 1, wyswietlenia: 1, pozycja: 1 })),
      podstrony: [], alert: true,
    }
    expect(zbudujKontekst(dane({ strony: [strona] }), DZIS).strony).toEqual([{
      strona: 'jwk26.pl', okres: '2026-09-01 - 2026-09-28', klikniecia: 60, wyswietlenia: 2000,
      sredniaPozycja: 7.3, zmianaKlikniecProc: -40, alertSpadku: true, topZapytania: ['jwk', 'jwk 2026', 'juwenalia'],
    }])
  })

  it('członkowie liczeni po statusach w kohortach', () => {
    const k = zbudujKontekst(dane({
      czlonkowie: [
        { id: '1', kohorta_edycja: "J'25", imie_nazwisko: 'A', status: 'aktywny', aktywnosc: [], created_at: '' },
        { id: '2', kohorta_edycja: "J'25", imie_nazwisko: 'B', status: 'aktywny', aktywnosc: [], created_at: '' },
        { id: '3', kohorta_edycja: "J'25", imie_nazwisko: 'C', status: 'nieaktywny', aktywnosc: [], created_at: '' },
      ],
    }), DZIS)
    expect(k.czlonkowie).toEqual([{ kohorta: "J'25", statusy: { aktywny: 2, nieaktywny: 1 } }])
  })
})
