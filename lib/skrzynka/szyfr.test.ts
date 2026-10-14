// @vitest-environment node
// node:crypto i jose - moduły tylko serwerowe.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'

const klucz = () => randomBytes(32).toString('base64')

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('SKRZYNKA_KLUCZ', klucz())
  vi.stubEnv('DECK_SESSION_SECRET', 'sekret-testowy-o-dlugosci-32-znakow!!')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('szyfr', () => {
  it('szyfruje i odszyfrowuje; ten sam tekst daje różne szyfrogramy', async () => {
    const { zaszyfruj, odszyfruj } = await import('@/lib/skrzynka/szyfr')
    const a = zaszyfruj('1//refresh-token')
    expect(a).not.toContain('refresh')
    expect(zaszyfruj('1//refresh-token')).not.toBe(a)
    expect(odszyfruj(a)).toBe('1//refresh-token')
  })

  it('zmieniony bajt albo inny klucz - wyjątek, nie śmieci', async () => {
    const { zaszyfruj, odszyfruj } = await import('@/lib/skrzynka/szyfr')
    const a = Buffer.from(zaszyfruj('token'), 'base64')
    a[a.length - 1] ^= 1
    expect(() => odszyfruj(a.toString('base64'))).toThrow()
    const b = zaszyfruj('token')
    vi.stubEnv('SKRZYNKA_KLUCZ', klucz())
    expect(() => odszyfruj(b)).toThrow()
  })

  it('klucz o złej długości - wyjątek', async () => {
    vi.stubEnv('SKRZYNKA_KLUCZ', Buffer.from('za krótki').toString('base64'))
    const { zaszyfruj } = await import('@/lib/skrzynka/szyfr')
    expect(() => zaszyfruj('x')).toThrow(/32 bajty/)
  })
})

describe('stan OAuth', () => {
  it('ważny dla tego samego konta, nie dla innego ani dla śmieci', async () => {
    const { podpiszStan, sprawdzStan } = await import('@/lib/skrzynka/stanOauth')
    const s = await podpiszStan('uid-1')
    expect(await sprawdzStan(s, 'uid-1')).toBe(true)
    expect(await sprawdzStan(s, 'uid-2')).toBe(false)
    expect(await sprawdzStan('smieci', 'uid-1')).toBe(false)
  })

  it('wygasa po 10 minutach', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'))
    const { podpiszStan, sprawdzStan } = await import('@/lib/skrzynka/stanOauth')
    const s = await podpiszStan('uid-1')
    vi.setSystemTime(new Date('2026-10-14T10:11:00Z'))
    expect(await sprawdzStan(s, 'uid-1')).toBe(false)
  })
})
