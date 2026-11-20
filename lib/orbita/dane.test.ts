import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Firestore w pamięci: dokumenty, kolekcja i transakcje (wzór lib/dziennik/dane.test.ts). */
const { baza, admin } = vi.hoisted(() => {
  type Dane = Record<string, unknown>
  const baza = new Map<string, Dane>()
  let licznik = 0
  const snap = (s: string) => ({ id: s.split('/').pop()!, exists: baza.has(s), data: () => baza.get(s) })
  const dok = (sciezka: string) => ({
    sciezka,
    id: sciezka.split('/').pop()!,
    get firestore() {
      return firestore
    },
    get: async () => snap(sciezka),
    set: async (d: Dane) => baza.set(sciezka, { ...d }),
  })
  const kolekcja = (nazwa: string) => ({
    doc: (id?: string) => dok(`${nazwa}/${id ?? `auto${++licznik}`}`),
    get firestore() {
      return firestore
    },
    get: async () => {
      const docs = [...baza.keys()].filter((k) => k.startsWith(`${nazwa}/`)).map(snap)
      return { docs, empty: docs.length === 0 }
    },
  })
  type Ref = { sciezka: string }
  const firestore = {
    runTransaction: async <T,>(f: (t: unknown) => Promise<T>) =>
      f({
        get: async (r: Ref) => snap(r.sciezka),
        set: (r: Ref, d: Dane) => baza.set(r.sciezka, { ...d }),
        delete: (r: Ref) => baza.delete(r.sciezka),
      }),
  }
  return { baza, admin: { orbitaZadaniaRef: () => kolekcja('orbitaZadania') } }
})
vi.mock('@/lib/firebase/admin', () => admin)

import { akcjaEtapu, czytajZadania, dodajZadanie, naZadanie, usunZadanie, zmienZadanie, zrodlaOtwartych } from '@/lib/orbita/dane'
import { BladOrbity } from '@/lib/orbita/etapy'
import type { Etap, PolaZadania } from '@/lib/orbita/typy'

const DZIS = { rok: 2026, miesiac: 11, dzien: 20 }
const etap = (id: string, zmiany: Partial<Etap> = {}): Etap => ({
  id, nazwa: id, rodzaj: 'praca', cel: '', zacznijOd: '', materialy: '', gotoweGdy: '', dni: 3,
  czekaNa: [], czekamDo: null, zamkniety: null, wynik: '', ...zmiany,
})
const POLA: PolaZadania = { tytul: 'Zarządzenie', kontekst: '', termin: '2026-12-20', zrodlo: null, etapy: [etap('a'), etap('b')] }

async function rzuca(p: Promise<unknown>, rodzaj: BladOrbity['rodzaj']) {
  const e = await p.then(() => null, (x) => x)
  expect(e).toBeInstanceOf(BladOrbity)
  expect((e as BladOrbity).rodzaj).toBe(rodzaj)
}

describe('dane Orbity', () => {
  beforeEach(() => baza.clear())

  it('dodaje i czyta zadanie', async () => {
    const z = await dodajZadanie(POLA, 10, DZIS)
    expect(z).toMatchObject({ ...POLA, utworzono: 10, zmieniono: 10, zamkniete: null })
    expect(await czytajZadania()).toEqual([z])
  })

  it('edycja ze starym zmieniono → zmienione, dokument bez zmian', async () => {
    const z = await dodajZadanie(POLA, 10, DZIS)
    await zmienZadanie(z.id, { ...POLA, tytul: 'Nowy' }, 10, 20, DZIS)
    await rzuca(zmienZadanie(z.id, { ...POLA, tytul: 'Inny' }, 10, 30, DZIS), 'zmienione')
    expect(baza.get(`orbitaZadania/${z.id}`)).toMatchObject({ tytul: 'Nowy', zmieniono: 20 })
  })

  it('edycja przestawiająca zamknięty etap → walidacja', async () => {
    const z = await dodajZadanie(POLA, 10, DZIS)
    const po = await akcjaEtapu(z.id, 'a', 'zamknij', '', 11, DZIS)
    await rzuca(zmienZadanie(z.id, { ...POLA, etapy: [etap('b'), etap('a')] }, po.zmieniono, 12, DZIS), 'walidacja')
  })

  it('zamknięcie tego samego etapu dwa razy → nie-biezacy, jedno zamknięcie', async () => {
    const z = await dodajZadanie(POLA, 10, DZIS)
    await akcjaEtapu(z.id, 'a', 'zamknij', 'wynik', 11, DZIS)
    await rzuca(akcjaEtapu(z.id, 'a', 'zamknij', 'drugi', 12, DZIS), 'nie-biezacy')
    const [zapisane] = await czytajZadania()
    expect(zapisane.etapy[0]).toMatchObject({ zamkniety: 11, wynik: 'wynik' })
  })

  it('brak zadania → nie-ma', async () => {
    await rzuca(usunZadanie('x'), 'nie-ma')
    await rzuca(zmienZadanie('x', POLA, 1, 2, DZIS), 'nie-ma')
    await rzuca(akcjaEtapu('x', 'a', 'otworz', '', 1, DZIS), 'nie-ma')
  })

  it('nowe zadanie zaczynające się od konsultacji dostaje czekamDo', async () => {
    const z = await dodajZadanie({ ...POLA, etapy: [etap('k', { rodzaj: 'czekanie', dni: 14 })] }, 1, DZIS)
    expect(z.etapy[0].czekamDo).toBe('2026-12-04')
  })

  it('naZadanie: bez etapów null, etap bez rodzaju to praca', () => {
    expect(naZadanie('z', { tytul: 'x', etapy: 'x' })).toBeNull()
    expect(naZadanie('z', { tytul: 'x', etapy: [] })).toBeNull()
    expect(naZadanie('z', { tytul: 'x', etapy: [{ id: 'a', nazwa: 'A' }] })!.etapy[0]).toMatchObject({ rodzaj: 'praca', dni: 0, czekaNa: [] })
  })

  it('zrodlaOtwartych pomija zamknięte i bez źródła', async () => {
    const zrodlo = { typ: 'dziennik' as const, wpisId: 'w1', termin: '2027-03-15' }
    const otwarte = await dodajZadanie({ ...POLA, zrodlo }, 1, DZIS)
    const zamkniete = await dodajZadanie({ ...POLA, zrodlo: { ...zrodlo, wpisId: 'w2' }, etapy: [etap('a')] }, 1, DZIS)
    await akcjaEtapu(zamkniete.id, 'a', 'zamknij', '', 2, DZIS)
    await dodajZadanie(POLA, 1, DZIS)
    expect(await zrodlaOtwartych()).toEqual([{ wpisId: 'w1', termin: '2027-03-15', zadanieId: otwarte.id }])
  })
})
