import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const jwtVerify = vi.fn()
vi.mock('jose', () => ({ jwtVerify: (...a: unknown[]) => jwtVerify(...a), createRemoteJWKSet: () => 'jwks' }))

const KONTO = 'skrzynka-push@deck-samorzad.iam.gserviceaccount.com'

beforeEach(() => {
  vi.resetModules()
  jwtVerify.mockReset()
  vi.stubEnv('SKRZYNKA_PUSH_KONTO', KONTO)
  vi.stubEnv('SKRZYNKA_ADRES', 'https://ssuew-analytics.vercel.app')
})
afterEach(() => vi.unstubAllEnvs())

describe('zweryfikujPush', () => {
  it('przyjmuje token Google z właściwym odbiorcą i kontem', async () => {
    jwtVerify.mockResolvedValue({ payload: { email: KONTO, email_verified: true } })
    const { zweryfikujPush } = await import('@/lib/skrzynka/push')
    expect(await zweryfikujPush('Bearer abc')).toBe(true)
    expect(jwtVerify.mock.calls[0][0]).toBe('abc')
    expect(jwtVerify.mock.calls[0][2]).toEqual({
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: 'https://ssuew-analytics.vercel.app/api/skrzynka/push',
    })
  })

  it('obce konto, niezweryfikowany adres, zły podpis, brak nagłówka', async () => {
    const { zweryfikujPush } = await import('@/lib/skrzynka/push')
    jwtVerify.mockResolvedValueOnce({ payload: { email: 'obcy@x.iam.gserviceaccount.com', email_verified: true } })
    expect(await zweryfikujPush('Bearer abc')).toBe(false)
    jwtVerify.mockResolvedValueOnce({ payload: { email: KONTO, email_verified: false } })
    expect(await zweryfikujPush('Bearer abc')).toBe(false)
    jwtVerify.mockRejectedValueOnce(new Error('signature'))
    expect(await zweryfikujPush('Bearer abc')).toBe(false)
    expect(await zweryfikujPush(null)).toBe(false)
    expect(await zweryfikujPush('Basic abc')).toBe(false)
  })

  it('bez konfiguracji - odmowa bez pytania Google', async () => {
    vi.stubEnv('SKRZYNKA_PUSH_KONTO', '')
    const { zweryfikujPush } = await import('@/lib/skrzynka/push')
    expect(await zweryfikujPush('Bearer abc')).toBe(false)
    expect(jwtVerify).not.toHaveBeenCalled()
  })
})
