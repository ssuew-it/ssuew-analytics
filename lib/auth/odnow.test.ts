import { describe, it, expect, vi, beforeEach } from 'vitest'

const stanAuth: { currentUser: { getIdToken: (f: boolean) => Promise<string> } | null } = { currentUser: null }

vi.mock('@/lib/auth/firebase', () => ({
  firebaseSkonfigurowany: true,
  auth: () => ({ authStateReady: () => Promise.resolve(), get currentUser() { return stanAuth.currentUser } }),
}))
vi.mock('./firebase', () => ({
  firebaseSkonfigurowany: true,
  auth: () => ({ authStateReady: () => Promise.resolve(), get currentUser() { return stanAuth.currentUser } }),
}))

const odp = (status: number) => new Response(status === 200 ? '[]' : '{}', { status })

describe('fetchZSesja', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    stanAuth.currentUser = null
  })

  it('wygasły token: odnawia sesję z konta Firebase i ponawia zapytanie raz', async () => {
    stanAuth.currentUser = { getIdToken: () => Promise.resolve('swiezy') }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(odp(401)) // dane - token wygasł
      .mockResolvedValueOnce(odp(200)) // POST /api/session
      .mockResolvedValueOnce(odp(200)) // dane po odnowieniu
    vi.stubGlobal('fetch', fetchMock)
    const { fetchZSesja } = await import('@/lib/auth/odnow')
    const res = await fetchZSesja('/api/kpi')
    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/kpi', '/api/session', '/api/kpi'])
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ token: 'swiezy' })
  })

  it('nikt nie jest zalogowany w Firebase - zostaje 401, bez ponawiania', async () => {
    const fetchMock = vi.fn().mockResolvedValue(odp(401))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchZSesja } = await import('@/lib/auth/odnow')
    expect((await fetchZSesja('/api/kpi')).status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('inne odpowiedzi przechodzą bez zmian', async () => {
    const fetchMock = vi.fn().mockResolvedValue(odp(200))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchZSesja } = await import('@/lib/auth/odnow')
    expect((await fetchZSesja('/api/kpi')).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
