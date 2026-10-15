import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as lista } from '@/app/api/skrzynka/sprawy/route'
import { GET as szukaj } from '@/app/api/skrzynka/szukaj/route'
import { GET as sprawa, PATCH as zmien } from '@/app/api/skrzynka/sprawy/[id]/route'
import { GET as zalacznik } from '@/app/api/skrzynka/sprawy/[id]/zalacznik/[zid]/route'
import { POST as odpowiedz } from '@/app/api/skrzynka/sprawy/[id]/odpowiedz/route'
import { BladSkrzynki } from '@/lib/skrzynka/google'
import { MAKS_POBRANIA, MAKS_ZALACZNIKOW, type Sprawa } from '@/lib/skrzynka/typy'

const { ktoPyta, dane, g, wyslijOdpowiedz } = vi.hoisted(() => ({
  ktoPyta: vi.fn(),
  dane: {
    listaSpraw: vi.fn(), czytajSprawy: vi.fn(), czytajSprawe: vi.fn(), zmienSprawe: vi.fn(),
    dodajPomijanie: vi.fn(), skladZarzadu: vi.fn(), czytajUstawienia: vi.fn(),
  },
  g: { listaWatkow: vi.fn(), watekPelny: vi.fn(), zalacznik: vi.fn() },
  wyslijOdpowiedz: vi.fn(),
}))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/skrzynka/dane', () => dane)
vi.mock('@/lib/skrzynka/synchronizacja', () => ({
  klientGmaila: async () => g,
  zRozlaczeniem: <T,>(f: () => Promise<T>) => f(),
  nasz: () => 'kontakt@samorzad.ue.wroc.pl',
  wyslijOdpowiedz: (...a: unknown[]) => wyslijOdpowiedz(...a),
}))

const BAZA = 'https://ssuew-analytics.vercel.app'
const zadanie = (sciezka: string, body?: unknown) =>
  ({ url: `${BAZA}${sciezka}`, nextUrl: new URL(`${BAZA}${sciezka}`), json: async () => body, formData: async () => body }) as never
const p = (id: string, zid?: string) => ({ params: Promise.resolve(zid ? { id, zid } : { id }) }) as never

const S = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
  id, temat: 'Sponsoring', status: 'do-odpowiedzi', oczekujeOd: 100, nowa: false, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
  ostatnia: { kiedy: 100, kierunek: 'oni', fragment: '' }, wiadomosci: 1, przypisana: null, kategoriaGmail: null, zmieniono: 1, ...n,
})

beforeEach(() => {
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  Object.values(dane).forEach((f) => f.mockReset())
  Object.values(g).forEach((f) => f.mockReset())
  wyslijOdpowiedz.mockReset()
  dane.skladZarzadu.mockResolvedValue(['Jula'])
  dane.czytajUstawienia.mockResolvedValue({ stopka: 'Stopka', pomijaneAdresy: [], pomijaneDomeny: [] })
})

describe('dostęp', () => {
  it('bez sesji 401, zarząd 403 - każda trasa', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await lista(zadanie('/api/skrzynka/sprawy?status=zalatwiona'))).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    for (const r of [
      await lista(zadanie('/api/skrzynka/sprawy?status=zalatwiona')),
      await szukaj(zadanie('/api/skrzynka/szukaj?q=oferta')),
      await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1')),
      await zmien(zadanie('/api/skrzynka/sprawy/t1', { status: 'w-toku' }), p('t1')),
      await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A?w=m1'), p('t1', 'A')),
      await odpowiedz(zadanie('/api/skrzynka/sprawy/t1/odpowiedz', new FormData()), p('t1')),
    ]) expect(r.status).toBe(403)
    expect(dane.zmienSprawe).not.toHaveBeenCalled()
    expect(wyslijOdpowiedz).not.toHaveBeenCalled()
  })
})

describe('lista i wyszukiwanie', () => {
  it('lista: nieznany status 400; strona z kursorem', async () => {
    expect((await lista(zadanie('/api/skrzynka/sprawy?status=archiwum'))).status).toBe(400)
    dane.listaSpraw.mockResolvedValue({ sprawy: [S('t1')], nastepna: 'k' })
    const r = await lista(zadanie('/api/skrzynka/sprawy?status=zalatwiona&po=zalatwiona%7C1%7Ct0'))
    expect(await r.json()).toMatchObject({ nastepna: 'k' })
    expect(dane.listaSpraw).toHaveBeenCalledWith('zalatwiona', 'zalatwiona|1|t0')
  })

  it('wyszukiwanie: za krótkie 400; wyniki z bazy od najnowszej, wątki spoza bazy pominięte', async () => {
    expect((await szukaj(zadanie('/api/skrzynka/szukaj?q=a'))).status).toBe(400)
    g.listaWatkow.mockResolvedValue({ threads: [{ id: 'stary' }, { id: 't1' }, { id: 'spoza' }, { id: 't2' }] })
    dane.czytajSprawy.mockResolvedValue(new Map([
      ['t1', S('t1', { ostatnia: { kiedy: 100, kierunek: 'oni', fragment: '' } })],
      ['t2', S('t2', { ostatnia: { kiedy: 300, kierunek: 'oni', fragment: '' } })],
      ['stary', S('stary', { ostatnia: { kiedy: 50, kierunek: 'oni', fragment: '' } })],
    ]))
    const r = await szukaj(zadanie(`/api/skrzynka/szukaj?q=${encodeURIComponent('oferta sponsorska')}`))
    expect((await r.json()).sprawy.map((s: Sprawa) => s.id)).toEqual(['t2', 't1', 'stary'])
    expect(g.listaWatkow).toHaveBeenCalledWith('oferta sponsorska', null)
  })
})

