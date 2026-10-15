import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WatekApi } from '@/lib/skrzynka/naglowki'
import type { Sprawa } from '@/lib/skrzynka/typy'

// vi.mock jest wynoszony nad importy - zaślepki muszą powstać w vi.hoisted, inaczej fabryka trafi na niezainicjowane stałe.
const { dane, g, wymienKod, utworzonyZ, odwolajToken } = vi.hoisted(() => ({
  dane: {
    czytajStan: vi.fn(), zapiszStan: vi.fn(), wezDzierzawe: vi.fn(), zwolnijDzierzawe: vi.fn(),
    czytajSprawy: vi.fn(), zapiszWynik: vi.fn(), pomijane: vi.fn(),
    czytajSprawe: vi.fn(), czytajUstawienia: vi.fn(), rozlaczStan: vi.fn(), usunDaneSkrzynki: vi.fn(),
  },
  g: {
    profil: vi.fn(), watek: vi.fn(), listaWatkow: vi.fn(), historia: vi.fn(), obserwuj: vi.fn(),
    watekDoOdpowiedzi: vi.fn(), wyslij: vi.fn(), zatrzymaj: vi.fn(),
  },
  wymienKod: vi.fn(),
  utworzonyZ: vi.fn(),
  odwolajToken: vi.fn(),
}))

vi.mock('@/lib/skrzynka/dane', () => dane)
vi.mock('@/lib/skrzynka/szyfr', () => ({ zaszyfruj: (t: string) => `enc:${t}`, odszyfruj: (t: string) => t.replace(/^enc:/, '') }))
vi.mock('@/lib/skrzynka/google', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/skrzynka/google')>()),
  gmail: (...a: unknown[]) => {
    utworzonyZ(...a)
    return g
  },
  wymienKod: (...a: unknown[]) => wymienKod(...a),
  odwolajToken: (...a: unknown[]) => odwolajToken(...a),
}))

import {
  importujStrone, klientGmaila, odnowObserwacje, polaczSkrzynke, przetworzWatki, rozlaczSkrzynke, synchronizuj, wyslijOdpowiedz,
} from '@/lib/skrzynka/synchronizacja'
import { BladSkrzynki } from '@/lib/skrzynka/google'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'
const TERAZ = Date.UTC(2026, 9, 14, 10)

function watek(id: string, wiadomosci: [od: string, kiedy: number, doKogo?: string][]): WatekApi {
  return {
    id,
    messages: wiadomosci.map(([od, kiedy, doKogo], i) => ({
      id: `${id}-${i}`,
      internalDate: String(kiedy),
      labelIds: ['INBOX'],
      snippet: 'treść',
      payload: { headers: [{ name: 'From', value: od }, { name: 'To', value: doKogo ?? NASZ }, { name: 'Subject', value: 'Sponsoring' }] },
    })),
  }
}

const stan = (n: object = {}) => ({
  email: NASZ, token: 'enc:refresh', historyId: '100', watchWygasa: null, ostatniaSynchronizacja: null,
  dzierzawaDo: 0, doPowtorki: false, polaczona: true, import: { trwa: false, zrobione: 0, razem: 0, strona: null }, ...n,
})

beforeEach(() => {
  vi.stubEnv('DECK_OWNER_EMAIL', NASZ)
  vi.stubEnv('SKRZYNKA_TEMAT', 'projects/deck-samorzad/topics/skrzynka')
  Object.values(dane).forEach((f) => f.mockReset())
  Object.values(g).forEach((f) => f.mockReset())
  wymienKod.mockReset()
  utworzonyZ.mockReset()
  odwolajToken.mockReset()
  dane.czytajSprawy.mockResolvedValue(new Map())
  dane.pomijane.mockResolvedValue({ adresy: [], domeny: [] })
  dane.czytajStan.mockResolvedValue(stan())
  dane.wezDzierzawe.mockResolvedValue(true)
  dane.zwolnijDzierzawe.mockResolvedValue(false)
})
afterEach(() => vi.unstubAllEnvs())

const zapisane = () => dane.zapiszWynik.mock.calls.at(-1)![0] as { sprawy: Sprawa[]; kontakty: unknown[]; organizacje: unknown[] }

