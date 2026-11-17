import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as asystent } from '@/app/api/skrzynka/sprawy/[id]/asystent/route'
import { BladAsystenta } from '@/lib/asystent/gemini'
import { BladSkrzynki } from '@/lib/skrzynka/google'
import { INSTRUKCJE } from '@/lib/skrzynka/asystent'

const { ktoPyta, czytajSprawe, watekPelny, zapytajGemini } = vi.hoisted(() => ({
  ktoPyta: vi.fn(), czytajSprawe: vi.fn(), watekPelny: vi.fn(), zapytajGemini: vi.fn(),
}))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/skrzynka/dane', () => ({ czytajSprawe: (...a: unknown[]) => czytajSprawe(...a) }))
vi.mock('@/lib/skrzynka/synchronizacja', () => ({
  klientGmaila: async () => ({ watekPelny: (...a: unknown[]) => watekPelny(...a) }),
  zRozlaczeniem: <T,>(f: () => Promise<T>) => f(),
  nasz: () => 'kontakt@samorzad.ue.wroc.pl',
}))
vi.mock('@/lib/asystent/pamiecDane', () => ({ tresciNotatek: async () => ['Juwenalia 15-17 maja'] }))
vi.mock('@/lib/asystent/gemini', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/asystent/gemini')>()),
  zapytajGemini: (...a: unknown[]) => zapytajGemini(...a),
}))

const BAZA = 'https://ssuew-analytics.vercel.app'
const zadanie = (body: unknown) =>
  ({ url: `${BAZA}/api/skrzynka/sprawy/t1/asystent`, nextUrl: new URL(`${BAZA}/api/skrzynka/sprawy/t1/asystent`), json: async () => body }) as never
const p = { params: Promise.resolve({ id: 't1' }) } as never
const utf = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const WATEK = {
  id: 't1',
  messages: [{
    id: 'm1', internalDate: String(Date.UTC(2026, 9, 1, 8)), labelIds: ['INBOX'],
    payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'Anna <anna@firma.pl>' }], body: { data: utf('Prosimy o ofertę na stoisko.') } },
  }],
}

beforeEach(() => {
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  czytajSprawe.mockReset().mockResolvedValue({ id: 't1', temat: 'Stoisko na Juwenaliach' })
  watekPelny.mockReset().mockResolvedValue(WATEK)
  zapytajGemini.mockReset()
})

describe('asystent sprawy', () => {
  it('bez sesji 401, zarząd 403 - nic nie idzie do Gemini', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await asystent(zadanie({ tryb: 'szkic' }), p)).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    expect((await asystent(zadanie({ tryb: 'szkic' }), p)).status).toBe(403)
    expect(zapytajGemini).not.toHaveBeenCalled()
  })

  it('szkic: instrukcja szkicu, temat, notatki i treść wątku; wynik bez spacji na brzegach', async () => {
    zapytajGemini.mockResolvedValue({ tekst: '  Dzień dobry,\nprzesyłamy ofertę [do uzupełnienia].\n', model: 'm' })
    const r = await asystent(zadanie({ tryb: 'szkic' }), p)
    expect(await r.json()).toEqual({ tekst: 'Dzień dobry,\nprzesyłamy ofertę [do uzupełnienia].' })
    const { instrukcja, wiadomosci, schemat } = zapytajGemini.mock.calls[0][0]
    expect(instrukcja).toBe(INSTRUKCJE.szkic)
    expect(schemat).toBeUndefined()
    expect(wiadomosci).toHaveLength(1)
    expect(wiadomosci[0].tekst).toContain('Temat: Stoisko na Juwenaliach')
    expect(wiadomosci[0].tekst).toContain('- Juwenalia 15-17 maja')
    expect(wiadomosci[0].tekst).toContain('Anna <anna@firma.pl>:\nProsimy o ofertę na stoisko.')
  })

  it('nieznany tryb 400; brak sprawy 404; wątek usunięty w Gmailu 404', async () => {
    expect((await asystent(zadanie({ tryb: 'wyslij' }), p)).status).toBe(400)
    czytajSprawe.mockResolvedValueOnce(null)
    expect((await asystent(zadanie({ tryb: 'strescz' }), p)).status).toBe(404)
    watekPelny.mockRejectedValueOnce(new BladSkrzynki('brak-watku', 'Gmail 404'))
    const r = await asystent(zadanie({ tryb: 'strescz' }), p)
    expect(r.status).toBe(404)
    expect((await r.json()).error).toBe('Tego wątku nie ma już w Gmailu.')
    expect(zapytajGemini).not.toHaveBeenCalled()
  })

  it('błędy Gemini z komunikatami asystenta; rozłączona skrzynka 409', async () => {
    zapytajGemini.mockRejectedValueOnce(new BladAsystenta('limit', 'x'))
    const r = await asystent(zadanie({ tryb: 'strescz' }), p)
    expect(r.status).toBe(429)
    expect((await r.json()).error).toMatch(/limit Gemini/)
    zapytajGemini.mockRejectedValueOnce(new BladAsystenta('brak-klucza', 'x'))
    expect((await asystent(zadanie({ tryb: 'strescz' }), p)).status).toBe(503)
    watekPelny.mockRejectedValueOnce(new BladSkrzynki('rozlaczona', '401'))
    expect((await asystent(zadanie({ tryb: 'strescz' }), p)).status).toBe(409)
  })
})
