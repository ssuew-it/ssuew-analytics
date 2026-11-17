import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET as polacz } from '@/app/api/skrzynka/polacz/route'
import { GET as oauth } from '@/app/api/skrzynka/oauth/route'
import { POST as importuj } from '@/app/api/skrzynka/import/route'
import { POST as push } from '@/app/api/skrzynka/push/route'
import { GET as cron } from '@/app/api/skrzynka/cron/route'
import { POST as dociagnij } from '@/app/api/skrzynka/synchronizuj/route'
import { GET as zgodaKalendarza } from '@/app/api/skrzynka/kalendarz/route'
import { BladSkrzynki } from '@/lib/skrzynka/google'

const { ktoPyta, s, zweryfikujPush, celStanu, polaczKalendarz } = vi.hoisted(() => ({
  ktoPyta: vi.fn(),
  s: { polaczSkrzynke: vi.fn(), importujStrone: vi.fn(), synchronizuj: vi.fn(), odnowObserwacje: vi.fn() },
  zweryfikujPush: vi.fn(),
  celStanu: vi.fn(),
  polaczKalendarz: vi.fn(),
}))

vi.mock('next/server', async (oryginal) => ({ ...(await oryginal<typeof import('next/server')>()), after: (f: () => unknown) => f() }))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/skrzynka/synchronizacja', () => s)
vi.mock('@/lib/skrzynka/push', () => ({ zweryfikujPush: (...a: unknown[]) => zweryfikujPush(...a) }))
vi.mock('@/lib/skrzynka/stanOauth', () => ({
  podpiszStan: async (uid: string, cel = 'skrzynka') => `stan-${uid}-${cel}`,
  celStanu: (...a: unknown[]) => celStanu(...a),
}))
vi.mock('@/lib/kalendarz/polaczenie', () => ({ polaczKalendarz: (...a: unknown[]) => polaczKalendarz(...a) }))

const BAZA = 'https://ssuew-analytics.vercel.app'
const zadanie = (sciezka: string, o: { body?: unknown; naglowki?: Record<string, string> } = {}) =>
  ({ url: `${BAZA}${sciezka}`, nextUrl: new URL(`${BAZA}${sciezka}`), headers: new Headers(o.naglowki), json: async () => o.body }) as never

beforeEach(() => {
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u1', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  Object.values(s).forEach((f) => f.mockReset())
  zweryfikujPush.mockReset()
  celStanu.mockReset().mockResolvedValue('skrzynka')
  polaczKalendarz.mockReset()
  vi.stubEnv('SKRZYNKA_CLIENT_ID', 'klient')
  vi.stubEnv('SKRZYNKA_CLIENT_SECRET', 'sekret')
  vi.stubEnv('SKRZYNKA_ADRES', BAZA)
  vi.stubEnv('DECK_OWNER_EMAIL', 'kontakt@samorzad.ue.wroc.pl')
  vi.stubEnv('CRON_SECRET', 'cron-sekret')
})
afterEach(() => vi.unstubAllEnvs())

describe('dostęp', () => {
  it('bez sesji 401, zarząd 403 - połączenie, oauth, import i dociąganie', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await polacz(zadanie('/api/skrzynka/polacz'))).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    for (const r of [
      await polacz(zadanie('/api/skrzynka/polacz')),
      await zgodaKalendarza(zadanie('/api/skrzynka/kalendarz')),
      await oauth(zadanie('/api/skrzynka/oauth?code=k&state=s')),
      await importuj(zadanie('/api/skrzynka/import', { body: {} })),
      await dociagnij(zadanie('/api/skrzynka/synchronizuj')),
    ]) {
      expect(r.status).toBe(403)
      expect((await r.json()).error).toBe('Skrzynka jest tylko dla właściciela')
    }
    expect(s.polaczSkrzynke).not.toHaveBeenCalled()
  })
})

describe('połączenie', () => {
  it('przekierowuje do zgody Google ze state związanym z kontem', async () => {
    const r = await polacz(zadanie('/api/skrzynka/polacz'))
    const u = new URL(r.headers.get('location')!)
    expect(u.host).toBe('accounts.google.com')
    expect(u.searchParams.get('state')).toBe('stan-u1-skrzynka')
  })

  it('bez konfiguracji - wraca do panelu z błędem', async () => {
    vi.stubEnv('SKRZYNKA_CLIENT_ID', '')
    const r = await polacz(zadanie('/api/skrzynka/polacz'))
    expect(r.headers.get('location')).toBe(`${BAZA}/skrzynka?blad=konfiguracja`)
  })

  it('powrót: odmowa, zły state, inne konto, zgoda bez wysyłki, błąd, sukces', async () => {
    const gdzie = async (q: string) => (await oauth(zadanie(`/api/skrzynka/oauth${q}`))).headers.get('location')
    expect(await gdzie('?error=access_denied')).toBe(`${BAZA}/skrzynka?blad=odmowa`)
    celStanu.mockResolvedValueOnce(null)
    expect(await gdzie('?code=k&state=zly')).toBe(`${BAZA}/skrzynka?blad=stan`)
    expect(await gdzie('?state=s')).toBe(`${BAZA}/skrzynka?blad=stan`)
    s.polaczSkrzynke.mockResolvedValueOnce('inne-konto')
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka?blad=inne-konto`)
    s.polaczSkrzynke.mockResolvedValueOnce('brak-wysylki')
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka?blad=brak-wysylki`)
    s.polaczSkrzynke.mockRejectedValueOnce(new Error('sieć'))
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka?blad=polaczenie`)
    s.polaczSkrzynke.mockResolvedValueOnce('ok')
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka`)
    expect(celStanu).toHaveBeenLastCalledWith('s', 'u1')
    expect(s.polaczSkrzynke).toHaveBeenLastCalledWith('k')
    expect(polaczKalendarz).not.toHaveBeenCalled()
  })

  it('zgoda na kalendarz: zarząd 403; właściciel - przekierowanie z include_granted_scopes i calendar.events', async () => {
    const r = await zgodaKalendarza(zadanie('/api/skrzynka/kalendarz'))
    const u = new URL(r.headers.get('location')!)
    expect(u.host).toBe('accounts.google.com')
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      scope: 'https://www.googleapis.com/auth/calendar.events',
      include_granted_scopes: 'true',
      access_type: 'offline',
      prompt: 'consent',
      redirect_uri: `${BAZA}/api/skrzynka/oauth`,
      login_hint: 'kontakt@samorzad.ue.wroc.pl',
      state: 'stan-u1-kalendarz',
    })
  })

  it('state kalendarza idzie do polaczKalendarz, nie do polaczSkrzynke', async () => {
    const gdzie = async () => (await oauth(zadanie('/api/skrzynka/oauth?code=k&state=s'))).headers.get('location')
    celStanu.mockResolvedValue('kalendarz')
    polaczKalendarz.mockResolvedValueOnce('ok')
    expect(await gdzie()).toBe(`${BAZA}/skrzynka?kalendarz=ok`)
    expect(polaczKalendarz).toHaveBeenCalledWith('k')
    polaczKalendarz.mockResolvedValueOnce('niepelna-zgoda')
    expect(await gdzie()).toBe(`${BAZA}/skrzynka?blad=niepelna-zgoda`)
    polaczKalendarz.mockRejectedValueOnce(new Error('sieć'))
    expect(await gdzie()).toBe(`${BAZA}/skrzynka?blad=polaczenie`)
    expect(s.polaczSkrzynke).not.toHaveBeenCalled()
  })
})

