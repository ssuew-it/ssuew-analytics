import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import type { StatystykiStrony } from '@/lib/strony/model'

// `dane.ts` ciągnie arkusz i Firestore - tu potrzebna jest tylko czysta `daneProjektu`.
vi.mock('@/lib/gas/client', () => ({ gasList: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({
  odprawaRef: vi.fn(), propozycjeRef: vi.fn(), semestrRef: vi.fn(), wydarzeniaRef: vi.fn(), ustawieniaRef: vi.fn(),
}))
const skrzynka = vi.hoisted(() => ({ liczniki: vi.fn(), obrazSkrzynki: vi.fn() }))
vi.mock('@/lib/skrzynka/dane', () => skrzynka)
const dziennik = vi.hoisted(() => ({ czytajKsiege: vi.fn() }))
vi.mock('@/lib/dziennik/dane', () => dziennik)
const orbita = vi.hoisted(() => ({ czytajZadania: vi.fn() }))
vi.mock('@/lib/orbita/dane', () => orbita)
const gemini = vi.hoisted(() => ({ zapytajGemini: vi.fn() }))
vi.mock('@/lib/asystent/gemini', async (oryginal) => ({ ...(await oryginal<object>()), zapytajGemini: gemini.zapytajGemini }))

import { daneProjektu, odswiezOdpraweWTle, pobierzObrazDziennika, pobierzObrazOrbity, pobierzObrazSkrzynki } from '@/lib/asystent/dane'
import type { ZapisanaOdprawa } from '@/lib/asystent/odprawa'

describe('daneProjektu', () => {
  it('do obrazu idą tylko strony, które odpowiedziały', () => {
    const strona = { witryna: 'sc-domain:jwk26.pl' } as StatystykiStrony
    const d = daneProjektu(
      { rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [], czasMs: 1 },
      { wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, ok: true },
      { id: '2026Z', nazwa: 'Z' },
      [],
      [{ ok: true, dane: strona }, { ok: false, witryna: 'x', nazwa: 'x', blad: 'inny', komunikat: '' }],
      null,
      null,
      null,
    )
    expect(d.strony).toEqual([strona])
    expect(d.skrzynka).toBeNull()
    expect(d.dziennik).toBeNull()
    expect(d.orbita).toBeNull()
  })
})

describe('pobierzObrazDziennika', () => {
  const DZIS = { rok: 2026, miesiac: 11, dzien: 19 }

  it('obowiązki z księgi w oknie 30 dni', async () => {
    dziennik.czytajKsiege.mockResolvedValue({ otwartaKadencjaId: 'k', kadencje: [], wpisy: [{
      id: 'c', dzial: 'cykl', kadencjaId: 'k', tytul: 'Sprawozdanie', tresc: '', utworzono: 1, zmieniono: 1, adnotacje: [],
      miesiac: 12, dzien: 1, wyprzedzenieTygodni: 0, obowiazkowe: true, rozlicza: ['RUSS'],
    }] })
    expect(await pobierzObrazDziennika(DZIS)).toEqual([{ tytul: 'Sprawozdanie', termin: '01.12.2026', przygotowaniaOd: '01.12.2026', obowiazkowe: true, rozlicza: ['RUSS'] }])
  })

  it('błąd odczytu księgi - null z logiem, bez wyjątku', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    dziennik.czytajKsiege.mockRejectedValue(new Error('firestore'))
    expect(await pobierzObrazDziennika(DZIS)).toBeNull()
    expect(log).toHaveBeenCalledWith('[asystent] dziennik:', expect.any(Error))
    log.mockRestore()
  })
})

describe('pobierzObrazOrbity', () => {
  it('błąd odczytu zadań - null z logiem, bez wyjątku', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    orbita.czytajZadania.mockRejectedValue(new Error('firestore'))
    expect(await pobierzObrazOrbity({ rok: 2026, miesiac: 11, dzien: 20 })).toBeNull()
    expect(log).toHaveBeenCalledWith('[asystent] orbita:', expect.any(Error))
    log.mockRestore()
  })

  it('zadania na obraz', async () => {
    orbita.czytajZadania.mockResolvedValue([])
    expect(await pobierzObrazOrbity({ rok: 2026, miesiac: 11, dzien: 20 })).toEqual({ dzis: [], podpowiedz: false, czekam: [] })
  })
})

