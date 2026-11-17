// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SignJWT } from 'jose'
import { celStanu, podpiszStan, sprawdzStan } from './stanOauth'

const SEKRET = 'x'.repeat(40)

beforeEach(() => vi.stubEnv('DECK_SESSION_SECRET', SEKRET))
afterEach(() => vi.unstubAllEnvs())

describe('stan zgody Google', () => {
  it('cel kalendarza w state; stary state bez celu to skrzynka; cudzy uid - null', async () => {
    const kalendarz = await podpiszStan('u1', 'kalendarz')
    expect(await celStanu(kalendarz, 'u1')).toBe('kalendarz')
    expect(await sprawdzStan(kalendarz, 'u1')).toBe(true)
    expect(await celStanu(await podpiszStan('u1'), 'u1')).toBe('skrzynka')

    const stary = await new SignJWT({ uid: 'u1' }).setProtectedHeader({ alg: 'HS256' }).setAudience('skrzynka-oauth')
      .setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(SEKRET))
    expect(await celStanu(stary, 'u1')).toBe('skrzynka')

    expect(await celStanu(kalendarz, 'u2')).toBeNull()
    expect(await celStanu('zepsuty', 'u1')).toBeNull()
  })
})
