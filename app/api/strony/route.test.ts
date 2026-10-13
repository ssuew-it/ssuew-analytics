import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST, DELETE } from '@/app/api/strony/route'
import { GET as dostepne } from '@/app/api/strony/dostepne/route'
import { BladGoogle } from '@/lib/strony/google'

const ktoPyta = vi.fn()
const listaWitryn = vi.fn()
const dane = { statystykiStron: vi.fn(), listaStron: vi.fn(), dodajStrone: vi.fn(), usunStrone: vi.fn() }
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/strony/dane', () => ({
  statystykiStron: (...a: unknown[]) => dane.statystykiStron(...a),
  listaStron: (...a: unknown[]) => dane.listaStron(...a),
  dodajStrone: (...a: unknown[]) => dane.dodajStrone(...a),
  usunStrone: (...a: unknown[]) => dane.usunStrone(...a),
}))
vi.mock('@/lib/strony/google', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/strony/google')>()),
  listaWitryn: (...a: unknown[]) => listaWitryn(...a),
  emailKonta: () => 'deck@p.iam.gserviceaccount.com',
}))

const zadanie = (body?: unknown, szukaj = '') =>
  ({ json: async () => body, nextUrl: new URL(`http://deck.test/api/strony${szukaj}`) }) as never

beforeEach(() => {
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'ja', rola: 'owner' })
  listaWitryn.mockReset().mockResolvedValue(['sc-domain:jwk26.pl', 'https://samorzad.ue.wroc.pl/'])
  Object.values(dane).forEach((f) => f.mockReset())
  dane.listaStron.mockResolvedValue([])
})

describe('/api/strony - dostęp', () => {
  it('bez sesji 401, zarząd 403 z komunikatem o stronach', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await GET(zadanie())).status).toBe(401)
    expect((await dostepne(zadanie())).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    const res = await POST(zadanie({ witryna: 'sc-domain:jwk26.pl' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Strony są tylko dla właściciela')
    expect((await DELETE(zadanie(undefined, '?witryna=x'))).status).toBe(403)
    expect(dane.dodajStrone).not.toHaveBeenCalled()
    expect(dane.usunStrone).not.toHaveBeenCalled()
  })
})

describe('/api/strony', () => {
  it('GET zwraca wyniki stron', async () => {
    dane.statystykiStron.mockResolvedValue([{ ok: false, witryna: 'x', nazwa: 'x', blad: 'inny', komunikat: '...' }])
    expect(await (await GET(zadanie())).json()).toHaveLength(1)
  })

  it('POST dodaje tylko witrynę z Search Console; nazwa z adresu albo przycięta', async () => {
    const res = await POST(zadanie({ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: '  ' }))
    expect(res.status).toBe(201)
    expect(dane.dodajStrone).toHaveBeenCalledWith({ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'samorzad.ue.wroc.pl' })
    await POST(zadanie({ witryna: 'sc-domain:jwk26.pl', nazwa: 'x'.repeat(80) }))
    expect(dane.dodajStrone).toHaveBeenLastCalledWith({ witryna: 'sc-domain:jwk26.pl', nazwa: 'x'.repeat(60) })
  })

  it('POST: pusta 400, spoza Search Console 400, Google zawiódł 502', async () => {
    expect((await POST(zadanie({ witryna: ' ' }))).status).toBe(400)
    expect((await POST(zadanie(null))).status).toBe(400)
    expect((await POST(zadanie({ witryna: 'https://obca.pl/' }))).status).toBe(400)
    listaWitryn.mockRejectedValue(new BladGoogle('api-wylaczone', '403'))
    const res = await POST(zadanie({ witryna: 'sc-domain:jwk26.pl' }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/Google Search Console API/)
    expect(dane.dodajStrone).not.toHaveBeenCalled()
  })

  it('DELETE odkodowuje adres witryny; bez parametru 400', async () => {
    const res = await DELETE(zadanie(undefined, `?witryna=${encodeURIComponent('https://samorzad.ue.wroc.pl/')}`))
    expect(res.status).toBe(200)
    expect(dane.usunStrone).toHaveBeenCalledWith('https://samorzad.ue.wroc.pl/')
    expect((await DELETE(zadanie())).status).toBe(400)
  })
})

describe('/api/strony/dostepne', () => {
  it('witryny spoza listy z nazwą i adres konta serwisowego', async () => {
    dane.listaStron.mockResolvedValue([{ witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK' }])
    expect(await (await dostepne(zadanie())).json()).toEqual({
      email: 'deck@p.iam.gserviceaccount.com',
      witryny: [{ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'samorzad.ue.wroc.pl' }],
      blad: null,
    })
  })

  it('błąd Google - 200 z komunikatem, żeby panel pokazał instrukcję', async () => {
    listaWitryn.mockRejectedValue(new BladGoogle('brak-dostepu', '403'))
    const res = await dostepne(zadanie())
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.witryny).toEqual([])
    expect(d.blad).toMatch(/deck@p\.iam\.gserviceaccount\.com/)
  })
})
