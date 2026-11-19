import type { Data } from '@/lib/planer/trwanie'
import { najblizsze } from './terminy'
import type { Ksiega } from './typy'

/** Co z Dziennika widzi asystent: same terminy kalendarza pracy, bez treści wpisów. */
export interface PozycjaDziennikaAsystenta {
  tytul: string
  /** DD.MM.RRRR */
  termin: string
  przygotowaniaOd: string
  obowiazkowe: boolean
  rozlicza: string[]
}

const dwie = (n: number) => String(n).padStart(2, '0')
const naTekst = (d: Data) => `${dwie(d.dzien)}.${dwie(d.miesiac)}.${d.rok}`

export function obrazDziennika(k: Ksiega, dzis: Data): PozycjaDziennikaAsystenta[] {
  return najblizsze(k.wpisy, dzis).map(({ wpis, termin, od }) => ({
    tytul: wpis.tytul,
    termin: naTekst(termin),
    przygotowaniaOd: naTekst(od),
    obowiazkowe: wpis.obowiazkowe,
    rozlicza: wpis.rozlicza,
  }))
}
