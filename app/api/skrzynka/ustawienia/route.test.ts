import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as ustawienia, PATCH as zmienUstawienia } from '@/app/api/skrzynka/ustawienia/route'
import { POST as rozlacz } from '@/app/api/skrzynka/rozlacz/route'
import { GET as kontakty } from '@/app/api/skrzynka/kontakty/route'
import { GET as organizacje, PATCH as zmienOrganizacje } from '@/app/api/skrzynka/organizacje/route'

const { ktoPyta, dane, rozlaczSkrzynke } = vi.hoisted(() => ({
  ktoPyta: vi.fn(),
  dane: {
    czytajUstawienia: vi.fn(), zapiszUstawienia: vi.fn(), listaKontaktow: vi.fn(), kartaKontaktu: vi.fn(),
    listaOrganizacji: vi.fn(), kartaOrganizacji: vi.fn(), zmienOrganizacje: vi.fn(),
  },
  rozlaczSkrzynke: vi.fn(),
}))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/skrzynka/dane', () => dane)
vi.mock('@/lib/skrzynka/synchronizacja', () => ({ rozlaczSkrzynke: (...a: unknown[]) => rozlaczSkrzynke(...a) }))

const BAZA = 'https://ssuew-analytics.vercel.app'
const zadanie = (sciezka: string, body?: unknown) =>
  ({ url: `${BAZA}${sciezka}`, nextUrl: new URL(`${BAZA}${sciezka}`), json: async () => body }) as never
const U = { stopka: 'S', pomijaneAdresy: [], pomijaneDomeny: [] }

beforeEach(() => {
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  Object.values(dane).forEach((f) => f.mockReset())
  rozlaczSkrzynke.mockReset()
})

describe('dostęp', () => {
  it('bez sesji 401, zarząd 403 - każda trasa', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await ustawienia(zadanie('/api/skrzynka/ustawienia'))).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    for (const r of [
      await ustawienia(zadanie('/api/skrzynka/ustawienia')),
      await zmienUstawienia(zadanie('/api/skrzynka/ustawienia', { stopka: 'x' })),
      await rozlacz(zadanie('/api/skrzynka/rozlacz', { usunDane: true })),
      await kontakty(zadanie('/api/skrzynka/kontakty')),
      await organizacje(zadanie('/api/skrzynka/organizacje')),
      await zmienOrganizacje(zadanie('/api/skrzynka/organizacje', { domena: 'firma.pl', typ: 'sponsor' })),
    ]) expect(r.status).toBe(403)
    expect(rozlaczSkrzynke).not.toHaveBeenCalled()
    expect(dane.zapiszUstawienia).not.toHaveBeenCalled()
  })
})

describe('ustawienia', () => {
  it('odczyt; zapis po walidacji; zła domena 400 z komunikatem', async () => {
    dane.czytajUstawienia.mockResolvedValue(U)
    expect(await (await ustawienia(zadanie('/api/skrzynka/ustawienia'))).json()).toEqual(U)
    dane.zapiszUstawienia.mockResolvedValue({ ...U, pomijaneAdresy: ['news@sklep.pl'] })
    const r = await zmienUstawienia(zadanie('/api/skrzynka/ustawienia', { pomijaneAdresy: ['News@Sklep.pl'] }))
    expect((await r.json()).pomijaneAdresy).toEqual(['news@sklep.pl'])
    expect(dane.zapiszUstawienia).toHaveBeenCalledWith({ pomijaneAdresy: ['news@sklep.pl'] })
    const zla = await zmienUstawienia(zadanie('/api/skrzynka/ustawienia', { pomijaneDomeny: ['gmail.com'] }))
    expect(zla.status).toBe(400)
    expect((await zla.json()).error).toMatch(/gmail\.com/)
  })
})

describe('rozłączenie', () => {
  it('z usuwaniem danych tylko przy jawnym true', async () => {
    expect(await (await rozlacz(zadanie('/api/skrzynka/rozlacz', { usunDane: true }))).json()).toEqual({ ok: true })
    expect(rozlaczSkrzynke).toHaveBeenLastCalledWith(true)
    await rozlacz(zadanie('/api/skrzynka/rozlacz', { usunDane: 'tak' }))
    expect(rozlaczSkrzynke).toHaveBeenLastCalledWith(false)
  })

  it('błąd - 500 z komunikatem', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    rozlaczSkrzynke.mockRejectedValue(new Error('firestore'))
    const r = await rozlacz(zadanie('/api/skrzynka/rozlacz', {}))
    expect(r.status).toBe(500)
    expect((await r.json()).error).toMatch(/Nie udało się rozłączyć/)
  })
})

describe('kontakty i organizacje', () => {
  it('lista kontaktów z kursorem; karta po adresie małymi literami; brak - 404', async () => {
    dane.listaKontaktow.mockResolvedValue({ kontakty: [], nastepna: null })
    await kontakty(zadanie('/api/skrzynka/kontakty?po=jan%40firma.pl'))
    expect(dane.listaKontaktow).toHaveBeenCalledWith('jan@firma.pl')
    dane.kartaKontaktu.mockResolvedValueOnce({ kontakt: { email: 'anna@firma.pl' }, sprawy: [] })
    expect((await kontakty(zadanie('/api/skrzynka/kontakty?email=Anna%40Firma.pl'))).status).toBe(200)
    expect(dane.kartaKontaktu).toHaveBeenCalledWith('anna@firma.pl')
    dane.kartaKontaktu.mockResolvedValueOnce(null)
    expect((await kontakty(zadanie('/api/skrzynka/kontakty?email=brak%40x.pl'))).status).toBe(404)
  })

  it('organizacje: lista, karta, zmiana po walidacji; zła zmiana 400, brak 404', async () => {
    dane.listaOrganizacji.mockResolvedValue([{ domena: 'firma.pl', nazwa: 'Firma', typ: 'inne' }])
    expect(await (await organizacje(zadanie('/api/skrzynka/organizacje'))).json()).toEqual({ organizacje: [{ domena: 'firma.pl', nazwa: 'Firma', typ: 'inne' }] })
    dane.kartaOrganizacji.mockResolvedValueOnce(null)
    expect((await organizacje(zadanie('/api/skrzynka/organizacje?domena=brak.pl'))).status).toBe(404)
    dane.zmienOrganizacje.mockResolvedValueOnce({ domena: 'firma.pl', nazwa: 'Firma S.A.', typ: 'sponsor' })
    const r = await zmienOrganizacje(zadanie('/api/skrzynka/organizacje', { domena: 'firma.pl', nazwa: ' Firma S.A. ', typ: 'sponsor' }))
    expect((await r.json()).nazwa).toBe('Firma S.A.')
    expect(dane.zmienOrganizacje).toHaveBeenCalledWith('firma.pl', { nazwa: 'Firma S.A.', typ: 'sponsor' })
    expect((await zmienOrganizacje(zadanie('/api/skrzynka/organizacje', { domena: 'firma.pl', typ: 'wrog' }))).status).toBe(400)
    dane.zmienOrganizacje.mockResolvedValueOnce(null)
    expect((await zmienOrganizacje(zadanie('/api/skrzynka/organizacje', { domena: 'brak.pl', typ: 'media' }))).status).toBe(404)
  })
})
