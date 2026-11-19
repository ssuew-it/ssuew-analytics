import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Firestore w pamięci: dokumenty, kolekcje i transakcje (bez izolacji - wystarczy do logiki). */
const { baza, admin } = vi.hoisted(() => {
  type Dane = Record<string, unknown>
  const baza = new Map<string, Dane>()
  let licznik = 0
  const snap = (s: string) => ({ id: s.split('/').pop()!, exists: baza.has(s), data: () => baza.get(s) })
  const zapisz = (s: string, d: Dane, scal?: boolean) => baza.set(s, scal ? { ...baza.get(s), ...d } : { ...d })
  const dok = (sciezka: string) => ({
    sciezka,
    id: sciezka.split('/').pop()!,
    get firestore() {
      return firestore
    },
    get: async () => snap(sciezka),
    set: async (d: Dane, o?: { merge?: boolean }) => zapisz(sciezka, d, o?.merge),
  })
  const kolekcja = (nazwa: string) => ({
    doc: (id?: string) => dok(`${nazwa}/${id ?? `auto${++licznik}`}`),
    get: async () => {
      const docs = [...baza.keys()].filter((k) => k.startsWith(`${nazwa}/`) && k.split('/').length === 2).map(snap)
      return { docs, empty: docs.length === 0 }
    },
  })
  type Ref = { sciezka: string }
  const firestore = {
    runTransaction: async <T,>(f: (t: unknown) => Promise<T>) =>
      f({
        get: async (r: Ref) => snap(r.sciezka),
        set: (r: Ref, d: Dane, o?: { merge?: boolean }) => zapisz(r.sciezka, d, o?.merge),
        update: (r: Ref, d: Dane) => {
          if (!baza.has(r.sciezka)) throw new Error('brak dokumentu')
          zapisz(r.sciezka, d, true)
        },
        delete: (r: Ref) => baza.delete(r.sciezka),
      }),
  }
  const admin = {
    dziennikKadencjeRef: () => kolekcja('dziennikKadencje'),
    dziennikWpisyRef: () => kolekcja('dziennikWpisy'),
    dziennikStanRef: () => dok('dziennik/stan'),
  }
  return { baza, admin }
})
vi.mock('@/lib/firebase/admin', () => admin)

import {
  BladDziennika, czytajKsiege, dodajAdnotacje, dodajWpis, otworzKadencje, usunAdnotacje, usunWpis,
  zamknijKadencje, zapiszKopie, zmienAdnotacje, zmienWpis,
} from '@/lib/dziennik/dane'

const KAD = { nazwa: '2025/26', autor: 'Jan K.', funkcja: null }
const LUKA = { dzial: 'luka' as const, tytul: 'Archiwum', tresc: 'Brak', ileCzasu: 'semestr' }

async function rzuca(p: Promise<unknown>, rodzaj: BladDziennika['rodzaj']) {
  const e = await p.then(() => null, (x) => x)
  expect(e).toBeInstanceOf(BladDziennika)
  expect((e as BladDziennika).rodzaj).toBe(rodzaj)
}

/** Wpis zapisany przez poprzednią, zamkniętą kadencję. */
function wpisStarej(id = 'w1', x: Record<string, unknown> = {}) {
  baza.set('dziennikKadencje/stara', { ...KAD, nazwa: '2024/25', otwarta: 1, zamknieta: 2, kopia: null })
  baza.set(`dziennikWpisy/${id}`, { ...LUKA, kadencjaId: 'stara', utworzono: 1, zmieniono: 1, adnotacje: [], ...x })
}