describe('przetworzWatki', () => {
  it('nowa sprawa z kontaktem i organizacją; 404 pominięte; wątek do siebie bez kontaktu', async () => {
    g.watek.mockImplementation(async (id: string) => {
      if (id === 'usuniety') throw new BladSkrzynki('brak-watku', '404')
      if (id === 'siebie') return watek(id, [[NASZ, 50, NASZ]])
      return watek(id, [['Anna <anna@firma.pl>', 100]])
    })
    expect(await przetworzWatki(g as never, ['t1', 'usuniety', 'siebie', 't1'], { teraz: TERAZ, import: false })).toBe(2)
    expect(g.watek).toHaveBeenCalledTimes(3)
    const w = zapisane()
    expect(w.sprawy[0]).toMatchObject({
      id: 't1', temat: 'Sponsoring', status: 'do-odpowiedzi', oczekujeOd: 100, nowa: true, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
      ostatnia: { kiedy: 100, kierunek: 'oni', fragment: 'treść' }, wiadomosci: 1, przypisana: null, zmieniono: TERAZ,
    })
    expect(w.sprawy[1]).toMatchObject({ id: 'siebie', kontakt: null, organizacja: null, status: 'czeka-na-nich' })
    expect(w.kontakty).toEqual([{ email: 'anna@firma.pl', imie: 'Anna', organizacja: 'firma.pl', typ: null }])
    expect(w.organizacje).toEqual([{ domena: 'firma.pl', nazwa: 'firma.pl', typ: 'inne' }])
  })

  it('zachowuje przypisanie i przechodzi statusem przez automat', async () => {
    dane.czytajSprawy.mockResolvedValue(new Map([['t1', {
      id: 't1', temat: 'Sponsoring', status: 'czeka-na-nich', oczekujeOd: null, nowa: false, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
      ostatnia: { kiedy: 100, kierunek: 'my', fragment: '' }, wiadomosci: 1, przypisana: 'Jula', kategoriaGmail: null, zmieniono: 1,
    }]]))
    g.watek.mockResolvedValue(watek('t1', [[NASZ, 100, 'anna@firma.pl'], ['anna@firma.pl', 200]]))
    await przetworzWatki(g as never, ['t1'], { teraz: TERAZ, import: false })
    expect(zapisane().sprawy[0]).toMatchObject({ status: 'do-odpowiedzi', oczekujeOd: 200, przypisana: 'Jula' })
  })

  it('pomijany adres albo domena - Pominięta', async () => {
    dane.pomijane.mockResolvedValue({ adresy: [], domeny: ['sklep.pl'] })
    g.watek.mockResolvedValue(watek('t1', [['news@sklep.pl', 100]]))
    await przetworzWatki(g as never, ['t1'], { teraz: TERAZ, import: false })
    expect(zapisane().sprawy[0].status).toBe('pominieta')
  })

  const zapisana = (n: Partial<Sprawa>): Sprawa => ({
    id: 't1', temat: 'Sponsoring', status: 'do-odpowiedzi', oczekujeOd: 300, nowa: true, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
    ostatnia: { kiedy: 300, kierunek: 'oni', fragment: '' }, wiadomosci: 3, przypisana: null, kategoriaGmail: null, zmieniono: 5, ...n,
  })

  it('wyścig: ktoś w trakcie zapisał świeższy stan wątku - nie nadpisujemy go starszym', async () => {
    dane.czytajSprawy.mockResolvedValueOnce(new Map()).mockResolvedValueOnce(new Map([['t1', zapisana({})]]))
    g.watek.mockResolvedValue(watek('t1', [['anna@firma.pl', 100]]))
    expect(await przetworzWatki(g as never, ['t1'], { teraz: TERAZ, import: true })).toBe(0)
    expect(zapisane().sprawy).toEqual([])
  })

  it('wyścig: zapis w trakcie, ale nasz wątek nowszy - status liczony od zapisanego stanu', async () => {
    dane.czytajSprawy
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([['t1', zapisana({ status: 'w-toku', oczekujeOd: null, nowa: false, ostatnia: { kiedy: 50, kierunek: 'oni', fragment: '' }, przypisana: 'Jula' })]]))
    g.watek.mockResolvedValue(watek('t1', [['anna@firma.pl', 50], ['anna@firma.pl', 100]]))
    await przetworzWatki(g as never, ['t1'], { teraz: TERAZ, import: true })
    expect(zapisane().sprawy[0]).toMatchObject({ status: 'w-toku', oczekujeOd: null, nowa: true, przypisana: 'Jula' })
  })

  it('pusta lista - nic nie zapisuje', async () => {
    expect(await przetworzWatki(g as never, [], { teraz: TERAZ, import: false })).toBe(0)
    expect(dane.zapiszWynik).not.toHaveBeenCalled()
  })
})

