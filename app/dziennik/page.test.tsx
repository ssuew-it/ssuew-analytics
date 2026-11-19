import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  ktoNaStronie: vi.fn(),
  redirect: vi.fn((cel: string) => {
    throw new Error(`redirect:${cel}`)
  }),
}))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/lib/auth/naStronie', () => ({ ktoNaStronie: m.ktoNaStronie }))
vi.mock('@/components/dziennik/DziennikClient', () => ({ DziennikClient: () => null }))

import DziennikPage from './page'

const sp = (x: Record<string, string> = {}) => ({ searchParams: Promise.resolve(x) })

describe('/dziennik', () => {
  beforeEach(() => m.ktoNaStronie.mockReset())

  it('bez sesji - logowanie', async () => {
    m.ktoNaStronie.mockResolvedValue(null)
    await expect(DziennikPage(sp())).rejects.toThrow('redirect:/login')
  })

  it('zarząd - kokpit', async () => {
    m.ktoNaStronie.mockResolvedValue({ uid: 'k', email: 'J', rola: 'board' })
    await expect(DziennikPage(sp())).rejects.toThrow('redirect:/')
  })

  it('właściciel - strona z komunikatem o połączeniu Dysku', async () => {
    m.ktoNaStronie.mockResolvedValue({ uid: 'u', email: 'kontakt@', rola: 'owner' })
    const el = await DziennikPage(sp({ dysk: 'ok' }))
    expect(JSON.stringify(el)).toContain('Dysk połączony')
  })
})
