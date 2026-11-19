import { porownajDaty, przesunDate, type Data } from '@/lib/planer/trwanie'
import { DNI_NAJBLIZSZYCH, type Wpis, type WpisCyklu } from './typy'

const dniWMiesiacu = (rok: number, miesiac: number) => new Date(Date.UTC(rok, miesiac, 0)).getUTCDate()

/** Termin w danym roku: dzień przycięty do długości miesiąca, `null` = ostatni dzień. */
function wRoku(w: Pick<WpisCyklu, 'miesiac' | 'dzien'>, rok: number): Data {
  const ostatni = dniWMiesiacu(rok, w.miesiac)
  return { rok, miesiac: w.miesiac, dzien: w.dzien === null ? ostatni : Math.min(w.dzien, ostatni) }
}

/** Najbliższe wystąpienie terminu rocznego: dziś albo później. */
export function najblizszyTermin(w: Pick<WpisCyklu, 'miesiac' | 'dzien'>, dzis: Data): Data {
  const wTymRoku = wRoku(w, dzis.rok)
  return porownajDaty(wTymRoku, dzis) >= 0 ? wTymRoku : wRoku(w, dzis.rok + 1)
}

export function poczatekPrzygotowan(termin: Data, wyprzedzenieTygodni: number): Data {
  return przesunDate(termin, -7 * wyprzedzenieTygodni)
}

export interface PozycjaNajblizsza {
  wpis: WpisCyklu
  termin: Data
  od: Data
  /** Przygotowania już się zaczęły. */
  trwa: boolean
}

// Zadanie 2 podmieni na stanWpisu z lib/dziennik/stan.ts.
function otwartyWpis(w: Wpis): boolean {
  const zeStanem = w.adnotacje.filter((a) => a.stan !== null).sort((a, b) => a.kiedy - b.kiedy)
  const stan = zeStanem.at(-1)?.stan ?? 'aktualne'
  return stan !== 'zamkniete' && stan !== 'nieaktualne'
}

/** Wpisy kalendarza pracy, których okno przygotowań [od, termin] zahacza o najbliższe `dni` dni. */
export function najblizsze(wpisy: Wpis[], dzis: Data, dni = DNI_NAJBLIZSZYCH): PozycjaNajblizsza[] {
  const koniecOkna = przesunDate(dzis, dni - 1)
  return wpisy
    .filter((w): w is WpisCyklu => w.dzial === 'cykl' && otwartyWpis(w))
    .map((wpis) => {
      const termin = najblizszyTermin(wpis, dzis)
      const od = poczatekPrzygotowan(termin, wpis.wyprzedzenieTygodni)
      return { wpis, termin, od, trwa: porownajDaty(od, dzis) <= 0 }
    })
    .filter((p) => porownajDaty(p.od, koniecOkna) <= 0)
    .sort((a, b) => porownajDaty(a.termin, b.termin) || Number(b.wpis.obowiazkowe) - Number(a.wpis.obowiazkowe))
}
