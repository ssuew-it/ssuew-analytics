import { describe, it, expect, vi, beforeEach } from 'vitest'

const ktoPyta = vi.fn()
const generujOdprawe = vi.fn()
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/asystent/pamiecDane', () => ({ tresciNotatek: async () => [] }))
vi.mock('@/lib/strony/dane', () => ({ statystykiStron: async () => [] }))
vi.mock('@/lib/asystent/dane', () => ({
  pobierzArkusz: async () => ({ rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [], czasMs: 1 }),
  pobierzPlaner: async () => ({ wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, ok: true }),
  daneProjektu: (a: object, p: object, _s: object, _n: object, _st: object, skrzynka: object) => ({ ...a, ...p, skrzynka, semestr: { id: '2026Z', nazwa: 'Z' } }),
  zbudujKontekst: (d: { skrzynka: object }) => ({ meta: { data: '02.10.2026', dzienTygodnia: 'piątek' }, skrzynka: d.skrzynka }),
  pobierzObrazDziennika: async () => [{ tytul: 'Sprawozdanie dla KR', termin: '15.12.2026', przygotowaniaOd: '01.12.2026', obowiazkowe: true, rozlicza: ['KR'] }],
  pobierzObrazOrbity: async () => ({ dzis: [], podpowiedz: false, czekam: [] }),
  pobierzObrazSkrzynki: async () => ({ liczby: { doOdpowiedzi: 2 }, poTerminie: [], aktywneOrganizacje: [] }),
  generujOdprawe: (...a: unknown[]) => generujOdprawe(...a),
}))

const zada = {} as never

describe('POST /api/asystent/odprawa', () => {
  beforeEach(() => {
    vi.resetModules()
    ktoPyta.mockReset()
    generujOdprawe.mockReset()
  })

  it('bez sesji 401, zarząd 403', async () => {
    const { POST } = await import('@/app/api/asystent/odprawa/route')
    ktoPyta.mockResolvedValue(null)
    expect((await POST(zada)).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    expect((await POST(zada)).status).toBe(403)
    expect(generujOdprawe).not.toHaveBeenCalled()
  })

  it('właściciel dostaje nową odprawę', async () => {
    ktoPyta.mockResolvedValue({ uid: 'u', email: 'ja', rola: 'owner' })
    generujOdprawe.mockResolvedValue({ slad: 's', odprawa: { podsumowanie: 'x', zagrozenia: [], dzis: [] } })
    const { POST } = await import('@/app/api/asystent/odprawa/route')
    const res = await POST(zada)
    expect(res.status).toBe(200)
    expect((await res.json()).slad).toBe('s')
    expect(generujOdprawe.mock.calls[0][0].skrzynka).toEqual({ liczby: { doOdpowiedzi: 2 }, poTerminie: [], aktywneOrganizacje: [] })
  })

  it('limit Gemini to 429 z ludzkim komunikatem', async () => {
    ktoPyta.mockResolvedValue({ uid: 'u', email: 'ja', rola: 'owner' })
    const { BladAsystenta } = await import('@/lib/asystent/gemini')
    generujOdprawe.mockRejectedValue(new BladAsystenta('limit', 'x'))
    const { POST } = await import('@/app/api/asystent/odprawa/route')
    const res = await POST(zada)
    expect(res.status).toBe(429)
    expect((await res.json()).error).toMatch(/limit/i)
  })
})
