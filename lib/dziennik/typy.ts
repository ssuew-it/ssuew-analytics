/** Działy księgi - kolejność zakładek (po „Najbliższe”). */
export const DZIALY = ['cykl', 'luka', 'watek', 'innowacja', 'strategia', 'przemyslenie'] as const
export type Dzial = (typeof DZIALY)[number]

export const STANY_WPISU = ['aktualne', 'przejmuje', 'zamkniete', 'nieaktualne'] as const
export type StanWpisu = (typeof STANY_WPISU)[number]

export const STATUSY_STRATEGII = ['projekt', 'przyjeta', 'wygasla', 'zastapiona'] as const
export type StatusStrategii = (typeof STATUSY_STRATEGII)[number]

export const STANY_CELU = ['realizowany', 'zrealizowany', 'porzucony'] as const
export type StanCelu = (typeof STANY_CELU)[number]

export interface Kadencja {
  id: string
  nazwa: string
  /** Wpisany ręcznie - konto kontakt@ jest wspólne, więc autora nie da się wziąć z logowania. */
  autor: string
  funkcja: string | null
  otwarta: number
  /** `null` - kadencja bieżąca (najwyżej jedna). */
  zamknieta: number | null
  kopia: { link: string; kiedy: number } | null
}

export interface Adnotacja {
  id: string
  kadencjaId: string
  stan: StanWpisu | null
  celId: string | null
  stanCelu: StanCelu | null
  komentarz: string
  kiedy: number
}

export interface Cel {
  id: string
  tresc: string
}

interface WpisBaza {
  id: string
  kadencjaId: string
  tytul: string
  tresc: string
  utworzono: number
  zmieniono: number
  adnotacje: Adnotacja[]
}

export type Wpis =
  | (WpisBaza & { dzial: 'cykl'; miesiac: number; dzien: number | null; wyprzedzenieTygodni: number; obowiazkowe: boolean; rozlicza: string[] })
  | (WpisBaza & { dzial: 'luka'; ileCzasu: string })
  | (WpisBaza & { dzial: 'watek'; zostalo: string })
  | (WpisBaza & { dzial: 'innowacja' | 'przemyslenie' })
  | (WpisBaza & { dzial: 'strategia'; link: string; okresOd: number; okresDo: number; status: StatusStrategii; uchwala: string | null; cele: Cel[] })

export type WpisCyklu = Extract<Wpis, { dzial: 'cykl' }>

export interface Ksiega {
  otwartaKadencjaId: string | null
  kadencje: Kadencja[]
  wpisy: Wpis[]
}

/** Okno zakładki „Najbliższe”, kafelka i odprawy. */
export const DNI_NAJBLIZSZYCH = 30
export const PODPOWIEDZI_ROZLICZA = ['Działacze', 'KR', 'RUSS']
