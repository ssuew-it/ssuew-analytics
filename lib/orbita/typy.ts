export type RodzajEtapu = 'praca' | 'czekanie'

export interface Etap {
  id: string
  nazwa: string
  rodzaj: RodzajEtapu
  cel: string
  zacznijOd: string
  materialy: string
  gotoweGdy: string
  /** Orientacyjna długość w dniach kalendarzowych; przy `czekanie` - czas oczekiwania. */
  dni: number
  /** Tylko `czekanie`: kto ma odpowiedzieć. */
  czekaNa: string[]
  /** Tylko `czekanie`: "RRRR-MM-DD", ustawiane przy zamknięciu poprzedniego etapu. */
  czekamDo: string | null
  zamkniety: number | null
  wynik: string
}

export interface ZrodloDziennika {
  typ: 'dziennik'
  wpisId: string
  termin: string
}

export interface Zadanie {
  id: string
  tytul: string
  kontekst: string
  /** "RRRR-MM-DD" albo null - „kiedyś”. */
  termin: string | null
  zrodlo: ZrodloDziennika | null
  etapy: Etap[]
  utworzono: number
  zmieniono: number
  zamkniete: number | null
}

export type PolaZadania = Pick<Zadanie, 'tytul' | 'kontekst' | 'termin' | 'zrodlo' | 'etapy'>

export const LIMITY = {
  tytul: 120,
  kontekst: 4000,
  etapy: 15,
  nazwa: 60,
  krotkie: 500,
  materialy: 2000,
  wynik: 2000,
  dni: 90,
  czekaNa: 10,
  czekaNaZnaki: 40,
} as const

/** Ile pozycji „Dziś” widać od razu; reszta pod „i jeszcze n”. */
export const WIDOCZNE_DZIS = 3
