import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POLA_DOMYSLNE, type Wydarzenie } from '@/lib/planer/typy'
import { naWydarzenieGoogle } from '@/lib/kalendarz/wydarzenie'
import type { PlanKalendarza, WpisKalendarza } from '@/lib/kalendarz/porownanie'

const { ktoPyta, obrazPlanera, czytajStan, odswiezDostep, wpisyKalendarza, wykonajPlan } = vi.hoisted(() => ({
  ktoPyta: vi.fn(),
  obrazPlanera: vi.fn(),
  czytajStan: vi.fn(),
  odswiezDostep: vi.fn(),
  wpisyKalendarza: vi.fn(),
  wykonajPlan: vi.fn(),
}))

vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/planer/obraz', () => ({ obrazPlanera: (...a: unknown[]) => obrazPlanera(...a) }))
vi.mock('@/lib/skrzynka/dane', () => ({ czytajStan: () => czytajStan() }))
vi.mock('@/lib/skrzynka/szyfr', () => ({ odszyfruj: (t: string) => t.replace(/^enc:/, '') }))
vi.mock('@/lib/skrzynka/google', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/skrzynka/google')>()),
  odswiezDostep: (...a: unknown[]) => odswiezDostep(...a),
}))
vi.mock('@/lib/kalendarz/google', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/kalendarz/google')>()),
  wpisyKalendarza: (...a: unknown[]) => wpisyKalendarza(...a),
  wykonajPlan: (...a: unknown[]) => wykonajPlan(...a),
}))

import { GET, POST } from './route'
import { BladKalendarza } from '@/lib/kalendarz/google'

const BAZA = 'https://ssuew-analytics.vercel.app'
const zadanie = (q = '', body?: unknown) =>
  ({
    url: `${BAZA}/api/planer/kalendarz${q}`,
    nextUrl: new URL(`${BAZA}/api/planer/kalendarz${q}`),
    headers: new Headers(),
    json: async () => body,
  }) as never
const wyslij = (body: unknown = { miesiac: '2026-11', wybrane: ['dodaj:w1', 'dodaj:w2'] }) => POST(zadanie('', body))

const W = (n: Partial<Wydarzenie> = {}): Wydarzenie => ({
  ...POLA_DOMYSLNE,
  id: 'w1', tytul: 'Komisja Dydaktyczna', kategoria: 'KOMISJE',
  rok: 2026, miesiac: 11, dzien: 21, godzina: '18:00', godzinaDo: '20:00',
  budynek: null, sala: null, osoby: [],
  ...n,
})
const naWpis = (w: Wydarzenie, id: string): WpisKalendarza => {
  const g = naWydarzenieGoogle(w, '2026Z')
  return { id, summary: g.summary, start: g.start, end: g.end, location: null, deckId: w.id, deckSemestr: '2026Z' }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(Date.UTC(2026, 10, 17, 12)))
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u1', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  obrazPlanera.mockReset().mockResolvedValue({ wydarzenia: [W(), W({ id: 'w2', tytul: 'Gala' })], sesja: {}, sklad: [] })
  czytajStan.mockReset().mockResolvedValue({ polaczona: true, kalendarz: true, token: 'enc:refresh' })
  odswiezDostep.mockReset().mockResolvedValue('dostep')
  wpisyKalendarza.mockReset().mockResolvedValue([])
  wykonajPlan.mockReset().mockResolvedValue({ udane: 2, nieudane: [] })
})

