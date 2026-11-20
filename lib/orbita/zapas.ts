import { dniMiedzy, porownajDaty, przesunDate, zIso, type Data } from '@/lib/planer/trwanie'
import type { Etap, Zadanie } from './typy'

/** Różnica dni (nie włącznie): od 20.11 do 20.12 to 30. `dniMiedzy` liczy oba końce. */
const roznica = (od: Data, doDnia: Data) => dniMiedzy(od, doDnia) - 1

const suma = (etapy: Etap[]) => etapy.reduce((s, e) => s + e.dni, 0)

/** Indeks pierwszego niezamkniętego etapu; `null`, gdy wszystkie zamknięte. */
export function biezacy(z: Zadanie): number | null {
  const i = z.etapy.findIndex((e) => e.zamkniety === null)
  return i === -1 ? null : i
}

/** `czekamDo` etapu oczekiwania, a gdy go brak (dane sprzed reguły) - dziś + czas oczekiwania. */
export function czekamDoEfektywne(e: Etap, dzis: Data): Data {
  return (e.czekamDo ? zIso(e.czekamDo) : null) ?? przesunDate(dzis, e.dni)
}

/**
 * Dni zapasu do ostatniego bezpiecznego startu bieżącego etapu (ujemne = spóźnienie).
 * Przy bieżącym etapie oczekiwania liczy się od jego końca, więc przedłużone
 * konsultacje od razu zjadają zapas.
 */
export function zapas(z: Zadanie, dzis: Data): number | null {
  const k = biezacy(z)
  const termin = z.termin ? zIso(z.termin) : null
  if (k === null || z.zamkniete !== null || !termin) return null
  const e = z.etapy[k]
  if (e.rodzaj === 'czekanie') return roznica(czekamDoEfektywne(e, dzis), termin) - suma(z.etapy.slice(k + 1))
  return roznica(dzis, termin) - suma(z.etapy.slice(k))
}

/** Bieżący etap to oczekiwanie, które jeszcze trwa (do `czekamDo` włącznie). */
export function czeka(z: Zadanie, dzis: Data): boolean {
  const k = biezacy(z)
  if (k === null || z.zamkniete !== null) return false
  const e = z.etapy[k]
  return e.rodzaj === 'czekanie' && porownajDaty(dzis, czekamDoEfektywne(e, dzis)) <= 0
}

export interface PozycjaDnia {
  zadanie: Zadanie
  etap: number
  zapas: number
  /** Etap oczekiwania, któremu minął `czekamDo`. */
  poCzekaniu: boolean
}

export interface PlanDnia {
  dzis: PozycjaDnia[]
  /** Nic nie musi ruszyć dziś - w `dzis` jest tylko najbliższy etap. */
  podpowiedz: boolean
  czekam: { zadanie: Zadanie; etap: number; do: Data }[]
  najblizej: PozycjaDnia[]
  kiedys: Zadanie[]
  zamkniete: Zadanie[]
}

const kolejnosc = (a: PozycjaDnia, b: PozycjaDnia) =>
  a.zapas - b.zapas || (a.zadanie.termin ?? '').localeCompare(b.zadanie.termin ?? '') || a.zadanie.tytul.localeCompare(b.zadanie.tytul, 'pl')

/** Sekcje widoku Dziś (spec sekcja 5). */
export function planDnia(zadania: Zadanie[], dzis: Data): PlanDnia {
  const plan: PlanDnia = { dzis: [], podpowiedz: false, czekam: [], najblizej: [], kiedys: [], zamkniete: [] }
  for (const z of zadania) {
    const k = biezacy(z)
    if (k === null || z.zamkniete !== null) {
      plan.zamkniete.push(z)
      continue
    }
    if (czeka(z, dzis)) {
      plan.czekam.push({ zadanie: z, etap: k, do: czekamDoEfektywne(z.etapy[k], dzis) })
      continue
    }
    const z0 = zapas(z, dzis)
    if (z0 === null) {
      plan.kiedys.push(z)
      continue
    }
    const poCzekaniu = z.etapy[k].rodzaj === 'czekanie'
    const pozycja = { zadanie: z, etap: k, zapas: z0, poCzekaniu }
    if (z0 <= 0 || poCzekaniu) plan.dzis.push(pozycja)
    else plan.najblizej.push(pozycja)
  }
  plan.dzis.sort(kolejnosc)
  plan.najblizej.sort(kolejnosc)
  plan.czekam.sort((a, b) => porownajDaty(a.do, b.do))
  plan.zamkniete.sort((a, b) => (b.zamkniete ?? 0) - (a.zamkniete ?? 0))
  if (plan.dzis.length === 0 && plan.najblizej.length > 0) {
    plan.dzis.push(plan.najblizej.shift()!)
    plan.podpowiedz = true
  }
  return plan
}

const otwarte = (etapy: Etap[]) => etapy.filter((e) => e.zamkniety === null)

/** O ile dni otwarte etapy przekraczają czas do terminu; bez terminu 0. */
export function ileBrakuje(etapy: Etap[], termin: string | null, dzis: Data): number {
  const t = termin ? zIso(termin) : null
  if (!t) return 0
  return Math.max(0, suma(otwarte(etapy)) - roznica(dzis, t))
}

/**
 * Skraca proporcjonalnie otwarte etapy pracy, żeby zmieściły się przed terminem.
 * Etapów oczekiwania nie rusza (konsultacje mają swoje terminy); każdy etap pracy
 * zostaje co najmniej jednodniowy, więc może dalej brakować dni.
 */
export function dopasuj(etapy: Etap[], termin: string, dzis: Data): { etapy: Etap[]; brakuje: number } {
  const t = zIso(termin)
  if (!t) return { etapy, brakuje: 0 }
  const dostepne = roznica(dzis, t)
  const otw = otwarte(etapy)
  const czekanie = suma(otw.filter((e) => e.rodzaj === 'czekanie'))
  const sumaPracy = suma(otw.filter((e) => e.rodzaj === 'praca'))
  const cel = dostepne - czekanie
  if (sumaPracy <= cel) return { etapy, brakuje: 0 }
  const nowe = etapy.map((e) =>
    // Etap zerowy zostaje zerowy - skracanie nie może go wydłużyć.
    e.zamkniety === null && e.rodzaj === 'praca' && e.dni > 0 ? { ...e, dni: Math.max(1, Math.floor((e.dni * Math.max(cel, 0)) / sumaPracy)) } : e,
  )
  return { etapy: nowe, brakuje: Math.max(0, suma(otwarte(nowe)) - dostepne) }
}
