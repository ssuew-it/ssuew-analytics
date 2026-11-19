import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as ksiega } from '@/app/api/dziennik/route'
import { POST as kadencja } from '@/app/api/dziennik/kadencja/route'
import { POST as dodaj } from '@/app/api/dziennik/wpisy/route'
import { PATCH as zmien, DELETE as usun } from '@/app/api/dziennik/wpisy/[id]/route'
import { POST as dodajAdn } from '@/app/api/dziennik/wpisy/[id]/adnotacje/route'
import { PATCH as zmienAdn, DELETE as usunAdn } from '@/app/api/dziennik/wpisy/[id]/adnotacje/[aid]/route'

import { BladDziennika } from '@/lib/dziennik/dane'

const ktoPyta = vi.fn()
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))

const dane = vi.hoisted(() => ({
  czytajKsiege: vi.fn(), otworzKadencje: vi.fn(), dodajWpis: vi.fn(), zmienWpis: vi.fn(), usunWpis: vi.fn(),
  dodajAdnotacje: vi.fn(), zmienAdnotacje: vi.fn(), usunAdnotacje: vi.fn(),
}))
vi.mock('@/lib/dziennik/dane', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/dziennik/dane')>()),
  ...dane,
}))

const zadanie = (body?: unknown) => ({ json: async () => body }) as never
const p = (x: Record<string, string>) => ({ params: Promise.resolve(x) }) as never
const LUKA = { dzial: 'luka', tytul: 'Archiwum', tresc: '', ileCzasu: 'semestr' }

describe('/api/dziennik', () => {
  beforeEach(() => {
    ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@', rola: 'owner' })
    Object.values(dane).forEach((f) => f.mockReset())
  })

  it('bez sesji 401, zarząd 403 - na każdej trasie', async () => {
    for (const [kto, kod] of [[null, 401], [{ uid: 'k', email: 'J', rola: 'board' }, 403]] as const) {
      ktoPyta.mockResolvedValue(kto)
      const wyniki = await Promise.all([
        ksiega(zadanie()), kadencja(zadanie({})), dodaj(zadanie(LUKA)), zmien(zadanie(LUKA), p({ id: 'w' })), usun(zadanie(), p({ id: 'w' })),
        dodajAdn(zadanie({}), p({ id: 'w' })), zmienAdn(zadanie({}), p({ id: 'w', aid: 'a' })), usunAdn(zadanie(), p({ id: 'w', aid: 'a' })),
      ])
      expect(wyniki.map((r) => r.status)).toEqual(Array(8).fill(kod))
    }
    expect(dane.czytajKsiege).not.toHaveBeenCalled()
  })

  it('GET zwraca księgę', async () => {
    dane.czytajKsiege.mockResolvedValue({ otwartaKadencjaId: null, kadencje: [], wpisy: [] })
    const r = await ksiega(zadanie())
    expect(await r.json()).toEqual({ otwartaKadencjaId: null, kadencje: [], wpisy: [] })
  })

  it('rozpoczęcie kadencji: walidacja 400, sukces 201, druga otwarta 409', async () => {
    expect((await kadencja(zadanie({ nazwa: '' }))).status).toBe(400)
    dane.otworzKadencje.mockResolvedValue({ id: 'k1' })
    expect((await kadencja(zadanie({ nazwa: '2025/26', autor: 'Jan' }))).status).toBe(201)
    expect(dane.otworzKadencje).toHaveBeenCalledWith({ nazwa: '2025/26', autor: 'Jan', funkcja: null }, expect.any(Number))
    dane.otworzKadencje.mockRejectedValue(new BladDziennika('kadencja-zmieniona', 'Kadencja już się zmieniła - odśwież'))
    const r = await kadencja(zadanie({ nazwa: '2025/26', autor: 'Jan' }))
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('Kadencja już się zmieniła - odśwież')
  })

  it('dodanie wpisu: zła treść 400, sukces 201, bez kadencji 409', async () => {
    expect((await dodaj(zadanie({ ...LUKA, tytul: '' }))).status).toBe(400)
    dane.dodajWpis.mockResolvedValue({ id: 'w1' })
    expect((await dodaj(zadanie(LUKA))).status).toBe(201)
    dane.dodajWpis.mockRejectedValue(new BladDziennika('brak-kadencji', 'Najpierw rozpocznij kadencję'))
    expect((await dodaj(zadanie(LUKA))).status).toBe(409)
  })

  it('zmiana wpisu nie przekazuje kadencjaId z ciała; cudzy wpis 409', async () => {
    dane.zmienWpis.mockRejectedValue(new BladDziennika('zamkniety', 'Wpis poprzedniej kadencji można tylko skomentować'))
    const r = await zmien(zadanie({ ...LUKA, kadencjaId: 'biezaca' }), p({ id: 'w1' }))
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('Wpis poprzedniej kadencji można tylko skomentować')
    expect(dane.zmienWpis).toHaveBeenCalledWith('w1', { dzial: 'luka', tytul: 'Archiwum', tresc: '', ileCzasu: 'semestr' }, expect.any(Number))
  })

  it('usunięcie: brak wpisu 404, sukces 200', async () => {
    dane.usunWpis.mockRejectedValueOnce(new BladDziennika('nie-ma', 'Nie ma takiego wpisu'))
    expect((await usun(zadanie(), p({ id: 'x' }))).status).toBe(404)
    dane.usunWpis.mockResolvedValue(undefined)
    expect((await usun(zadanie(), p({ id: 'w1' }))).status).toBe(200)
  })

  it('adnotacje: walidacja z warstwy danych 400, sukces 201, cudza 409', async () => {
    dane.dodajAdnotacje.mockRejectedValueOnce(new BladDziennika('walidacja', 'Nie ma takiego celu'))
    expect((await dodajAdn(zadanie({ celId: 'x' }), p({ id: 'w1' }))).status).toBe(400)
    dane.dodajAdnotacje.mockResolvedValue({ id: 'a1' })
    expect((await dodajAdn(zadanie({ komentarz: 'x' }), p({ id: 'w1' }))).status).toBe(201)
    expect(dane.dodajAdnotacje).toHaveBeenLastCalledWith('w1', { komentarz: 'x' }, expect.any(Number))
    dane.zmienAdnotacje.mockRejectedValue(new BladDziennika('zamkniety', 'Komentarz poprzedniej kadencji zostaje bez zmian'))
    expect((await zmienAdn(zadanie({ komentarz: 'y' }), p({ id: 'w1', aid: 'a0' }))).status).toBe(409)
    dane.usunAdnotacje.mockResolvedValue(undefined)
    expect((await usunAdn(zadanie(), p({ id: 'w1', aid: 'a1' }))).status).toBe(200)
  })

  it('nieoczekiwany błąd bazy to 500 bez szczegółów', async () => {
    dane.czytajKsiege.mockRejectedValue(new Error('firestore padł: sekret'))
    const r = await ksiega(zadanie())
    expect(r.status).toBe(500)
    expect(JSON.stringify(await r.json())).not.toContain('sekret')
  })
})
