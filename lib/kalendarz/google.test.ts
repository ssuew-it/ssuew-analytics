import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POLA_DOMYSLNE, type Wydarzenie } from '@/lib/planer/typy'
import { naWydarzenieGoogle } from './wydarzenie'
import type { PlanKalendarza, WpisKalendarza } from './porownanie'
import { BladKalendarza, wpisyKalendarza, wykonajPlan } from './google'

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const fetchMock = vi.fn()
const odp = (status: number, dane: unknown = {}) =>
  new Response(status === 204 ? null : JSON.stringify(dane), { status })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const W = (n: Partial<Wydarzenie> = {}): Wydarzenie => ({
  ...POLA_DOMYSLNE,
  id: 'w1', tytul: 'Komisja Dydaktyczna', kategoria: 'KOMISJE',
  rok: 2026, miesiac: 11, dzien: 21, godzina: '18:00', godzinaDo: '20:00',
  budynek: null, sala: null, osoby: [],
  ...n,
})

const zdarzenieApi = (id: string, n: Record<string, unknown> = {}) => ({
  id,
  summary: `Wpis ${id}`,
  start: { dateTime: '2026-11-21T18:00:00+01:00', timeZone: 'Europe/Warsaw' },
  end: { dateTime: '2026-11-21T20:00:00+01:00', timeZone: 'Europe/Warsaw' },
  ...n,
})

describe('wpisyKalendarza', () => {
  it('wpisy: znacznik semestru i okno czasu, stronicowanie, bez powtórzeń', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = new URL(url)
      if (u.searchParams.get('privateExtendedProperty')) {
        return odp(200, { items: [zdarzenieApi('a', { extendedProperties: { private: { deck: '1', deckId: 'w1', deckSemestr: '2026Z' } } })] })
      }
      if (!u.searchParams.get('pageToken')) return odp(200, { items: [zdarzenieApi('b', { location: 'B/L 110L' })], nextPageToken: 'STRONA2' })
      return odp(200, { items: [zdarzenieApi('a', { extendedProperties: { private: { deck: '1', deckId: 'w1', deckSemestr: '2026Z' } } }), zdarzenieApi('c', { start: { date: '2026-11-22' }, end: { date: '2026-11-23' } })] })
    })

    const wpisy = await wpisyKalendarza('DOSTEP', '2026Z', '2026-10-01T00:00:00+02:00', '2027-03-01T00:00:00+01:00')

    const adresy = fetchMock.mock.calls.map(([u]) => new URL(u as string))
    expect(adresy.every((u) => u.origin + u.pathname === API)).toBe(true)
    expect(adresy.some((u) => u.searchParams.get('privateExtendedProperty') === 'deckSemestr=2026Z')).toBe(true)
    const okno = adresy.find((u) => u.searchParams.get('timeMin'))!
    expect(Object.fromEntries(okno.searchParams)).toMatchObject({
      timeMin: '2026-10-01T00:00:00+02:00', timeMax: '2027-03-01T00:00:00+01:00', singleEvents: 'true', timeZone: 'Europe/Warsaw',
    })
    expect(adresy.some((u) => u.searchParams.get('pageToken') === 'STRONA2')).toBe(true)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer DOSTEP')

    expect(wpisy.map((w) => w.id).sort()).toEqual(['a', 'b', 'c'])
    const a = wpisy.find((w) => w.id === 'a')!
    expect(a).toMatchObject({ deckId: 'w1', deckSemestr: '2026Z', location: null })
    expect(a.start).toEqual({ dateTime: '2026-11-21T18:00:00', timeZone: 'Europe/Warsaw' })
    expect(wpisy.find((w) => w.id === 'b')).toMatchObject({ deckId: null, deckSemestr: null, location: 'B/L 110L' })
    expect(wpisy.find((w) => w.id === 'c')!.start).toEqual({ date: '2026-11-22' })
  })

  it('Calendar API wyłączone - błąd api-wylaczone', async () => {
    fetchMock.mockImplementation(async () => odp(403, { error: { code: 403, errors: [{ reason: 'accessNotConfigured' }], message: 'Calendar API has not been used' } }))
    await expect(wpisyKalendarza('D', '2026Z', 'a', 'b')).rejects.toMatchObject({ rodzaj: 'api-wylaczone' })
    await expect(wpisyKalendarza('D', '2026Z', 'a', 'b')).rejects.toBeInstanceOf(BladKalendarza)
  })

  it('inny 403 (np. cudze spotkanie) to nie brak zgody', async () => {
    fetchMock.mockImplementation(async () => odp(403, { error: { code: 403, status: 'PERMISSION_DENIED', errors: [{ reason: 'forbiddenForNonOrganizer' }] } }))
    await expect(wpisyKalendarza('D', '2026Z', 'a', 'b')).rejects.toMatchObject({ rodzaj: 'google' })
  })

  it('organizator i goście: wpis z gośćmi albo cudze zaproszenie to spotkanie', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (new URL(url).searchParams.get('privateExtendedProperty')) return odp(200, { items: [] })
      return odp(200, { items: [
        zdarzenieApi('wlasny', { organizer: { self: true } }),
        zdarzenieApi('goscie', { organizer: { self: true }, attendees: [{ email: 'ktos@ue.wroc.pl' }] }),
        zdarzenieApi('zaproszenie', { organizer: { email: 'dziekanat@ue.wroc.pl' } }),
      ] })
    })
    const wpisy = await wpisyKalendarza('D', '2026Z', 'a', 'b')
    const spotkanie = (id: string) => wpisy.find((w) => w.id === id)!.spotkanie
    expect([spotkanie('wlasny'), spotkanie('goscie'), spotkanie('zaproszenie')]).toEqual([false, true, true])
  })

  it('brak zgody na kalendarz (401, 403 insufficientPermissions) - brak-zgody', async () => {
    fetchMock.mockImplementation(async () => odp(401, { error: { code: 401 } }))
    await expect(wpisyKalendarza('D', '2026Z', 'a', 'b')).rejects.toMatchObject({ rodzaj: 'brak-zgody' })
    fetchMock.mockImplementation(async () => odp(403, { error: { code: 403, errors: [{ reason: 'insufficientPermissions' }] } }))
    await expect(wpisyKalendarza('D', '2026Z', 'a', 'b')).rejects.toMatchObject({ rodzaj: 'brak-zgody' })
  })
})

