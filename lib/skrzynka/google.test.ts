import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BladSkrzynki, adresZgody, gmail, komunikatBledu, wymienKod } from '@/lib/skrzynka/google'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const fetchMock = vi.fn()
const odp = (status: number, dane: unknown) => new Response(typeof dane === 'string' ? dane : JSON.stringify(dane), { status })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('SKRZYNKA_CLIENT_ID', 'klient.apps.googleusercontent.com')
  vi.stubEnv('SKRZYNKA_CLIENT_SECRET', 'sekret')
  vi.stubEnv('SKRZYNKA_ADRES', 'https://ssuew-analytics.vercel.app/')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** Google: token zawsze, a na Gmaila odpowiada `api(url)`. */
function google(api: (url: string) => Response = () => odp(200, {})) {
  fetchMock.mockImplementation(async (url: string) =>
    url === TOKEN_URL ? odp(200, { access_token: 'dostep-1', expires_in: 3600 }) : api(url),
  )
}
const wywolaniaTokenu = () => fetchMock.mock.calls.filter(([u]) => u === TOKEN_URL)

describe('zgoda i wymiana kodu', () => {
  it('adres zgody: offline, zgoda wymuszona, oba zakresy, stały adres powrotu', () => {
    const u = new URL(adresZgody('STAN', 'kontakt@samorzad.ue.wroc.pl'))
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: 'klient.apps.googleusercontent.com',
      redirect_uri: 'https://ssuew-analytics.vercel.app/api/skrzynka/oauth',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      login_hint: 'kontakt@samorzad.ue.wroc.pl',
      state: 'STAN',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
    })
  })

  it('bez konfiguracji - BladSkrzynki konfiguracja', () => {
    vi.stubEnv('SKRZYNKA_CLIENT_SECRET', '')
    expect(() => adresZgody('s', 'e')).toThrow(BladSkrzynki)
  })

  it('wymiana kodu zwraca refresh token; bez niego - błąd', async () => {
    fetchMock.mockResolvedValueOnce(odp(200, { access_token: 'a', refresh_token: 'r', expires_in: 3600 }))
    expect(await wymienKod('KOD')).toEqual({ refreshToken: 'r', dostep: 'a' })
    const cialo = new URLSearchParams(fetchMock.mock.calls[0][1].body)
    expect(Object.fromEntries(cialo)).toMatchObject({ grant_type: 'authorization_code', code: 'KOD', redirect_uri: 'https://ssuew-analytics.vercel.app/api/skrzynka/oauth' })
    fetchMock.mockResolvedValueOnce(odp(200, { access_token: 'a', expires_in: 3600 }))
    await expect(wymienKod('KOD')).rejects.toBeInstanceOf(BladSkrzynki)
  })
})

describe('klient Gmaila', () => {
  it('odświeża token raz i używa go ponownie', async () => {
    google(() => odp(200, { emailAddress: 'kontakt@samorzad.ue.wroc.pl', historyId: '9' }))
    const g = gmail('refresh-1')
    await g.profil()
    await g.profil()
    expect(wywolaniaTokenu()).toHaveLength(1)
    expect(Object.fromEntries(new URLSearchParams(wywolaniaTokenu()[0][1].body))).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'refresh-1' })
    expect(fetchMock.mock.calls.at(-1)![1].headers.Authorization).toBe('Bearer dostep-1')
  })

  it('token z wymiany kodu nie wymaga odświeżania', async () => {
    google(() => odp(200, { emailAddress: 'x', historyId: '1' }))
    await gmail('r', 'dostep-z-kodu').profil()
    expect(wywolaniaTokenu()).toHaveLength(0)
  })

  it('wątek: format metadata z listą nagłówków; lista i historia z parametrami', async () => {
    google(() => odp(200, {}))
    const g = gmail('r', 'd')
    await g.watek('abc')
    const u1 = new URL(fetchMock.mock.calls.at(-1)![0])
    expect(u1.pathname).toBe('/gmail/v1/users/me/threads/abc')
    expect(u1.searchParams.get('format')).toBe('metadata')
    expect(u1.searchParams.getAll('metadataHeaders')).toEqual(['From', 'To', 'Cc', 'Subject', 'List-Unsubscribe', 'Precedence'])
    await g.listaWatkow('newer_than:365d', 'STRONA')
    const u2 = new URL(fetchMock.mock.calls.at(-1)![0])
    expect(Object.fromEntries(u2.searchParams)).toEqual({ q: 'newer_than:365d', maxResults: '100', pageToken: 'STRONA' })
    await g.historia('123', null)
    const u3 = new URL(fetchMock.mock.calls.at(-1)![0])
    expect(Object.fromEntries(u3.searchParams)).toEqual({ startHistoryId: '123', historyTypes: 'messageAdded' })
  })

  it('obserwacja: tylko Odebrane i Wysłane', async () => {
    google(() => odp(200, { historyId: '5', expiration: '1792000000000' }))
    await gmail('r', 'd').obserwuj('projects/deck-samorzad/topics/skrzynka')
    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/watch')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ topicName: 'projects/deck-samorzad/topics/skrzynka', labelIds: ['INBOX', 'SENT'], labelFilterBehavior: 'include' })
  })

  it('błędy: odwołany token, 401, za stara historia, brak wątku, inne', async () => {
    fetchMock.mockResolvedValueOnce(odp(400, { error: 'invalid_grant' }))
    await expect(gmail('r').profil()).rejects.toMatchObject({ rodzaj: 'rozlaczona' })

    const przypadki: [string, (url: string) => Response, string][] = [
      ['profil', () => odp(401, 'unauthorized'), 'rozlaczona'],
      ['historia', () => odp(404, 'not found'), 'historia-za-stara'],
      ['watek', () => odp(404, 'not found'), 'brak-watku'],
      ['profil', () => odp(500, 'backend'), 'inny'],
    ]
    for (const [metoda, api, rodzaj] of przypadki) {
      google(api)
      const g = gmail('r', 'd')
      const wynik = metoda === 'historia' ? g.historia('1', null) : metoda === 'watek' ? g.watek('t') : g.profil()
      await expect(wynik).rejects.toMatchObject({ rodzaj })
    }
  })

  it('limit tempa (429 i 403 rateLimitExceeded) - ponawia z przerwą, po trzech próbach poddaje się', async () => {
    vi.useFakeTimers()
    try {
      let n = 0
      google(() => (++n <= 2 ? odp(n === 1 ? 429 : 403, '{"error":{"errors":[{"reason":"rateLimitExceeded"}]}}') : odp(200, { emailAddress: 'x', historyId: '1' })))
      const p = gmail('r', 'd').profil()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(await p).toEqual({ emailAddress: 'x', historyId: '1' })
      expect(n).toBe(3)

      google(() => new Response('slow down', { status: 429, headers: { 'Retry-After': '2' } }))
      const q = gmail('r', 'd').profil().catch((e) => e)
      await vi.advanceTimersByTimeAsync(30_000)
      expect(await q).toMatchObject({ rodzaj: 'inny' })
      expect(fetchMock.mock.calls.filter(([u]) => u !== TOKEN_URL)).toHaveLength(4 + 3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('komunikaty błędów dla tras', () => {
    expect(komunikatBledu(new BladSkrzynki('rozlaczona', 'x'))).toEqual({ status: 409, error: 'Skrzynka jest rozłączona - połącz ją ponownie.' })
    expect(komunikatBledu(new BladSkrzynki('konfiguracja', 'x')).status).toBe(500)
    expect(komunikatBledu(new Error('?')).status).toBe(502)
  })
})
