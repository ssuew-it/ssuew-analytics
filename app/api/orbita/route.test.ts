import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as lista, POST as dodaj } from '@/app/api/orbita/route'
import { PATCH as zmien, DELETE as usun } from '@/app/api/orbita/[id]/route'
import { POST as etap } from '@/app/api/orbita/[id]/etapy/[eid]/route'
import { GET as zrodla } from '@/app/api/orbita/zrodla/route'
import { BladOrbity, KOMUNIKAT_KOLIZJI } from '@/lib/orbita/etapy'

const ktoPyta = vi.fn()
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))

const dane = vi.hoisted(() => ({
  czytajZadania: vi.fn(), dodajZadanie: vi.fn(), zmienZadanie: vi.fn(), usunZadanie: vi.fn(), akcjaEtapu: vi.fn(), zrodlaOtwartych: vi.fn(),
}))
vi.mock('@/lib/orbita/dane', () => dane)

const zadanie = (body?: unknown) => ({ json: async () => body }) as never
const p = (x: Record<string, string>) => ({ params: Promise.resolve(x) }) as never
const ETAP = { id: 'a', nazwa: 'Koncepcja', rodzaj: 'praca', dni: 3 }
const POLA = { tytul: 'Zarządzenie', kontekst: '', termin: null, zrodlo: null, etapy: [ETAP] }

describe('/api/orbita', () => {
  beforeEach(() => {
    ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@', rola: 'owner' })
    Object.values(dane).forEach((f) => f.mockReset())
  })

  it('bez sesji 401, zarząd 403 - na każdej trasie', async () => {
    for (const [kto, kod] of [[null, 401], [{ uid: 'k', email: 'J', rola: 'board' }, 403]] as const) {
      ktoPyta.mockResolvedValue(kto)
      const wyniki = await Promise.all([
        lista(zadanie()), dodaj(zadanie(POLA)), zmien(zadanie({ ...POLA, zmieniono: 1 }), p({ id: 'z' })), usun(zadanie(), p({ id: 'z' })),
        etap(zadanie({ akcja: 'zamknij' }), p({ id: 'z', eid: 'a' })), zrodla(zadanie()),
      ])
      expect(wyniki.map((r) => r.status)).toEqual(Array(6).fill(kod))
    }
    expect(dane.czytajZadania).not.toHaveBeenCalled()
  })

  it('GET zwraca zadania, POST ze złym ciałem 400, dobrym 201', async () => {
    dane.czytajZadania.mockResolvedValue([{ id: 'z' }])
    expect(await (await lista(zadanie())).json()).toEqual({ zadania: [{ id: 'z' }] })
    expect((await dodaj(zadanie({ tytul: '' }))).status).toBe(400)
    dane.dodajZadanie.mockResolvedValue({ id: 'n' })
    const r = await dodaj(zadanie(POLA))
    expect(r.status).toBe(201)
    expect(dane.dodajZadanie.mock.calls[0][0]).toMatchObject({ tytul: 'Zarządzenie' })
  })

  it('PATCH wymaga liczbowego zmieniono; kolizja to 409 z komunikatem', async () => {
    expect((await zmien(zadanie(POLA), p({ id: 'z' }))).status).toBe(400)
    dane.zmienZadanie.mockRejectedValue(new BladOrbity('zmienione', KOMUNIKAT_KOLIZJI))
    const r = await zmien(zadanie({ ...POLA, zmieniono: 5 }), p({ id: 'z' }))
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ error: KOMUNIKAT_KOLIZJI })
    expect(dane.zmienZadanie.mock.calls[0].slice(0, 1)).toEqual(['z'])
    expect(dane.zmienZadanie.mock.calls[0][2]).toBe(5)
  })

  it('DELETE: brak 404, sukces 200', async () => {
    dane.usunZadanie.mockRejectedValueOnce(new BladOrbity('nie-ma', 'Nie ma takiego zadania'))
    expect((await usun(zadanie(), p({ id: 'z' }))).status).toBe(404)
    dane.usunZadanie.mockResolvedValue(undefined)
    expect((await usun(zadanie(), p({ id: 'z' }))).status).toBe(200)
  })

  it('etap: zła akcja 400, zamknięcie przekazuje wynik, niebieżący 409', async () => {
    expect((await etap(zadanie({ akcja: 'skasuj' }), p({ id: 'z', eid: 'a' }))).status).toBe(400)
    dane.akcjaEtapu.mockResolvedValueOnce({ id: 'z' })
    expect((await etap(zadanie({ akcja: 'zamknij', wynik: 'link' }), p({ id: 'z', eid: 'a' }))).status).toBe(200)
    expect(dane.akcjaEtapu.mock.calls[0].slice(0, 4)).toEqual(['z', 'a', 'zamknij', 'link'])
    dane.akcjaEtapu.mockRejectedValueOnce(new BladOrbity('nie-biezacy', KOMUNIKAT_KOLIZJI))
    expect((await etap(zadanie({ akcja: 'otworz' }), p({ id: 'z', eid: 'a' }))).status).toBe(409)
  })

  it('zrodla zwraca listę, nieoczekiwany błąd to 500 bez szczegółów', async () => {
    dane.zrodlaOtwartych.mockResolvedValueOnce([{ wpisId: 'w', termin: '2027-03-15', zadanieId: 'z' }])
    expect(await (await zrodla(zadanie())).json()).toEqual({ zrodla: [{ wpisId: 'w', termin: '2027-03-15', zadanieId: 'z' }] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    dane.czytajZadania.mockRejectedValue(new Error('tajny szczegół'))
    const r = await lista(zadanie())
    expect(r.status).toBe(500)
    expect(JSON.stringify(await r.json())).not.toContain('tajny')
  })
})
