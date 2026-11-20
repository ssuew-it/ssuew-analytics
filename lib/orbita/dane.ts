import type { DocumentData, Transaction } from 'firebase-admin/firestore'
import type { Data } from '@/lib/planer/trwanie'
import { orbitaZadaniaRef } from '@/lib/firebase/admin'
import { BladOrbity, KOMUNIKAT_KOLIZJI, otworzEtap, zamknijEtap } from './etapy'
import type { Etap, PolaZadania, Zadanie, ZrodloDziennika } from './typy'
import { scalEdycje, ustalCzekamDo } from './walidacja'

const NIE_MA = 'Nie ma takiego zadania - odśwież'

// --- odczyt: tolerancyjny, uszkodzone pole dostaje wartość domyślną ---

const t = (x: unknown) => (typeof x === 'string' ? x : '')
const n = (x: unknown, dom = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : dom)
const nLubNull = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const tLubNull = (x: unknown) => (typeof x === 'string' && x ? x : null)

function naEtap(e: Record<string, unknown>): Etap {
  const czekanie = e.rodzaj === 'czekanie'
  return {
    id: t(e.id), nazwa: t(e.nazwa), rodzaj: czekanie ? 'czekanie' : 'praca',
    cel: t(e.cel), zacznijOd: t(e.zacznijOd), materialy: t(e.materialy), gotoweGdy: t(e.gotoweGdy),
    dni: n(e.dni),
    czekaNa: (Array.isArray(e.czekaNa) ? e.czekaNa : []).filter((x: unknown): x is string => typeof x === 'string'),
    czekamDo: tLubNull(e.czekamDo), zamkniety: nLubNull(e.zamkniety), wynik: t(e.wynik),
  }
}

function naZrodlo(x: unknown): ZrodloDziennika | null {
  const z = x as Record<string, unknown> | null
  if (!z || z.typ !== 'dziennik' || !t(z.wpisId) || !t(z.termin)) return null
  return { typ: 'dziennik', wpisId: t(z.wpisId), termin: t(z.termin) }
}

/** Dokument z bazy na zadanie; bez etapów to śmieć - pomijamy. */
export function naZadanie(id: string, d: DocumentData): Zadanie | null {
  if (!Array.isArray(d.etapy) || d.etapy.length === 0) return null
  return {
    id, tytul: t(d.tytul), kontekst: t(d.kontekst), termin: tLubNull(d.termin), zrodlo: naZrodlo(d.zrodlo),
    etapy: d.etapy.map((e: unknown) => naEtap((e ?? {}) as Record<string, unknown>)),
    utworzono: n(d.utworzono), zmieniono: n(d.zmieniono), zamkniete: nLubNull(d.zamkniete),
  }
}

const bezId = ({ id: _id, ...reszta }: Zadanie) => reszta

export async function czytajZadania(): Promise<Zadanie[]> {
  const snap = await orbitaZadaniaRef().get()
  return snap.docs.flatMap((d) => {
    const z = naZadanie(d.id, d.data() ?? {})
    return z ? [z] : []
  })
}

export async function dodajZadanie(pola: PolaZadania, teraz: number, dzis: Data): Promise<Zadanie> {
  const ref = orbitaZadaniaRef().doc()
  const z: Zadanie = { id: ref.id, ...pola, etapy: ustalCzekamDo(pola.etapy, dzis), utworzono: teraz, zmieniono: teraz, zamkniete: null }
  await ref.set(bezId(z))
  return z
}

const transakcja = <T>(f: (tr: Transaction) => Promise<T>) => orbitaZadaniaRef().firestore.runTransaction(f)

async function wTransakcji(tr: Transaction, id: string): Promise<Zadanie> {
  const snap = await tr.get(orbitaZadaniaRef().doc(id))
  const z = snap.exists ? naZadanie(id, snap.data() ?? {}) : null
  if (!z) throw new BladOrbity('nie-ma', NIE_MA)
  return z
}

/** Edycja całego zadania; `zmieniono` musi się zgadzać z bazą (druga karta). */
export function zmienZadanie(id: string, pola: PolaZadania, zmieniono: number, teraz: number, dzis: Data): Promise<Zadanie> {
  return transakcja(async (tr) => {
    const stare = await wTransakcji(tr, id)
    if (stare.zmieniono !== zmieniono) throw new BladOrbity('zmienione', KOMUNIKAT_KOLIZJI)
    const nowe = scalEdycje(stare, pola, teraz, dzis)
    if (typeof nowe === 'string') throw new BladOrbity('walidacja', nowe)
    tr.set(orbitaZadaniaRef().doc(id), bezId(nowe))
    return nowe
  })
}

export function usunZadanie(id: string): Promise<void> {
  return transakcja(async (tr) => {
    await wTransakcji(tr, id)
    tr.delete(orbitaZadaniaRef().doc(id))
  })
}

/** Zamknięcie albo ponowne otwarcie etapu - szybka akcja bez kontroli `zmieniono`. */
export function akcjaEtapu(id: string, etapId: string, akcja: 'zamknij' | 'otworz', wynik: string, teraz: number, dzis: Data): Promise<Zadanie> {
  return transakcja(async (tr) => {
    const z = await wTransakcji(tr, id)
    const nowe = akcja === 'zamknij' ? zamknijEtap(z, etapId, wynik, teraz, dzis) : otworzEtap(z, etapId, teraz)
    tr.set(orbitaZadaniaRef().doc(id), bezId(nowe))
    return nowe
  })
}

/** Obowiązki z Dziennika, które już są w otwartych zadaniach - do oznaczenia „w Orbicie”. */
export async function zrodlaOtwartych(): Promise<{ wpisId: string; termin: string; zadanieId: string }[]> {
  return (await czytajZadania()).flatMap((z) =>
    z.zrodlo && z.zamkniete === null ? [{ wpisId: z.zrodlo.wpisId, termin: z.zrodlo.termin, zadanieId: z.id }] : [],
  )
}
