import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BladSkrzynki, adresZgody, gmail, komunikatBledu, odwolajToken, wymienKod } from '@/lib/skrzynka/google'

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
    fetchMock.mockResolvedValueOnce(odp(200, { access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send' }))
    expect(await wymienKod('KOD')).toEqual({
      refreshToken: 'r', dostep: 'a', zakresy: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    })
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
      expect(await q).toMatchObject({ rodzaj: 'limit' })
      expect(fetchMock.mock.calls.filter(([u]) => u !== TOKEN_URL)).toHaveLength(4 + 3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('limit w formacie „Quota exceeded” (403 bez reason) też jest ponawiany', async () => {
    vi.useFakeTimers()
    try {
      let n = 0
      const quota = JSON.stringify({ error: { code: 403, message: "Quota exceeded for quota metric 'Total Query Cost' and limit 'Units per minute per user' of service 'gmail.googleapis.com'", status: 'PERMISSION_DENIED' } })
      google(() => (++n === 1 ? odp(403, quota) : odp(200, { emailAddress: 'x', historyId: '1' })))
      const p = gmail('r', 'd').profil()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(await p).toEqual({ emailAddress: 'x', historyId: '1' })
      expect(n).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('pełny wątek i pobranie załącznika (identyfikator kodowany w ścieżce)', async () => {
    google(() => odp(200, { data: 'YWJj', size: 3 }))
    const g = gmail('r', 'd')
    await g.watekPelny('t1')
    const u = new URL(fetchMock.mock.calls.at(-1)![0])
    expect(u.pathname).toBe('/gmail/v1/users/me/threads/t1')
    expect(u.searchParams.get('format')).toBe('full')
    expect(await g.zalacznik('m1', 'A/B')).toEqual({ data: 'YWJj', size: 3 })
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/m1/attachments/A%2FB')
  })

  it('odpowiedź: nagłówki wątku do odpowiedzi, wysyłka przez upload z wątkiem, zatrzymanie obserwacji', async () => {
    google((url) => (url.includes('/stop') ? new Response(null, { status: 204 }) : odp(200, { id: 'w1', threadId: 't1' })))
    const g = gmail('r', 'd')
    await g.watekDoOdpowiedzi('t1')
    const u = new URL(fetchMock.mock.calls.at(-1)![0])
    expect(u.searchParams.getAll('metadataHeaders')).toEqual(['From', 'To', 'Reply-To', 'Subject', 'Message-ID', 'References'])
    expect(await g.wyslij('From: kontakt@x\r\n\r\nTreść', 't1')).toEqual({ id: 'w1', threadId: 't1' })
    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(url).toBe('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('multipart/related; boundary=deck_wysylka_granica')
    expect(init.body).toBe(
      '--deck_wysylka_granica\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"threadId":"t1"}\r\n' +
        '--deck_wysylka_granica\r\nContent-Type: message/rfc822\r\n\r\nFrom: kontakt@x\r\n\r\nTreść\r\n--deck_wysylka_granica--',
    )
    await g.zatrzymaj()
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/stop')
  })

  it('brak zgody na wysyłkę (403 insufficient scopes) - osobny rodzaj błędu', async () => {
    google(() => odp(403, { error: { message: 'Request had insufficient authentication scopes.' } }))
    await expect(gmail('r', 'd').wyslij('x', 't1')).rejects.toMatchObject({ rodzaj: 'brak-zgody' })
  })

  it('odwołanie tokenu w Google; odmowa - błąd', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }))
    await odwolajToken('refresh-1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/revoke')
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({ token: 'refresh-1' })
    fetchMock.mockResolvedValueOnce(odp(400, { error: 'invalid_token' }))
    await expect(odwolajToken('x')).rejects.toBeInstanceOf(BladSkrzynki)
  })

  it('komunikaty błędów dla tras', () => {
    expect(komunikatBledu(new BladSkrzynki('limit', 'x'))).toEqual({ status: 429, error: 'Gmail chwilowo ogranicza tempo - spróbuję ponownie za minutę.' })
    expect(komunikatBledu(new BladSkrzynki('rozlaczona', 'x'))).toEqual({ status: 409, error: 'Skrzynka jest rozłączona - połącz ją ponownie.' })
    expect(komunikatBledu(new BladSkrzynki('konfiguracja', 'x')).status).toBe(500)
    expect(komunikatBledu(new BladSkrzynki('brak-zgody', 'x')).status).toBe(403)
    expect(komunikatBledu(new BladSkrzynki('brak-adresata', 'x')).status).toBe(400)
    expect(komunikatBledu(new Error('?')).status).toBe(502)
  })
})
