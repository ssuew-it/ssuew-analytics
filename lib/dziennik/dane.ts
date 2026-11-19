import { randomUUID } from 'node:crypto'
import type { DocumentData, Transaction } from 'firebase-admin/firestore'
import { dziennikKadencjeRef, dziennikStanRef, dziennikWpisyRef } from '@/lib/firebase/admin'
import {
  DZIALY, STANY_CELU, STANY_WPISU, STATUSY_STRATEGII,
  type Adnotacja, type Cel, type Kadencja, type Ksiega, type Wpis,
} from './typy'
import { sprawdzAdnotacje, type PolaKadencji, type PolaWpisu } from './walidacja'

export type RodzajBleduDziennika = 'brak-kadencji' | 'kadencja-zmieniona' | 'zamkniety' | 'nie-ma' | 'walidacja'

export class BladDziennika extends Error {
  readonly rodzaj: RodzajBleduDziennika
  constructor(rodzaj: RodzajBleduDziennika, wiadomosc: string) {
    super(wiadomosc)
    this.name = 'BladDziennika'
    this.rodzaj = rodzaj
  }
}

const BRAK_KADENCJI = 'Najpierw rozpocznij kadencję'
const ZMIENIONA = 'Kadencja już się zmieniła - odśwież'
const CUDZY_WPIS = 'Wpis poprzedniej kadencji można tylko skomentować'
const CUDZA_ADNOTACJA = 'Komentarz poprzedniej kadencji zostaje bez zmian'

// --- odczyt: tolerancyjny, uszkodzone pole dostaje wartość domyślną ---

const t = (x: unknown) => (typeof x === 'string' ? x : '')
const n = (x: unknown, dom = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : dom)
const zListy = <T extends string>(x: unknown, lista: readonly T[], dom: T) => ((lista as readonly unknown[]).includes(x) ? (x as T) : dom)
const zListyLubNull = <T extends string>(x: unknown, lista: readonly T[]) => ((lista as readonly unknown[]).includes(x) ? (x as T) : null)

function naAdnotacje(x: unknown): Adnotacja[] {
  return (Array.isArray(x) ? x : []).map((a) => ({
    id: t(a?.id), kadencjaId: t(a?.kadencjaId),
    stan: zListyLubNull(a?.stan, STANY_WPISU),
    celId: t(a?.celId) || null,
    stanCelu: zListyLubNull(a?.stanCelu, STANY_CELU),
    komentarz: t(a?.komentarz), kiedy: n(a?.kiedy),
  }))
}

const naCele = (x: unknown): Cel[] => (Array.isArray(x) ? x : []).map((c) => ({ id: t(c?.id), tresc: t(c?.tresc) }))

export function naWpis(id: string, d: DocumentData): Wpis | null {
  if (!(DZIALY as readonly unknown[]).includes(d.dzial)) return null
  const baza = {
    id, kadencjaId: t(d.kadencjaId), tytul: t(d.tytul), tresc: t(d.tresc),
    utworzono: n(d.utworzono), zmieniono: n(d.zmieniono), adnotacje: naAdnotacje(d.adnotacje),
  }
  switch (d.dzial as Wpis['dzial']) {
    case 'cykl':
      return {
        ...baza, dzial: 'cykl', miesiac: n(d.miesiac, 1), dzien: typeof d.dzien === 'number' ? d.dzien : null,
        wyprzedzenieTygodni: n(d.wyprzedzenieTygodni, 2), obowiazkowe: d.obowiazkowe === true,
        rozlicza: (Array.isArray(d.rozlicza) ? d.rozlicza : []).filter((x: unknown) => typeof x === 'string'),
      }
    case 'luka':
      return { ...baza, dzial: 'luka', ileCzasu: t(d.ileCzasu) }
    case 'watek':
      return { ...baza, dzial: 'watek', zostalo: t(d.zostalo) }
    case 'innowacja':
    case 'przemyslenie':
      return { ...baza, dzial: d.dzial }
    case 'strategia':
      return {
        ...baza, dzial: 'strategia', link: t(d.link), okresOd: n(d.okresOd), okresDo: n(d.okresDo),
        status: zListy(d.status, STATUSY_STRATEGII, 'projekt'), uchwala: t(d.uchwala) || null, cele: naCele(d.cele),
      }
  }
}

