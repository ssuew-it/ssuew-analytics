import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  ktoNaStronie: vi.fn(),
  redirect: vi.fn((cel: string) => {
    throw new Error(`redirect:${cel}`)
  }),
}))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/lib/auth/naStronie', () => ({ ktoNaStronie: m.ktoNaStronie }))
vi.mock('@/components/orbita/OrbitaClient', () => ({ OrbitaClient: () => null }))

import OrbitaPage from './page'

const sp = (x: Record<string, string> = {}) => ({ searchParams: Promise.resolve(x) })

describe('/orbita', () => {
  beforeEach(() => m.ktoNaStronie.mockReset())

  it('bez sesji - logowanie', async () => {
    m.ktoNaStronie.mockResolvedValue(null)
    await expect(OrbitaPage(sp())).rejects.toThrow('redirect:/login')
  })

  it('zarząd - kokpit', async () => {
    m.ktoNaStronie.mockResolvedValue({ uid: 'k', email: 'J', rola: 'board' })
    await expect(OrbitaPage(sp())).rejects.toThrow('redirect:/')
  })

  it('właściciel - widok z adresu, nieznany widok to Dziś', async () => {
    m.ktoNaStronie.mockResolvedValue({ uid: 'u', email: 'kontakt@', rola: 'owner' })
    const el = (await OrbitaPage(sp({ widok: 'radar', zDziennika: 'w1' }))) as { props: Record<string, unknown> }
    expect(el.props).toMatchObject({ widok: 'radar', zDziennika: 'w1' })
    const el2 = (await OrbitaPage(sp({ widok: 'cokolwiek' }))) as { props: Record<string, unknown> }
    expect(el2.props).toMatchObject({ widok: 'dzis', zDziennika: null })
  })
})
