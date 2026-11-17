import { opisMiejsca, przezPolnoc } from '@/lib/planer/opis'
import { naIso, przesunDate, type Data } from '@/lib/planer/trwanie'
import type { Kategoria, Wydarzenie } from '@/lib/planer/typy'

/** Kategorie, które trafiają do Kalendarza Samorządowicza. Zebrania, Aplikacje i Inne - nigdy. */
export const DO_KALENDARZA: ReadonlySet<Kategoria> = new Set<Kategoria>(['KOMISJE', 'SSUEW', 'PROJEKTY', 'UE'])

/** Wydarzenie bez ustalonej godziny idzie jako całodniowe z tym dopiskiem w tytule. */
export const DOPISEK_BEZ_GODZINY = ' (godzina do ustalenia)'

export type Termin = { date: string } | { dateTime: string; timeZone: 'Europe/Warsaw' }

export interface WydarzenieGoogle {
  summary: string
  start: Termin
  end: Termin
  location?: string
  extendedProperties: { private: { deck: '1'; deckId: string; deckSemestr: string } }
}

const STREFA = 'Europe/Warsaw' as const
const dwie = (n: number) => String(n).padStart(2, '0')

/** Godzina "HH:MM" w danym dniu; minuty ponad dobę przechodzą na następne dni. */
function wGodzinie(dzien: Data, minuty: number): Termin {
  const doba = 24 * 60
  const d = przesunDate(dzien, Math.floor(minuty / doba))
  const reszta = minuty % doba
  return { dateTime: `${naIso(d)}T${dwie(Math.floor(reszta / 60))}:${dwie(reszta % 60)}:00`, timeZone: STREFA }
}

const naMinuty = (g: string) => {
  const [h, m] = g.split(':').map(Number)
  return h * 60 + m
}

/**
 * Wydarzenie Planera w kształcie Google Calendar API. Daty liczone na `Data`
 * (bez `Date`), więc zmiana czasu nie przesuwa dni; strefę dopisuje Google.
 * Osób celowo brak - kalendarz jest dla Działaczy, nie dla przydziałów zarządu.
 */
export function naWydarzenieGoogle(w: Wydarzenie, semestrId: string): WydarzenieGoogle {
  const pierwszy: Data = { rok: w.rok, miesiac: w.miesiac, dzien: w.dzien }
  const dni = Math.max(1, w.dni)
  const ostatni = przesunDate(pierwszy, dni - 1)
  const bezGodziny = !w.calyDzien && !w.godzina

  let start: Termin
  let end: Termin
  if (w.calyDzien || !w.godzina) {
    start = { date: naIso(pierwszy) }
    end = { date: naIso(przesunDate(ostatni, 1)) }
  } else {
    start = wGodzinie(pierwszy, naMinuty(w.godzina))
    end = w.godzinaDo
      ? wGodzinie(przezPolnoc(w) ? przesunDate(ostatni, 1) : ostatni, naMinuty(w.godzinaDo))
      : wGodzinie(ostatni, naMinuty(w.godzina) + 60)
  }

  const miejsce = opisMiejsca(w)
  return {
    summary: bezGodziny ? `${w.tytul}${DOPISEK_BEZ_GODZINY}` : w.tytul,
    start,
    end,
    ...(miejsce ? { location: miejsce } : {}),
    extendedProperties: { private: { deck: '1', deckId: w.id, deckSemestr: semestrId } },
  }
}