function naKadencje(id: string, d: DocumentData): Kadencja {
  const kopia = d.kopia && typeof d.kopia.link === 'string' ? { link: d.kopia.link, kiedy: n(d.kopia.kiedy) } : null
  return {
    id, nazwa: t(d.nazwa), autor: t(d.autor), funkcja: t(d.funkcja) || null,
    otwarta: n(d.otwarta), zamknieta: typeof d.zamknieta === 'number' ? d.zamknieta : null, kopia,
  }
}

export async function czytajKsiege(): Promise<Ksiega> {
  const [stan, kadencje, wpisy] = await Promise.all([dziennikStanRef().get(), dziennikKadencjeRef().get(), dziennikWpisyRef().get()])
  const otwarta = stan.data()?.otwartaKadencjaId
  return {
    otwartaKadencjaId: typeof otwarta === 'string' && otwarta ? otwarta : null,
    kadencje: kadencje.docs.map((d) => naKadencje(d.id, d.data() ?? {})).sort((a, b) => a.otwarta - b.otwarta),
    wpisy: wpisy.docs.flatMap((d) => {
      const w = naWpis(d.id, d.data() ?? {})
      return w ? [w] : []
    }),
  }
}

// --- zapis: zawsze w transakcji z wskaźnikiem otwartej kadencji ---

const transakcja = <T>(f: (tr: Transaction) => Promise<T>) => dziennikStanRef().firestore.runTransaction(f)

async function otwartaId(tr: Transaction): Promise<string | null> {
  const x = (await tr.get(dziennikStanRef())).data()?.otwartaKadencjaId
  return typeof x === 'string' && x ? x : null
}

async function wymagajOtwartej(tr: Transaction): Promise<string> {
  const id = await otwartaId(tr)
  if (!id) throw new BladDziennika('brak-kadencji', BRAK_KADENCJI)
  return id
}

/** Wpis z bazy i otwarta kadencja. Własność rozstrzyga `kadencjaId` zapisany w bazie, nigdy ciało żądania. */
async function wpisWTransakcji(tr: Transaction, id: string): Promise<{ wpis: Wpis; otwarta: string }> {
  const otwarta = await wymagajOtwartej(tr)
  const snap = await tr.get(dziennikWpisyRef().doc(id))
  const wpis = snap.exists ? naWpis(id, snap.data() ?? {}) : null
  if (!wpis) throw new BladDziennika('nie-ma', 'Nie ma takiego wpisu')
  return { wpis, otwarta }
}

const bezId = ({ id: _id, ...reszta }: Wpis) => reszta

function zCelami(pola: PolaWpisu): PolaWpisu {
  return pola.dzial === 'strategia' ? { ...pola, cele: pola.cele.map((c) => ({ ...c, id: c.id || randomUUID() })) } : pola
}

export function otworzKadencje(pola: PolaKadencji, teraz: number): Promise<Kadencja> {
  return transakcja(async (tr) => {
    if (await otwartaId(tr)) throw new BladDziennika('kadencja-zmieniona', ZMIENIONA)
    const ref = dziennikKadencjeRef().doc()
    const kadencja: Omit<Kadencja, 'id'> = { ...pola, otwarta: teraz, zamknieta: null, kopia: null }
    tr.set(ref, kadencja)
    tr.set(dziennikStanRef(), { otwartaKadencjaId: ref.id })
    return { id: ref.id, ...kadencja }
  })
}

export function zamknijKadencje(kadencjaId: string, teraz: number): Promise<void> {
  return transakcja(async (tr) => {
    if ((await otwartaId(tr)) !== kadencjaId) throw new BladDziennika('kadencja-zmieniona', ZMIENIONA)
    tr.update(dziennikKadencjeRef().doc(kadencjaId), { zamknieta: teraz })
    tr.set(dziennikStanRef(), { otwartaKadencjaId: null })
  })
}

export async function zapiszKopie(kadencjaId: string, kopia: { link: string; kiedy: number }): Promise<void> {
  await dziennikKadencjeRef().doc(kadencjaId).set({ kopia }, { merge: true })
}

