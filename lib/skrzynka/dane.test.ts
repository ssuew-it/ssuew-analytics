import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Sprawa } from '@/lib/skrzynka/typy'

/** Firestore w pamięci - dokumenty, partie, transakcje i proste zapytania (where, orderBy, startAfter, limit, count). */
const { baza, admin } = vi.hoisted(() => {
  type Dane = Record<string, unknown>
  type Ref = { sciezka: string }
  const baza = new Map<string, Dane>()
  const snap = (s: string) => ({
    id: s.split('/').pop()!,
    ref: { sciezka: s },
    exists: baza.has(s),
    data: () => baza.get(s),
    get: (pole: string) => baza.get(s)?.[pole],
  })
  type Migawka = ReturnType<typeof snap>
  const zapisz = (s: string, d: Dane, scal?: boolean) => baza.set(s, scal ? { ...baza.get(s), ...d } : { ...d })
  const firestore = {
    getAll: async (...refs: Ref[]) => refs.map((r) => snap(r.sciezka)),
    batch: () => {
      const ops: (() => void)[] = []
      return {
        set: (r: Ref, d: Dane, o?: { merge?: boolean }) => ops.push(() => zapisz(r.sciezka, d, o?.merge)),
        update: (r: Ref, d: Dane) => ops.push(() => zapisz(r.sciezka, d, true)),
        commit: async () => ops.forEach((f) => f()),
      }
    },
    runTransaction: async <T,>(f: (t: unknown) => Promise<T>) =>
      f({
        get: async (r: Ref) => snap(r.sciezka),
        set: (r: Ref, d: Dane, o?: { merge?: boolean }) => zapisz(r.sciezka, d, o?.merge),
        update: (r: Ref, d: Dane) => zapisz(r.sciezka, d, true),
      }),
  }
  const dok = (sciezka: string) => ({
    sciezka,
    firestore,
    get: async () => snap(sciezka),
    set: async (d: Dane, o?: { merge?: boolean }) => zapisz(sciezka, d, o?.merge),
  })
  const por = (a: unknown, b: unknown) => ((a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0)
  const spelnia = (v: unknown, op: string, w: unknown) => {
    if (v === undefined || v === null) return false
    const r = por(v, w)
    return op === '==' ? v === w : op === '<' ? r < 0 : op === '>' ? r > 0 : op === '>=' ? r >= 0 : op === '<=' ? r <= 0 : false
  }
  type Opis = { warunki: [string, string, unknown][]; kolejnosc: [string, string] | null; ile: number; po: unknown }
  interface Zapytanie {
    where(p: string, op: string, w: unknown): Zapytanie
    orderBy(p: string, kier?: string): Zapytanie
    limit(n: number): Zapytanie
    startAfter(w: unknown): Zapytanie
    get(): Promise<{ docs: Migawka[]; empty: boolean; size: number }>
    count(): { get(): Promise<{ data(): { count: number } }> }
  }
  const zapytanie = (nazwa: string, z: Opis): Zapytanie => {
    const wyniki = () => {
      let docs = [...baza.keys()]
        .filter((k) => k.startsWith(`${nazwa}/`))
        .map(snap)
        .filter((d) => z.warunki.every(([p, op, w]) => spelnia(d.get(p), op, w)))
      if (z.kolejnosc) {
        const [p, kier] = z.kolejnosc
        const zn = kier === 'desc' ? -1 : 1
        docs.sort((a, b) => por(a.get(p), b.get(p)) * zn)
        if (z.po !== undefined) docs = docs.filter((d) => por(d.get(p), z.po) * zn > 0)
      }
      return docs.slice(0, z.ile)
    }
    return {
      where: (p, op, w) => zapytanie(nazwa, { ...z, warunki: [...z.warunki, [p, op, w]] }),
      orderBy: (p, kier = 'asc') => zapytanie(nazwa, { ...z, kolejnosc: [p, kier] }),
      limit: (n) => zapytanie(nazwa, { ...z, ile: n }),
      startAfter: (w) => zapytanie(nazwa, { ...z, po: w }),
      get: async () => {
        const docs = wyniki()
        return { docs, empty: !docs.length, size: docs.length }
      },
      count: () => ({ get: async () => ({ data: () => ({ count: wyniki().length }) }) }),
    }
  }
  const kolekcja = (nazwa: string) => ({
    firestore,
    doc: (id: string) => dok(`${nazwa}/${id}`),
    ...zapytanie(nazwa, { warunki: [], kolejnosc: null, ile: Infinity, po: undefined }),
  })
  return {
    baza,
    admin: {
      skrzynkaStanRef: () => dok('skrzynka/stan'),
      skrzynkaUstawieniaRef: () => dok('skrzynka/ustawienia'),
      ustawieniaRef: (nazwa: string) => dok(`ustawienia/${nazwa}`),
      sprawyRef: () => kolekcja('skrzynkaSprawy'),
      kontaktyRef: () => kolekcja('skrzynkaKontakty'),
      organizacjeRef: () => kolekcja('skrzynkaOrganizacje'),
    },
  }
})
vi.mock('@/lib/firebase/admin', () => admin)

import {
  czytajSprawy, czytajStan, kluczListy, liczniki, listaSpraw, pomijane, uzupelnijKlucze, wezDzierzawe, zapiszStan, zapiszWynik, zwolnijDzierzawe,
} from '@/lib/skrzynka/dane'

const sprawa = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
  id, temat: 'T', status: 'do-odpowiedzi', oczekujeOd: 100, nowa: true, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
  ostatnia: { kiedy: 100, kierunek: 'oni', fragment: 'f' }, wiadomosci: 1, przypisana: null, kategoriaGmail: null, zmieniono: 1, ...n,
})

