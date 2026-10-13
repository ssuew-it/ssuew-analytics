import { describe, it, expect, vi, beforeEach } from 'vitest'

let zapisane: unknown
const zapytanie = vi.fn()
vi.mock('next/cache', () => ({ unstable_cache: (f: unknown) => f }))
vi.mock('@/lib/firebase/admin', () => ({
  stronyRef: () => ({
    get: async () => ({ data: () => zapisane }),
    set: async (d: unknown) => {
      zapisane = d
    },
  }),
}))
vi.mock('@/lib/strony/google', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/strony/google')>()),
  zapytanie: (...a: unknown[]) => zapytanie(...a),
}))

import { dodajStrone, listaStron, statystykiStron, usunStrone } from '@/lib/strony/dane'
import { BladGoogle } from '@/lib/strony/google'

beforeEach(() => {
  zapisane = undefined
  zapytanie.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('lista stron', () => {
  it('bez dokumentu pusta; zepsute wpisy pominięte; brak nazwy - nazwa z adresu', async () => {
    expect(await listaStron()).toEqual([])
    zapisane = { witryny: [{ witryna: 'sc-domain:jwk26.pl', nazwa: ' JWK 26 ' }, { nazwa: 'bez adresu' }, { witryna: 'https://samorzad.ue.wroc.pl/' }] }
    expect(await listaStron()).toEqual([
      { witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK 26' },
      { witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'samorzad.ue.wroc.pl' },
    ])
  })

  it('dodaje bez dublowania i usuwa', async () => {
    await dodajStrone({ witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK' })
    await dodajStrone({ witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK' })
    await dodajStrone({ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'Samorząd' })
    expect((await listaStron()).map((s) => s.witryna)).toEqual(['sc-domain:jwk26.pl', 'https://samorzad.ue.wroc.pl/'])
    await usunStrone('sc-domain:jwk26.pl')
    expect(await listaStron()).toEqual([{ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'Samorząd' }])
  })
})

describe('statystykiStron', () => {
  it('pyta o okres liczony od daty Warszawy; błąd jednej strony nie zasłania drugiej', async () => {
    zapisane = { witryny: [{ witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK' }, { witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'Samorząd' }] }
    zapytanie.mockImplementation(async (witryna: string) => {
      if (witryna.startsWith('https://samorzad')) throw new BladGoogle('brak-dostepu', '403')
      return { rows: [{ keys: ['x'], clicks: 10, impressions: 100, ctr: 0.1, position: 5 }] }
    })
    const wyniki = await statystykiStron(new Date('2026-10-04T10:00:00Z'))
    expect(zapytanie).toHaveBeenCalledWith('sc-domain:jwk26.pl', {
      startDate: '2026-09-04', endDate: '2026-10-01', dimensions: ['query'], rowLimit: 10,
    })
    expect(zapytanie).toHaveBeenCalledWith('sc-domain:jwk26.pl', { startDate: '2026-08-07', endDate: '2026-09-03' })
    expect(wyniki[0]).toMatchObject({ ok: true, dane: { nazwa: 'JWK', biezace: { klikniecia: 10 } } })
    expect(wyniki[1]).toMatchObject({ ok: false, witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'Samorząd', blad: 'brak-dostepu' })
    expect(wyniki[1].ok === false && wyniki[1].komunikat).toMatch(/Ograniczone/)
  })

  it('nieznany błąd to „inny”', async () => {
    zapisane = { witryny: [{ witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK' }] }
    zapytanie.mockRejectedValue(new Error('sieć'))
    expect((await statystykiStron())[0]).toMatchObject({ ok: false, blad: 'inny' })
  })
})