describe('synchronizuj', () => {
  it('niepołączona albo zajęta - nic nie robi', async () => {
    dane.czytajStan.mockResolvedValueOnce(null)
    expect(await synchronizuj(TERAZ)).toEqual({ stan: 'niepolaczona' })
    dane.wezDzierzawe.mockResolvedValueOnce(false)
    expect(await synchronizuj(TERAZ)).toEqual({ stan: 'zajete' })
    expect(g.historia).not.toHaveBeenCalled()
  })

  it('historia od zapamiętanego punktu, zmienione wątki, nowy punkt; token odszyfrowany', async () => {
    g.historia.mockResolvedValueOnce({ history: [{ messagesAdded: [{ message: { threadId: 't1' } }] }], nextPageToken: 'p2', historyId: '150' })
    g.historia.mockResolvedValueOnce({ history: [{ messagesAdded: [{ message: { threadId: 't2' } }] }], historyId: '160' })
    g.watek.mockImplementation(async (id: string) => watek(id, [['anna@firma.pl', 100]]))
    expect(await synchronizuj(TERAZ)).toEqual({ stan: 'zrobione', watki: 2 })
    expect(utworzonyZ).toHaveBeenCalledWith('refresh')
    expect(g.historia.mock.calls).toEqual([['100', null], ['100', 'p2']])
    expect(dane.zapiszStan).toHaveBeenCalledWith(expect.objectContaining({ historyId: '160' }))
  })

  it('zgłoszenie w trakcie - druga runda od nowego punktu', async () => {
    dane.zwolnijDzierzawe.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    g.historia.mockResolvedValueOnce({ history: [], historyId: '150' }).mockResolvedValueOnce({ history: [], historyId: '170' })
    await synchronizuj(TERAZ)
    expect(g.historia.mock.calls.map((c) => c[0])).toEqual(['100', '150'])
    expect(dane.zapiszStan).toHaveBeenLastCalledWith(expect.objectContaining({ historyId: '170' }))
  })

  it('za stara historia - przegląd 30 dni i punkt z profilu', async () => {
    g.historia.mockRejectedValue(new BladSkrzynki('historia-za-stara', '404'))
    g.profil.mockResolvedValue({ emailAddress: NASZ, historyId: '999' })
    g.listaWatkow.mockResolvedValue({ threads: [{ id: 't9' }] })
    g.watek.mockResolvedValue(watek('t9', [['anna@firma.pl', 100]]))
    expect(await synchronizuj(TERAZ)).toEqual({ stan: 'zrobione', watki: 1 })
    expect(g.listaWatkow).toHaveBeenCalledWith('newer_than:30d', null)
    expect(dane.zapiszStan).toHaveBeenCalledWith(expect.objectContaining({ historyId: '999' }))
  })

  it('odwołany dostęp - stan rozłączona, dzierżawa zwolniona', async () => {
    g.historia.mockRejectedValue(new BladSkrzynki('rozlaczona', '401'))
    expect(await synchronizuj(TERAZ)).toEqual({ stan: 'rozlaczona' })
    expect(dane.zapiszStan).toHaveBeenCalledWith({ dzierzawaDo: 0 })
    expect(dane.zapiszStan).toHaveBeenCalledWith({ polaczona: false })
  })

  it('inny błąd - dzierżawa zwolniona, wyjątek dalej', async () => {
    g.historia.mockRejectedValue(new BladSkrzynki('inny', '500'))
    await expect(synchronizuj(TERAZ)).rejects.toBeInstanceOf(BladSkrzynki)
    expect(dane.zapiszStan).toHaveBeenCalledWith({ dzierzawaDo: 0 })
  })
})

describe('importujStrone', () => {
  it('strona po stronie; stare wątki do archiwum; postęp w stanie', async () => {
    g.listaWatkow.mockResolvedValueOnce({ threads: [{ id: 'stary' }, { id: 'nowy' }], nextPageToken: 'p2', resultSizeEstimate: 230 })
    g.watek.mockImplementation(async (id: string) => watek(id, [['anna@firma.pl', id === 'stary' ? TERAZ - 40 * 86_400_000 : TERAZ - 86_400_000]]))
    expect(await importujStrone(null, TERAZ)).toEqual({ nastepnaStrona: 'p2', zrobione: 2, razem: 230 })
    expect(g.listaWatkow).toHaveBeenCalledWith('newer_than:365d', null)
    expect(zapisane().sprawy.map((s) => s.status)).toEqual(['zalatwiona', 'do-odpowiedzi'])
    expect(dane.zapiszStan).toHaveBeenCalledWith({ import: { trwa: true, zrobione: 2, razem: 230, strona: 'p2' } })

    dane.czytajStan.mockResolvedValue(stan({ import: { trwa: true, zrobione: 2, razem: 230, strona: 'p2' } }))
    g.listaWatkow.mockResolvedValueOnce({ threads: [{ id: 'trzeci' }] })
    expect(await importujStrone('p2', TERAZ)).toEqual({ nastepnaStrona: null, zrobione: 3, razem: 230 })
    expect(dane.zapiszStan).toHaveBeenLastCalledWith({ import: { trwa: false, zrobione: 3, razem: 230, strona: null } })
  })

  it('odwołany dostęp w trakcie - rozłączona i wyjątek', async () => {
    g.listaWatkow.mockRejectedValue(new BladSkrzynki('rozlaczona', '401'))
    await expect(importujStrone(null, TERAZ)).rejects.toMatchObject({ rodzaj: 'rozlaczona' })
    expect(dane.zapiszStan).toHaveBeenCalledWith({ polaczona: false })
  })
})

