import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  czytajKsiege: vi.fn(), zapiszKopie: vi.fn(), czytajStan: vi.fn(), odswiezDostep: vi.fn(), zapiszNaDysku: vi.fn(),
}))
vi.mock('@/lib/dziennik/dane', () => ({ czytajKsiege: m.czytajKsiege, zapiszKopie: m.zapiszKopie }))
vi.mock('@/lib/skrzynka/dane', () => ({ czytajStan: m.czytajStan }))
vi.mock('@/lib/skrzynka/szyfr', () => ({ odszyfruj: (x: string) => `jawny:${x}` }))
vi.mock('@/lib/skrzynka/google', async (o) => ({ ...(await o<typeof import('@/lib/skrzynka/google')>()), odswiezDostep: m.odswiezDostep }))
vi.mock('@/lib/dysk/google', async (o) => ({ ...(await o<typeof import('@/lib/dysk/google')>()), zapiszNaDysku: m.zapiszNaDysku }))

import { zrobKopie } from '@/lib/dziennik/kopia'
import { BladDysku } from '@/lib/dysk/google'
import { BladSkrzynki } from '@/lib/skrzynka/google'

const KSIEGA = { otwartaKadencjaId: 'k1', kadencje: [], wpisy: [] }
const TERAZ = new Date(Date.UTC(2026, 10, 19, 12))

describe('zrobKopie', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset())
    m.czytajKsiege.mockResolvedValue(KSIEGA)
    m.czytajStan.mockResolvedValue({ polaczona: true, dysk: true, token: 'enc' })
    m.odswiezDostep.mockResolvedValue('dostep')
    m.zapiszNaDysku.mockResolvedValue({ id: 'f', link: 'https://docs.google.com/document/d/f' })
  })

  it('bez zgody na Dysk - brak-dysku, Google nie wołany', async () => {
    m.czytajStan.mockResolvedValue({ polaczona: true, dysk: false, token: 'enc' })
    const w = await zrobKopie(TERAZ)
    expect(w).toEqual({ ok: false, powod: 'brak-dysku', komunikat: 'Dysk nie jest połączony - połącz go w Skrzynka → Ustawienia' })
    expect(m.zapiszNaDysku).not.toHaveBeenCalled()
    m.czytajStan.mockResolvedValue(null)
    expect((await zrobKopie(TERAZ)).ok).toBe(false)
  })

  it('sukces - dokument z datą w nazwie, link zapisany przy otwartej kadencji', async () => {
    const w = await zrobKopie(TERAZ)
    expect(w).toEqual({ ok: true, link: 'https://docs.google.com/document/d/f' })
    expect(m.odswiezDostep).toHaveBeenCalledWith('jawny:enc')
    expect(m.zapiszNaDysku).toHaveBeenCalledWith('dostep', 'Dziennik Stratega - stan na 19.11.2026', expect.stringContaining('<!doctype html>'))
    expect(m.zapiszKopie).toHaveBeenCalledWith('k1', { link: 'https://docs.google.com/document/d/f', kiedy: TERAZ.getTime() })
  })

  it('bez otwartej kadencji kopia powstaje, ale nie ma gdzie zapisać linku', async () => {
    m.czytajKsiege.mockResolvedValue({ ...KSIEGA, otwartaKadencjaId: null })
    expect((await zrobKopie(TERAZ)).ok).toBe(true)
    expect(m.zapiszKopie).not.toHaveBeenCalled()
  })

  it('błędy Dysku na komunikaty, które mówią, co zrobić', async () => {
    const przypadki: [BladDysku['rodzaj'], string][] = [
      ['api-wylaczone', 'Włącz Google Drive API w projekcie deck-samorzad'],
      ['brak-zgody', 'Połącz Dysk ponownie w Ustawieniach Skrzynki'],
      ['limit', 'Google chwilowo odmawia - spróbuj za minutę'],
      ['za-duzy', 'Księga przekracza 4 MB i nie zmieści się na Dysku'],
      ['google', 'Dysk nie odpowiedział - spróbuj ponownie'],
    ]
    for (const [rodzaj, komunikat] of przypadki) {
      m.zapiszNaDysku.mockRejectedValueOnce(new BladDysku(rodzaj, 'x'))
      expect(await zrobKopie(TERAZ)).toEqual({ ok: false, powod: rodzaj, komunikat })
    }
    expect(m.zapiszKopie).not.toHaveBeenCalled()
  })

  it('wygasła zgoda Google (rozłączona skrzynka) - brak-zgody', async () => {
    m.odswiezDostep.mockRejectedValue(new BladSkrzynki('rozlaczona', 'invalid_grant'))
    expect(await zrobKopie(TERAZ)).toEqual({ ok: false, powod: 'brak-zgody', komunikat: 'Połącz Dysk ponownie w Ustawieniach Skrzynki' })
  })

  it('podana księga nie jest czytana drugi raz', async () => {
    await zrobKopie(TERAZ, KSIEGA)
    expect(m.czytajKsiege).not.toHaveBeenCalled()
  })
})
