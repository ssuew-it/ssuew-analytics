import { describe, it, expect, vi, beforeEach } from 'vitest'

const gasList = vi.fn()
const gasWrite = vi.fn()
const ktoPyta = vi.fn()
const odswiezAnalytics = vi.fn()

vi.mock('@/lib/gas/client', () => ({
  gasList: (...a: unknown[]) => gasList(...a),
  gasWrite: (...a: unknown[]) => gasWrite(...a),
  GasError: class GasError extends Error {
    kod = 500
  },
  odswiezAnalytics: () => odswiezAnalytics(),
}))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))

function zada(body: unknown) {
  return { json: () => Promise.resolve(body) } as never
}

const KOMPLET = { edycja: "J'26", sezon: 'jesien', rok: 2026, zgloszenia: 90, przyjeci: 30 }

describe('/api/rekrutacje', () => {
  beforeEach(() => {
    vi.resetModules()
    gasList.mockReset()
    gasWrite.mockReset()
    ktoPyta.mockReset()
    odswiezAnalytics.mockReset()
  })

  it('GET bez ważnej sesji - 401, arkusz nietknięty', async () => {
    // Proxy sprawdza tylko, czy ciasteczko istnieje - wygasły albo zmyślony
    // token przechodził i dostawał dane.
    ktoPyta.mockResolvedValue(null)
    const { GET } = await import('@/app/api/rekrutacje/route')
    const res = await GET(zada(null))
    expect(res.status).toBe(401)
    expect(gasList).not.toHaveBeenCalled()
  })

  it('GET zwraca wiersze z arkusza', async () => {
    ktoPyta.mockResolvedValue({ uid: 'u', rola: 'czlonek' })
    gasList.mockResolvedValue([{ id: '1', edycja: "J'25" }])
    const { GET } = await import('@/app/api/rekrutacje/route')
    const res = await GET(zada(null))
    expect(await res.json()).toEqual([{ id: '1', edycja: "J'25" }])
    expect(gasList).toHaveBeenCalledWith('rekrutacje')
  })

  it('POST bez sesji zwraca 401 i niczego nie zapisuje', async () => {
    ktoPyta.mockResolvedValue(null)
    const { POST } = await import('@/app/api/rekrutacje/route')
    const res = await POST(zada(KOMPLET))
    expect(res.status).toBe(401)
    expect(gasWrite).not.toHaveBeenCalled()
  })

  it('POST z rolą board zwraca 403 i niczego nie zapisuje', async () => {
    ktoPyta.mockResolvedValue({ uid: 'u2', email: 'z@e.com', rola: 'board' })
    const { POST } = await import('@/app/api/rekrutacje/route')
    const res = await POST(zada(KOMPLET))
    expect(res.status).toBe(403)
    expect(gasWrite).not.toHaveBeenCalled()
  })

  it('POST z brakiem pól zwraca 400', async () => {
    ktoPyta.mockResolvedValue({ uid: 'u1', email: 'a@b.c', rola: 'owner' })
    const { POST } = await import('@/app/api/rekrutacje/route')
    expect((await POST(zada({ edycja: "J'26" }))).status).toBe(400)
  })

  it('POST z rolą owner zapisuje przez upsert i zwraca 201', async () => {
    ktoPyta.mockResolvedValue({ uid: 'u1', email: 'a@b.c', rola: 'owner' })
    gasWrite.mockResolvedValue([{ id: 'x', ...KOMPLET }])
    const { POST } = await import('@/app/api/rekrutacje/route')
    const res = await POST(zada(KOMPLET))
    expect(res.status).toBe(201)
    expect(gasWrite).toHaveBeenCalledWith('rekrutacje', 'upsert', [KOMPLET])
  })

  it('POST unieważnia cache, żeby zapis był widoczny od razu', async () => {
    ktoPyta.mockResolvedValue({ uid: 'u1', email: 'a@b.c', rola: 'owner' })
    gasWrite.mockResolvedValue([{ id: 'x' }])
    const { POST } = await import('@/app/api/rekrutacje/route')
    await POST(zada(KOMPLET))
    expect(odswiezAnalytics).toHaveBeenCalled()
  })
})
