import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/skrzynka/oauth/route'
import { GET as zgodaDysku } from '@/app/api/skrzynka/dysk/route'

const { ktoPyta, celStanu, podpiszStan, polaczDysk, polaczKalendarz, polaczSkrzynke } = vi.hoisted(() => ({
  ktoPyta: vi.fn(), celStanu: vi.fn(), podpiszStan: vi.fn(), polaczDysk: vi.fn(), polaczKalendarz: vi.fn(), polaczSkrzynke: vi.fn(),
}))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta }))
vi.mock('@/lib/skrzynka/stanOauth', () => ({ celStanu, podpiszStan }))
vi.mock('@/lib/dysk/polaczenie', () => ({ polaczDysk }))
vi.mock('@/lib/kalendarz/polaczenie', () => ({ polaczKalendarz }))
vi.mock('@/lib/skrzynka/synchronizacja', () => ({ polaczSkrzynke }))

const powrot = (q: string) => ({ url: `https://deck.test/api/skrzynka/oauth?${q}`, nextUrl: new URL(`https://deck.test/api/skrzynka/oauth?${q}`) }) as never

describe('powrót ze zgody Google - cel dysk', () => {
  beforeEach(() => {
    ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@', rola: 'owner' })
    celStanu.mockReset().mockResolvedValue('dysk')
    polaczDysk.mockReset()
  })

  it('ok - wraca do Dziennika z dysk=ok', async () => {
    polaczDysk.mockResolvedValue('ok')
    const r = await GET(powrot('code=K&state=S'))
    expect(polaczDysk).toHaveBeenCalledWith('K')
    expect(r.headers.get('location')).toBe('https://deck.test/dziennik?dysk=ok')
  })

  it('inny wynik - wraca do Dziennika z błędem', async () => {
    polaczDysk.mockResolvedValue('brak-dysku')
    const r = await GET(powrot('code=K&state=S'))
    expect(r.headers.get('location')).toBe('https://deck.test/dziennik?blad=brak-dysku')
  })

  it('odmowa w Google przy celu dysk - też do Dziennika', async () => {
    const r = await GET(powrot('error=access_denied&state=S'))
    expect(r.headers.get('location')).toBe('https://deck.test/dziennik?blad=odmowa')
  })
})

describe('GET /api/skrzynka/dysk', () => {
  it('przekierowuje na zgodę Google na drive.file z celem dysk', async () => {
    vi.stubEnv('DECK_OWNER_EMAIL', 'kontakt@samorzad.ue.wroc.pl')
    vi.stubEnv('SKRZYNKA_CLIENT_ID', 'id')
    vi.stubEnv('SKRZYNKA_CLIENT_SECRET', 'sekret')
    vi.stubEnv('SKRZYNKA_ADRES', 'https://deck.test')
    ktoPyta.mockResolvedValue({ uid: 'u', email: 'kontakt@', rola: 'owner' })
    podpiszStan.mockResolvedValue('STAN')
    const r = await zgodaDysku({ url: 'https://deck.test/api/skrzynka/dysk' } as never)
    expect(podpiszStan).toHaveBeenCalledWith('u', 'dysk')
    const adres = new URL(r.headers.get('location')!)
    expect(adres.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file')
    expect(adres.searchParams.get('include_granted_scopes')).toBe('true')
    expect(adres.searchParams.get('state')).toBe('STAN')
    vi.unstubAllEnvs()
  })
})