describe('import i dociąganie', () => {
  it('import przekazuje stronę; rozłączona - 409', async () => {
    s.importujStrone.mockResolvedValueOnce({ nastepnaStrona: 'p3', zrobione: 200, razem: 900 })
    const r = await importuj(zadanie('/api/skrzynka/import', { body: { strona: 'p2' } }))
    expect(await r.json()).toEqual({ nastepnaStrona: 'p3', zrobione: 200, razem: 900 })
    expect(s.importujStrone).toHaveBeenCalledWith('p2')
    await importuj(zadanie('/api/skrzynka/import', { body: null }))
    expect(s.importujStrone).toHaveBeenLastCalledWith(null)
    s.importujStrone.mockRejectedValueOnce(new BladSkrzynki('rozlaczona', '401'))
    expect((await importuj(zadanie('/api/skrzynka/import', { body: {} }))).status).toBe(409)
  })

  it('dociąganie zwraca wynik synchronizacji', async () => {
    s.synchronizuj.mockResolvedValueOnce({ stan: 'zrobione', watki: 3 })
    expect(await (await dociagnij(zadanie('/api/skrzynka/synchronizuj'))).json()).toEqual({ stan: 'zrobione', watki: 3 })
  })
})

describe('push i cron', () => {
  it('push bez ważnego tokenu 401 i bez synchronizacji; z tokenem 204 i synchronizacja', async () => {
    zweryfikujPush.mockResolvedValueOnce(false)
    expect((await push(zadanie('/api/skrzynka/push', { naglowki: { authorization: 'Bearer zly' } }))).status).toBe(401)
    expect(s.synchronizuj).not.toHaveBeenCalled()
    zweryfikujPush.mockResolvedValueOnce(true)
    s.synchronizuj.mockResolvedValueOnce({ stan: 'zrobione', watki: 1 })
    expect((await push(zadanie('/api/skrzynka/push', { naglowki: { authorization: 'Bearer dobry' } }))).status).toBe(204)
    expect(zweryfikujPush).toHaveBeenLastCalledWith('Bearer dobry')
    expect(s.synchronizuj).toHaveBeenCalledTimes(1)
  })

  it('cron tylko z sekretem: odnawia obserwację i synchronizuje', async () => {
    expect((await cron(zadanie('/api/skrzynka/cron'))).status).toBe(401)
    expect((await cron(zadanie('/api/skrzynka/cron', { naglowki: { authorization: 'Bearer zly' } }))).status).toBe(401)
    s.synchronizuj.mockResolvedValueOnce({ stan: 'niepolaczona' })
    const r = await cron(zadanie('/api/skrzynka/cron', { naglowki: { authorization: 'Bearer cron-sekret' } }))
    expect(r.status).toBe(200)
    expect(s.odnowObserwacje).toHaveBeenCalled()
    vi.stubEnv('CRON_SECRET', '')
    expect((await cron(zadanie('/api/skrzynka/cron', { naglowki: { authorization: 'Bearer ' } }))).status).toBe(401)
  })

  it('cron: nieudane odnowienie obserwacji nie blokuje synchronizacji, ale kończy się błędem w logach', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    s.odnowObserwacje.mockRejectedValueOnce(new BladSkrzynki('inny', 'watch padł'))
    s.synchronizuj.mockResolvedValueOnce({ stan: 'ok', zmian: 2 })
    const r = await cron(zadanie('/api/skrzynka/cron', { naglowki: { authorization: 'Bearer cron-sekret' } }))
    expect(s.synchronizuj).toHaveBeenCalled()
    expect(r.status).toBe(500)
    expect(await r.json()).toMatchObject({ synchronizacja: { stan: 'ok', zmian: 2 }, obserwacja: expect.any(String) })
    expect(log).toHaveBeenCalledWith('[skrzynka] cron - odnowienie obserwacji:', expect.anything())
    log.mockRestore()
  })
})
