import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/asystent/czat/route'
import { BladAsystenta } from '@/lib/asystent/gemini'

const ktoPyta = vi.fn()
const zapytajGemini = vi.fn()
const czytajRozmowe = vi.fn()
const zapiszRozmowe = vi.fn()
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/asystent/gemini', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/asystent/gemini')>()),
  zapytajGemini: (...a: unknown[]) => zapytajGemini(...a),
}))
vi.mock('@/lib/strony/dane', () => ({ statystykiStron: async () => [] }))
vi.mock('@/lib/asystent/dane', () => ({
  pobierzArkusz: async () => ({ rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [], czasMs: 1 }),
  pobierzPlaner: async () => ({ wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, ok: true }),
  daneProjektu: (_a: object, _p: object, _s: object, notatki: string[]) => ({ notatki }),
  zbudujKontekst: (d: { notatki: string[] }) => ({ meta: { data: '02.10.2026', dzienTygodnia: 'piątek' }, notatki: d.notatki }),
  czytajOdprawe: async () => ({ odprawa: { podsumowanie: 'Retencja słabnie.', zagrozenia: [], dzis: [] } }),
}))
vi.mock('@/lib/asystent/pamiecDane', () => ({
  czytajRozmowe: (...a: unknown[]) => czytajRozmowe(...a),
  zapiszRozmowe: (...a: unknown[]) => zapiszRozmowe(...a),
  tresciNotatek: async () => ['Zebrania w środy'],
}))

const zadanie = (body: unknown) => ({ json: async () => body }) as never
const WLASCICIEL = { uid: 'u', email: 'ja', rola: 'owner' }
const JSON_ODP = (o: object) => ({ tekst: JSON.stringify(o), model: 'gemini-3.8-flash' })

describe('POST /api/asystent/czat', () => {
  beforeEach(() => {
    ktoPyta.mockReset().mockResolvedValue(WLASCICIEL)
    zapytajGemini.mockReset()
    czytajRozmowe.mockReset()
    zapiszRozmowe.mockReset().mockResolvedValue('nowa-1')
  })

  it('bez sesji 401, zarząd 403', async () => {
    ktoPyta.mockResolvedValueOnce(null)
    expect((await POST(zadanie({ pytanie: 'x' }))).status).toBe(401)
    ktoPyta.mockResolvedValueOnce({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    expect((await POST(zadanie({ pytanie: 'x' }))).status).toBe(403)
    expect(zapytajGemini).not.toHaveBeenCalled()
  })

  it('złe zapytanie 400, nieznana rozmowa 404', async () => {
    expect((await POST(zadanie({ pytanie: '' }))).status).toBe(400)
    czytajRozmowe.mockResolvedValue(null)
    expect((await POST(zadanie({ rozmowaId: 'brak', pytanie: 'x' }))).status).toBe(404)
  })

  it('nowa rozmowa: zapisuje pytanie, potem odpowiedź; zwraca id i propozycję', async () => {
    zapytajGemini.mockResolvedValue(JSON_ODP({ odpowiedz: 'Retencja spada.', propozycjaNotatki: 'Cel retencji 3,5 sem.' }))
    const res = await POST(zadanie({ pytanie: 'Cel retencji to 3,5 sem.' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ rozmowaId: 'nowa-1', odpowiedz: 'Retencja spada.', propozycja: 'Cel retencji 3,5 sem.' })
    const [pierwszy, bezId] = zapiszRozmowe.mock.calls[0]
    expect(bezId).toBeUndefined()
    expect(pierwszy.tytul).toBe('Cel retencji to 3,5 sem.')
    expect(pierwszy.wiadomosci.map((w: { rola: string }) => w.rola)).toEqual(['ja'])
    const [drugi, id] = zapiszRozmowe.mock.calls[1]
    expect(id).toBe('nowa-1')
    expect(drugi.wiadomosci.map((w: { rola: string }) => w.rola)).toEqual(['ja', 'deck'])
    const { wiadomosci, schemat } = zapytajGemini.mock.calls[0][0]
    expect(schemat).toBeDefined()
    expect(wiadomosci[0].tekst).toContain('Zebrania w środy')
    expect(wiadomosci[0].tekst).toContain('Retencja słabnie.')
  })

  it('kolejne pytanie dopisuje się do istniejącego wątku', async () => {
    czytajRozmowe.mockResolvedValue({
      id: 'w1', tytul: 'Stare', utworzono: 1, zmieniono: 2,
      wiadomosci: [{ rola: 'ja', tresc: 'A', kiedy: 1 }, { rola: 'deck', tresc: 'B', kiedy: 2 }],
    })
    zapiszRozmowe.mockResolvedValue('w1')
    zapytajGemini.mockResolvedValue(JSON_ODP({ odpowiedz: 'C2', propozycjaNotatki: null }))
    await POST(zadanie({ rozmowaId: 'w1', pytanie: 'C' }))
    const [ostatni, id] = zapiszRozmowe.mock.calls[1]
    expect(id).toBe('w1')
    expect(ostatni.tytul).toBe('Stare')
    expect(ostatni.wiadomosci.map((w: { tresc: string }) => w.tresc)).toEqual(['A', 'B', 'C', 'C2'])
  })

  it('ponowienie nie dubluje pytania', async () => {
    czytajRozmowe.mockResolvedValue({
      id: 'w1', tytul: 'T', utworzono: 1, zmieniono: 2, wiadomosci: [{ rola: 'ja', tresc: 'A', kiedy: 1 }],
    })
    zapiszRozmowe.mockResolvedValue('w1')
    zapytajGemini.mockResolvedValue(JSON_ODP({ odpowiedz: 'B' }))
    await POST(zadanie({ rozmowaId: 'w1', pytanie: 'A', ponow: true }))
    expect(zapiszRozmowe.mock.calls[1][0].wiadomosci.map((w: { tresc: string }) => w.tresc)).toEqual(['A', 'B'])
  })

  it('pełna rozmowa 409', async () => {
    czytajRozmowe.mockResolvedValue({
      id: 'w1', tytul: 'T', utworzono: 1, zmieniono: 2,
      wiadomosci: Array.from({ length: 199 }, () => ({ rola: 'ja', tresc: 'x', kiedy: 1 })),
    })
    expect((await POST(zadanie({ rozmowaId: 'w1', pytanie: 'y' }))).status).toBe(409)
  })

  it('błąd Gemini: pytanie zostaje zapisane, odpowiedź niesie komunikat i id rozmowy', async () => {
    zapytajGemini.mockRejectedValue(new BladAsystenta('limit', 'x'))
    const res = await POST(zadanie({ pytanie: 'Co z KPI?' }))
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ rozmowaId: 'nowa-1', error: expect.stringMatching(/limit Gemini/) })
    expect(zapiszRozmowe).toHaveBeenCalledTimes(1)
  })

  it('odpowiedź niezgodna ze schematem to błąd formatu', async () => {
    zapytajGemini.mockResolvedValue({ tekst: 'zwykły tekst', model: 'm' })
    expect((await POST(zadanie({ pytanie: 'x' }))).status).toBe(502)
  })
})
