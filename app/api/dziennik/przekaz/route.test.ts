import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as przekaz } from '@/app/api/dziennik/przekaz/route'
import { GET as pobierz, POST as kopia } from '@/app/api/dziennik/kopia/route'

const m = vi.hoisted(() => ({ ktoPyta: vi.fn(), czytajKsiege: vi.fn(), zamknijKadencje: vi.fn(), zrobKopie: vi.fn(), kolejnosc: [] as string[] }))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: m.ktoPyta }))
vi.mock('@/lib/dziennik/dane', async (o) => ({
  ...(await o<typeof import('@/lib/dziennik/dane')>()),
  czytajKsiege: m.czytajKsiege,
  zamknijKadencje: m.zamknijKadencje,
}))
vi.mock('@/lib/dziennik/kopia', () => ({ zrobKopie: m.zrobKopie }))

const KSIEGA = { otwartaKadencjaId: 'k1', kadencje: [], wpisy: [] }
const zadanie = (body?: unknown) => ({ json: async () => body }) as never

describe('/api/dziennik/przekaz i /kopia', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => typeof f === 'function' && f.mockReset())
    m.kolejnosc.length = 0
    m.ktoPyta.mockResolvedValue({ uid: 'u', email: 'kontakt@', rola: 'owner' })
    m.czytajKsiege.mockResolvedValue(KSIEGA)
    m.zrobKopie.mockImplementation(async () => {
      m.kolejnosc.push('kopia')
      return { ok: true, link: 'https://docs.google.com/document/d/f' }
    })
    m.zamknijKadencje.mockImplementation(async () => {
      m.kolejnosc.push('zamknij')
    })
  })

  it('zarząd 403 na obu trasach', async () => {
    m.ktoPyta.mockResolvedValue({ uid: 'k', email: 'J', rola: 'board' })
    expect((await przekaz(zadanie({ kadencjaId: 'k1' }))).status).toBe(403)
    expect((await kopia(zadanie())).status).toBe(403)
    expect((await pobierz(zadanie())).status).toBe(403)
  })

  it('przekazanie: najpierw kopia, potem zamknięcie; zwraca link', async () => {
    const r = await przekaz(zadanie({ kadencjaId: 'k1' }))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ link: 'https://docs.google.com/document/d/f' })
    expect(m.kolejnosc).toEqual(['kopia', 'zamknij'])
    expect(m.zamknijKadencje).toHaveBeenCalledWith('k1', expect.any(Number))
  })

  it('nieudana kopia - 409 z komunikatem, nic nie zamknięte', async () => {
    m.zrobKopie.mockResolvedValue({ ok: false, powod: 'api-wylaczone', komunikat: 'Włącz Google Drive API w projekcie deck-samorzad' })
    const r = await przekaz(zadanie({ kadencjaId: 'k1' }))
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ error: 'Włącz Google Drive API w projekcie deck-samorzad', powod: 'api-wylaczone' })
    expect(m.zamknijKadencje).not.toHaveBeenCalled()
  })

  it('inna kadencja niż otwarta - 409 bez kopii', async () => {
    const r = await przekaz(zadanie({ kadencjaId: 'k0' }))
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('Kadencja już się zmieniła - odśwież')
    expect(m.zrobKopie).not.toHaveBeenCalled()
  })

  it('kopia na żądanie: sukces 200 z linkiem, brak Dysku 409 z powodem', async () => {
    expect(await (await kopia(zadanie())).json()).toEqual({ link: 'https://docs.google.com/document/d/f' })
    m.zrobKopie.mockResolvedValue({ ok: false, powod: 'brak-dysku', komunikat: 'Dysk nie jest połączony - połącz go w Skrzynka → Ustawienia' })
    const r = await kopia(zadanie())
    expect(r.status).toBe(409)
    expect((await r.json()).powod).toBe('brak-dysku')
  })

  it('pobranie pliku: HTML jako załącznik z datą w nazwie', async () => {
    const r = await pobierz(zadanie())
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(r.headers.get('content-disposition')).toMatch(/^attachment; filename="dziennik-stratega-\d{4}-\d{2}-\d{2}\.html"$/)
    expect((await r.text()).startsWith('<!doctype html>')).toBe(true)
  })
})