describe('dane Dziennika', () => {
  beforeEach(() => baza.clear())

  it('otwiera jedną kadencję; druga próba przy otwartej to kadencja-zmieniona', async () => {
    const k = await otworzKadencje(KAD, 10)
    expect(k).toMatchObject({ ...KAD, otwarta: 10, zamknieta: null, kopia: null })
    await rzuca(otworzKadencje({ ...KAD, nazwa: 'druga' }, 11), 'kadencja-zmieniona')
    const ksiega = await czytajKsiege()
    expect(ksiega.otwartaKadencjaId).toBe(k.id)
    expect(ksiega.kadencje.filter((x) => x.zamknieta === null)).toHaveLength(1)
  })

  it('zamyka tylko tę kadencję, którą wskazuje wskaźnik', async () => {
    const k = await otworzKadencje(KAD, 10)
    await rzuca(zamknijKadencje('inna', 20), 'kadencja-zmieniona')
    await zamknijKadencje(k.id, 20)
    const ksiega = await czytajKsiege()
    expect(ksiega.otwartaKadencjaId).toBeNull()
    expect(ksiega.kadencje[0].zamknieta).toBe(20)
    await rzuca(zamknijKadencje(k.id, 21), 'kadencja-zmieniona')
  })

  it('zapisuje kopię przy kadencji', async () => {
    const k = await otworzKadencje(KAD, 10)
    await zapiszKopie(k.id, { link: 'https://docs.google.com/d/1', kiedy: 15 })
    expect((await czytajKsiege()).kadencje[0].kopia).toEqual({ link: 'https://docs.google.com/d/1', kiedy: 15 })
  })

  it('bez otwartej kadencji nie da się dopisać wpisu', async () => {
    await rzuca(dodajWpis(LUKA, 1), 'brak-kadencji')
  })

  it('dopisuje wpis do otwartej kadencji', async () => {
    const k = await otworzKadencje(KAD, 10)
    const w = await dodajWpis(LUKA, 12)
    expect(w).toMatchObject({ ...LUKA, kadencjaId: k.id, utworzono: 12, zmieniono: 12, adnotacje: [] })
    expect((await czytajKsiege()).wpisy).toEqual([w])
  })

  it('cele strategii bez id dostają identyfikator; istniejące zostają', async () => {
    await otworzKadencje(KAD, 10)
    const w = await dodajWpis({
      dzial: 'strategia', tytul: 'S', tresc: '', link: '', okresOd: 2026, okresDo: 2027, status: 'projekt', uchwala: null,
      cele: [{ id: 'c1', tresc: 'A' }, { id: '', tresc: 'B' }],
    }, 12)
    if (w.dzial !== 'strategia') throw new Error('zły dział')
    expect(w.cele[0].id).toBe('c1')
    expect(w.cele[1].id).toMatch(/\S/)
    expect(w.cele[1].id).not.toBe('c1')
  })

  it('wpisu poprzedniej kadencji nie da się zmienić ani usunąć', async () => {
    wpisStarej()
    await otworzKadencje(KAD, 10)
    await rzuca(zmienWpis('w1', { ...LUKA, tytul: 'Nowy' }, 11), 'zamkniety')
    await rzuca(usunWpis('w1'), 'zamkniety')
    expect(baza.get('dziennikWpisy/w1')?.tytul).toBe('Archiwum')
  })

  it('własny wpis: zmiana zachowuje autora, adnotacje i datę utworzenia; zmiana działu odrzucona', async () => {
    const k = await otworzKadencje(KAD, 10)
    const w = await dodajWpis(LUKA, 12)
    const z = await zmienWpis(w.id, { ...LUKA, tytul: 'Nowy' }, 13)
    expect(z).toMatchObject({ tytul: 'Nowy', kadencjaId: k.id, utworzono: 12, zmieniono: 13, adnotacje: [] })
    await rzuca(zmienWpis(w.id, { dzial: 'innowacja', tytul: 'X', tresc: '' }, 14), 'zamkniety')
    await usunWpis(w.id)
    expect((await czytajKsiege()).wpisy).toEqual([])
  })

  it('brakujący wpis to nie-ma', async () => {
    await otworzKadencje(KAD, 10)
    await rzuca(zmienWpis('brak', LUKA, 11), 'nie-ma')
    await rzuca(dodajAdnotacje('brak', { komentarz: 'x' }, 11), 'nie-ma')
  })

  it('adnotacja na wpisie starej kadencji zapisuje się z kadencją bieżącą', async () => {
    wpisStarej()
    const k = await otworzKadencje(KAD, 10)
    const a = await dodajAdnotacje('w1', { stan: 'przejmuje', komentarz: 'od marca', kadencjaId: 'podrobiona' }, 11)
    expect(a).toMatchObject({ kadencjaId: k.id, stan: 'przejmuje', komentarz: 'od marca', kiedy: 11 })
    expect((await czytajKsiege()).wpisy[0].adnotacje).toEqual([a])
  })

  it('zła adnotacja to błąd walidacji', async () => {
    wpisStarej()
    await otworzKadencje(KAD, 10)
    await rzuca(dodajAdnotacje('w1', { celId: 'nie-ma-takiego', stanCelu: 'porzucony' }, 11), 'walidacja')
  })

  it('cudzej adnotacji nie da się zmienić ani usunąć; własną tak', async () => {
    wpisStarej('w1', { adnotacje: [{ id: 'a0', kadencjaId: 'stara', stan: 'aktualne', celId: null, stanCelu: null, komentarz: 'stara', kiedy: 2 }] })
    await otworzKadencje(KAD, 10)
    await rzuca(zmienAdnotacje('w1', 'a0', { komentarz: 'x' }, 11), 'zamkniety')
    await rzuca(usunAdnotacje('w1', 'a0'), 'zamkniety')
    const a = await dodajAdnotacje('w1', { komentarz: 'moja' }, 11)
    const z = await zmienAdnotacje('w1', a.id, { stan: 'zamkniete', komentarz: 'poprawiona' }, 12)
    expect(z).toMatchObject({ id: a.id, stan: 'zamkniete', komentarz: 'poprawiona', kiedy: 11 })
    await usunAdnotacje('w1', a.id)
    expect((await czytajKsiege()).wpisy[0].adnotacje.map((x) => x.id)).toEqual(['a0'])
  })

  it('bez otwartej kadencji nie da się dodać adnotacji', async () => {
    wpisStarej()
    await rzuca(dodajAdnotacje('w1', { komentarz: 'x' }, 11), 'brak-kadencji')
  })

  it('odczyt toleruje uszkodzone dokumenty i pomija nieznany dział', async () => {
    baza.set('dziennikWpisy/x', { dzial: 'kronika', tytul: 'X' })
    baza.set('dziennikWpisy/y', { dzial: 'cykl', tytul: 'Y', kadencjaId: 'k', miesiac: 3 })
    const { wpisy } = await czytajKsiege()
    expect(wpisy).toHaveLength(1)
    expect(wpisy[0]).toMatchObject({ id: 'y', dzial: 'cykl', miesiac: 3, dzien: null, wyprzedzenieTygodni: 2, obowiazkowe: false, rozlicza: [], adnotacje: [] })
  })
})