describe('wykonajPlan', () => {
  const g1 = naWydarzenieGoogle(W(), '2026Z')
  const g2 = naWydarzenieGoogle(W({ id: 'w2', tytul: 'Gala SSUEW', kategoria: 'SSUEW' }), '2026Z')
  const stary: WpisKalendarza = { id: 'g/9', summary: 'Stare', start: g1.start, end: g1.end, location: null, deckId: 'x', deckSemestr: '2026Z' }

  it('wykonaj plan: POST/PATCH/DELETE z sendUpdates=none', async () => {
    fetchMock.mockImplementation(async (_u: string, o: RequestInit) => odp(o.method === 'DELETE' ? 204 : 200, { id: 'nowe' }))
    const plan: PlanKalendarza = {
      przejmij: [{ wpisId: 'r1', wydarzenie: g1 }],
      dodaj: [g2],
      zmien: [{ wpisId: 'g2', wydarzenie: g2 }],
      usun: [stary],
      doSprawdzenia: [{ wydarzenie: g1, kandydaci: 2, spotkanie: false }],
    }
    expect(await wykonajPlan('DOSTEP', plan)).toEqual({ udane: 4, nieudane: [] })

    const wywolania = fetchMock.mock.calls.map(([u, o]) => ({ u: new URL(u as string), o: o as RequestInit }))
    expect(wywolania).toHaveLength(4)
    expect(wywolania.every(({ u }) => u.searchParams.get('sendUpdates') === 'none')).toBe(true)
    const metody = wywolania.map(({ u, o }) => `${o.method} ${u.pathname.slice(u.pathname.indexOf('/events'))}`).sort()
    expect(metody).toEqual(['DELETE /events/g%2F9', 'PATCH /events/g2', 'PATCH /events/r1', 'POST /events'])
    const przejecie = wywolania.find(({ u }) => u.pathname.endsWith('/r1'))!
    expect(JSON.parse(przejecie.o.body as string)).toEqual({
      ...g1,
      start: { ...g1.start, date: null },
      end: { ...g1.end, date: null },
      location: '',
    })
    const dodanie = wywolania.find(({ o }) => o.method === 'POST')!
    expect(JSON.parse(dodanie.o.body as string)).toEqual(g2)
  })

  it('PATCH zamienia całodniowe na godzinowe i odwrotnie - stare pole terminu wyczyszczone', async () => {
    fetchMock.mockImplementation(async () => odp(200, { id: 'x' }))
    const godzinowe = naWydarzenieGoogle(W(), '2026Z')
    const calodniowe = naWydarzenieGoogle(W({ godzina: null, godzinaDo: null }), '2026Z')
    await wykonajPlan('D', { przejmij: [], dodaj: [], zmien: [{ wpisId: 'a', wydarzenie: godzinowe }, { wpisId: 'b', wydarzenie: calodniowe }], usun: [], doSprawdzenia: [] })
    const cialo = (id: string) => JSON.parse(fetchMock.mock.calls.find(([u]) => new URL(u as string).pathname.endsWith(`/${id}`))![1].body)
    expect(cialo('a').start).toEqual({ date: null, dateTime: '2026-11-21T18:00:00', timeZone: 'Europe/Warsaw' })
    expect(cialo('a').end).toEqual({ date: null, dateTime: '2026-11-21T20:00:00', timeZone: 'Europe/Warsaw' })
    expect(cialo('b').start).toEqual({ date: '2026-11-21', dateTime: null, timeZone: null })
    expect(cialo('b').end).toEqual({ date: '2026-11-22', dateTime: null, timeZone: null })
  })

  it('częściowa porażka - reszta idzie dalej', async () => {
    let n = 0
    fetchMock.mockImplementation(async () => (++n === 2 ? odp(429, { error: { code: 429 } }) : odp(200, { id: 'x' })))
    const dodaj = [1, 2, 3, 4].map((i) => naWydarzenieGoogle(W({ id: `w${i}`, tytul: `Komisja ${i}` }), '2026Z'))
    const wynik = await wykonajPlan('D', { przejmij: [], dodaj, zmien: [], usun: [], doSprawdzenia: [] })
    expect(wynik.udane).toBe(3)
    expect(wynik.nieudane).toHaveLength(1)
    expect(wynik.nieudane[0].powod).toMatch(/limit/)
    expect(wynik.nieudane[0].tytul).toMatch(/^Komisja \d$/)
  })

  it('usunięcie wpisu, którego już nie ma w Google (404, 410), liczy się jako udane', async () => {
    fetchMock.mockResolvedValueOnce(odp(410, { error: { code: 410 } }))
    expect(await wykonajPlan('D', { przejmij: [], dodaj: [], zmien: [], usun: [stary], doSprawdzenia: [] }))
      .toEqual({ udane: 1, nieudane: [] })
  })
})