describe('polaczSkrzynke', () => {
  beforeEach(() => {
    wymienKod.mockResolvedValue({ refreshToken: 'refresh-2', dostep: 'dostep', zakresy: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'] })
    g.obserwuj.mockResolvedValue({ historyId: '500', expiration: '1792000000000' })
  })

  it('inne konto - nic nie zapisuje', async () => {
    g.profil.mockResolvedValue({ emailAddress: 'ktos@gmail.com', historyId: '1' })
    expect(await polaczSkrzynke('KOD')).toBe('inne-konto')
    expect(dane.zapiszStan).not.toHaveBeenCalled()
    expect(g.obserwuj).not.toHaveBeenCalled()
  })

  it('zgoda bez wysyłki - nic nie zapisuje, prosi o pełną zgodę', async () => {
    wymienKod.mockResolvedValue({ refreshToken: 'r', dostep: 'd', zakresy: ['https://www.googleapis.com/auth/gmail.readonly'] })
    g.profil.mockResolvedValue({ emailAddress: NASZ, historyId: '1' })
    expect(await polaczSkrzynke('KOD')).toBe('brak-wysylki')
    expect(dane.zapiszStan).not.toHaveBeenCalled()
  })

  it('pierwsze połączenie: zaszyfrowany token, obserwacja, punkt historii z obserwacji, import do zrobienia', async () => {
    dane.czytajStan.mockResolvedValue(null)
    g.profil.mockResolvedValue({ emailAddress: 'Kontakt@samorzad.ue.wroc.pl', historyId: '1' })
    expect(await polaczSkrzynke('KOD')).toBe('ok')
    expect(utworzonyZ).toHaveBeenCalledWith('refresh-2', 'dostep')
    expect(g.obserwuj).toHaveBeenCalledWith('projects/deck-samorzad/topics/skrzynka')
    expect(dane.zapiszStan).toHaveBeenCalledWith(expect.objectContaining({
      email: 'Kontakt@samorzad.ue.wroc.pl', token: 'enc:refresh-2', polaczona: true, historyId: '500', watchWygasa: 1792000000000,
      dzierzawaDo: 0, doPowtorki: false, import: { trwa: true, zrobione: 0, razem: 0, strona: null },
    }))
  })

  it('ponowne połączenie: punkt historii i import z poprzedniego stanu', async () => {
    dane.czytajStan.mockResolvedValue(stan({ polaczona: false, historyId: '120', import: { trwa: false, zrobione: 900, razem: 900, strona: null } }))
    g.profil.mockResolvedValue({ emailAddress: NASZ, historyId: '1' })
    await polaczSkrzynke('KOD')
    expect(dane.zapiszStan).toHaveBeenCalledWith(expect.objectContaining({ historyId: '120', import: { trwa: false, zrobione: 900, razem: 900, strona: null } }))
  })
})

describe('odnowObserwacje', () => {
  it('odnawia watch i zapisuje termin; niepołączona - nic', async () => {
    g.obserwuj.mockResolvedValue({ historyId: '600', expiration: '1793000000000' })
    await odnowObserwacje()
    expect(dane.zapiszStan).toHaveBeenCalledWith({ watchWygasa: 1793000000000 })
    dane.czytajStan.mockResolvedValue(stan({ polaczona: false }))
    g.obserwuj.mockClear()
    await odnowObserwacje()
    expect(g.obserwuj).not.toHaveBeenCalled()
  })
})

describe('klientGmaila', () => {
  it('niepołączona - rozłączona; połączona - klient na odszyfrowanym tokenie', async () => {
    dane.czytajStan.mockResolvedValueOnce(stan({ polaczona: false }))
    await expect(klientGmaila()).rejects.toMatchObject({ rodzaj: 'rozlaczona' })
    expect(await klientGmaila()).toBe(g)
    expect(utworzonyZ).toHaveBeenLastCalledWith('refresh')
  })
})

describe('wyslijOdpowiedz', () => {
  const S = { id: 't1', status: 'do-odpowiedzi' } as Sprawa
  const doOdpowiedzi = {
    id: 't1',
    messages: [{
      id: 'm1', internalDate: '1', labelIds: ['INBOX'],
      payload: { headers: [
        { name: 'From', value: 'Anna <anna@firma.pl>' }, { name: 'To', value: NASZ },
        { name: 'Subject', value: 'Oferta' }, { name: 'Message-ID', value: '<a1@firma.pl>' },
      ] },
    }],
  }
  beforeEach(() => {
    dane.czytajUstawienia.mockResolvedValue({ stopka: 'Stopka', pomijaneAdresy: [], pomijaneDomeny: [] })
    g.watekDoOdpowiedzi.mockResolvedValue(doOdpowiedzi)
    g.wyslij.mockResolvedValue({ id: 'w1', threadId: 't1' })
  })

  it('mail do adresata w tym samym wątku, ze stopką; potem automat i świeża sprawa', async () => {
    dane.czytajSprawe.mockResolvedValueOnce(S).mockResolvedValueOnce({ ...S, status: 'czeka-na-nich' })
    g.watek.mockResolvedValue(watek('t1', [['anna@firma.pl', 1], [NASZ, 2]]))
    expect(await wyslijOdpowiedz('t1', 'Dziękujemy', [], TERAZ)).toMatchObject({ status: 'czeka-na-nich' })
    const [mime, watekId] = g.wyslij.mock.calls[0]
    expect(watekId).toBe('t1')
    expect(mime).toContain('<kontakt@samorzad.ue.wroc.pl>')
    expect(mime).toContain('To: anna@firma.pl\r\n')
    expect(mime).toContain('Subject: Re: Oferta\r\n')
    expect(mime).toContain('In-Reply-To: <a1@firma.pl>\r\n')
    expect(Buffer.from(mime.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe('Dziękujemy\r\n\r\nStopka')
    expect(zapisane().sprawy[0]).toMatchObject({ id: 't1', status: 'czeka-na-nich' })
  })

  it('nie ma sprawy - null; nie ma do kogo - błąd; nic nie wysłane', async () => {
    dane.czytajSprawe.mockResolvedValueOnce(null)
    expect(await wyslijOdpowiedz('brak', 'x', [])).toBeNull()
    dane.czytajSprawe.mockResolvedValue(S)
    g.watekDoOdpowiedzi.mockResolvedValue({ id: 't1', messages: [] })
    await expect(wyslijOdpowiedz('t1', 'x', [])).rejects.toMatchObject({ rodzaj: 'brak-adresata' })
    expect(g.wyslij).not.toHaveBeenCalled()
  })

  it('rozłączona skrzynka - błąd rozłączenia', async () => {
    dane.czytajSprawe.mockResolvedValue(S)
    dane.czytajStan.mockResolvedValue(stan({ polaczona: false }))
    await expect(wyslijOdpowiedz('t1', 'x', [])).rejects.toMatchObject({ rodzaj: 'rozlaczona' })
  })
})

describe('rozlaczSkrzynke', () => {
  beforeEach(() => {
    g.zatrzymaj.mockResolvedValue(undefined)
    odwolajToken.mockResolvedValue(undefined)
  })

  it('zatrzymuje obserwację, odwołuje token i zostawia dane', async () => {
    await rozlaczSkrzynke(false)
    expect(utworzonyZ).toHaveBeenCalledWith('refresh')
    expect(g.zatrzymaj).toHaveBeenCalled()
    expect(odwolajToken).toHaveBeenCalledWith('refresh')
    expect(dane.rozlaczStan).toHaveBeenCalled()
    expect(dane.usunDaneSkrzynki).not.toHaveBeenCalled()
  })

  it('Google nie odpowiada - i tak usuwa dane po naszej stronie', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    g.zatrzymaj.mockRejectedValue(new Error('500'))
    odwolajToken.mockRejectedValue(new Error('400'))
    await rozlaczSkrzynke(true)
    expect(dane.usunDaneSkrzynki).toHaveBeenCalled()
    expect(dane.rozlaczStan).not.toHaveBeenCalled()
  })

  it('bez stanu - bez Google, tylko po naszej stronie', async () => {
    dane.czytajStan.mockResolvedValue(null)
    await rozlaczSkrzynke(false)
    expect(g.zatrzymaj).not.toHaveBeenCalled()
    expect(dane.rozlaczStan).toHaveBeenCalled()
  })
})