describe('sprawa', () => {
  const utf = (s: string) => Buffer.from(s, 'utf8').toString('base64url')

  it('wątek usunięty w Gmailu - sprawa bez wiadomości, żeby dało się ją zamknąć', async () => {
    dane.czytajSprawe.mockResolvedValueOnce(S('t1'))
    g.watekPelny.mockRejectedValue(new BladSkrzynki('brak-watku', 'Gmail 404'))
    const r = await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1'))
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ sprawa: { id: 't1' }, wiadomosci: [], adresat: null, stopka: 'Stopka' })
  })

  it('brak - 404; jest - treść z Gmaila, adresat i stopka odpowiedzi, zdjęty znacznik nowej', async () => {
    dane.czytajSprawe.mockResolvedValueOnce(null)
    expect((await sprawa(zadanie('/api/skrzynka/sprawy/brak'), p('brak'))).status).toBe(404)
    dane.czytajSprawe.mockResolvedValueOnce(S('t1', { nowa: true }))
    dane.zmienSprawe.mockResolvedValueOnce(S('t1', { nowa: false }))
    g.watekPelny.mockResolvedValue({
      id: 't1',
      messages: [{ id: 'm1', internalDate: '100', labelIds: ['INBOX'], payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'anna@firma.pl' }], body: { data: utf('Treść') } } }],
    })
    const d = await (await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1'))).json()
    expect(d.sprawa.nowa).toBe(false)
    expect(d.wiadomosci[0]).toMatchObject({ id: 'm1', tekst: 'Treść' })
    expect(d.adresat).toBe('anna@firma.pl')
    expect(d.stopka).toBe('Stopka')
    expect(dane.zmienSprawe).toHaveBeenCalledWith('t1', { nowa: false })
  })

  it('zmiana: niepoprawna 400, brak 404, status, przypisanie', async () => {
    expect((await zmien(zadanie('/api/skrzynka/sprawy/t1', { przypisana: 'Obcy' }), p('t1'))).status).toBe(400)
    dane.czytajSprawe.mockResolvedValueOnce(null)
    expect((await zmien(zadanie('/api/skrzynka/sprawy/t1', { status: 'w-toku' }), p('t1'))).status).toBe(404)
    dane.czytajSprawe.mockResolvedValue(S('t1'))
    dane.zmienSprawe.mockResolvedValue(S('t1', { status: 'w-toku', oczekujeOd: null }))
    const r = await zmien(zadanie('/api/skrzynka/sprawy/t1', { status: 'w-toku', przypisana: 'Jula' }), p('t1'))
    expect((await r.json()).status).toBe('w-toku')
    expect(dane.zmienSprawe).toHaveBeenLastCalledWith('t1', { status: 'w-toku', przypisana: 'Jula' })
  })

  it('pomiń zawsze: adres albo domena organizacji; domena skrzynki prywatnej - 400', async () => {
    dane.czytajSprawe.mockResolvedValue(S('t1'))
    dane.zmienSprawe.mockResolvedValue(S('t1', { status: 'pominieta', oczekujeOd: null }))
    await zmien(zadanie('/api/skrzynka/sprawy/t1', { pomin: 'domena' }), p('t1'))
    expect(dane.dodajPomijanie).toHaveBeenLastCalledWith('domena', 'firma.pl')
    expect(dane.zmienSprawe).toHaveBeenLastCalledWith('t1', { status: 'pominieta' })
    await zmien(zadanie('/api/skrzynka/sprawy/t1', { pomin: 'adres' }), p('t1'))
    expect(dane.dodajPomijanie).toHaveBeenLastCalledWith('adres', 'anna@firma.pl')
    dane.czytajSprawe.mockResolvedValue(S('t2', { kontakt: 'ktos@gmail.com', organizacja: null }))
    const r = await zmien(zadanie('/api/skrzynka/sprawy/t2', { pomin: 'domena' }), p('t2'))
    expect(r.status).toBe(400)
    dane.czytajSprawe.mockResolvedValue(S('t3', { kontakt: null, organizacja: null }))
    expect((await zmien(zadanie('/api/skrzynka/sprawy/t3', { pomin: 'adres' }), p('t3'))).status).toBe(400)
  })
})

