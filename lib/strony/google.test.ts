// @vitest-environment node
// jose w jsdom nie rozpoznaje Uint8Array z innej realm - moduł i tak żyje tylko na serwerze.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair } from 'jose'

const EMAIL = 'deck@projekt.iam.gserviceaccount.com'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
let konto = ''
const fetchMock = vi.fn()

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  konto = JSON.stringify({ client_email: EMAIL, private_key: await exportPKCS8(privateKey) })
})

const odp = (status: number, dane: unknown) =>
  new Response(typeof dane === 'string' ? dane : JSON.stringify(dane), { status })

/** Google, który wydaje token i na każde inne pytanie odpowiada `api`. */
function google(api: { status: number; dane: unknown } = { status: 200, dane: { siteEntry: [] } }) {
  fetchMock.mockImplementation(async (url: string) =>
    url === TOKEN_URL ? odp(200, { access_token: 'tok-1', expires_in: 3600 }) : odp(api.status, api.dane),
  )
}

const wywolaniaTokenu = () => fetchMock.mock.calls.filter(([u]) => u === TOKEN_URL)
const modul = () => import('@/lib/strony/google')

beforeEach(() => {
  vi.resetModules()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', konto)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('token konta serwisowego', () => {
  it('podpisuje JWT kluczem konta i wymienia go na token dostępu', async () => {
    google()
    const { listaWitryn } = await modul()
    await listaWitryn()
    const cialo = new URLSearchParams(wywolaniaTokenu()[0][1].body)
    expect(cialo.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    const jwt = cialo.get('assertion')!
    expect(decodeProtectedHeader(jwt).alg).toBe('RS256')
    expect(decodeJwt(jwt)).toMatchObject({
      iss: EMAIL,
      aud: TOKEN_URL,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    })
    const [, api] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/sites'))!
    expect(api.headers.Authorization).toBe('Bearer tok-1')
  })

  it('ten sam token przy kolejnym pytaniu; nowy 5 minut przed wygaśnięciem', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-04T10:00:00Z'))
    google()
    const { listaWitryn } = await modul()
    await listaWitryn()
    await listaWitryn()
    expect(wywolaniaTokenu()).toHaveLength(1)
    vi.setSystemTime(new Date('2026-10-04T10:56:00Z'))
    await listaWitryn()
    expect(wywolaniaTokenu()).toHaveLength(2)
  })

  it('osobne konto Search Console ma pierwszeństwo przed kontem Firebase', async () => {
    const { privateKey } = await generateKeyPair('RS256', { extractable: true })
    const wlasne = 'deck-strony@deck-samorzad.iam.gserviceaccount.com'
    vi.stubEnv('SEARCH_CONSOLE_SERVICE_ACCOUNT', JSON.stringify({ client_email: wlasne, private_key: await exportPKCS8(privateKey) }))
    google()
    const { listaWitryn, emailKonta } = await modul()
    expect(emailKonta()).toBe(wlasne)
    await listaWitryn()
    const jwt = new URLSearchParams(wywolaniaTokenu()[0][1].body).get('assertion')!
    expect(decodeJwt(jwt).iss).toBe(wlasne)
  })

  it('emailKonta: adres z konta albo null bez konfiguracji', async () => {
    expect((await modul()).emailKonta()).toBe(EMAIL)
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '')
    expect((await modul()).emailKonta()).toBeNull()
  })
})

describe('wywołania Search Console', () => {
  it('listaWitryn pomija witryny bez weryfikacji', async () => {
    google({
      status: 200,
      dane: {
        siteEntry: [
          { siteUrl: 'sc-domain:jwk26.pl', permissionLevel: 'siteRestrictedUser' },
          { siteUrl: 'https://obca.pl/', permissionLevel: 'siteUnverifiedUser' },
        ],
      },
    })
    expect(await (await modul()).listaWitryn()).toEqual(['sc-domain:jwk26.pl'])
  })

  it('zapytanie koduje identyfikator witryny w ścieżce i wysyła parametry', async () => {
    google({ status: 200, dane: { rows: [{ clicks: 5, impressions: 50, ctr: 0.1, position: 3 }] } })
    const { zapytanie } = await modul()
    const w = await zapytanie('sc-domain:jwk26.pl', {
      startDate: '2026-09-04', endDate: '2026-10-01', dimensions: ['query'], rowLimit: 10,
    })
    expect(w.rows?.[0].clicks).toBe(5)
    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(url).toBe('https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Ajwk26.pl/searchAnalytics/query')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ startDate: '2026-09-04', endDate: '2026-10-01', dimensions: ['query'], rowLimit: 10 })
  })

  it('błędy mają rodzaj: brak dostępu, wyłączone API, inny', async () => {
    const przypadki = [
      [403, '{"error":{"message":"User does not have sufficient permission for site"}}', 'brak-dostepu'],
      [403, '{"error":{"message":"Google Search Console API has not been used in project 1 before or it is disabled."}}', 'api-wylaczone'],
      [500, 'Backend Error', 'inny'],
    ] as const
    for (const [status, dane, rodzaj] of przypadki) {
      vi.resetModules()
      google({ status, dane })
      const { zapytanie, BladGoogle } = await modul()
      const blad = await zapytanie('https://samorzad.ue.wroc.pl/', { startDate: '2026-09-04', endDate: '2026-10-01' }).catch((e) => e)
      expect(blad).toBeInstanceOf(BladGoogle)
      expect(blad.rodzaj).toBe(rodzaj)
    }
  })

  it('bez konta serwisowego - BladGoogle, nie wyjątek JSON-a', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '')
    const { listaWitryn, BladGoogle } = await modul()
    await expect(listaWitryn()).rejects.toBeInstanceOf(BladGoogle)
  })
})
