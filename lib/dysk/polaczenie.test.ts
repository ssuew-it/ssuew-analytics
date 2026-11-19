import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { dane, wymienKod, profil } = vi.hoisted(() => ({
  dane: { czytajStan: vi.fn(), zapiszStan: vi.fn() },
  wymienKod: vi.fn(),
  profil: vi.fn(),
}))

vi.mock('@/lib/skrzynka/dane', () => dane)
vi.mock('@/lib/skrzynka/szyfr', () => ({ zaszyfruj: (t: string) => `enc:${t}` }))
vi.mock('@/lib/skrzynka/google', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/skrzynka/google')>()),
  wymienKod: (...a: unknown[]) => wymienKod(...a),
  gmail: () => ({ profil }),
}))

import { polaczDysk } from './polaczenie'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'
const GMAIL = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
const KALENDARZ = 'https://www.googleapis.com/auth/calendar.events'
const DYSK = 'https://www.googleapis.com/auth/drive.file'

beforeEach(() => {
  Object.values(dane).forEach((f) => f.mockReset())
  dane.czytajStan.mockResolvedValue({ polaczona: true, email: NASZ, token: 'enc:stary' })
  wymienKod.mockReset().mockResolvedValue({ refreshToken: 'nowy', dostep: 'd', zakresy: [...GMAIL, DYSK] })
  profil.mockReset().mockResolvedValue({ emailAddress: NASZ, historyId: '1' })
  vi.stubEnv('DECK_OWNER_EMAIL', NASZ)
})
afterEach(() => vi.unstubAllEnvs())

describe('polaczDysk', () => {
  it('ok - podmienia token, zaznacza dysk, kalendarz według zakresów', async () => {
    expect(await polaczDysk('KOD')).toBe('ok')
    expect(dane.zapiszStan).toHaveBeenCalledWith({ token: 'enc:nowy', dysk: true, kalendarz: false })
    wymienKod.mockResolvedValue({ refreshToken: 'nowy', dostep: 'd', zakresy: [...GMAIL, KALENDARZ, DYSK] })
    await polaczDysk('KOD')
    expect(dane.zapiszStan).toHaveBeenLastCalledWith({ token: 'enc:nowy', dysk: true, kalendarz: true })
  })

  it('bez zakresu Dysku - brak-dysku, nic nie zapisane', async () => {
    wymienKod.mockResolvedValue({ refreshToken: 'nowy', dostep: 'd', zakresy: GMAIL })
    expect(await polaczDysk('KOD')).toBe('brak-dysku')
    expect(dane.zapiszStan).not.toHaveBeenCalled()
  })

  it('bez gmail.send - niepelna-zgoda, token skrzynki nienadpisany', async () => {
    wymienKod.mockResolvedValue({ refreshToken: 'nowy', dostep: 'd', zakresy: [GMAIL[0], DYSK] })
    expect(await polaczDysk('KOD')).toBe('niepelna-zgoda')
    expect(dane.zapiszStan).not.toHaveBeenCalled()
  })

  it('inne konto - inne-konto', async () => {
    profil.mockResolvedValue({ emailAddress: 'ktos@gmail.com', historyId: '1' })
    expect(await polaczDysk('KOD')).toBe('inne-konto')
    expect(dane.zapiszStan).not.toHaveBeenCalled()
  })

  it('skrzynka niepołączona - niepolaczona', async () => {
    dane.czytajStan.mockResolvedValue(null)
    expect(await polaczDysk('KOD')).toBe('niepolaczona')
    expect(wymienKod).not.toHaveBeenCalled()
  })
})
