import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Sprawa } from '@/lib/skrzynka/typy'

/** Firestore w pamięci - tylko to, czego używa `dane.ts`. */
const { baza, admin } = vi.hoisted(() => {
  const baza = new Map<string, Record<string, unknown>>()
  const snap = (s: string) => ({ id: s.split('/').pop()!, exists: baza.has(s), data: () => baza.get(s) })
  const zapisz = (s: string, d: Record<string, unknown>, scal?: boolean) => baza.set(s, scal ? { ...baza.get(s), ...d } : { ...d })
  type Ref = { sciezka: string }
  const firestore = {
    getAll: async (...refs: Ref[]) => refs.map((r) => snap(r.sciezka)),
    batch: () => {
      const ops: (() => void)[] = []
      return {
        set: (r: Ref, d: Record<string, unknown>, o?: { merge?: boolean }) => ops.push(() => zapisz(r.sciezka, d, o?.merge)),
        commit: async () => ops.forEach((f) => f()),
      }
    },
    runTransaction: async <T,>(f: (t: unknown) => Promise<T>) =>
      f({
        get: async (r: Ref) => snap(r.sciezka),
        set: (r: Ref, d: Record<string, unknown>, o?: { merge?: boolean }) => zapisz(r.sciezka, d, o?.merge),
        update: (r: Ref, d: Record<string, unknown>) => zapisz(r.sciezka, d, true),
      }),
  }
  const dok = (sciezka: string) => ({
    sciezka,
    firestore,
    get: async () => snap(sciezka),
    set: async (d: Record<string, unknown>, o?: { merge?: boolean }) => zapisz(sciezka, d, o?.merge),
  })
  const porownaj = (a: unknown, op: string, b: unknown) =>
    op === '==' ? a === b : op === '<' ? typeof a === 'number' && a < (b as number) : false
  const kolekcja = (nazwa: string) => ({
    firestore,
    doc: (id: string) => dok(`${nazwa}/${id}`),
    where: (pole: string, op: string, wartosc: unknown) => ({
      count: () => ({
        get: async () => ({
          data: () => ({
            count: [...baza].filter(([k, v]) => k.startsWith(`${nazwa}/`) && porownaj(v[pole], op, wartosc)).length,
          }),
        }),
      }),
    }),
  })
  return {
    baza,
    admin: {
      skrzynkaStanRef: () => dok('skrzynka/stan'),
      skrzynkaUstawieniaRef: () => dok('skrzynka/ustawienia'),
      sprawyRef: () => kolekcja('skrzynkaSprawy'),
      kontaktyRef: () => kolekcja('skrzynkaKontakty'),
      organizacjeRef: () => kolekcja('skrzynkaOrganizacje'),
    },
  }
})
vi.mock('@/lib/firebase/admin', () => admin)

import { czytajSprawy, czytajStan, liczniki, pomijane, wezDzierzawe, zapiszStan, zapiszWynik, zwolnijDzierzawe } from '@/lib/skrzynka/dane'

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
      dzierzawaDo: 0, doPowtorki: false, polaczona: true, import: { trwa: false, zrobione: 0, razem: 0, strona: null },
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
      stan: 'rozlaczona', doOdpowiedzi: 2, poTerminie: 1, doPrzejrzenia: 1, czekaNaNich: 1, wToku: 1, ostatniaSynchronizacja: 9,
    })
  })
})
