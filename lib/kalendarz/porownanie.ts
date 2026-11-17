import type { Miesiac, Wydarzenie } from '@/lib/planer/typy'
import { DO_KALENDARZA, DOPISEK_BEZ_GODZINY, naWydarzenieGoogle, type Termin, type WydarzenieGoogle } from './wydarzenie'

/** Wpis już siedzący w kalendarzu; `deckId` null = wpis ręczny, bez znacznika D.E.C.K. */
export interface WpisKalendarza {
  id: string
  summary: string
  start: Termin
  end: Termin
  location: string | null
  deckId: string | null
  deckSemestr: string | null
  /** Wpis z gośćmi albo zaproszenie od kogoś innego - D.E.C.K. go nigdy nie przejmuje. */
  spotkanie?: boolean
}

export interface PlanKalendarza {
  /** Ręczny wpis, który D.E.C.K. dopasował i od teraz prowadzi (dostaje znacznik). */
  przejmij: { wpisId: string; wydarzenie: WydarzenieGoogle }[]
  dodaj: WydarzenieGoogle[]
  zmien: { wpisId: string; wydarzenie: WydarzenieGoogle }[]
  usun: WpisKalendarza[]
  /**
   * Więcej niż jeden pasujący ręczny wpis albo pasujące spotkanie z gośćmi - D.E.C.K.
   * nie zgaduje i nic nie dodaje (przejęcie przesunęłoby spotkanie wszystkim gościom).
   */
  doSprawdzenia: { wydarzenie: WydarzenieGoogle; kandydaci: number; spotkanie: boolean }[]
}

/** Termin jako tekst do porównań; przesunięcie strefy z odpowiedzi Google odcięte. */
const klucz = (t: Termin) => ('date' in t ? t.date : t.dateTime.slice(0, 19))
const dzienStartu = (t: Termin) => klucz(t).slice(0, 10)

function tytulDoDopasowania(tytul: string): string {
  const t = tytul.trim().toLowerCase()
  const dopisek = DOPISEK_BEZ_GODZINY.trim().toLowerCase()
  return (t.endsWith(dopisek) ? t.slice(0, -dopisek.length) : t).trim()
}

function rozne(w: WpisKalendarza, g: WydarzenieGoogle): boolean {
  return w.summary !== g.summary
    || klucz(w.start) !== klucz(g.start)
    || klucz(w.end) !== klucz(g.end)
    || (w.location ?? null) !== (g.location ?? null)
}

const dwie = (n: number) => String(n).padStart(2, '0')

/**
 * Plan zmian: Planer (tylko kategorie `DO_KALENDARZA`) kontra wpisy kalendarza.
 * Wpisy ze znacznikiem innego semestru i ręczne bez pary nigdy nie trafiają do planu.
 * Z `miesiac` - tylko to, co startuje w tym miesiącu; para wydarzenie-wpis wchodzi,
 * gdy którekolwiek z nich w nim startuje (przeniesienie między miesiącami to zmiana, nie nowy wpis).
 */
export function porownaj(wydarzenia: Wydarzenie[], wpisy: WpisKalendarza[], semestrId: string, miesiac?: Miesiac): PlanKalendarza {
  const plan: PlanKalendarza = { przejmij: [], dodaj: [], zmien: [], usun: [], doSprawdzenia: [] }
  const wMiesiacu = (t: Termin) => !miesiac || klucz(t).slice(0, 7) === `${miesiac.y}-${dwie(miesiac.m)}`

  const nasze = new Map<string, WpisKalendarza>()
  const nadmiarowe: WpisKalendarza[] = []
  for (const w of wpisy) {
    if (w.deckId === null || w.deckSemestr !== semestrId) continue
    if (nasze.has(w.deckId)) nadmiarowe.push(w)
    else nasze.set(w.deckId, w)
  }
  const reczne = wpisy.filter((w) => w.deckId === null)
  const przejete = new Set<string>()

  const doKalendarza = wydarzenia.filter((w) => DO_KALENDARZA.has(w.kategoria))
  const sparowane = new Set<string>()
  const bezPary: WydarzenieGoogle[] = []

  for (const w of doKalendarza) {
    const g = naWydarzenieGoogle(w, semestrId)
    const istniejacy = nasze.get(w.id)
    if (istniejacy) {
      sparowane.add(w.id)
      if ((wMiesiacu(g.start) || wMiesiacu(istniejacy.start)) && rozne(istniejacy, g)) {
        plan.zmien.push({ wpisId: istniejacy.id, wydarzenie: g })
      }
    } else if (wMiesiacu(g.start)) {
      bezPary.push(g)
    }
  }

  for (const g of bezPary) {
    const tytul = tytulDoDopasowania(g.summary)
    const dzien = dzienStartu(g.start)
    const kandydaci = reczne.filter((r) => tytulDoDopasowania(r.summary) === tytul && dzienStartu(r.start) === dzien)
    const spotkanie = kandydaci.some((k) => k.spotkanie === true)
    if (kandydaci.length > 1 || spotkanie) {
      plan.doSprawdzenia.push({ wydarzenie: g, kandydaci: kandydaci.length, spotkanie })
      continue
    }
    const jedyny = kandydaci[0]
    if (jedyny && !przejete.has(jedyny.id)) {
      przejete.add(jedyny.id)
      plan.przejmij.push({ wpisId: jedyny.id, wydarzenie: g })
    } else {
      plan.dodaj.push(g)
    }
  }

  for (const [deckId, w] of nasze) if (!sparowane.has(deckId) && wMiesiacu(w.start)) plan.usun.push(w)
  plan.usun.push(...nadmiarowe.filter((w) => wMiesiacu(w.start)))
  return plan
}

const deckId = (g: WydarzenieGoogle) => g.extendedProperties.private.deckId

/** Klucze pozycji planu w kolejności okna - po nich klient mówi, co zaznaczył. */
export function kluczePlanu(plan: PlanKalendarza): string[] {
  return [
    ...plan.przejmij.map((p) => `przejmij:${deckId(p.wydarzenie)}`),
    ...plan.dodaj.map((g) => `dodaj:${deckId(g)}`),
    ...plan.zmien.map((z) => `zmien:${deckId(z.wydarzenie)}`),
    ...plan.usun.map((w) => `usun:${w.id}`),
  ]
}

/** Plan okrojony do zaznaczonych pozycji; klucz spoza planu (nieaktualny) nic nie robi. */
export function wybierz(plan: PlanKalendarza, wybrane: Iterable<string>): PlanKalendarza {
  const z = new Set(wybrane)
  return {
    przejmij: plan.przejmij.filter((p) => z.has(`przejmij:${deckId(p.wydarzenie)}`)),
    dodaj: plan.dodaj.filter((g) => z.has(`dodaj:${deckId(g)}`)),
    zmien: plan.zmien.filter((x) => z.has(`zmien:${deckId(x.wydarzenie)}`)),
    usun: plan.usun.filter((w) => z.has(`usun:${w.id}`)),
    doSprawdzenia: plan.doSprawdzenia,
  }
}
