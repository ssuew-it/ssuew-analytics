import { describe, it, expect, vi } from 'vitest'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'

const ktoPyta = vi.fn()
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))

describe('tylkoWlasciciel', () => {
  it('bez sesji 401, zarząd 403, właściciel przechodzi', async () => {
    ktoPyta.mockResolvedValueOnce(null)
    expect((await tylkoWlasciciel({} as never)).odmowa?.status).toBe(401)
    ktoPyta.mockResolvedValueOnce({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    expect((await tylkoWlasciciel({} as never)).odmowa?.status).toBe(403)
    ktoPyta.mockResolvedValueOnce({ uid: 'u', email: 'ja', rola: 'owner' })
    const w = await tylkoWlasciciel({} as never)
    expect(w.odmowa).toBeNull()
    expect(w.kto?.rola).toBe('owner')
  })

  it('przyjmuje własny komunikat odmowy', async () => {
    ktoPyta.mockResolvedValueOnce({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    const { odmowa } = await tylkoWlasciciel({} as never, 'Strony są tylko dla właściciela')
    expect(await odmowa?.json()).toEqual({ error: 'Strony są tylko dla właściciela' })
  })
})
