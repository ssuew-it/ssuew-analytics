import { alertSpadku, dniOkresu, zmiana, type Okres } from './okresy'

export const DLUGOSC_NAZWY = 60
export const TYLKO_WLASCICIEL = 'Strony są tylko dla właściciela'

export interface Liczby {
  klikniecia: number
  wyswietlenia: number
  /** Ułamek, nie procent: 0.05 to 5%. */
  ctr: number
  /** Średnia pozycja w wynikach; 0, gdy nie było wyświetleń. */
  pozycja: number
}

/** Wpis listy stron. `witryna` to identyfikator Search Console: `sc-domain:jwk26.pl` albo `https://a.pl/`. */
export interface WpisStrony {
  witryna: string
  nazwa: string
}

export interface StatystykiStrony {
  witryna: string
  nazwa: string
  okres: Okres
  biezace: Liczby
  poprzednie: Liczby
  /** Ułamek; `null`, gdy w poprzednim okresie było zero. */
  zmiana: { klikniecia: number | null; wyswietlenia: number | null }
  dzienne: { data: string; klikniecia: number; wyswietlenia: number }[]
  zapytania: { tekst: string; klikniecia: number; wyswietlenia: number; pozycja: number }[]
  podstrony: { adres: string; klikniecia: number; wyswietlenia: number; pozycja: number }[]
  alert: boolean
}

export type RodzajBledu = 'brak-dostepu' | 'api-wylaczone' | 'inny'

export type WynikStrony =
  | { ok: true; dane: StatystykiStrony }
  | { ok: false; witryna: string; nazwa: string; blad: RodzajBledu; komunikat: string }

/** Kafelek w kokpicie i pasek podsumowania w panelu. */
export interface PodsumowanieStron {
  stron: number
  klikniecia: number
  wyswietlenia: number
  poprzednieKlikniecia: number
  poprzednieWyswietlenia: number
  alerty: number
  bledy: number
}

/** Odpowiedź `/api/strony/dostepne`. `blad` to gotowy komunikat, gdy Search Console zawiódł. */
export interface DostepneWitryny {
  email: string | null
  witryny: WpisStrony[]
  blad: string | null
}

/** Wiersz odpowiedzi `searchAnalytics.query` - nazwy pól z dokumentacji Google. */
export interface WierszApi {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

/** Bez danych Google nie zwraca `rows` wcale. */
export interface OdpowiedzApi {
  rows?: WierszApi[]
}

const liczby = (w?: WierszApi): Liczby => ({
  klikniecia: w?.clicks ?? 0,
  wyswietlenia: w?.impressions ?? 0,
  ctr: w?.ctr ?? 0,
  pozycja: w?.position ?? 0,
})

const wiersze = (o: OdpowiedzApi) =>
  (o.rows ?? []).map((r) => ({
    klucz: r.keys?.[0] ?? '',
    klikniecia: r.clicks ?? 0,
    wyswietlenia: r.impressions ?? 0,
    pozycja: r.position ?? 0,
  }))

export function zlozStatystyki(w: {
  strona: WpisStrony
  okres: Okres
  suma: OdpowiedzApi
  sumaPoprzednia: OdpowiedzApi
  dzienne: OdpowiedzApi
  zapytania: OdpowiedzApi
  podstrony: OdpowiedzApi
}): StatystykiStrony {
  const biezace = liczby(w.suma.rows?.[0])
  const poprzednie = liczby(w.sumaPoprzednia.rows?.[0])
  const poDniu = new Map(wiersze(w.dzienne).map((r) => [r.klucz, r]))
  return {
    witryna: w.strona.witryna,
    nazwa: w.strona.nazwa,
    okres: w.okres,
    biezace,
    poprzednie,
    zmiana: {
      klikniecia: zmiana(biezace.klikniecia, poprzednie.klikniecia),
      wyswietlenia: zmiana(biezace.wyswietlenia, poprzednie.wyswietlenia),
    },
    // Google pomija dni bez wyświetleń. Bez zer wykres łączyłby linią dni,
    // między którymi ruchu nie było wcale.
    dzienne: dniOkresu(w.okres).map((data) => {
      const r = poDniu.get(data)
      return { data, klikniecia: r?.klikniecia ?? 0, wyswietlenia: r?.wyswietlenia ?? 0 }
    }),
    zapytania: wiersze(w.zapytania).map(({ klucz, ...r }) => ({ tekst: klucz, ...r })),
    podstrony: wiersze(w.podstrony).map(({ klucz, ...r }) => ({ adres: klucz, ...r })),
    alert: alertSpadku(biezace.klikniecia, poprzednie.klikniecia),
  }
}

export function podsumujStrony(wyniki: WynikStrony[]): PodsumowanieStron {
  const dobre = wyniki.flatMap((w) => (w.ok ? [w.dane] : []))
  const suma = (f: (s: StatystykiStrony) => number) => dobre.reduce((a, s) => a + f(s), 0)
  return {
    stron: wyniki.length,
    klikniecia: suma((s) => s.biezace.klikniecia),
    wyswietlenia: suma((s) => s.biezace.wyswietlenia),
    poprzednieKlikniecia: suma((s) => s.poprzednie.klikniecia),
    poprzednieWyswietlenia: suma((s) => s.poprzednie.wyswietlenia),
    alerty: dobre.filter((s) => s.alert).length,
    bledy: wyniki.length - dobre.length,
  }
}

/** Komunikat z instrukcją - to, co właściciel ma zrobić, a nie kod błędu. */
export function komunikatStrony(rodzaj: RodzajBledu, email: string | null): string {
  if (rodzaj === 'brak-dostepu') {
    return `Brak dostępu. W Search Console tej strony: Ustawienia → Użytkownicy i uprawnienia → Dodaj użytkownika: ${email ?? 'adres konta serwisowego (client_email)'}, uprawnienie „Ograniczone”.`
  }
  if (rodzaj === 'api-wylaczone') {
    return 'Google Search Console API jest wyłączone. Włącz je w Google Cloud, w projekcie konta serwisowego (APIs & Services → Library).'
  }
  return 'Search Console teraz nie odpowiada - spróbuj później.'
}