beforeEach(() => baza.clear())

describe('stan', () => {
  it('bez dokumentu null; zapis scala pola; import i liczby z wartościami domyślnymi', async () => {
    expect(await czytajStan()).toBeNull()
    await zapiszStan({ email: 'kontakt@x', token: 'enc', polaczona: true, historyId: '7' })
    await zapiszStan({ ostatniaSynchronizacja: 5 })
    expect(await czytajStan()).toEqual({
      email: 'kontakt@x', token: 'enc', historyId: '7', watchWygasa: null, ostatniaSynchronizacja: 5,
      dzierzawaDo: 0, doPowtorki: false, polaczona: true, wersjaDanych: 1, import: { trwa: false, zrobione: 0, razem: 0, strona: null },
    })
  })
})

describe('dzierżawa synchronizacji', () => {
  beforeEach(() => zapiszStan({ token: 'enc', polaczona: true }))

  it('druga synchronizacja w trakcie zgłasza powtórkę; pierwsza robi wtedy jeszcze rundę', async () => {
    expect(await wezDzierzawe(1_000)).toBe(true)
    expect(await wezDzierzawe(2_000)).toBe(false)
    expect(await zwolnijDzierzawe(3_000)).toBe(true)
    expect(baza.get('skrzynka/stan')).toMatchObject({ doPowtorki: false, dzierzawaDo: 63_000 })
    expect(await zwolnijDzierzawe(4_000)).toBe(false)
    expect(baza.get('skrzynka/stan')).toMatchObject({ dzierzawaDo: 0 })
  })

  it('przeterminowana dzierżawa nie blokuje', async () => {
    expect(await wezDzierzawe(1_000)).toBe(true)
    expect(await wezDzierzawe(1_000 + 61_000)).toBe(true)
  })
})

describe('sprawy, kontakty, organizacje', () => {
  it('zapis i odczyt sprawy po id wątku; brak - nie ma w mapie', async () => {
    await zapiszWynik({ sprawy: [sprawa('t1')], kontakty: [], organizacje: [] })
    const m = await czytajSprawy(['t1', 't2'])
    expect(m.get('t1')).toEqual(sprawa('t1'))
    expect(m.has('t2')).toBe(false)
    expect((await czytajSprawy([])).size).toBe(0)
  })

  it('nie nadpisuje nazwy i typu organizacji ani znanego imienia kontaktu', async () => {
    baza.set('skrzynkaOrganizacje/firma.pl', { domena: 'firma.pl', nazwa: 'Firma S.A.', typ: 'sponsor' })
    baza.set('skrzynkaKontakty/anna@firma.pl', { email: 'anna@firma.pl', imie: 'Anna Kowalska', organizacja: 'firma.pl', typ: null })
    await zapiszWynik({
      sprawy: [],
      kontakty: [{ email: 'anna@firma.pl', imie: '', organizacja: 'firma.pl', typ: null }, { email: 'jan@nowa.pl', imie: 'Jan', organizacja: 'nowa.pl', typ: null }],
      organizacje: [{ domena: 'firma.pl', nazwa: 'firma.pl', typ: 'inne' }, { domena: 'nowa.pl', nazwa: 'nowa.pl', typ: 'inne' }, { domena: 'nowa.pl', nazwa: 'nowa.pl', typ: 'inne' }],
    })
    expect(baza.get('skrzynkaOrganizacje/firma.pl')).toEqual({ domena: 'firma.pl', nazwa: 'Firma S.A.', typ: 'sponsor' })
    expect(baza.get('skrzynkaOrganizacje/nowa.pl')).toEqual({ domena: 'nowa.pl', nazwa: 'nowa.pl', typ: 'inne' })
    expect(baza.get('skrzynkaKontakty/anna@firma.pl')).toMatchObject({ imie: 'Anna Kowalska' })
    expect(baza.get('skrzynkaKontakty/jan@nowa.pl')).toMatchObject({ imie: 'Jan' })
  })

  it('pomijane adresy i domeny małymi literami; bez dokumentu puste', async () => {
    expect(await pomijane()).toEqual({ adresy: [], domeny: [] })
    baza.set('skrzynka/ustawienia', { pomijaneAdresy: ['News@Sklep.pl', 5], pomijaneDomeny: ['Reklama.pl'] })
    expect(await pomijane()).toEqual({ adresy: ['news@sklep.pl'], domeny: ['reklama.pl'] })
  })
})