describe('/api/planer/kalendarz', () => {
  it('bez sesji 401, zarząd 403', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await GET(zadanie())).status).toBe(401)
    expect((await wyslij()).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    expect((await GET(zadanie())).status).toBe(403)
    expect((await wyslij()).status).toBe(403)
    expect(wykonajPlan).not.toHaveBeenCalled()
  })

  it('GET bez miesiąca - następny miesiąc semestru i lista miesięcy', async () => {
    const d = await (await GET(zadanie())).json()
    expect(d.semestr).toBe('2026Z')
    expect(d.miesiac).toBe('2026-12')
    expect(d.miesiace).toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02'])
    expect(d.plan.dodaj).toEqual([])
    const [, , od, do_] = wpisyKalendarza.mock.calls[0]
    expect(new Date(od).toISOString()).toBe('2026-11-30T23:00:00.000Z')
    expect(new Date(do_).toISOString()).toBe('2026-12-31T23:00:00.000Z')
  })

  it('w lutym (ostatni miesiąc semestru) - domyślnie bieżący', async () => {
    vi.setSystemTime(new Date(Date.UTC(2027, 1, 10, 12)))
    expect((await (await GET(zadanie())).json()).miesiac).toBe('2027-02')
  })

  it('GET - plan wybranego miesiąca z bieżącego semestru', async () => {
    const r = await GET(zadanie('?miesiac=2026-11'))
    expect(r.status).toBe(200)
    const d = (await r.json()) as { semestr: string; miesiac: string; plan: PlanKalendarza }
    expect(d.miesiac).toBe('2026-11')
    expect(d.plan.dodaj.map((g) => g.summary)).toEqual(['Komisja Dydaktyczna', 'Gala'])
    expect(obrazPlanera).toHaveBeenCalledWith('2026Z')
    expect(odswiezDostep).toHaveBeenCalledWith('refresh')
    const [dostep, semestr, od, do_] = wpisyKalendarza.mock.calls[0]
    expect([dostep, semestr]).toEqual(['dostep', '2026Z'])
    expect(new Date(od).toISOString()).toBe('2026-10-31T23:00:00.000Z')
    expect(new Date(do_).toISOString()).toBe('2026-11-30T23:00:00.000Z')
    expect(wykonajPlan).not.toHaveBeenCalled()
  })

  it('miesiąc spoza semestru albo zły zapis - 400', async () => {
    expect((await GET(zadanie('?miesiac=2027-05'))).status).toBe(400)
    expect((await GET(zadanie('?miesiac=grudzien'))).status).toBe(400)
    expect((await wyslij({ miesiac: '2027-05', wybrane: [] })).status).toBe(400)
    expect((await wyslij({ miesiac: '2026-11', wybrane: 'dodaj:w1' })).status).toBe(400)
    expect((await wyslij(null)).status).toBe(400)
    expect(wykonajPlan).not.toHaveBeenCalled()
  })

  it('POST liczy plan od nowa i wykonuje tylko zaznaczone', async () => {
    const r = await wyslij({ miesiac: '2026-11', wybrane: ['dodaj:w2', 'usun:nieaktualny'] })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ udane: 2, nieudane: [] })
    const [dostep, plan] = wykonajPlan.mock.calls[0] as [string, PlanKalendarza]
    expect(dostep).toBe('dostep')
    expect(plan.dodaj.map((g) => g.summary)).toEqual(['Gala'])
    expect(plan.usun).toEqual([])
    expect(wpisyKalendarza).toHaveBeenCalledTimes(1)
  })

  it('kalendarz niepołączony - 409 z odnośnikiem do Ustawień', async () => {
    czytajStan.mockResolvedValue({ polaczona: true, kalendarz: false, token: 'enc:r' })
    const r = await GET(zadanie())
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('Kalendarz niepołączony - połącz go w Ustawieniach skrzynki.')
    wpisyKalendarza.mockRejectedValue(new BladKalendarza('brak-zgody', '403'))
    czytajStan.mockResolvedValue({ polaczona: true, kalendarz: true, token: 'enc:r' })
    expect((await wyslij()).status).toBe(409)
  })

  it('Calendar API wyłączone - 503 z instrukcją', async () => {
    wpisyKalendarza.mockRejectedValue(new BladKalendarza('api-wylaczone', '403'))
    const r = await GET(zadanie())
    expect(r.status).toBe(503)
    expect((await r.json()).error).toBe('Włącz Google Calendar API w projekcie deck-samorzad.')
    wpisyKalendarza.mockRejectedValue(new BladKalendarza('limit', '429'))
    expect((await GET(zadanie())).status).toBe(429)
    wpisyKalendarza.mockRejectedValue(new BladKalendarza('google', '500'))
    expect((await GET(zadanie())).status).toBe(502)
  })

  it('częściowa porażka - 200 z listą nieudanych', async () => {
    wykonajPlan.mockResolvedValue({ udane: 1, nieudane: [{ tytul: 'Gala', powod: 'limit Google - kliknij Wyślij ponownie za minutę' }] })
    const r = await wyslij()
    expect(r.status).toBe(200)
    expect((await r.json()).nieudane).toEqual([{ tytul: 'Gala', powod: 'limit Google - kliknij Wyślij ponownie za minutę' }])
  })

  it('drugie wysłanie po częściowej porażce nie dubluje', async () => {
    wpisyKalendarza.mockResolvedValue([naWpis(W(), 'g1')])
    const d = (await (await GET(zadanie('?miesiac=2026-11'))).json()) as { plan: PlanKalendarza }
    expect(d.plan.dodaj.map((g) => g.summary)).toEqual(['Gala'])
    expect(d.plan.zmien).toEqual([])
  })
})