describe('załącznik', () => {
  it('za duży na odpowiedź funkcji - 413 z odesłaniem do Gmaila', async () => {
    g.zalacznik.mockResolvedValue({ data: 'JVBERi0', size: MAKS_POBRANIA + 1 })
    const r = await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A?w=m1&nazwa=skan.pdf&typ=application%2Fpdf'), p('t1', 'A'))
    expect(r.status).toBe(413)
    expect((await r.json()).error).toMatch(/Gmail/)
  })

  it('zawsze do pobrania; typ spoza listy bezpiecznych jako octet-stream; polska nazwa', async () => {
    g.zalacznik.mockResolvedValue({ data: Buffer.from('<svg onload=alert(1)>').toString('base64url'), size: 21 })
    const r = await zalacznik(zadanie(`/api/skrzynka/sprawy/t1/zalacznik/A?w=m1&nazwa=${encodeURIComponent('Ofert\u0105 2026.svg')}&typ=image%2Fsvg%2Bxml`), p('t1', 'A'))
    expect(r.headers.get('content-type')).toBe('application/octet-stream')
    expect(r.headers.get('content-disposition')).toBe(`attachment; filename="Ofert_ 2026.svg"; filename*=UTF-8''${encodeURIComponent('Ofert\u0105 2026.svg')}`)
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await r.text()).toBe('<svg onload=alert(1)>')
    expect(g.zalacznik).toHaveBeenCalledWith('m1', 'A')
  })

  it('PDF z typem; bez identyfikatora wiadomości - 400', async () => {
    g.zalacznik.mockResolvedValue({ data: 'JVBERi0', size: 5 })
    const r = await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A?w=m1&nazwa=o.pdf&typ=application%2Fpdf'), p('t1', 'A'))
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect((await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A'), p('t1', 'A'))).status).toBe(400)
  })
})

describe('odpowiedź', () => {
  const formularz = (tekst: string, pliki: File[] = []) => {
    const fd = new FormData()
    fd.append('tekst', tekst)
    for (const plik of pliki) fd.append('pliki', plik)
    return fd
  }
  const wyslij = (fd: FormData) => odpowiedz(zadanie('/api/skrzynka/sprawy/t1/odpowiedz', fd), p('t1'))

  it('tekst bez spacji na brzegach i załączniki do wysyłki; wynik - sprawa po automacie', async () => {
    wyslijOdpowiedz.mockResolvedValue(S('t1', { status: 'czeka-na-nich', oczekujeOd: null }))
    const r = await wyslij(formularz('  Dziękujemy  ', [new File([Uint8Array.from([1, 2, 3])], 'Umowa.pdf', { type: 'application/pdf' })]))
    expect((await r.json()).status).toBe('czeka-na-nich')
    expect(wyslijOdpowiedz).toHaveBeenCalledWith('t1', 'Dziękujemy', [{ nazwa: 'Umowa.pdf', typ: 'application/pdf', dane: Uint8Array.from([1, 2, 3]) }])
  })

  it('pusta treść 400; załączniki ponad 4 MB 413 - nic nie wysłane; dokładnie 4 MB przechodzi', async () => {
    expect((await wyslij(formularz('   '))).status).toBe(400)
    const zaDuzo = await wyslij(formularz('x', [new File([new Uint8Array(MAKS_ZALACZNIKOW)], 'a.bin'), new File([Uint8Array.from([1])], 'b.bin')]))
    expect(zaDuzo.status).toBe(413)
    expect((await zaDuzo.json()).error).toBe('Załączniki mogą mieć łącznie najwyżej 4 MB.')
    expect(wyslijOdpowiedz).not.toHaveBeenCalled()
    wyslijOdpowiedz.mockResolvedValue(S('t1'))
    expect((await wyslij(formularz('x', [new File([new Uint8Array(MAKS_ZALACZNIKOW)], 'a.bin')]))).status).toBe(200)
  })

  it('brak sprawy 404; brak zgody na wysyłkę 403 z komunikatem', async () => {
    wyslijOdpowiedz.mockResolvedValueOnce(null)
    expect((await wyslij(formularz('x'))).status).toBe(404)
    wyslijOdpowiedz.mockRejectedValueOnce(new BladSkrzynki('brak-zgody', 'Gmail 403'))
    const r = await wyslij(formularz('x'))
    expect(r.status).toBe(403)
    expect((await r.json()).error).toMatch(/zgody na wysyłkę/)
  })
})