describe('liczniki', () => {
  it('bez połączenia - stan brak', async () => {
    expect((await liczniki(0)).stan).toBe('brak')
  })

  it('liczy statusy i sprawy po terminie; rozłączona zachowuje liczby', async () => {
    const wtorek = Date.UTC(2026, 9, 20, 8)
    await zapiszStan({ token: 'enc', polaczona: false, ostatniaSynchronizacja: 9 })
    await zapiszWynik({
      sprawy: [
        sprawa('a', { oczekujeOd: Date.UTC(2026, 9, 14, 13) }),
        sprawa('b', { oczekujeOd: Date.UTC(2026, 9, 16, 7) }),
        sprawa('c', { status: 'do-przejrzenia', oczekujeOd: null }),
        sprawa('d', { status: 'czeka-na-nich', oczekujeOd: null }),
        sprawa('e', { status: 'w-toku', oczekujeOd: null }),
      ],
      kontakty: [],
      organizacje: [],
    })
    expect(await liczniki(wtorek)).toEqual({
      stan: 'rozlaczona', doOdpowiedzi: 2, poTerminie: 1, doPrzejrzenia: 1, czekaNaNich: 1, wToku: 1, zalatwione: 0, pominiete: 0, ostatniaSynchronizacja: 9,
    })
  })
})

describe('lista spraw', () => {
  const kiedy = (k: number) => ({ ostatnia: { kiedy: k, kierunek: 'oni' as const, fragment: '' } })

  it('klucz: status, czas z zerami do 15 cyfr, id', () => {
    expect(kluczListy({ id: 't1', status: 'zalatwiona', ...kiedy(1792000000000) })).toBe('zalatwiona|001792000000000|t1')
  })

  it('jeden status od najnowszej; strony; inne statusy poza listą', async () => {
    await zapiszWynik({
      sprawy: [
        sprawa('a', { status: 'zalatwiona', oczekujeOd: null, ...kiedy(100) }),
        sprawa('b', { status: 'zalatwiona', oczekujeOd: null, ...kiedy(300) }),
        sprawa('c', { status: 'zalatwiona', oczekujeOd: null, ...kiedy(200) }),
        sprawa('d', { status: 'pominieta', oczekujeOd: null, ...kiedy(400) }),
      ],
      kontakty: [],
      organizacje: [],
    })
    const s1 = await listaSpraw('zalatwiona', null, 2)
    expect(s1.sprawy.map((s) => s.id)).toEqual(['b', 'c'])
    expect(s1.nastepna).toBe('zalatwiona|000000000000200|c')
    const s2 = await listaSpraw('zalatwiona', s1.nastepna, 2)
    expect(s2.sprawy.map((s) => s.id)).toEqual(['a'])
    expect(s2.nastepna).toBeNull()
  })

  it('Do odpowiedzi: najdłużej czekające na górze', async () => {
    await zapiszWynik({
      sprawy: [sprawa('x', { oczekujeOd: 500 }), sprawa('y', { oczekujeOd: 100 }), sprawa('z', { status: 'w-toku', oczekujeOd: null })],
      kontakty: [],
      organizacje: [],
    })
    expect((await listaSpraw('do-odpowiedzi', null)).sprawy.map((s) => s.id)).toEqual(['y', 'x'])
  })

  it('sprawy sprzed wersji 2 dostają klucz raz', async () => {
    await zapiszStan({ token: 'enc', polaczona: true })
    baza.set('skrzynkaSprawy/stara', { temat: 'T', status: 'zalatwiona', oczekujeOd: null, ostatnia: { kiedy: 100, kierunek: 'oni', fragment: '' } })
    expect((await listaSpraw('zalatwiona', null)).sprawy).toEqual([])
    expect(await uzupelnijKlucze()).toBe(1)
    expect((await listaSpraw('zalatwiona', null)).sprawy.map((s) => s.id)).toEqual(['stara'])
    expect((await czytajStan())?.wersjaDanych).toBe(2)
    expect(await uzupelnijKlucze()).toBe(0)
  })
})
