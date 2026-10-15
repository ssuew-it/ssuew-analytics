export const TYLKO_WLASCICIEL = 'Skrzynka jest tylko dla właściciela'

export const STATUSY = ['do-przejrzenia', 'do-odpowiedzi', 'w-toku', 'czeka-na-nich', 'zalatwiona', 'pominieta'] as const
export type Status = (typeof STATUSY)[number]

export const TYPY_ORGANIZACJI = ['partner', 'sponsor', 'uczelnia', 'organizacja-studencka', 'media', 'inne'] as const
export type TypOrganizacji = (typeof TYPY_ORGANIZACJI)[number]

export type Kierunek = 'my' | 'oni'

export interface Adres {
  email: string
  imie: string
}

/** Jedna wiadomość wątku - same nagłówki, bez treści. */
export interface WiadomoscMeta {
  id: string
  kiedy: number
  od: Adres | null
  do: Adres[]
  temat: string
  etykiety: string[]
  /** `List-Unsubscribe` albo `Precedence: bulk/list` - poczta masowa. */
  masowa: boolean
  fragment: string
}

/** Wątek po odczytaniu: bez szkiców, spamu i kosza, od najstarszej wiadomości. */
export interface WatekZGmaila {
  id: string
  wiadomosci: WiadomoscMeta[]
}

/**
 * Status z polami, które od niego zależą.
 * Niezmiennik: `oczekujeOd !== null` wtedy i tylko wtedy, gdy status to `do-odpowiedzi`.
 */
export interface StanSprawy {
  status: Status
  oczekujeOd: number | null
  nowa: boolean
}

export interface Sprawa extends StanSprawy {
  /** Identyfikator wątku Gmaila. */
  id: string
  temat: string
  kontakt: string | null
  organizacja: string | null
  ostatnia: { kiedy: number; kierunek: Kierunek; fragment: string }
  wiadomosci: number
  /** Osoba ze Składu zarządu - furtka na przyszły dostęp zarządu. */
  przypisana: string | null
  kategoriaGmail: string | null
  zmieniono: number
}

export interface Kontakt {
  email: string
  imie: string
  organizacja: string | null
  typ: 'student' | null
}

export interface Organizacja {
  domena: string
  nazwa: string
  typ: TypOrganizacji
}

export interface PostepImportu {
  trwa: boolean
  zrobione: number
  razem: number
  /** Token następnej strony - po przerwie import rusza stąd, a nie od początku. */
  strona: string | null
}

export interface LicznikiSkrzynki {
  stan: 'brak' | 'rozlaczona' | 'polaczona'
  doOdpowiedzi: number
  poTerminie: number
  doPrzejrzenia: number
  czekaNaNich: number
  wToku: number
  zalatwione: number
  pominiete: number
  ostatniaSynchronizacja: number | null
}

export type WynikSynchronizacji =
  | { stan: 'zrobione'; watki: number }
  | { stan: 'zajete' }
  | { stan: 'niepolaczona' }
  | { stan: 'rozlaczona' }

/** Strona listy spraw; `nastepna` to kursor kolejnej strony albo `null`. */
export interface StronaSpraw {
  sprawy: Sprawa[]
  nastepna: string | null
}

export interface Zalacznik {
  /** `attachmentId` Gmaila. */
  id: string
  wiadomoscId: string
  nazwa: string
  typ: string
  rozmiar: number
}

/** Wiadomość z treścią - tylko w odpowiedzi trasy, nigdy w bazie. */
export interface WiadomoscPelna {
  id: string
  kiedy: number
  od: Adres | null
  do: Adres[]
  temat: string
  tekst: string | null
  html: string | null
  zalaczniki: Zalacznik[]
}

export interface SzczegolySprawy {
  sprawa: Sprawa
  wiadomosci: WiadomoscPelna[]
}