export function dodajWpis(pola: PolaWpisu, teraz: number): Promise<Wpis> {
  return transakcja(async (tr) => {
    const kadencjaId = await wymagajOtwartej(tr)
    const ref = dziennikWpisyRef().doc()
    const wpis = { ...zCelami(pola), kadencjaId, utworzono: teraz, zmieniono: teraz, adnotacje: [] } as Omit<Wpis, 'id'>
    tr.set(ref, wpis)
    return { id: ref.id, ...wpis } as Wpis
  })
}

export function zmienWpis(id: string, pola: PolaWpisu, teraz: number): Promise<Wpis> {
  return transakcja(async (tr) => {
    const { wpis, otwarta } = await wpisWTransakcji(tr, id)
    if (wpis.kadencjaId !== otwarta) throw new BladDziennika('zamkniety', CUDZY_WPIS)
    if (wpis.dzial !== pola.dzial) throw new BladDziennika('zamkniety', 'Nie można zmienić działu wpisu')
    const nowy = {
      ...zCelami(pola), kadencjaId: wpis.kadencjaId, utworzono: wpis.utworzono, zmieniono: teraz, adnotacje: wpis.adnotacje,
    } as Omit<Wpis, 'id'>
    tr.set(dziennikWpisyRef().doc(id), nowy)
    return { id, ...nowy } as Wpis
  })
}

export function usunWpis(id: string): Promise<void> {
  return transakcja(async (tr) => {
    const { wpis, otwarta } = await wpisWTransakcji(tr, id)
    if (wpis.kadencjaId !== otwarta) throw new BladDziennika('zamkniety', CUDZY_WPIS)
    tr.delete(dziennikWpisyRef().doc(id))
  })
}

function celeWpisu(w: Wpis): Cel[] {
  return w.dzial === 'strategia' ? w.cele : []
}

function sprawdzone(x: unknown, w: Wpis) {
  const s = sprawdzAdnotacje(x, celeWpisu(w))
  if (!s.ok) throw new BladDziennika('walidacja', s.blad)
  return s.pola
}

/** Adnotację może dodać każda kadencja, do każdego wpisu - także zamkniętej kadencji. */
export function dodajAdnotacje(wpisId: string, x: unknown, teraz: number): Promise<Adnotacja> {
  return transakcja(async (tr) => {
    const { wpis, otwarta } = await wpisWTransakcji(tr, wpisId)
    const a: Adnotacja = { id: randomUUID(), kadencjaId: otwarta, ...sprawdzone(x, wpis), kiedy: teraz }
    tr.set(dziennikWpisyRef().doc(wpisId), { ...bezId(wpis), adnotacje: [...wpis.adnotacje, a] })
    return a
  })
}

async function wlasnaAdnotacja(tr: Transaction, wpisId: string, aid: string) {
  const { wpis, otwarta } = await wpisWTransakcji(tr, wpisId)
  const a = wpis.adnotacje.find((x) => x.id === aid)
  if (!a) throw new BladDziennika('nie-ma', 'Nie ma takiego komentarza')
  if (a.kadencjaId !== otwarta) throw new BladDziennika('zamkniety', CUDZA_ADNOTACJA)
  return { wpis, a }
}

/** Poprawka zachowuje czas dodania - kolejność stanów się nie przestawia. */
export function zmienAdnotacje(wpisId: string, aid: string, x: unknown, _teraz: number): Promise<Adnotacja> {
  return transakcja(async (tr) => {
    const { wpis, a } = await wlasnaAdnotacja(tr, wpisId, aid)
    const nowa: Adnotacja = { ...a, ...sprawdzone(x, wpis) }
    tr.set(dziennikWpisyRef().doc(wpisId), { ...bezId(wpis), adnotacje: wpis.adnotacje.map((y) => (y.id === aid ? nowa : y)) })
    return nowa
  })
}

export function usunAdnotacje(wpisId: string, aid: string): Promise<void> {
  return transakcja(async (tr) => {
    const { wpis } = await wlasnaAdnotacja(tr, wpisId, aid)
    tr.set(dziennikWpisyRef().doc(wpisId), { ...bezId(wpis), adnotacje: wpis.adnotacje.filter((y) => y.id !== aid) })
  })
}
