import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { dane, wymienKod, profil, obserwuj } = vi.hoisted(() => ({
  dane: { czytajStan: vi.fn(), zapiszStan: vi.fn() },
  wymienKod: vi.fn(),
  profil: vi.fn(),
  obserwuj: vi.fn(),
}))

vi.mock('@/lib/skrzynka/dane', () => dane)
vi.mock('@/lib/skrzynka/szyfr', () => ({ zaszyfruj: (t: string) => `enc:${t}` }))
vi.mock('@/lib/skrzynka/google', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/skrzynka/google')>()),
  wymienKod: (...a: unknown[]) => wymienKod(...a),
  gmail: () => ({ profil, obserwuj }),
}))

import { polaczKalendarz } from './polaczenie'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'
const GMAIL = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
const KALENDARZ = 'https://www.googleapis.com/auth/calendar.events'

beforeEach(() => {
  Object.values(dane).forEach((f) => f.mockReset())
  dane.czytajStan.mockResolvedValue({ polaczona: true, email: NASZ, token: 'enc:stary' })
  wymienKod.mockReset().mockResolvedValue({ refreshToken: 'nowy', dostep: 'd', zakresy: [...GMAIL, KALENDARZ] })
  profil.mockReset().mockResolvedValue({ emailAddress: 'Kontakt@samorzad.ue.wroc.pl', historyId: '1' })
  obserwuj.mockReset()
  vi.stubEnv('DECK_OWNER_EMAIL', NASZ)
})
afterEach(() => vi.unstubAllEnvs())

describe('polaczKalendarz', () => {
  it('ok - zapisuje tylko token i kalendarz: true', async () => {
    expect(await polaczKalendarz('KOD')).toBe('ok')
    expect(wymienKod).toHaveBeenCalledWith('KOD')
    expect(dane.zapiszStan).toHaveBeenCalledTimes(1)
    expect(dane.zapiszStan).toHaveBeenCalledWith({ token: 'enc:nowy', kalendarz: true })
    expect(obserwuj).not.toHaveBeenCalled()
  })

  it('zgoda bez zakresów Gmaila - token skrzynki nienadpisany', async () => {
    wymienKod.mockResolvedValue({ refreshToken: 'nowy', dostep: 'd', zakresy: [KALENDARZ, GMAIL[0]] })
    expect(await polaczKalendarz('KOD')).toBe('niepelna-zgoda')
    expect(dane.zapiszStan).not.toHaveBeenCalled()
  })

  it('bez zakresu kalendarza - brak-kalendarza', async () => {
    wymienKod.mockResolvedValue({ refreshToken: 'nowy', dostep: 'd', zakresy: GMAIL })
    expect(await polaczKalendarz('KOD')).toBe('brak-kalendarza')
    expect(dane.zapiszStan).not.toHaveBeenCalled()
  })

  it('inne konto - inne-konto', async () => {
    profil.mockResolvedValue({ emailAddress: 'ktos@gmail.com', historyId: '1' })
    expect(await polaczKalendarz('KOD')).toBe('inne-konto')
    expect(dane.zapiszStan).not.toHaveBeenCalled()
  })

  it('skrzynka niepołączona - niepolaczona', async () => {
    dane.czytajStan.mockResolvedValue(null)
    expect(await polaczKalendarz('KOD')).toBe('niepolaczona')
    dane.czytajStan.mockResolvedValue({ polaczona: false })
    expect(await polaczKalendarz('KOD')).toBe('niepolaczona')
    expect(wymienKod).not.toHaveBeenCalled()
    expect(dane.zapiszStan).not.toHaveBeenCalled()
  })
})