describe('pobierzObrazSkrzynki', () => {
  const OBRAZ = { liczby: { doOdpowiedzi: 1, poTerminie: 0, doPrzejrzenia: 0, czekaNaNich: 0, wToku: 0 }, poTerminie: [], aktywneOrganizacje: [] }

  it('liczniki z kokpitu albo pobrane na miejscu', async () => {
    skrzynka.obrazSkrzynki.mockResolvedValue(OBRAZ)
    const l = { stan: 'polaczona' }
    expect(await pobierzObrazSkrzynki(5, Promise.resolve(l as never))).toEqual(OBRAZ)
    expect(skrzynka.obrazSkrzynki).toHaveBeenLastCalledWith(5, l)
    expect(skrzynka.liczniki).not.toHaveBeenCalled()
    skrzynka.liczniki.mockResolvedValue(l)
    await pobierzObrazSkrzynki(6)
    expect(skrzynka.liczniki).toHaveBeenCalledWith(6)
  })

  it('błąd liczników - null zamiast wyjątku', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    skrzynka.liczniki.mockRejectedValueOnce(new Error('firestore'))
    expect(await pobierzObrazSkrzynki(7)).toBeNull()
  })
})

describe('odswiezOdpraweWTle - obraz skrzynki tylko przed możliwą nową odprawą', () => {
  const GODZINA = 3_600_000
  const TERAZ = new Date(Date.UTC(2026, 9, 20, 8))
  const zapisana = (wiek: number): ZapisanaOdprawa => ({
    slad: 'stary', dzien: 'x', utworzono: TERAZ.getTime() - wiek, model: 'm', odprawa: { podsumowanie: '', zagrozenia: [], dzis: [] },
  })
  const wejdz = (z: ZapisanaOdprawa | null, czasMs: number | null = 1) => {
    const obraz = vi.fn(async () => null)
    const p = odswiezOdpraweWTle({
      arkusz: Promise.resolve({ rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [], czasMs }),
      planer: Promise.resolve({ wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, ok: true }),
      zapisana: Promise.resolve(z),
      notatki: Promise.resolve([]),
      strony: Promise.resolve([]),
      skrzynka: obraz,
      dziennik: Promise.resolve(null),
      orbita: Promise.resolve(null),
      semestr: { id: '2026Z', nazwa: 'Z' },
      teraz: TERAZ,
    })
    return { p, obraz }
  }

  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    gemini.zapytajGemini.mockReset()
    // Gemini zawodzi - `odswiezOdpraweWTle` łapie błąd, a test sprawdza tylko, czy o niego pytano.
    gemini.zapytajGemini.mockImplementation(async () => {
      throw new Error('gemini')
    })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('odprawa młodsza niż godzina - obraz nieliczony, Gemini niepytany', async () => {
    const w = wejdz(zapisana(GODZINA - 1))
    await w.p
    expect(w.obraz).not.toHaveBeenCalled()
    expect(gemini.zapytajGemini).not.toHaveBeenCalled()
  })

  it('bez klucza Gemini albo z pustym arkuszem - obraz nieliczony', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    const bezKlucza = wejdz(null)
    await bezKlucza.p
    expect(bezKlucza.obraz).not.toHaveBeenCalled()
    vi.stubEnv('GEMINI_API_KEY', 'k')
    const pustyArkusz = wejdz(null, null)
    await pustyArkusz.p
    expect(pustyArkusz.obraz).not.toHaveBeenCalled()
  })

  it('odprawa starsza niż godzina - obraz liczony raz, potem pytanie do Gemini', async () => {
    const w = wejdz(zapisana(GODZINA + 1))
    await w.p
    expect(w.obraz).toHaveBeenCalledTimes(1)
    expect(gemini.zapytajGemini).toHaveBeenCalledTimes(1)
  })
})
