import { naIso, zIso } from '@/lib/planer/trwanie'
import { LIMITY, type Etap, type PolaZadania, type RodzajEtapu, type Zadanie, type ZrodloDziennika } from './typy'

type Wynik<T> = { ok: true; pola: T } | { ok: false; blad: string }

class Odrzut extends Error {}
const odrzuc = (blad: string): never => {
  throw new Odrzut(blad)
}

const tekst = (x: unknown) => (typeof x === 'string' ? x.trim() : '')

function tekstDo(x: unknown, max: number, nazwa: string, wymagany = false): string {
  const t = tekst(x)
  if (wymagany && !t) odrzuc(`${nazwa} jest wymagany`)
  if (t.length > max) odrzuc(`${nazwa}: najwyżej ${max} znaków`)
  return t
}

/** Data "RRRR-MM-DD", która naprawdę istnieje (31 listopada - nie). */
export function poprawnaData(x: unknown): x is string {
  if (typeof x !== 'string') return false
  const d = zIso(x)
  if (!d) return false
  const t = new Date(Date.UTC(d.rok, d.miesiac - 1, d.dzien))
  return naIso({ rok: t.getUTCFullYear(), miesiac: t.getUTCMonth() + 1, dzien: t.getUTCDate() }) === x
}

function data(x: unknown, nazwa: string): string | null {
  if (x === null || x === undefined || x === '') return null
  if (!poprawnaData(x)) odrzuc(`${nazwa}: zła data`)
  return x as string
}

function zrodlo(x: unknown): ZrodloDziennika | null {
  if (x === null || x === undefined) return null
  const z = x as Record<string, unknown>
  const wpisId = tekst(z.wpisId)
  if (z.typ !== 'dziennik' || !wpisId || !poprawnaData(z.termin)) odrzuc('Złe źródło zadania')
  return { typ: 'dziennik', wpisId, termin: z.termin as string }
}

function czekaNa(x: unknown): string[] {
  const lista = Array.isArray(x) ? x.map(tekst).filter(Boolean) : []
  const bez = [...new Set(lista)]
  if (bez.length > LIMITY.czekaNa) odrzuc(`Najwyżej ${LIMITY.czekaNa} pozycji „czeka na”`)
  if (bez.some((p) => p.length > LIMITY.czekaNaZnaki)) odrzuc(`„Czeka na”: najwyżej ${LIMITY.czekaNaZnaki} znaków`)
  return bez
}

function etap(x: unknown): Etap {
  const e = (x ?? {}) as Record<string, unknown>
  const rodzaj = e.rodzaj
  if (rodzaj !== 'praca' && rodzaj !== 'czekanie') odrzuc('Nieznany rodzaj etapu')
  const dni = e.dni
  if (typeof dni !== 'number' || !Number.isInteger(dni) || dni < 0 || dni > LIMITY.dni) odrzuc(`Dni etapu: liczba od 0 do ${LIMITY.dni}`)
  const czekanie = rodzaj === 'czekanie'
  return {
    id: tekst(e.id) || crypto.randomUUID(),
    nazwa: tekst(e.nazwa) ? tekstDo(e.nazwa, LIMITY.nazwa, 'Nazwa etapu') : odrzuc('Każdy etap musi mieć nazwę'),
    rodzaj: rodzaj as RodzajEtapu,
    cel: tekstDo(e.cel, LIMITY.krotkie, 'Cel'),
    zacznijOd: tekstDo(e.zacznijOd, LIMITY.krotkie, '„Zacznij od”'),
    materialy: tekstDo(e.materialy, LIMITY.materialy, 'Materiały'),
    gotoweGdy: tekstDo(e.gotoweGdy, LIMITY.krotkie, '„Gotowe, gdy”'),
    dni: dni as number,
    czekaNa: czekanie ? czekaNa(e.czekaNa) : [],
    czekamDo: czekanie ? data(e.czekamDo, 'Czekam do') : null,
    zamkniety: null,
    wynik: tekstDo(e.wynik, LIMITY.wynik, 'Wynik'),
  }
}

/** Pola zadania z ciała żądania. `zamkniety` etapów zawsze `null` - zamyka tylko trasa etapu. */
export function sprawdzZadanie(x: unknown): Wynik<PolaZadania> {
  try {
    const z = (x ?? {}) as Record<string, unknown>
    if (!Array.isArray(z.etapy) || z.etapy.length === 0) odrzuc('Zadanie musi mieć co najmniej jeden etap')
    const etapy = z.etapy as unknown[]
    if (etapy.length > LIMITY.etapy) odrzuc(`Najwyżej ${LIMITY.etapy} etapów`)
    return {
      ok: true,
      pola: {
        tytul: tekstDo(z.tytul, LIMITY.tytul, 'Tytuł', true),
        kontekst: tekstDo(z.kontekst, LIMITY.kontekst, 'Kontekst'),
        termin: data(z.termin, 'Termin'),
        zrodlo: zrodlo(z.zrodlo),
        etapy: etapy.map(etap),
      },
    }
  } catch (e) {
    if (e instanceof Odrzut) return { ok: false, blad: e.message }
    throw e
  }
}

/**
 * Edycja zadania nie może ruszyć zamkniętych etapów: muszą zostać na początku,
 * w tej samej kolejności, z polami z bazy (poza wynikiem). Zwraca komunikat błędu albo nowe zadanie.
 */
export function scalEdycje(stare: Zadanie, nowe: PolaZadania, teraz: number): Zadanie | string {
  if (nowe.etapy.length === 0) return 'Zadanie musi mieć co najmniej jeden etap'
  const zamkniete = stare.etapy.filter((e) => e.zamkniety !== null)
  const poczatek = nowe.etapy.slice(0, zamkniete.length)
  if (poczatek.length < zamkniete.length || zamkniete.some((e, i) => poczatek[i].id !== e.id)) {
    return 'Zamkniętych etapów nie można usuwać ani przestawiać'
  }
  const reszta = nowe.etapy.slice(zamkniete.length)
  if (reszta.some((e) => zamkniete.some((s) => s.id === e.id))) return 'Zamkniętych etapów nie można usuwać ani przestawiać'
  const etapy = [
    ...zamkniete.map((s, i) => ({ ...s, wynik: poczatek[i].wynik })),
    ...reszta.map((e) => ({ ...e, zamkniety: null })),
  ]
  return {
    ...stare,
    ...nowe,
    etapy,
    zmieniono: teraz,
    zamkniete: reszta.length === 0 ? teraz : null,
  }
}
