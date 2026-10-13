import { describe, it, expect } from 'vitest'
import { komunikatStrony, podsumujStrony, zlozStatystyki, type StatystykiStrony, type WynikStrony } from '@/lib/strony/model'

const OKRES = { od: '2026-09-04', do: '2026-10-01' }
const STRONA = { witryna: 'sc-domain:jwk26.pl', nazwa: 'jwk26.pl' }
const pusta = { rows: undefined }

describe('zlozStatystyki', () => {
  it('sumy, zmiana, alert, zapytania i podstrony', () => {
    const s = zlozStatystyki({
      strona: STRONA,
      okres: OKRES,
      suma: { rows: [{ clicks: 60, impressions: 2000, ctr: 0.03, position: 7.3 }] },
      sumaPoprzednia: { rows: [{ clicks: 100, impressions: 1600, ctr: 0.0625, position: 8.1 }] },
      dzienne: { rows: [{ keys: ['2026-09-05'], clicks: 4, impressions: 90, ctr: 0.04, position: 6 }] },
      zapytania: { rows: [{ keys: ['juwenalia wrocław'], clicks: 20, impressions: 300, ctr: 0.07, position: 4.2 }] },
      podstrony: { rows: [{ keys: ['https://jwk26.pl/zapisy'], clicks: 30, impressions: 900, ctr: 0.03, position: 3.1 }] },
    })
    expect(s.biezace).toEqual({ klikniecia: 60, wyswietlenia: 2000, ctr: 0.03, pozycja: 7.3 })
    expect(s.poprzednie.klikniecia).toBe(100)
    expect(s.zmiana).toEqual({ klikniecia: -0.4, wyswietlenia: 0.25 })
    expect(s.alert).toBe(true)
    expect(s.zapytania).toEqual([{ tekst: 'juwenalia wrocław', klikniecia: 20, wyswietlenia: 300, pozycja: 4.2 }])
    expect(s.podstrony).toEqual([{ adres: 'https://jwk26.pl/zapisy', klikniecia: 30, wyswietlenia: 900, pozycja: 3.1 }])
    expect(s).toMatchObject({ witryna: 'sc-domain:jwk26.pl', nazwa: 'jwk26.pl', okres: OKRES })
  })

  it('dni, których Google nie zwrócił, mają zera - wykres nie łączy linią dziur', () => {
    const s = zlozStatystyki({
      strona: STRONA, okres: OKRES, suma: pusta, sumaPoprzednia: pusta, zapytania: pusta, podstrony: pusta,
      dzienne: { rows: [{ keys: ['2026-09-05'], clicks: 4, impressions: 90, ctr: 0.04, position: 6 }] },
    })
    expect(s.dzienne).toHaveLength(28)
    expect(s.dzienne[0]).toEqual({ data: '2026-09-04', klikniecia: 0, wyswietlenia: 0 })
    expect(s.dzienne[1]).toEqual({ data: '2026-09-05', klikniecia: 4, wyswietlenia: 90 })
  })

  it('pusta odpowiedź - zera, zmiana null, bez alertu, puste listy', () => {
    const s = zlozStatystyki({ strona: STRONA, okres: OKRES, suma: pusta, sumaPoprzednia: pusta, dzienne: pusta, zapytania: pusta, podstrony: pusta })
    expect(s.biezace).toEqual({ klikniecia: 0, wyswietlenia: 0, ctr: 0, pozycja: 0 })
    expect(s.zmiana).toEqual({ klikniecia: null, wyswietlenia: null })
    expect(s.alert).toBe(false)
    expect(s.zapytania).toEqual([])
    expect(s.podstrony).toEqual([])
  })
})

const stat = (k: number, kp: number, alert = false): StatystykiStrony => ({
  witryna: 'w', nazwa: 'w', okres: OKRES,
  biezace: { klikniecia: k, wyswietlenia: k * 10, ctr: 0, pozycja: 0 },
  poprzednie: { klikniecia: kp, wyswietlenia: kp * 10, ctr: 0, pozycja: 0 },
  zmiana: { klikniecia: null, wyswietlenia: null }, dzienne: [], zapytania: [], podstrony: [], alert,
})

describe('podsumujStrony', () => {
  it('sumuje tylko strony, które odpowiedziały; liczy alerty i błędy', () => {
    const wyniki: WynikStrony[] = [
      { ok: true, dane: stat(60, 100, true) },
      { ok: true, dane: stat(40, 20) },
      { ok: false, witryna: 'x', nazwa: 'x', blad: 'brak-dostepu', komunikat: '...' },
    ]
    expect(podsumujStrony(wyniki)).toEqual({
      stron: 3, klikniecia: 100, wyswietlenia: 1000, poprzednieKlikniecia: 120, poprzednieWyswietlenia: 1200, alerty: 1, bledy: 1,
    })
  })

  it('pusta lista', () => {
    expect(podsumujStrony([])).toEqual({
      stron: 0, klikniecia: 0, wyswietlenia: 0, poprzednieKlikniecia: 0, poprzednieWyswietlenia: 0, alerty: 0, bledy: 0,
    })
  })
})

describe('komunikatStrony', () => {
  it('brak dostępu podaje adres konta serwisowego', () => {
    expect(komunikatStrony('brak-dostepu', 'deck@p.iam.gserviceaccount.com')).toMatch(/deck@p\.iam\.gserviceaccount\.com/)
    expect(komunikatStrony('brak-dostepu', 'deck@p.iam.gserviceaccount.com')).toMatch(/Ograniczone/)
    expect(komunikatStrony('api-wylaczone', null)).toMatch(/Google Search Console API/)
    expect(komunikatStrony('inny', null)).toMatch(/spróbuj później/)
  })
})
