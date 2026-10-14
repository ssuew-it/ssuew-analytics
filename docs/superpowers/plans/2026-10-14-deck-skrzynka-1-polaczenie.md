# D.E.C.K. - Skrzynka, część 1: połączenie, synchronizacja i kafelek - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** D.E.C.K. łączy się ze skrzynką kontakt@ (wewnętrzna aplikacja OAuth), importuje 12 miesięcy wątków, na bieżąco synchronizuje je przez push z Gmaila, nadaje sprawom statusy automatem i pokazuje liczniki na kafelku i w prostym panelu `/skrzynka`.

**Architektura:** czyste funkcje (`statusy`, `naglowki`, `kontakty`) nie znają sieci ani bazy. `google.ts` to klient OAuth i Gmail REST na `fetch`, `push.ts` weryfikuje token OIDC Pub/Sub, `szyfr.ts` szyfruje refresh token. `dane.ts` to cała rozmowa z Firestore (stan, dzierżawa, sprawy, liczniki), a `synchronizacja.ts` skleja to w `polaczSkrzynke`, `importujStrone`, `synchronizuj` i `odnowObserwacje`. Trasy są cienkie. Panel części 1 pokazuje połączenie, import i liczniki; lista spraw i wysyłka to część 2.

**Stack:** Next.js 16 (trasy, `after`, cron Vercela), React 19, Firestore Admin SDK, `jose`, `node:crypto`, Gmail API v1, Pub/Sub push, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-10-13-deck-skrzynka-crm-design.md](../specs/2026-10-13-deck-skrzynka-crm-design.md) - ten plan realizuje punkt 1 z §14.

## Zasady wspólne

- Wszystko po polsku; w tekstach tylko „-”, nigdy długie myślniki.
- Commit dopiero po `npx vitest run <pliki> > "$TMP/vt.log" 2>&1; echo $?` = 0. Stopka: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Praca na gałęzi `deck-skrzynka-1`; `main` w `ssuew-it/ssuew-analytics` przyjmuje zmiany przez pull request. Vercel (zespół `dzial-it-samorzadu`) buduje produkcję z `main`.
- Zakresy OAuth: `https://www.googleapis.com/auth/gmail.readonly` i `https://www.googleapis.com/auth/gmail.send` (wysyłka od razu, żeby część 2 nie wymagała ponownej zgody).
- Zmienne Vercela: `SKRZYNKA_CLIENT_ID`, `SKRZYNKA_CLIENT_SECRET`, `SKRZYNKA_ADRES` (`https://ssuew-analytics.vercel.app`), `SKRZYNKA_TEMAT` (`projects/deck-samorzad/topics/skrzynka`), `SKRZYNKA_PUSH_KONTO`, `SKRZYNKA_KLUCZ` (32 bajty base64), `CRON_SECRET`. Projekt Google Cloud: `deck-samorzad` (organizacja samorzad.ue.wroc.pl).
- Połączyć można wyłącznie konto `DECK_OWNER_EMAIL` (kontakt@).
- `users.watch` tylko na `INBOX` i `SENT`, `labelFilterBehavior: include`.
- Import: `newer_than:365d`, strony po 100 wątków; wątek z ostatnią wiadomością starszą niż 30 dni - Załatwiona.
- Alarm: Do odpowiedzi dłużej niż 3 dni robocze (pn-pt, czas Warszawy, bez świąt).
- Dzierżawa synchronizacji: 60 s; najwyżej 3 rundy na jedno wywołanie.
- Trasy z sesją: 401 bez sesji, 403 zarząd z komunikatem „Skrzynka jest tylko dla właściciela”.
- Kokpit nigdy nie pyta Gmaila - tylko liczniki z Firestore.

### Poprawki wobec specu (świadome)

1. **`SKRZYNKA_ADRES` zamiast wyprowadzania adresu z żądania.** Adres przekierowania OAuth i odbiorca tokenu push muszą być stałe; za Vercelem host żądania bywa adresem konkretnego wdrożenia.
2. **Liczba wątków kontaktu i organizacji nie jest zapisywana** (spec §6: `watki`, `ostatniKontakt`). Synchronizacja przetwarza ten sam wątek wiele razy, więc licznik w dokumencie rozjeżdżałby się; część 2 policzy je zapytaniem `count()` po `skrzynkaSprawy`.
3. **Niezmiennik `oczekujeOd !== null` ⇔ status `do-odpowiedzi`.** Dzięki niemu „po terminie” to jedno zapytanie zakresowe na `oczekujeOd`, bez indeksu złożonego.
4. **Panel części 1 jest prosty:** połączenie, import, liczniki, „Dociągnij”. Lista, widok sprawy, wysyłka, kontakty, ustawienia i „Rozłącz” to część 2.
5. **Nowy wątek ocenia się po ostatnim słowie,** nie po tym, kto zaczął: import trafia na wątki, w których już odpowiedzieli.

## Na co uważać w przeglądzie

1. **Kilka powiadomień push w trakcie synchronizacji** - żadna zmiana nie ginie: druga synchronizacja zgłasza powtórkę, pierwsza robi kolejną rundę (test w zadaniach 6 i 7).
2. **Wątek bez drugiej strony** (mail z kontakt@ do kontakt@, same szkice) - sprawa bez kontaktu albo pominięta, bez wyjątku (test w zadaniu 7).
3. **Wątek usunięty między powiadomieniem a pobraniem** (404) - pominięty, reszta przetworzona (test w zadaniu 7).
4. **Ponowne połączenie po rozłączeniu** - synchronizacja rusza od zapamiętanego punktu historii, import nie startuje od nowa (test w zadaniu 7).
5. **Synchronizacja nie kasuje pracy właściciela** - przypisanie i poprawione imię kontaktu zostają, nazwa i typ organizacji nie są nadpisywane (testy w zadaniach 6 i 7).

---

## Mapa plików

| Plik | Odpowiedzialność | Zadanie |
|---|---|---|
| `lib/czas.ts` | `polnocWarszawa` | 1 |
| `lib/skrzynka/typy.ts` | typy i stałe wspólne dla serwera i przeglądarki | 1 |
| `lib/skrzynka/statusy.ts` | automat statusów, alarm | 1 |
| `lib/skrzynka/naglowki.ts` | wątek Gmaila → `WatekZGmaila`, adresy, RFC 2047 | 2 |
| `lib/skrzynka/kontakty.ts` | druga strona, organizacja z domeny, typ kontaktu | 2 |
| `lib/skrzynka/szyfr.ts`, `lib/skrzynka/stanOauth.ts` | AES-256-GCM, podpisany `state` | 3 |
| `lib/skrzynka/google.ts` | OAuth, klient Gmaila, `BladSkrzynki`, `komunikatBledu` | 4 |
| `lib/skrzynka/push.ts` | weryfikacja OIDC Pub/Sub | 5 |
| `lib/firebase/admin.ts`, `lib/skrzynka/dane.ts` | kolekcje, stan, dzierżawa, sprawy, liczniki | 6 |
| `lib/skrzynka/synchronizacja.ts` | `przetworzWatki`, `synchronizuj`, `importujStrone`, `polaczSkrzynke`, `odnowObserwacje` | 7 |
| `app/api/skrzynka/{polacz,oauth,import,push,cron,synchronizuj}/route.ts`, `vercel.json` | trasy, cron | 8 |
| `lib/skrzynka/klient.ts`, `components/skrzynka/*`, `app/skrzynka/page.tsx` | panel części 1 | 9 |
| `components/deck/DeckHub.tsx`, `app/page.tsx` | kafelek | 10 |
| `README.md`, `.env.example` | konfiguracja | 11 |

---

## Zadanie 1: Typy, północ w Warszawie i automat statusów

**Pliki:** zmiana `lib/czas.ts`, `lib/czas.test.ts`; nowe `lib/skrzynka/typy.ts`, `lib/skrzynka/statusy.ts`, test `lib/skrzynka/statusy.test.ts`

**Interfejsy:**
- Korzysta z: `dzisWarszawa(teraz: Date): Data` (`@/lib/czas`), `przesunDate(d: Data, oDni: number): Data`, `type Data` (`@/lib/planer/trwanie`).
- Daje: `polnocWarszawa(d: Data): number`; z `typy.ts`: `STATUSY`, `Status`, `TYPY_ORGANIZACJI`, `TypOrganizacji`, `Kierunek`, `Adres`, `WiadomoscMeta`, `WatekZGmaila`, `StanSprawy`, `Sprawa`, `Kontakt`, `Organizacja`, `LicznikiSkrzynki`, `WynikSynchronizacji`, `PostepImportu`, `TYLKO_WLASCICIEL`; ze `statusy.ts`: `DNI_ALARMU`, `ARCHIWUM_MS`, `kierunek(w, nasz)`, `czyMasowa(w)`, `KontekstOceny`, `ocenSprawe(poprzednia, watek, k): StanSprawy`, `progAlarmu(teraz: number): number`, `poTerminie(oczekujeOd: number | null, teraz: number): boolean`.

- [ ] **Krok 1: Test `polnocWarszawa` - dopisz w `lib/czas.test.ts`**

Dopisz `polnocWarszawa` do importu z `@/lib/czas` i blok:

```ts
describe('polnocWarszawa', () => {
  it('lato (UTC+2) i zima (UTC+1)', () => {
    expect(polnocWarszawa({ rok: 2026, miesiac: 10, dzien: 14 })).toBe(Date.UTC(2026, 9, 13, 22))
    expect(polnocWarszawa({ rok: 2026, miesiac: 12, dzien: 1 })).toBe(Date.UTC(2026, 10, 30, 23))
  })
})
```

- [ ] **Krok 2: Test automatu - `lib/skrzynka/statusy.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { ocenSprawe, poTerminie, progAlarmu, ARCHIWUM_MS } from '@/lib/skrzynka/statusy'
import type { Status, WatekZGmaila, WiadomoscMeta } from '@/lib/skrzynka/typy'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'
const TERAZ = Date.UTC(2026, 9, 14, 10)

function m(kto: 'my' | 'oni', kiedy: number, extra: Partial<WiadomoscMeta> = {}): WiadomoscMeta {
  const od = kto === 'my' ? { email: NASZ, imie: 'Samorząd' } : { email: 'anna@firma.pl', imie: 'Anna' }
  return { id: `m${kiedy}`, kiedy, od, do: [], temat: 'Współpraca', etykiety: ['INBOX'], masowa: false, fragment: '', ...extra }
}
const w = (...wiadomosci: WiadomoscMeta[]): WatekZGmaila => ({ id: 't1', wiadomosci })
const k = { nasz: NASZ, pomijana: false, teraz: TERAZ, import: false }

describe('ocenSprawe - nowy wątek', () => {
  it('ich mail - Do odpowiedzi od tej chwili', () => {
    expect(ocenSprawe(null, w(m('oni', 100)), k)).toEqual({ status: 'do-odpowiedzi', oczekujeOd: 100, nowa: true })
  })

  it('ostatnie słowo nasze - Czeka na nich', () => {
    expect(ocenSprawe(null, w(m('oni', 100), m('my', 200)), k)).toEqual({ status: 'czeka-na-nich', oczekujeOd: null, nowa: false })
    expect(ocenSprawe(null, w(m('my', 100)), k).status).toBe('czeka-na-nich')
  })

  it('czekanie liczone od pierwszego ich maila po naszej odpowiedzi', () => {
    expect(ocenSprawe(null, w(m('oni', 100), m('my', 200), m('oni', 300), m('oni', 400)), k).oczekujeOd).toBe(300)
  })

  it('kategoria Gmaila albo nagłówek listy - Do przejrzenia', () => {
    expect(ocenSprawe(null, w(m('oni', 100, { etykiety: ['INBOX', 'CATEGORY_PROMOTIONS'] })), k).status).toBe('do-przejrzenia')
    expect(ocenSprawe(null, w(m('oni', 100, { masowa: true })), k)).toEqual({ status: 'do-przejrzenia', oczekujeOd: null, nowa: true })
  })

  it('pomijany nadawca - Pominięta, nawet gdy to reklama', () => {
    expect(ocenSprawe(null, w(m('oni', 100, { masowa: true })), { ...k, pomijana: true }).status).toBe('pominieta')
  })

  it('import: ostatnia wiadomość starsza niż 30 dni - Załatwiona', () => {
    const stary = TERAZ - ARCHIWUM_MS - 1
    expect(ocenSprawe(null, w(m('oni', stary)), { ...k, import: true })).toEqual({ status: 'zalatwiona', oczekujeOd: null, nowa: false })
    expect(ocenSprawe(null, w(m('oni', stary)), k).status).toBe('do-odpowiedzi')
  })
})

describe('ocenSprawe - znana sprawa', () => {
  const pop = (status: Status, oczekujeOd: number | null = null) => ({ status, oczekujeOd, nowa: false, ostatniaKiedy: 100 })

  it('bez nowych wiadomości - bez zmian', () => {
    expect(ocenSprawe(pop('w-toku'), w(m('oni', 100)), k)).toEqual({ status: 'w-toku', oczekujeOd: null, nowa: false })
  })

  it('ich mail w Czeka na nich i w Załatwionej - Do odpowiedzi', () => {
    expect(ocenSprawe(pop('czeka-na-nich'), w(m('my', 100), m('oni', 300)), k)).toEqual({ status: 'do-odpowiedzi', oczekujeOd: 300, nowa: true })
    expect(ocenSprawe(pop('zalatwiona'), w(m('my', 100), m('oni', 300)), k).status).toBe('do-odpowiedzi')
  })

  it('ich mail w W toku, Pominiętej i Do przejrzenia - status zostaje, znacznik nowej wiadomości', () => {
    for (const s of ['w-toku', 'pominieta', 'do-przejrzenia'] as const) {
      expect(ocenSprawe(pop(s), w(m('oni', 100), m('oni', 300)), k)).toEqual({ status: s, oczekujeOd: null, nowa: true })
    }
  })

  it('nasz mail w Do odpowiedzi - Czeka na nich; w W toku i Załatwionej bez zmian', () => {
    expect(ocenSprawe(pop('do-odpowiedzi', 100), w(m('oni', 100), m('my', 300)), k)).toEqual({ status: 'czeka-na-nich', oczekujeOd: null, nowa: false })
    expect(ocenSprawe(pop('w-toku'), w(m('oni', 100), m('my', 300)), k).status).toBe('w-toku')
    expect(ocenSprawe(pop('zalatwiona'), w(m('oni', 100), m('my', 300)), k).status).toBe('zalatwiona')
  })

  it('kolejny ich mail w Do odpowiedzi - czekanie liczone od pierwszego', () => {
    expect(ocenSprawe(pop('do-odpowiedzi', 100), w(m('oni', 100), m('oni', 300)), k)).toEqual({ status: 'do-odpowiedzi', oczekujeOd: 100, nowa: true })
  })

  it('nowe: najpierw nasz, potem ich - liczy się ostatnie słowo', () => {
    expect(ocenSprawe(pop('czeka-na-nich'), w(m('my', 100), m('my', 200), m('oni', 300)), k).status).toBe('do-odpowiedzi')
    expect(ocenSprawe(pop('czeka-na-nich'), w(m('my', 100), m('oni', 200), m('my', 300)), k).status).toBe('czeka-na-nich')
  })
})

describe('alarm 3 dni roboczych', () => {
  // Wtorek 20.10.2026, 10:00 w Warszawie (UTC+2).
  const wtorek = Date.UTC(2026, 9, 20, 8)

  it('próg to północ czwartego dnia roboczego wstecz (czwartek 15.10)', () => {
    expect(progAlarmu(wtorek)).toBe(Date.UTC(2026, 9, 14, 22))
  })

  it('pt → wt to 2 dni robocze - jeszcze nie; środa - już tak; czwartek rano - jeszcze nie', () => {
    expect(poTerminie(Date.UTC(2026, 9, 16, 7), wtorek)).toBe(false)
    expect(poTerminie(Date.UTC(2026, 9, 14, 13), wtorek)).toBe(true)
    expect(poTerminie(Date.UTC(2026, 9, 15, 6), wtorek)).toBe(false)
    expect(poTerminie(null, wtorek)).toBe(false)
  })
})
```

- [ ] **Krok 3: Uruchom - ma paść**

Run: `npx vitest run lib/czas.test.ts lib/skrzynka/statusy.test.ts > "$TMP/vt.log" 2>&1; echo $?`
Expected: `1` (brak `polnocWarszawa` i modułów skrzynki).

- [ ] **Krok 4: `polnocWarszawa` na końcu `lib/czas.ts`**

```ts
/**
 * Chwila, w której w Warszawie zaczyna się dany dzień. Przesunięcie (UTC+1
 * albo UTC+2) odczytujemy z południa tego dnia - w południe zmiana czasu
 * nigdy nie wypada.
 */
export function polnocWarszawa(d: Data): number {
  const poludnie = Date.UTC(d.rok, d.miesiac - 1, d.dzien, 12)
  const godzina = Number(new Intl.DateTimeFormat('en-GB', { timeZone: STREFA, hour: '2-digit', hourCycle: 'h23' }).format(poludnie))
  return Date.UTC(d.rok, d.miesiac - 1, d.dzien) - (godzina - 12) * 3_600_000
}
```

- [ ] **Krok 5: `lib/skrzynka/typy.ts`**

```ts
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
}

export interface LicznikiSkrzynki {
  stan: 'brak' | 'rozlaczona' | 'polaczona'
  doOdpowiedzi: number
  poTerminie: number
  doPrzejrzenia: number
  czekaNaNich: number
  wToku: number
  ostatniaSynchronizacja: number | null
}

export type WynikSynchronizacji =
  | { stan: 'zrobione'; watki: number }
  | { stan: 'zajete' }
  | { stan: 'niepolaczona' }
  | { stan: 'rozlaczona' }
```

- [ ] **Krok 6: `lib/skrzynka/statusy.ts`**

```ts
import { dzisWarszawa, polnocWarszawa } from '@/lib/czas'
import { przesunDate, type Data } from '@/lib/planer/trwanie'
import type { Kierunek, StanSprawy, WatekZGmaila, WiadomoscMeta } from './typy'

export const DNI_ALARMU = 3
/** Przy imporcie starsze sprawy idą do archiwum - inaczej start dałby setki fałszywych alarmów. */
export const ARCHIWUM_MS = 30 * 24 * 3_600_000
const KATEGORIE_MASOWE = ['CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS']

export function kierunek(w: WiadomoscMeta, nasz: string): Kierunek {
  return w.od?.email.toLowerCase() === nasz.toLowerCase() ? 'my' : 'oni'
}

export function czyMasowa(w: WiadomoscMeta): boolean {
  return w.masowa || w.etykiety.some((e) => KATEGORIE_MASOWE.includes(e))
}

/** Pierwsza ich wiadomość po naszej ostatniej; `null`, gdy ostatnie słowo jest nasze. */
function poczatekCzekania(wiadomosci: WiadomoscMeta[], nasz: string): number | null {
  let od: number | null = null
  for (const w of wiadomosci) {
    if (kierunek(w, nasz) === 'my') od = null
    else if (od === null) od = w.kiedy
  }
  return od
}

const doOdpowiedzi = (oczekujeOd: number): StanSprawy => ({ status: 'do-odpowiedzi', oczekujeOd, nowa: true })

export interface KontekstOceny {
  nasz: string
  /** Druga strona jest na liście „zawsze pomijaj”. */
  pomijana: boolean
  teraz: number
  /** Pierwszy import skrzynki - stare sprawy idą do archiwum. */
  import: boolean
}

/**
 * Automat statusów (spec §5). `poprzednia` to stan z bazy z czasem ostatniej
 * znanej wiadomości; `null` - sprawa nowa. Wątek ma co najmniej jedną
 * wiadomość, od najstarszej.
 */
export function ocenSprawe(
  poprzednia: (StanSprawy & { ostatniaKiedy: number }) | null,
  watek: WatekZGmaila,
  k: KontekstOceny,
): StanSprawy {
  const ws = watek.wiadomosci
  const ostatnia = ws[ws.length - 1]

  if (!poprzednia) {
    if (k.pomijana) return { status: 'pominieta', oczekujeOd: null, nowa: false }
    if (k.import && k.teraz - ostatnia.kiedy > ARCHIWUM_MS) return { status: 'zalatwiona', oczekujeOd: null, nowa: false }
    const pierwszaIch = ws.find((w) => kierunek(w, k.nasz) === 'oni')
    if (pierwszaIch && czyMasowa(pierwszaIch)) return { status: 'do-przejrzenia', oczekujeOd: null, nowa: true }
    const od = poczatekCzekania(ws, k.nasz)
    return od === null ? { status: 'czeka-na-nich', oczekujeOd: null, nowa: false } : doOdpowiedzi(od)
  }

  const nowe = ws.filter((w) => w.kiedy > poprzednia.ostatniaKiedy)
  if (!nowe.length) return { status: poprzednia.status, oczekujeOd: poprzednia.oczekujeOd, nowa: poprzednia.nowa }
  const ichNowe = nowe.some((w) => kierunek(w, k.nasz) === 'oni')
  const ostatniKierunek = kierunek(nowe[nowe.length - 1], k.nasz)

  switch (poprzednia.status) {
    case 'pominieta':
    case 'do-przejrzenia':
    case 'w-toku':
      return { status: poprzednia.status, oczekujeOd: null, nowa: poprzednia.nowa || ichNowe }
    case 'czeka-na-nich':
    case 'zalatwiona':
      if (ostatniKierunek === 'oni') return doOdpowiedzi(poczatekCzekania(nowe, k.nasz) ?? ostatnia.kiedy)
      return { status: poprzednia.status, oczekujeOd: null, nowa: poprzednia.nowa }
    case 'do-odpowiedzi':
      if (ostatniKierunek === 'my') return { status: 'czeka-na-nich', oczekujeOd: null, nowa: false }
      return doOdpowiedzi(poprzednia.oczekujeOd ?? poczatekCzekania(nowe, k.nasz) ?? ostatnia.kiedy)
  }
}

const roboczy = (d: Data) => {
  const t = new Date(Date.UTC(d.rok, d.miesiac - 1, d.dzien)).getUTCDay()
  return t >= 1 && t <= 5
}

/**
 * Chwila graniczna alarmu: co czeka od wcześniej, jest po terminie. To
 * północ (Warszawa) czwartego dnia roboczego wstecz, licząc dziś - wtedy
 * między dniem maila a dziś mieszczą się co najmniej 4 dni robocze.
 */
export function progAlarmu(teraz: number): number {
  let d = dzisWarszawa(new Date(teraz))
  let n = 0
  for (;;) {
    if (roboczy(d)) n++
    if (n === DNI_ALARMU + 1) return polnocWarszawa(d)
    d = przesunDate(d, -1)
  }
}

export function poTerminie(oczekujeOd: number | null, teraz: number): boolean {
  return oczekujeOd !== null && oczekujeOd < progAlarmu(teraz)
}
```

- [ ] **Krok 7: Uruchom - ma przejść**

Run: `npx vitest run lib/czas.test.ts lib/skrzynka/statusy.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 8: Commit**

```bash
git add lib/czas.ts lib/czas.test.ts lib/skrzynka/typy.ts lib/skrzynka/statusy.ts lib/skrzynka/statusy.test.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): typy i automat statusow spraw z alarmem 3 dni roboczych

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 2: Odczyt nagłówków i kontakty

**Pliki:** nowe `lib/skrzynka/naglowki.ts`, `lib/skrzynka/kontakty.ts`, test `lib/skrzynka/naglowki.test.ts`

**Interfejsy:**
- Korzysta z: `Adres`, `WiadomoscMeta`, `WatekZGmaila`, `Kontakt`, `Organizacja` (zadanie 1).
- Daje: `WatekApi` (typ odpowiedzi `threads.get`), `dekodujNaglowek(s)`, `odczytajAdresy(naglowek): Adres[]`, `odczytajWatek(w: WatekApi): WatekZGmaila`; `SKRZYNKI_PRYWATNE`, `domena(email)`, `organizacjaZEmaila(email): Organizacja | null`, `typKontaktu(email)`, `drugaStrona(w, nasz): Adres | null`, `kontaktZAdresu(a): Kontakt`.

- [ ] **Krok 1: Test**

```ts
// @vitest-environment node
// TextDecoder z ISO-8859-2 i atob - jak na serwerze.
import { describe, it, expect } from 'vitest'
import { dekodujNaglowek, odczytajAdresy, odczytajWatek, type WatekApi } from '@/lib/skrzynka/naglowki'
import { drugaStrona, organizacjaZEmaila, typKontaktu, kontaktZAdresu } from '@/lib/skrzynka/kontakty'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'

describe('dekodujNaglowek', () => {
  it('RFC 2047: base64 UTF-8, quoted-printable ISO-8859-2, sąsiednie słowa i zwykły tekst', () => {
    expect(dekodujNaglowek('=?UTF-8?B?WmFwcm9zemVuaWUgbmEgSnV3ZW5hbGlh?=')).toBe('Zaproszenie na Juwenalia')
    expect(dekodujNaglowek('=?ISO-8859-2?Q?Wsp=F3=B3praca?=')).toBe('Współpraca')
    expect(dekodujNaglowek('=?utf-8?B?V3Nww7PFgnByYWNhIHogU2Ftb3J6xIVkZW0=?=')).toBe('Współpraca z Samorządem')
    expect(dekodujNaglowek('=?UTF-8?Q?Ala?= =?UTF-8?Q?_ma_kota?=')).toBe('Ala ma kota')
    expect(dekodujNaglowek('Zwykły temat')).toBe('Zwykły temat')
  })
})

describe('odczytajAdresy', () => {
  it('przecinek w cudzysłowie, kilku odbiorców, sam adres, wielkość liter', () => {
    expect(odczytajAdresy('"Kowalska, Anna" <Anna@Firma.pl>, jan@uew.pl, Zarząd <zarzad@ssuew.pl>')).toEqual([
      { email: 'anna@firma.pl', imie: 'Kowalska, Anna' },
      { email: 'jan@uew.pl', imie: '' },
      { email: 'zarzad@ssuew.pl', imie: 'Zarząd' },
    ])
    expect(odczytajAdresy('')).toEqual([])
    expect(odczytajAdresy('undisclosed-recipients:;')).toEqual([])
  })
})

function surowy(wiadomosci: { od: string; kiedy: number; do?: string; etykiety?: string[]; naglowki?: Record<string, string> }[]): WatekApi {
  return {
    id: 't1',
    messages: wiadomosci.map((w, i) => ({
      id: `m${i}`,
      internalDate: String(w.kiedy),
      labelIds: w.etykiety ?? ['INBOX'],
      snippet: 'Dzień dobry, piszę w sprawie &quot;Juwenaliów&quot; &amp; sponsoringu',
      payload: {
        headers: [
          { name: 'From', value: w.od },
          { name: 'To', value: w.do ?? NASZ },
          { name: 'Subject', value: 'Sponsoring' },
          ...Object.entries(w.naglowki ?? {}).map(([name, value]) => ({ name, value })),
        ],
      },
    })),
  }
}

describe('odczytajWatek', () => {
  it('sortuje od najstarszej, pomija szkice, spam i kosz, dekoduje fragment', () => {
    const w = odczytajWatek(surowy([
      { od: NASZ, kiedy: 300, etykiety: ['SENT'] },
      { od: 'Anna <anna@firma.pl>', kiedy: 100 },
      { od: NASZ, kiedy: 400, etykiety: ['DRAFT'] },
      { od: 'x@spam.pl', kiedy: 200, etykiety: ['SPAM'] },
    ]))
    expect(w.wiadomosci.map((m) => m.kiedy)).toEqual([100, 300])
    expect(w.wiadomosci[0].od).toEqual({ email: 'anna@firma.pl', imie: 'Anna' })
    expect(w.wiadomosci[0].temat).toBe('Sponsoring')
    expect(w.wiadomosci[0].fragment).toBe('Dzień dobry, piszę w sprawie "Juwenaliów" & sponsoringu')
  })

  it('List-Unsubscribe albo Precedence: bulk - poczta masowa', () => {
    expect(odczytajWatek(surowy([{ od: 'news@sklep.pl', kiedy: 1, naglowki: { 'List-Unsubscribe': '<mailto:x@sklep.pl>' } }])).wiadomosci[0].masowa).toBe(true)
    expect(odczytajWatek(surowy([{ od: 'news@sklep.pl', kiedy: 1, naglowki: { Precedence: 'Bulk' } }])).wiadomosci[0].masowa).toBe(true)
    expect(odczytajWatek(surowy([{ od: 'anna@firma.pl', kiedy: 1 }])).wiadomosci[0].masowa).toBe(false)
  })

  it('wątek bez wiadomości', () => {
    expect(odczytajWatek({ id: 't2' }).wiadomosci).toEqual([])
  })
})

describe('kontakty', () => {
  it('organizacja z domeny: prywatna, student, uczelnia, firma', () => {
    expect(organizacjaZEmaila('ktos@gmail.com')).toBeNull()
    expect(organizacjaZEmaila('ktos@wp.pl')).toBeNull()
    expect(organizacjaZEmaila('123456@student.ue.wroc.pl')).toBeNull()
    expect(organizacjaZEmaila('dziekan@ue.wroc.pl')).toEqual({ domena: 'ue.wroc.pl', nazwa: 'Uniwersytet Ekonomiczny', typ: 'uczelnia' })
    expect(organizacjaZEmaila('anna@Firma.pl')).toEqual({ domena: 'firma.pl', nazwa: 'firma.pl', typ: 'inne' })
    expect(typKontaktu('123456@student.ue.wroc.pl')).toBe('student')
    expect(typKontaktu('anna@firma.pl')).toBeNull()
  })

  it('druga strona: pierwszy adres w wątku inny niż nasz', () => {
    const odNas = odczytajWatek(surowy([{ od: NASZ, kiedy: 1, do: 'Anna <anna@firma.pl>, jan@firma.pl' }]))
    expect(drugaStrona(odNas, NASZ)).toEqual({ email: 'anna@firma.pl', imie: 'Anna' })
    const doNas = odczytajWatek(surowy([{ od: 'Jan <jan@firma.pl>', kiedy: 1 }]))
    expect(drugaStrona(doNas, NASZ.toUpperCase())).toEqual({ email: 'jan@firma.pl', imie: 'Jan' })
    const doSiebie = odczytajWatek(surowy([{ od: NASZ, kiedy: 1, do: NASZ }]))
    expect(drugaStrona(doSiebie, NASZ)).toBeNull()
  })

  it('kontakt z adresu', () => {
    expect(kontaktZAdresu({ email: '123@student.ue.wroc.pl', imie: 'Ola' })).toEqual({ email: '123@student.ue.wroc.pl', imie: 'Ola', organizacja: null, typ: 'student' })
    expect(kontaktZAdresu({ email: 'anna@firma.pl', imie: '' })).toEqual({ email: 'anna@firma.pl', imie: '', organizacja: 'firma.pl', typ: null })
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/naglowki.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `lib/skrzynka/naglowki.ts`**

```ts
import type { Adres, WatekZGmaila, WiadomoscMeta } from './typy'

/** Odpowiedź `threads.get` z `format=metadata` - tylko pola, których używamy. */
export interface WatekApi {
  id: string
  messages?: {
    id: string
    internalDate?: string
    labelIds?: string[]
    snippet?: string
    payload?: { headers?: { name: string; value: string }[] }
  }[]
}

const POMIJANE_ETYKIETY = ['DRAFT', 'SPAM', 'TRASH']

/** Słowa zakodowane RFC 2047 (`=?UTF-8?B?…?=`). Gmail zwykle podaje nagłówki już odkodowane - to zabezpieczenie. */
export function dekodujNaglowek(s: string): string {
  return s
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (calosc, zestaw: string, kod: string, tekst: string) => {
      try {
        const znaki = kod.toUpperCase() === 'B'
          ? atob(tekst)
          : tekst.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
        return new TextDecoder(zestaw.toLowerCase()).decode(Uint8Array.from(znaki, (c) => c.charCodeAt(0)))
      } catch {
        return calosc
      }
    })
}

/** `Imię <a@b>, "Nazwisko, Imię" <c@d>, e@f` - przecinek w cudzysłowie albo w nawiasie nie dzieli adresów. */
export function odczytajAdresy(naglowek: string): Adres[] {
  const czesci: string[] = []
  let biezaca = ''
  let cudzyslow = false
  let nawias = false
  for (const z of naglowek) {
    if (z === '"') cudzyslow = !cudzyslow
    else if (z === '<' && !cudzyslow) nawias = true
    else if (z === '>' && !cudzyslow) nawias = false
    if (z === ',' && !cudzyslow && !nawias) {
      czesci.push(biezaca)
      biezaca = ''
    } else {
      biezaca += z
    }
  }
  czesci.push(biezaca)
  return czesci.flatMap((c) => {
    const t = c.trim()
    const m = t.match(/^(.*?)<([^>]+)>\s*$/)
    const email = (m ? m[2] : t).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) return []
    const imie = dekodujNaglowek((m ? m[1] : '').trim().replace(/^"(.*)"$/, '$1').trim())
    return [{ email, imie }]
  })
}

const ENCJE: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** `snippet` Gmaila ma encje HTML. */
function dekodujEncje(s: string): string {
  return s.replace(/&(#\d+|[a-z]+);/gi, (calosc, e: string) =>
    e.startsWith('#') ? String.fromCharCode(Number(e.slice(1))) : ENCJE[e.toLowerCase()] ?? calosc,
  )
}

export function odczytajWatek(w: WatekApi): WatekZGmaila {
  const wiadomosci: WiadomoscMeta[] = (w.messages ?? [])
    .filter((m) => !(m.labelIds ?? []).some((e) => POMIJANE_ETYKIETY.includes(e)))
    .map((m) => {
      const h = (nazwa: string) =>
        m.payload?.headers?.find((x) => x.name.toLowerCase() === nazwa.toLowerCase())?.value ?? ''
      const precedence = h('Precedence').trim().toLowerCase()
      return {
        id: m.id,
        kiedy: Number(m.internalDate) || 0,
        od: odczytajAdresy(h('From'))[0] ?? null,
        do: [...odczytajAdresy(h('To')), ...odczytajAdresy(h('Cc'))],
        temat: dekodujNaglowek(h('Subject')).trim(),
        etykiety: m.labelIds ?? [],
        masowa: Boolean(h('List-Unsubscribe')) || precedence === 'bulk' || precedence === 'list',
        fragment: dekodujEncje(m.snippet ?? ''),
      }
    })
    .sort((a, b) => a.kiedy - b.kiedy)
  return { id: w.id, wiadomosci }
}
```

- [ ] **Krok 4: `lib/skrzynka/kontakty.ts`**

```ts
import type { Adres, Kontakt, Organizacja, WatekZGmaila } from './typy'

/** Skrzynki prywatne nie tworzą organizacji - inaczej „gmail.com” byłby największym partnerem. */
export const SKRZYNKI_PRYWATNE = new Set([
  'gmail.com', 'googlemail.com', 'wp.pl', 'o2.pl', 'onet.pl', 'op.pl', 'interia.pl',
  'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'yahoo.com', 'proton.me', 'protonmail.com',
])
const STUDENCI = 'student.ue.wroc.pl'
const UCZELNIA = 'ue.wroc.pl'

export function domena(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase()
}

export function organizacjaZEmaila(email: string): Organizacja | null {
  const d = domena(email)
  if (SKRZYNKI_PRYWATNE.has(d) || d === STUDENCI) return null
  if (d === UCZELNIA) return { domena: d, nazwa: 'Uniwersytet Ekonomiczny', typ: 'uczelnia' }
  return { domena: d, nazwa: d, typ: 'inne' }
}

export function typKontaktu(email: string): 'student' | null {
  return domena(email) === STUDENCI ? 'student' : null
}

/** Pierwszy adres w wątku inny niż nasz - nadawca albo, gdy zaczęliśmy my, pierwszy odbiorca. */
export function drugaStrona(w: WatekZGmaila, nasz: string): Adres | null {
  const n = nasz.toLowerCase()
  for (const m of w.wiadomosci) {
    for (const a of [m.od, ...m.do]) if (a && a.email !== n) return a
  }
  return null
}

export function kontaktZAdresu(a: Adres): Kontakt {
  return { email: a.email, imie: a.imie, organizacja: organizacjaZEmaila(a.email)?.domena ?? null, typ: typKontaktu(a.email) }
}
```

- [ ] **Krok 5: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka/naglowki.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 6: Commit**

```bash
git add lib/skrzynka/naglowki.ts lib/skrzynka/kontakty.ts lib/skrzynka/naglowki.test.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): odczyt naglowkow watku, adresow i organizacji z domeny

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 3: Szyfr tokenu i podpisany `state`

**Pliki:** nowe `lib/skrzynka/szyfr.ts`, `lib/skrzynka/stanOauth.ts`, test `lib/skrzynka/szyfr.test.ts`

**Interfejsy:**
- Korzysta z: `SKRZYNKA_KLUCZ`, `DECK_SESSION_SECRET`.
- Daje: `zaszyfruj(tekst): string`, `odszyfruj(szyfrogram): string` (rzuca przy zmienionym szyfrogramie albo innym kluczu), `podpiszStan(uid): Promise<string>`, `sprawdzStan(stan, uid): Promise<boolean>`.

- [ ] **Krok 1: Test**

```ts
// @vitest-environment node
// node:crypto i jose - moduły tylko serwerowe.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'

const klucz = () => randomBytes(32).toString('base64')

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('SKRZYNKA_KLUCZ', klucz())
  vi.stubEnv('DECK_SESSION_SECRET', 'sekret-testowy-o-dlugosci-32-znakow!!')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('szyfr', () => {
  it('szyfruje i odszyfrowuje; ten sam tekst daje różne szyfrogramy', async () => {
    const { zaszyfruj, odszyfruj } = await import('@/lib/skrzynka/szyfr')
    const a = zaszyfruj('1//refresh-token')
    expect(a).not.toContain('refresh')
    expect(zaszyfruj('1//refresh-token')).not.toBe(a)
    expect(odszyfruj(a)).toBe('1//refresh-token')
  })

  it('zmieniony bajt albo inny klucz - wyjątek, nie śmieci', async () => {
    const { zaszyfruj, odszyfruj } = await import('@/lib/skrzynka/szyfr')
    const a = Buffer.from(zaszyfruj('token'), 'base64')
    a[a.length - 1] ^= 1
    expect(() => odszyfruj(a.toString('base64'))).toThrow()
    const b = zaszyfruj('token')
    vi.stubEnv('SKRZYNKA_KLUCZ', klucz())
    expect(() => odszyfruj(b)).toThrow()
  })

  it('klucz o złej długości - wyjątek', async () => {
    vi.stubEnv('SKRZYNKA_KLUCZ', Buffer.from('za krótki').toString('base64'))
    const { zaszyfruj } = await import('@/lib/skrzynka/szyfr')
    expect(() => zaszyfruj('x')).toThrow(/32 bajty/)
  })
})

describe('stan OAuth', () => {
  it('ważny dla tego samego konta, nie dla innego ani dla śmieci', async () => {
    const { podpiszStan, sprawdzStan } = await import('@/lib/skrzynka/stanOauth')
    const s = await podpiszStan('uid-1')
    expect(await sprawdzStan(s, 'uid-1')).toBe(true)
    expect(await sprawdzStan(s, 'uid-2')).toBe(false)
    expect(await sprawdzStan('smieci', 'uid-1')).toBe(false)
  })

  it('wygasa po 10 minutach', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'))
    const { podpiszStan, sprawdzStan } = await import('@/lib/skrzynka/stanOauth')
    const s = await podpiszStan('uid-1')
    vi.setSystemTime(new Date('2026-10-14T10:11:00Z'))
    expect(await sprawdzStan(s, 'uid-1')).toBe(false)
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/szyfr.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `lib/skrzynka/szyfr.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Refresh token kontakt@ daje pełny dostęp do poczty, więc w Firestore leży
 * zaszyfrowany kluczem spoza bazy. Sam wyciek bazy go nie zdradza.
 * Format: base64(iv 12 B | tag 16 B | szyfrogram).
 */
function klucz(): Buffer {
  const k = Buffer.from(process.env.SKRZYNKA_KLUCZ ?? '', 'base64')
  if (k.length !== 32) throw new Error('SKRZYNKA_KLUCZ musi mieć 32 bajty w base64')
  return k
}

export function zaszyfruj(tekst: string): string {
  const iv = randomBytes(12)
  const szyfr = createCipheriv('aes-256-gcm', klucz(), iv)
  const dane = Buffer.concat([szyfr.update(tekst, 'utf8'), szyfr.final()])
  return Buffer.concat([iv, szyfr.getAuthTag(), dane]).toString('base64')
}

export function odszyfruj(szyfrogram: string): string {
  const b = Buffer.from(szyfrogram, 'base64')
  const deszyfr = createDecipheriv('aes-256-gcm', klucz(), b.subarray(0, 12))
  deszyfr.setAuthTag(b.subarray(12, 28))
  return Buffer.concat([deszyfr.update(b.subarray(28)), deszyfr.final()]).toString('utf8')
}
```

- [ ] **Krok 4: `lib/skrzynka/stanOauth.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose'

const CEL = 'skrzynka-oauth'

function sekret(): Uint8Array {
  const s = process.env.DECK_SESSION_SECRET ?? ''
  if (s.length < 32) throw new Error('DECK_SESSION_SECRET musi mieć co najmniej 32 znaki')
  return new TextEncoder().encode(s)
}

/** `state` zgody Google: podpisany, krótko ważny i związany z kontem, które zaczęło łączenie - chroni przed podrzuceniem cudzego kodu. */
export async function podpiszStan(uid: string): Promise<string> {
  return new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setAudience(CEL).setIssuedAt().setExpirationTime('10m').sign(sekret())
}

export async function sprawdzStan(stan: string, uid: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(stan, sekret(), { audience: CEL })
    return payload.uid === uid
  } catch {
    return false
  }
}
```

- [ ] **Krok 5: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka/szyfr.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 6: Commit**

```bash
git add lib/skrzynka/szyfr.ts lib/skrzynka/stanOauth.ts lib/skrzynka/szyfr.test.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): szyfrowanie tokenu i podpisany state zgody Google

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 4: Klient OAuth i Gmaila

**Pliki:** nowy `lib/skrzynka/google.ts`, test `lib/skrzynka/google.test.ts`

**Interfejsy:**
- Korzysta z: `WatekApi` (zadanie 2); `SKRZYNKA_CLIENT_ID`, `SKRZYNKA_CLIENT_SECRET`, `SKRZYNKA_ADRES`.
- Daje: `RodzajBledu = 'rozlaczona' | 'historia-za-stara' | 'brak-watku' | 'konfiguracja' | 'inny'`, `class BladSkrzynki { rodzaj }`, `komunikatBledu(e): { status: number; error: string }`, `adresZgody(stan, email): string`, `wymienKod(kod): Promise<{ refreshToken; dostep }>`, `interface Gmail { profil; watek; listaWatkow; historia; obserwuj }`, `gmail(refreshToken, dostep?): Gmail`.

- [ ] **Krok 1: Test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BladSkrzynki, adresZgody, gmail, komunikatBledu, wymienKod } from '@/lib/skrzynka/google'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const fetchMock = vi.fn()
const odp = (status: number, dane: unknown) => new Response(typeof dane === 'string' ? dane : JSON.stringify(dane), { status })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('SKRZYNKA_CLIENT_ID', 'klient.apps.googleusercontent.com')
  vi.stubEnv('SKRZYNKA_CLIENT_SECRET', 'sekret')
  vi.stubEnv('SKRZYNKA_ADRES', 'https://ssuew-analytics.vercel.app/')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** Google: token zawsze, a na Gmaila odpowiada `api(url)`. */
function google(api: (url: string) => Response = () => odp(200, {})) {
  fetchMock.mockImplementation(async (url: string) =>
    url === TOKEN_URL ? odp(200, { access_token: 'dostep-1', expires_in: 3600 }) : api(url),
  )
}
const wywolaniaTokenu = () => fetchMock.mock.calls.filter(([u]) => u === TOKEN_URL)

describe('zgoda i wymiana kodu', () => {
  it('adres zgody: offline, zgoda wymuszona, oba zakresy, stały adres powrotu', () => {
    const u = new URL(adresZgody('STAN', 'kontakt@samorzad.ue.wroc.pl'))
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: 'klient.apps.googleusercontent.com',
      redirect_uri: 'https://ssuew-analytics.vercel.app/api/skrzynka/oauth',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      login_hint: 'kontakt@samorzad.ue.wroc.pl',
      state: 'STAN',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
    })
  })

  it('bez konfiguracji - BladSkrzynki konfiguracja', () => {
    vi.stubEnv('SKRZYNKA_CLIENT_SECRET', '')
    expect(() => adresZgody('s', 'e')).toThrow(BladSkrzynki)
  })

  it('wymiana kodu zwraca refresh token; bez niego - błąd', async () => {
    fetchMock.mockResolvedValueOnce(odp(200, { access_token: 'a', refresh_token: 'r', expires_in: 3600 }))
    expect(await wymienKod('KOD')).toEqual({ refreshToken: 'r', dostep: 'a' })
    const cialo = new URLSearchParams(fetchMock.mock.calls[0][1].body)
    expect(Object.fromEntries(cialo)).toMatchObject({ grant_type: 'authorization_code', code: 'KOD', redirect_uri: 'https://ssuew-analytics.vercel.app/api/skrzynka/oauth' })
    fetchMock.mockResolvedValueOnce(odp(200, { access_token: 'a', expires_in: 3600 }))
    await expect(wymienKod('KOD')).rejects.toBeInstanceOf(BladSkrzynki)
  })
})

describe('klient Gmaila', () => {
  it('odświeża token raz i używa go ponownie', async () => {
    google(() => odp(200, { emailAddress: 'kontakt@samorzad.ue.wroc.pl', historyId: '9' }))
    const g = gmail('refresh-1')
    await g.profil()
    await g.profil()
    expect(wywolaniaTokenu()).toHaveLength(1)
    expect(Object.fromEntries(new URLSearchParams(wywolaniaTokenu()[0][1].body))).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'refresh-1' })
    expect(fetchMock.mock.calls.at(-1)![1].headers.Authorization).toBe('Bearer dostep-1')
  })

  it('token z wymiany kodu nie wymaga odświeżania', async () => {
    google(() => odp(200, { emailAddress: 'x', historyId: '1' }))
    await gmail('r', 'dostep-z-kodu').profil()
    expect(wywolaniaTokenu()).toHaveLength(0)
  })

  it('wątek: format metadata z listą nagłówków; lista i historia z parametrami', async () => {
    google(() => odp(200, {}))
    const g = gmail('r', 'd')
    await g.watek('abc')
    const u1 = new URL(fetchMock.mock.calls.at(-1)![0])
    expect(u1.pathname).toBe('/gmail/v1/users/me/threads/abc')
    expect(u1.searchParams.get('format')).toBe('metadata')
    expect(u1.searchParams.getAll('metadataHeaders')).toEqual(['From', 'To', 'Cc', 'Subject', 'List-Unsubscribe', 'Precedence'])
    await g.listaWatkow('newer_than:365d', 'STRONA')
    const u2 = new URL(fetchMock.mock.calls.at(-1)![0])
    expect(Object.fromEntries(u2.searchParams)).toEqual({ q: 'newer_than:365d', maxResults: '100', pageToken: 'STRONA' })
    await g.historia('123', null)
    const u3 = new URL(fetchMock.mock.calls.at(-1)![0])
    expect(Object.fromEntries(u3.searchParams)).toEqual({ startHistoryId: '123', historyTypes: 'messageAdded' })
  })

  it('obserwacja: tylko Odebrane i Wysłane', async () => {
    google(() => odp(200, { historyId: '5', expiration: '1792000000000' }))
    await gmail('r', 'd').obserwuj('projects/deck-samorzad/topics/skrzynka')
    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/watch')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ topicName: 'projects/deck-samorzad/topics/skrzynka', labelIds: ['INBOX', 'SENT'], labelFilterBehavior: 'include' })
  })

  it('błędy: odwołany token, 401, za stara historia, brak wątku, inne', async () => {
    fetchMock.mockResolvedValueOnce(odp(400, { error: 'invalid_grant' }))
    await expect(gmail('r').profil()).rejects.toMatchObject({ rodzaj: 'rozlaczona' })

    const przypadki: [string, (url: string) => Response, string][] = [
      ['profil', () => odp(401, 'unauthorized'), 'rozlaczona'],
      ['historia', () => odp(404, 'not found'), 'historia-za-stara'],
      ['watek', () => odp(404, 'not found'), 'brak-watku'],
      ['profil', () => odp(500, 'backend'), 'inny'],
    ]
    for (const [metoda, api, rodzaj] of przypadki) {
      google(api)
      const g = gmail('r', 'd')
      const wynik = metoda === 'historia' ? g.historia('1', null) : metoda === 'watek' ? g.watek('t') : g.profil()
      await expect(wynik).rejects.toMatchObject({ rodzaj })
    }
  })

  it('komunikaty błędów dla tras', () => {
    expect(komunikatBledu(new BladSkrzynki('rozlaczona', 'x'))).toEqual({ status: 409, error: 'Skrzynka jest rozłączona - połącz ją ponownie.' })
    expect(komunikatBledu(new BladSkrzynki('konfiguracja', 'x')).status).toBe(500)
    expect(komunikatBledu(new Error('?')).status).toBe(502)
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/google.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `lib/skrzynka/google.ts`**

```ts
import type { WatekApi } from './naglowki'

const ZAKRESY = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const NAGLOWKI_META = ['From', 'To', 'Cc', 'Subject', 'List-Unsubscribe', 'Precedence']

export type RodzajBledu = 'rozlaczona' | 'historia-za-stara' | 'brak-watku' | 'konfiguracja' | 'inny'

export class BladSkrzynki extends Error {
  readonly rodzaj: RodzajBledu
  constructor(rodzaj: RodzajBledu, wiadomosc: string) {
    super(wiadomosc)
    this.name = 'BladSkrzynki'
    this.rodzaj = rodzaj
  }
}

/** Ludzki komunikat i status dla tras. Szczegóły z Google idą tylko do logów. */
export function komunikatBledu(e: unknown): { status: number; error: string } {
  if (e instanceof BladSkrzynki && e.rodzaj === 'rozlaczona') return { status: 409, error: 'Skrzynka jest rozłączona - połącz ją ponownie.' }
  if (e instanceof BladSkrzynki && e.rodzaj === 'konfiguracja') return { status: 500, error: 'Skrzynka nie jest skonfigurowana na serwerze.' }
  console.error('[skrzynka]', e)
  return { status: 502, error: 'Gmail nie odpowiedział - spróbuj ponownie.' }
}

function konfiguracja() {
  const id = process.env.SKRZYNKA_CLIENT_ID
  const sekret = process.env.SKRZYNKA_CLIENT_SECRET
  const adres = process.env.SKRZYNKA_ADRES
  if (!id || !sekret || !adres) throw new BladSkrzynki('konfiguracja', 'Brak SKRZYNKA_CLIENT_ID, SKRZYNKA_CLIENT_SECRET albo SKRZYNKA_ADRES')
  return { id, sekret, przekierowanie: `${adres.replace(/\/+$/, '')}/api/skrzynka/oauth` }
}

export function adresZgody(stan: string, email: string): string {
  const k = konfiguracja()
  const p = new URLSearchParams({
    client_id: k.id,
    redirect_uri: k.przekierowanie,
    response_type: 'code',
    scope: ZAKRESY.join(' '),
    // offline + consent: tylko tak Google za każdym razem oddaje refresh token.
    access_type: 'offline',
    prompt: 'consent',
    login_hint: email,
    state: stan,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

async function token(cialo: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(cialo),
    cache: 'no-store',
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || typeof d.access_token !== 'string') {
    throw new BladSkrzynki(d.error === 'invalid_grant' ? 'rozlaczona' : 'inny', `Token Google ${res.status}: ${d.error ?? ''}`)
  }
  return d
}

export async function wymienKod(kod: string): Promise<{ refreshToken: string; dostep: string }> {
  const k = konfiguracja()
  const d = await token({ grant_type: 'authorization_code', code: kod, client_id: k.id, client_secret: k.sekret, redirect_uri: k.przekierowanie })
  if (!d.refresh_token) throw new BladSkrzynki('inny', 'Google nie zwrócił refresh tokenu')
  return { refreshToken: d.refresh_token, dostep: d.access_token }
}

export interface Gmail {
  profil(): Promise<{ emailAddress: string; historyId: string }>
  watek(id: string): Promise<WatekApi>
  listaWatkow(zapytanie: string, strona: string | null): Promise<{ threads?: { id: string }[]; nextPageToken?: string; resultSizeEstimate?: number }>
  historia(od: string, strona: string | null): Promise<{
    history?: { messagesAdded?: { message: { threadId: string } }[] }[]
    nextPageToken?: string
    historyId: string
  }>
  obserwuj(temat: string): Promise<{ historyId: string; expiration: string }>
}

const parametry = (p: Record<string, string | string[] | null>) => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v === null) continue
    for (const x of [v].flat()) u.append(k, x)
  }
  return u.toString()
}

/** Klient Gmaila na refresh tokenie kontakt@. Token dostępu żyje w domknięciu - jeden klient na jedno wywołanie trasy. */
export function gmail(refreshToken: string, dostep?: string): Gmail {
  let biezacy = dostep ? { wartosc: dostep, wygasa: Date.now() + 50 * 60_000 } : null

  async function tokenDostepu(): Promise<string> {
    if (biezacy && biezacy.wygasa > Date.now()) return biezacy.wartosc
    const k = konfiguracja()
    const d = await token({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: k.id, client_secret: k.sekret })
    biezacy = { wartosc: d.access_token, wygasa: Date.now() + (d.expires_in - 300) * 1000 }
    return biezacy.wartosc
  }

  async function wywolaj<T>(sciezka: string, cialo?: unknown): Promise<T> {
    const naglowki: Record<string, string> = { Authorization: `Bearer ${await tokenDostepu()}` }
    if (cialo !== undefined) naglowki['Content-Type'] = 'application/json'
    const res = await fetch(`${GMAIL}${sciezka}`, {
      method: cialo === undefined ? 'GET' : 'POST',
      headers: naglowki,
      body: cialo === undefined ? undefined : JSON.stringify(cialo),
      cache: 'no-store',
    })
    if (!res.ok) {
      const tresc = await res.text().catch(() => '')
      if (res.status === 401) throw new BladSkrzynki('rozlaczona', `Gmail 401: ${tresc.slice(0, 200)}`)
      if (res.status === 404 && sciezka.startsWith('/history')) throw new BladSkrzynki('historia-za-stara', 'Punkt historii Gmaila jest za stary')
      if (res.status === 404) throw new BladSkrzynki('brak-watku', `Gmail 404: ${sciezka}`)
      throw new BladSkrzynki('inny', `Gmail ${res.status}: ${tresc.slice(0, 300)}`)
    }
    return res.json() as Promise<T>
  }

  return {
    profil: () => wywolaj('/profile'),
    watek: (id) => wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'metadata', metadataHeaders: NAGLOWKI_META })}`),
    listaWatkow: (zapytanie, strona) => wywolaj(`/threads?${parametry({ q: zapytanie, maxResults: '100', pageToken: strona })}`),
    historia: (od, strona) => wywolaj(`/history?${parametry({ startHistoryId: od, historyTypes: 'messageAdded', pageToken: strona })}`),
    // Tylko Odebrane i Wysłane - przeczytanie maila czy zmiana etykiety nie budzą serwera.
    obserwuj: (temat) => wywolaj('/watch', { topicName: temat, labelIds: ['INBOX', 'SENT'], labelFilterBehavior: 'include' }),
  }
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka/google.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/skrzynka/google.ts lib/skrzynka/google.test.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): klient OAuth i Gmail API z rozpoznawaniem rozlaczenia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 5: Weryfikacja powiadomień push

**Pliki:** nowy `lib/skrzynka/push.ts`, test `lib/skrzynka/push.test.ts`

**Interfejsy:**
- Korzysta z: `createRemoteJWKSet`, `jwtVerify` (`jose`); `SKRZYNKA_PUSH_KONTO`, `SKRZYNKA_ADRES`.
- Daje: `zweryfikujPush(naglowekAuthorization: string | null): Promise<boolean>`.

- [ ] **Krok 1: Test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const jwtVerify = vi.fn()
vi.mock('jose', () => ({ jwtVerify: (...a: unknown[]) => jwtVerify(...a), createRemoteJWKSet: () => 'jwks' }))

const KONTO = 'skrzynka-push@deck-samorzad.iam.gserviceaccount.com'

beforeEach(() => {
  vi.resetModules()
  jwtVerify.mockReset()
  vi.stubEnv('SKRZYNKA_PUSH_KONTO', KONTO)
  vi.stubEnv('SKRZYNKA_ADRES', 'https://ssuew-analytics.vercel.app')
})
afterEach(() => vi.unstubAllEnvs())

describe('zweryfikujPush', () => {
  it('przyjmuje token Google z właściwym odbiorcą i kontem', async () => {
    jwtVerify.mockResolvedValue({ payload: { email: KONTO, email_verified: true } })
    const { zweryfikujPush } = await import('@/lib/skrzynka/push')
    expect(await zweryfikujPush('Bearer abc')).toBe(true)
    expect(jwtVerify.mock.calls[0][0]).toBe('abc')
    expect(jwtVerify.mock.calls[0][2]).toEqual({
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: 'https://ssuew-analytics.vercel.app/api/skrzynka/push',
    })
  })

  it('obce konto, niezweryfikowany adres, zły podpis, brak nagłówka', async () => {
    const { zweryfikujPush } = await import('@/lib/skrzynka/push')
    jwtVerify.mockResolvedValueOnce({ payload: { email: 'obcy@x.iam.gserviceaccount.com', email_verified: true } })
    expect(await zweryfikujPush('Bearer abc')).toBe(false)
    jwtVerify.mockResolvedValueOnce({ payload: { email: KONTO, email_verified: false } })
    expect(await zweryfikujPush('Bearer abc')).toBe(false)
    jwtVerify.mockRejectedValueOnce(new Error('signature'))
    expect(await zweryfikujPush('Bearer abc')).toBe(false)
    expect(await zweryfikujPush(null)).toBe(false)
    expect(await zweryfikujPush('Basic abc')).toBe(false)
  })

  it('bez konfiguracji - odmowa bez pytania Google', async () => {
    vi.stubEnv('SKRZYNKA_PUSH_KONTO', '')
    const { zweryfikujPush } = await import('@/lib/skrzynka/push')
    expect(await zweryfikujPush('Bearer abc')).toBe(false)
    expect(jwtVerify).not.toHaveBeenCalled()
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/push.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `lib/skrzynka/push.ts`**

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose'

const CERTYFIKATY = 'https://www.googleapis.com/oauth2/v3/certs'
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

/**
 * Pub/Sub podpisuje każde powiadomienie tokenem OIDC Google. Sprawdzamy
 * podpis, wystawcę, odbiorcę (adres naszej trasy) i konto subskrypcji -
 * bez tego każdy mógłby wywoływać synchronizację.
 */
export async function zweryfikujPush(naglowek: string | null): Promise<boolean> {
  const konto = process.env.SKRZYNKA_PUSH_KONTO
  const adres = process.env.SKRZYNKA_ADRES
  const token = naglowek?.startsWith('Bearer ') ? naglowek.slice('Bearer '.length) : ''
  if (!konto || !adres || !token) return false
  jwks ??= createRemoteJWKSet(new URL(CERTYFIKATY))
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: `${adres.replace(/\/+$/, '')}/api/skrzynka/push`,
    })
    return payload.email === konto && payload.email_verified === true
  } catch {
    return false
  }
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka/push.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/skrzynka/push.ts lib/skrzynka/push.test.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): weryfikacja tokenu OIDC powiadomien Pub/Sub

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 6: Firestore - stan, dzierżawa, sprawy, liczniki

**Pliki:** zmiana `lib/firebase/admin.ts`; nowy `lib/skrzynka/dane.ts`, test `lib/skrzynka/dane.test.ts`

**Interfejsy:**
- Korzysta z: typy (zadanie 1), `progAlarmu` (zadanie 1).
- Daje: w `admin.ts`: `skrzynkaStanRef()`, `skrzynkaUstawieniaRef()`, `sprawyRef()`, `kontaktyRef()`, `organizacjeRef()`; w `dane.ts`: `interface StanSkrzynki`, `DZIERZAWA_MS`, `czytajStan(): Promise<StanSkrzynki | null>`, `zapiszStan(zmiany: Partial<StanSkrzynki>)`, `wezDzierzawe(teraz): Promise<boolean>`, `zwolnijDzierzawe(teraz): Promise<boolean>` (true = trzeba jeszcze jednej rundy), `czytajSprawy(ids): Promise<Map<string, Sprawa>>`, `zapiszWynik({ sprawy, kontakty, organizacje })`, `pomijane(): Promise<{ adresy: string[]; domeny: string[] }>`, `liczniki(teraz): Promise<LicznikiSkrzynki>`.

- [ ] **Krok 1: Test z bazą w pamięci**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Sprawa } from '@/lib/skrzynka/typy'

/** Firestore w pamięci - tylko to, czego używa `dane.ts`. */
const { baza, admin } = vi.hoisted(() => {
  const baza = new Map<string, Record<string, unknown>>()
  const snap = (s: string) => ({ id: s.split('/').pop()!, exists: baza.has(s), data: () => baza.get(s) })
  const zapisz = (s: string, d: Record<string, unknown>, scal?: boolean) => baza.set(s, scal ? { ...baza.get(s), ...d } : { ...d })
  type Ref = { sciezka: string }
  const firestore = {
    getAll: async (...refs: Ref[]) => refs.map((r) => snap(r.sciezka)),
    batch: () => {
      const ops: (() => void)[] = []
      return {
        set: (r: Ref, d: Record<string, unknown>, o?: { merge?: boolean }) => ops.push(() => zapisz(r.sciezka, d, o?.merge)),
        commit: async () => ops.forEach((f) => f()),
      }
    },
    runTransaction: async <T,>(f: (t: unknown) => Promise<T>) =>
      f({
        get: async (r: Ref) => snap(r.sciezka),
        set: (r: Ref, d: Record<string, unknown>, o?: { merge?: boolean }) => zapisz(r.sciezka, d, o?.merge),
        update: (r: Ref, d: Record<string, unknown>) => zapisz(r.sciezka, d, true),
      }),
  }
  const dok = (sciezka: string) => ({
    sciezka,
    firestore,
    get: async () => snap(sciezka),
    set: async (d: Record<string, unknown>, o?: { merge?: boolean }) => zapisz(sciezka, d, o?.merge),
  })
  const porownaj = (a: unknown, op: string, b: unknown) =>
    op === '==' ? a === b : op === '<' ? typeof a === 'number' && a < (b as number) : false
  const kolekcja = (nazwa: string) => ({
    firestore,
    doc: (id: string) => dok(`${nazwa}/${id}`),
    where: (pole: string, op: string, wartosc: unknown) => ({
      count: () => ({
        get: async () => ({
          data: () => ({
            count: [...baza].filter(([k, v]) => k.startsWith(`${nazwa}/`) && porownaj(v[pole], op, wartosc)).length,
          }),
        }),
      }),
    }),
  })
  return {
    baza,
    admin: {
      skrzynkaStanRef: () => dok('skrzynka/stan'),
      skrzynkaUstawieniaRef: () => dok('skrzynka/ustawienia'),
      sprawyRef: () => kolekcja('skrzynkaSprawy'),
      kontaktyRef: () => kolekcja('skrzynkaKontakty'),
      organizacjeRef: () => kolekcja('skrzynkaOrganizacje'),
    },
  }
})
vi.mock('@/lib/firebase/admin', () => admin)

import { czytajSprawy, czytajStan, liczniki, pomijane, wezDzierzawe, zapiszStan, zapiszWynik, zwolnijDzierzawe } from '@/lib/skrzynka/dane'

const sprawa = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
  id, temat: 'T', status: 'do-odpowiedzi', oczekujeOd: 100, nowa: true, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
  ostatnia: { kiedy: 100, kierunek: 'oni', fragment: 'f' }, wiadomosci: 1, przypisana: null, kategoriaGmail: null, zmieniono: 1, ...n,
})

beforeEach(() => baza.clear())

describe('stan', () => {
  it('bez dokumentu null; zapis scala pola; import i liczby z wartościami domyślnymi', async () => {
    expect(await czytajStan()).toBeNull()
    await zapiszStan({ email: 'kontakt@x', token: 'enc', polaczona: true, historyId: '7' })
    await zapiszStan({ ostatniaSynchronizacja: 5 })
    expect(await czytajStan()).toEqual({
      email: 'kontakt@x', token: 'enc', historyId: '7', watchWygasa: null, ostatniaSynchronizacja: 5,
      dzierzawaDo: 0, doPowtorki: false, polaczona: true, import: { trwa: false, zrobione: 0, razem: 0 },
    })
  })
})

describe('dzierżawa synchronizacji', () => {
  beforeEach(() => zapiszStan({ token: 'enc', polaczona: true }))

  it('druga synchronizacja w trakcie zgłasza powtórkę; pierwsza robi wtedy jeszcze rundę', async () => {
    expect(await wezDzierzawe(1_000)).toBe(true)
    expect(await wezDzierzawe(2_000)).toBe(false)
    expect(await zwolnijDzierzawe(3_000)).toBe(true)
    expect(baza.get('skrzynka/stan')).toMatchObject({ doPowtorki: false, dzierzawaDo: 63_000 })
    expect(await zwolnijDzierzawe(4_000)).toBe(false)
    expect(baza.get('skrzynka/stan')).toMatchObject({ dzierzawaDo: 0 })
  })

  it('przeterminowana dzierżawa nie blokuje', async () => {
    expect(await wezDzierzawe(1_000)).toBe(true)
    expect(await wezDzierzawe(1_000 + 61_000)).toBe(true)
  })
})

describe('sprawy, kontakty, organizacje', () => {
  it('zapis i odczyt sprawy po id wątku; brak - nie ma w mapie', async () => {
    await zapiszWynik({ sprawy: [sprawa('t1')], kontakty: [], organizacje: [] })
    const m = await czytajSprawy(['t1', 't2'])
    expect(m.get('t1')).toEqual(sprawa('t1'))
    expect(m.has('t2')).toBe(false)
    expect((await czytajSprawy([])).size).toBe(0)
  })

  it('nie nadpisuje nazwy i typu organizacji ani znanego imienia kontaktu', async () => {
    baza.set('skrzynkaOrganizacje/firma.pl', { domena: 'firma.pl', nazwa: 'Firma S.A.', typ: 'sponsor' })
    baza.set('skrzynkaKontakty/anna@firma.pl', { email: 'anna@firma.pl', imie: 'Anna Kowalska', organizacja: 'firma.pl', typ: null })
    await zapiszWynik({
      sprawy: [],
      kontakty: [{ email: 'anna@firma.pl', imie: '', organizacja: 'firma.pl', typ: null }, { email: 'jan@nowa.pl', imie: 'Jan', organizacja: 'nowa.pl', typ: null }],
      organizacje: [{ domena: 'firma.pl', nazwa: 'firma.pl', typ: 'inne' }, { domena: 'nowa.pl', nazwa: 'nowa.pl', typ: 'inne' }, { domena: 'nowa.pl', nazwa: 'nowa.pl', typ: 'inne' }],
    })
    expect(baza.get('skrzynkaOrganizacje/firma.pl')).toEqual({ domena: 'firma.pl', nazwa: 'Firma S.A.', typ: 'sponsor' })
    expect(baza.get('skrzynkaOrganizacje/nowa.pl')).toEqual({ domena: 'nowa.pl', nazwa: 'nowa.pl', typ: 'inne' })
    expect(baza.get('skrzynkaKontakty/anna@firma.pl')).toMatchObject({ imie: 'Anna Kowalska' })
    expect(baza.get('skrzynkaKontakty/jan@nowa.pl')).toMatchObject({ imie: 'Jan' })
  })

  it('pomijane adresy i domeny małymi literami; bez dokumentu puste', async () => {
    expect(await pomijane()).toEqual({ adresy: [], domeny: [] })
    baza.set('skrzynka/ustawienia', { pomijaneAdresy: ['News@Sklep.pl', 5], pomijaneDomeny: ['Reklama.pl'] })
    expect(await pomijane()).toEqual({ adresy: ['news@sklep.pl'], domeny: ['reklama.pl'] })
  })
})

describe('liczniki', () => {
  it('bez połączenia - stan brak', async () => {
    expect((await liczniki(0)).stan).toBe('brak')
  })

  it('liczy statusy i sprawy po terminie; rozłączona zachowuje liczby', async () => {
    const wtorek = Date.UTC(2026, 9, 20, 8)
    await zapiszStan({ token: 'enc', polaczona: false, ostatniaSynchronizacja: 9 })
    await zapiszWynik({
      sprawy: [
        sprawa('a', { oczekujeOd: Date.UTC(2026, 9, 14, 13) }),
        sprawa('b', { oczekujeOd: Date.UTC(2026, 9, 16, 7) }),
        sprawa('c', { status: 'do-przejrzenia', oczekujeOd: null }),
        sprawa('d', { status: 'czeka-na-nich', oczekujeOd: null }),
        sprawa('e', { status: 'w-toku', oczekujeOd: null }),
      ],
      kontakty: [],
      organizacje: [],
    })
    expect(await liczniki(wtorek)).toEqual({
      stan: 'rozlaczona', doOdpowiedzi: 2, poTerminie: 1, doPrzejrzenia: 1, czekaNaNich: 1, wToku: 1, ostatniaSynchronizacja: 9,
    })
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/dane.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: Kolekcje na końcu `lib/firebase/admin.ts`**

```ts
/** Skrzynka kontakt@: stan połączenia (z zaszyfrowanym tokenem) i ustawienia. Tylko serwer - reguła końcowa. */
export function skrzynkaStanRef() {
  return bazaAdmin().collection('skrzynka').doc('stan')
}

export function skrzynkaUstawieniaRef() {
  return bazaAdmin().collection('skrzynka').doc('ustawienia')
}

/** Sprawy (wątki Gmaila), kontakty i organizacje - tylko serwer; reguła końcowa zamyka je przed przeglądarką. */
export function sprawyRef() {
  return bazaAdmin().collection('skrzynkaSprawy')
}

export function kontaktyRef() {
  return bazaAdmin().collection('skrzynkaKontakty')
}

export function organizacjeRef() {
  return bazaAdmin().collection('skrzynkaOrganizacje')
}
```

- [ ] **Krok 4: `lib/skrzynka/dane.ts`**

```ts
import type { DocumentData } from 'firebase-admin/firestore'
import { kontaktyRef, organizacjeRef, skrzynkaStanRef, skrzynkaUstawieniaRef, sprawyRef } from '@/lib/firebase/admin'
import { progAlarmu } from './statusy'
import { STATUSY, type Kontakt, type LicznikiSkrzynki, type Organizacja, type PostepImportu, type Sprawa, type Status } from './typy'

export const DZIERZAWA_MS = 60_000
/** Limit partii Firestore to 500 zapisów - zostawiamy zapas. */
const PARTIA = 400

export interface StanSkrzynki {
  email: string
  /** Refresh token zaszyfrowany `szyfr.ts`. */
  token: string
  historyId: string | null
  watchWygasa: number | null
  ostatniaSynchronizacja: number | null
  dzierzawaDo: number
  doPowtorki: boolean
  polaczona: boolean
  import: PostepImportu
}

const liczba = (x: unknown) => Number(x) || 0

export async function czytajStan(): Promise<StanSkrzynki | null> {
  const d = (await skrzynkaStanRef().get()).data()
  if (!d || typeof d.token !== 'string') return null
  return {
    email: String(d.email ?? ''),
    token: d.token,
    historyId: typeof d.historyId === 'string' ? d.historyId : null,
    watchWygasa: liczba(d.watchWygasa) || null,
    ostatniaSynchronizacja: liczba(d.ostatniaSynchronizacja) || null,
    dzierzawaDo: liczba(d.dzierzawaDo),
    doPowtorki: d.doPowtorki === true,
    polaczona: d.polaczona === true,
    import: { trwa: d.import?.trwa === true, zrobione: liczba(d.import?.zrobione), razem: liczba(d.import?.razem) },
  }
}

export async function zapiszStan(zmiany: Partial<StanSkrzynki>): Promise<void> {
  await skrzynkaStanRef().set(zmiany, { merge: true })
}

/**
 * Jedna synchronizacja naraz. Gdy dzierżawa jest zajęta, zostawiamy
 * zgłoszenie `doPowtorki` - trwająca synchronizacja zrobi wtedy jeszcze
 * jedną rundę i nic z kilku powiadomień naraz nie zginie.
 */
export async function wezDzierzawe(teraz: number): Promise<boolean> {
  const ref = skrzynkaStanRef()
  return ref.firestore.runTransaction(async (t) => {
    const d = (await t.get(ref)).data()
    if (d && liczba(d.dzierzawaDo) > teraz) {
      t.update(ref, { doPowtorki: true })
      return false
    }
    t.set(ref, { dzierzawaDo: teraz + DZIERZAWA_MS, doPowtorki: false }, { merge: true })
    return true
  })
}

/** `true` - w trakcie przyszło zgłoszenie, dzierżawa przedłużona na kolejną rundę. */
export async function zwolnijDzierzawe(teraz: number): Promise<boolean> {
  const ref = skrzynkaStanRef()
  return ref.firestore.runTransaction(async (t) => {
    const d = (await t.get(ref)).data()
    if (d?.doPowtorki === true) {
      t.update(ref, { doPowtorki: false, dzierzawaDo: teraz + DZIERZAWA_MS })
      return true
    }
    t.update(ref, { dzierzawaDo: 0 })
    return false
  })
}

const naStatus = (x: unknown): Status => (STATUSY.includes(x as Status) ? (x as Status) : 'do-odpowiedzi')

function naSprawe(id: string, x: DocumentData): Sprawa {
  return {
    id,
    temat: String(x.temat ?? ''),
    status: naStatus(x.status),
    oczekujeOd: typeof x.oczekujeOd === 'number' ? x.oczekujeOd : null,
    nowa: x.nowa === true,
    kontakt: typeof x.kontakt === 'string' ? x.kontakt : null,
    organizacja: typeof x.organizacja === 'string' ? x.organizacja : null,
    ostatnia: {
      kiedy: liczba(x.ostatnia?.kiedy),
      kierunek: x.ostatnia?.kierunek === 'my' ? 'my' : 'oni',
      fragment: String(x.ostatnia?.fragment ?? ''),
    },
    wiadomosci: liczba(x.wiadomosci),
    przypisana: typeof x.przypisana === 'string' ? x.przypisana : null,
    kategoriaGmail: typeof x.kategoriaGmail === 'string' ? x.kategoriaGmail : null,
    zmieniono: liczba(x.zmieniono),
  }
}

export async function czytajSprawy(ids: string[]): Promise<Map<string, Sprawa>> {
  const wynik = new Map<string, Sprawa>()
  if (!ids.length) return wynik
  const kol = sprawyRef()
  const migawki = await kol.firestore.getAll(...ids.map((id) => kol.doc(id)))
  for (const m of migawki) {
    const d = m.data()
    if (m.exists && d) wynik.set(m.id, naSprawe(m.id, d))
  }
  return wynik
}

/**
 * Zapis wyniku synchronizacji. Organizacje tylko nowe - nazwę i typ
 * właściciel poprawia ręcznie. Kontakt bez imienia nie kasuje znanego.
 */
export async function zapiszWynik(w: { sprawy: Sprawa[]; kontakty: Kontakt[]; organizacje: Organizacja[] }): Promise<void> {
  const sprawy = sprawyRef()
  const kontakty = kontaktyRef()
  const organizacje = organizacjeRef()
  const baza = sprawy.firestore
  const orgUnikalne = [...new Map(w.organizacje.map((o) => [o.domena, o])).values()]
  const istniejace = orgUnikalne.length ? await baza.getAll(...orgUnikalne.map((o) => organizacje.doc(o.domena))) : []
  const nowe = orgUnikalne.filter((_, i) => !istniejace[i].exists)

  const zapisy = [
    ...w.sprawy.map(({ id, ...s }) => ({ ref: sprawy.doc(id), dane: s as DocumentData, scal: false })),
    ...w.kontakty.map((k) => ({
      ref: kontakty.doc(k.email),
      dane: (k.imie ? k : { email: k.email, organizacja: k.organizacja, typ: k.typ }) as DocumentData,
      scal: true,
    })),
    ...nowe.map((o) => ({ ref: organizacje.doc(o.domena), dane: o as DocumentData, scal: false })),
  ]
  for (let i = 0; i < zapisy.length; i += PARTIA) {
    const partia = baza.batch()
    for (const z of zapisy.slice(i, i + PARTIA)) {
      if (z.scal) partia.set(z.ref, z.dane, { merge: true })
      else partia.set(z.ref, z.dane)
    }
    await partia.commit()
  }
}

export async function pomijane(): Promise<{ adresy: string[]; domeny: string[] }> {
  const d = (await skrzynkaUstawieniaRef().get()).data()
  const lista = (x: unknown) =>
    Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string').map((y) => y.toLowerCase()) : []
  return { adresy: lista(d?.pomijaneAdresy), domeny: lista(d?.pomijaneDomeny) }
}

/**
 * Liczniki kafelka - same zapytania zliczające, bez list. „Po terminie” to
 * jedno zapytanie zakresowe dzięki niezmiennikowi: `oczekujeOd` ma wartość
 * tylko w sprawach Do odpowiedzi.
 */
export async function liczniki(teraz: number): Promise<LicznikiSkrzynki> {
  const stan = await czytajStan()
  const zero = { doOdpowiedzi: 0, poTerminie: 0, doPrzejrzenia: 0, czekaNaNich: 0, wToku: 0 }
  if (!stan) return { stan: 'brak', ...zero, ostatniaSynchronizacja: null }
  const s = sprawyRef()
  const ile = (status: Status) => s.where('status', '==', status).count().get().then((x) => x.data().count)
  const [doOdpowiedzi, poTerminie, doPrzejrzenia, czekaNaNich, wToku] = await Promise.all([
    ile('do-odpowiedzi'),
    s.where('oczekujeOd', '<', progAlarmu(teraz)).count().get().then((x) => x.data().count),
    ile('do-przejrzenia'),
    ile('czeka-na-nich'),
    ile('w-toku'),
  ])
  return {
    stan: stan.polaczona ? 'polaczona' : 'rozlaczona',
    doOdpowiedzi, poTerminie, doPrzejrzenia, czekaNaNich, wToku,
    ostatniaSynchronizacja: stan.ostatniaSynchronizacja,
  }
}
```

- [ ] **Krok 5: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka/dane.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 6: Commit**

```bash
git add lib/firebase/admin.ts lib/skrzynka/dane.ts lib/skrzynka/dane.test.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): stan, dzierzawa synchronizacji, sprawy i liczniki w Firestore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 7: Synchronizacja, import i połączenie

**Pliki:** nowy `lib/skrzynka/synchronizacja.ts`, test `lib/skrzynka/synchronizacja.test.ts`

**Interfejsy:**
- Korzysta z: `gmail`, `wymienKod`, `BladSkrzynki`, `Gmail` (zadanie 4); `zaszyfruj`, `odszyfruj` (zadanie 3); wszystkie funkcje `dane.ts` (zadanie 6); `odczytajWatek` (zadanie 2); `drugaStrona`, `kontaktZAdresu`, `organizacjaZEmaila`, `domena` (zadanie 2); `ocenSprawe`, `kierunek` (zadanie 1); `DECK_OWNER_EMAIL`, `SKRZYNKA_TEMAT`.
- Daje: `ZAPYTANIE_IMPORTU`, `przetworzWatki(g, ids, { teraz, import }): Promise<number>`, `synchronizuj(teraz?): Promise<WynikSynchronizacji>`, `importujStrone(strona, teraz?): Promise<{ nastepnaStrona: string | null; zrobione: number; razem: number }>`, `polaczSkrzynke(kod): Promise<'ok' | 'inne-konto'>`, `odnowObserwacje(): Promise<void>`.

- [ ] **Krok 1: Test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WatekApi } from '@/lib/skrzynka/naglowki'
import type { Sprawa } from '@/lib/skrzynka/typy'

// vi.mock jest wynoszony nad importy - zaślepki muszą powstać w vi.hoisted, inaczej fabryka trafi na niezainicjowane stałe.
const { dane, g, wymienKod, utworzonyZ } = vi.hoisted(() => ({
  dane: {
    czytajStan: vi.fn(), zapiszStan: vi.fn(), wezDzierzawe: vi.fn(), zwolnijDzierzawe: vi.fn(),
    czytajSprawy: vi.fn(), zapiszWynik: vi.fn(), pomijane: vi.fn(),
  },
  g: { profil: vi.fn(), watek: vi.fn(), listaWatkow: vi.fn(), historia: vi.fn(), obserwuj: vi.fn() },
  wymienKod: vi.fn(),
  utworzonyZ: vi.fn(),
}))

vi.mock('@/lib/skrzynka/dane', () => dane)
vi.mock('@/lib/skrzynka/szyfr', () => ({ zaszyfruj: (t: string) => `enc:${t}`, odszyfruj: (t: string) => t.replace(/^enc:/, '') }))
vi.mock('@/lib/skrzynka/google', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/skrzynka/google')>()),
  gmail: (...a: unknown[]) => {
    utworzonyZ(...a)
    return g
  },
  wymienKod: (...a: unknown[]) => wymienKod(...a),
}))

import { importujStrone, polaczSkrzynke, przetworzWatki, synchronizuj, odnowObserwacje } from '@/lib/skrzynka/synchronizacja'
import { BladSkrzynki } from '@/lib/skrzynka/google'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'
const TERAZ = Date.UTC(2026, 9, 14, 10)

function watek(id: string, wiadomosci: [od: string, kiedy: number, doKogo?: string][]): WatekApi {
  return {
    id,
    messages: wiadomosci.map(([od, kiedy, doKogo], i) => ({
      id: `${id}-${i}`,
      internalDate: String(kiedy),
      labelIds: ['INBOX'],
      snippet: 'treść',
      payload: { headers: [{ name: 'From', value: od }, { name: 'To', value: doKogo ?? NASZ }, { name: 'Subject', value: 'Sponsoring' }] },
    })),
  }
}

const stan = (n: object = {}) => ({
  email: NASZ, token: 'enc:refresh', historyId: '100', watchWygasa: null, ostatniaSynchronizacja: null,
  dzierzawaDo: 0, doPowtorki: false, polaczona: true, import: { trwa: false, zrobione: 0, razem: 0 }, ...n,
})

beforeEach(() => {
  vi.stubEnv('DECK_OWNER_EMAIL', NASZ)
  vi.stubEnv('SKRZYNKA_TEMAT', 'projects/deck-samorzad/topics/skrzynka')
  Object.values(dane).forEach((f) => f.mockReset())
  Object.values(g).forEach((f) => f.mockReset())
  wymienKod.mockReset()
  utworzonyZ.mockReset()
  dane.czytajSprawy.mockResolvedValue(new Map())
  dane.pomijane.mockResolvedValue({ adresy: [], domeny: [] })
  dane.czytajStan.mockResolvedValue(stan())
  dane.wezDzierzawe.mockResolvedValue(true)
  dane.zwolnijDzierzawe.mockResolvedValue(false)
})
afterEach(() => vi.unstubAllEnvs())

const zapisane = () => dane.zapiszWynik.mock.calls.at(-1)![0] as { sprawy: Sprawa[]; kontakty: unknown[]; organizacje: unknown[] }

describe('przetworzWatki', () => {
  it('nowa sprawa z kontaktem i organizacją; 404 pominięte; wątek do siebie bez kontaktu', async () => {
    g.watek.mockImplementation(async (id: string) => {
      if (id === 'usuniety') throw new BladSkrzynki('brak-watku', '404')
      if (id === 'siebie') return watek(id, [[NASZ, 50, NASZ]])
      return watek(id, [['Anna <anna@firma.pl>', 100]])
    })
    expect(await przetworzWatki(g as never, ['t1', 'usuniety', 'siebie', 't1'], { teraz: TERAZ, import: false })).toBe(2)
    expect(g.watek).toHaveBeenCalledTimes(3)
    const w = zapisane()
    expect(w.sprawy[0]).toMatchObject({
      id: 't1', temat: 'Sponsoring', status: 'do-odpowiedzi', oczekujeOd: 100, nowa: true, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
      ostatnia: { kiedy: 100, kierunek: 'oni', fragment: 'treść' }, wiadomosci: 1, przypisana: null, zmieniono: TERAZ,
    })
    expect(w.sprawy[1]).toMatchObject({ id: 'siebie', kontakt: null, organizacja: null, status: 'czeka-na-nich' })
    expect(w.kontakty).toEqual([{ email: 'anna@firma.pl', imie: 'Anna', organizacja: 'firma.pl', typ: null }])
    expect(w.organizacje).toEqual([{ domena: 'firma.pl', nazwa: 'firma.pl', typ: 'inne' }])
  })

  it('zachowuje przypisanie i przechodzi statusem przez automat', async () => {
    dane.czytajSprawy.mockResolvedValue(new Map([['t1', {
      id: 't1', temat: 'Sponsoring', status: 'czeka-na-nich', oczekujeOd: null, nowa: false, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
      ostatnia: { kiedy: 100, kierunek: 'my', fragment: '' }, wiadomosci: 1, przypisana: 'Jula', kategoriaGmail: null, zmieniono: 1,
    }]]))
    g.watek.mockResolvedValue(watek('t1', [[NASZ, 100, 'anna@firma.pl'], ['anna@firma.pl', 200]]))
    await przetworzWatki(g as never, ['t1'], { teraz: TERAZ, import: false })
    expect(zapisane().sprawy[0]).toMatchObject({ status: 'do-odpowiedzi', oczekujeOd: 200, przypisana: 'Jula' })
  })

  it('pomijany adres albo domena - Pominięta', async () => {
    dane.pomijane.mockResolvedValue({ adresy: [], domeny: ['sklep.pl'] })
    g.watek.mockResolvedValue(watek('t1', [['news@sklep.pl', 100]]))
    await przetworzWatki(g as never, ['t1'], { teraz: TERAZ, import: false })
    expect(zapisane().sprawy[0].status).toBe('pominieta')
  })

  it('pusta lista - nic nie zapisuje', async () => {
    expect(await przetworzWatki(g as never, [], { teraz: TERAZ, import: false })).toBe(0)
    expect(dane.zapiszWynik).not.toHaveBeenCalled()
  })
})

describe('synchronizuj', () => {
  it('niepołączona albo zajęta - nic nie robi', async () => {
    dane.czytajStan.mockResolvedValueOnce(null)
    expect(await synchronizuj(TERAZ)).toEqual({ stan: 'niepolaczona' })
    dane.wezDzierzawe.mockResolvedValueOnce(false)
    expect(await synchronizuj(TERAZ)).toEqual({ stan: 'zajete' })
    expect(g.historia).not.toHaveBeenCalled()
  })

  it('historia od zapamiętanego punktu, zmienione wątki, nowy punkt; token odszyfrowany', async () => {
    g.historia.mockResolvedValueOnce({ history: [{ messagesAdded: [{ message: { threadId: 't1' } }] }], nextPageToken: 'p2', historyId: '150' })
    g.historia.mockResolvedValueOnce({ history: [{ messagesAdded: [{ message: { threadId: 't2' } }] }], historyId: '160' })
    g.watek.mockImplementation(async (id: string) => watek(id, [['anna@firma.pl', 100]]))
    expect(await synchronizuj(TERAZ)).toEqual({ stan: 'zrobione', watki: 2 })
    expect(utworzonyZ).toHaveBeenCalledWith('refresh')
    expect(g.historia.mock.calls).toEqual([['100', null], ['100', 'p2']])
    expect(dane.zapiszStan).toHaveBeenCalledWith(expect.objectContaining({ historyId: '160' }))
  })

  it('zgłoszenie w trakcie - druga runda od nowego punktu', async () => {
    dane.zwolnijDzierzawe.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    g.historia.mockResolvedValueOnce({ history: [], historyId: '150' }).mockResolvedValueOnce({ history: [], historyId: '170' })
    await synchronizuj(TERAZ)
    expect(g.historia.mock.calls.map((c) => c[0])).toEqual(['100', '150'])
    expect(dane.zapiszStan).toHaveBeenLastCalledWith(expect.objectContaining({ historyId: '170' }))
  })

  it('za stara historia - przegląd 30 dni i punkt z profilu', async () => {
    g.historia.mockRejectedValue(new BladSkrzynki('historia-za-stara', '404'))
    g.profil.mockResolvedValue({ emailAddress: NASZ, historyId: '999' })
    g.listaWatkow.mockResolvedValue({ threads: [{ id: 't9' }] })
    g.watek.mockResolvedValue(watek('t9', [['anna@firma.pl', 100]]))
    expect(await synchronizuj(TERAZ)).toEqual({ stan: 'zrobione', watki: 1 })
    expect(g.listaWatkow).toHaveBeenCalledWith('newer_than:30d', null)
    expect(dane.zapiszStan).toHaveBeenCalledWith(expect.objectContaining({ historyId: '999' }))
  })

  it('odwołany dostęp - stan rozłączona, dzierżawa zwolniona', async () => {
    g.historia.mockRejectedValue(new BladSkrzynki('rozlaczona', '401'))
    expect(await synchronizuj(TERAZ)).toEqual({ stan: 'rozlaczona' })
    expect(dane.zapiszStan).toHaveBeenCalledWith({ dzierzawaDo: 0 })
    expect(dane.zapiszStan).toHaveBeenCalledWith({ polaczona: false })
  })

  it('inny błąd - dzierżawa zwolniona, wyjątek dalej', async () => {
    g.historia.mockRejectedValue(new BladSkrzynki('inny', '500'))
    await expect(synchronizuj(TERAZ)).rejects.toBeInstanceOf(BladSkrzynki)
    expect(dane.zapiszStan).toHaveBeenCalledWith({ dzierzawaDo: 0 })
  })
})

describe('importujStrone', () => {
  it('strona po stronie; stare wątki do archiwum; postęp w stanie', async () => {
    g.listaWatkow.mockResolvedValueOnce({ threads: [{ id: 'stary' }, { id: 'nowy' }], nextPageToken: 'p2', resultSizeEstimate: 230 })
    g.watek.mockImplementation(async (id: string) => watek(id, [['anna@firma.pl', id === 'stary' ? TERAZ - 40 * 86_400_000 : TERAZ - 86_400_000]]))
    expect(await importujStrone(null, TERAZ)).toEqual({ nastepnaStrona: 'p2', zrobione: 2, razem: 230 })
    expect(g.listaWatkow).toHaveBeenCalledWith('newer_than:365d', null)
    expect(zapisane().sprawy.map((s) => s.status)).toEqual(['zalatwiona', 'do-odpowiedzi'])
    expect(dane.zapiszStan).toHaveBeenCalledWith({ import: { trwa: true, zrobione: 2, razem: 230 } })

    dane.czytajStan.mockResolvedValue(stan({ import: { trwa: true, zrobione: 2, razem: 230 } }))
    g.listaWatkow.mockResolvedValueOnce({ threads: [{ id: 'trzeci' }] })
    expect(await importujStrone('p2', TERAZ)).toEqual({ nastepnaStrona: null, zrobione: 3, razem: 230 })
    expect(dane.zapiszStan).toHaveBeenLastCalledWith({ import: { trwa: false, zrobione: 3, razem: 230 } })
  })

  it('odwołany dostęp w trakcie - rozłączona i wyjątek', async () => {
    g.listaWatkow.mockRejectedValue(new BladSkrzynki('rozlaczona', '401'))
    await expect(importujStrone(null, TERAZ)).rejects.toMatchObject({ rodzaj: 'rozlaczona' })
    expect(dane.zapiszStan).toHaveBeenCalledWith({ polaczona: false })
  })
})

describe('polaczSkrzynke', () => {
  beforeEach(() => {
    wymienKod.mockResolvedValue({ refreshToken: 'refresh-2', dostep: 'dostep' })
    g.obserwuj.mockResolvedValue({ historyId: '500', expiration: '1792000000000' })
  })

  it('inne konto - nic nie zapisuje', async () => {
    g.profil.mockResolvedValue({ emailAddress: 'ktos@gmail.com', historyId: '1' })
    expect(await polaczSkrzynke('KOD')).toBe('inne-konto')
    expect(dane.zapiszStan).not.toHaveBeenCalled()
    expect(g.obserwuj).not.toHaveBeenCalled()
  })

  it('pierwsze połączenie: zaszyfrowany token, obserwacja, punkt historii z obserwacji, import do zrobienia', async () => {
    dane.czytajStan.mockResolvedValue(null)
    g.profil.mockResolvedValue({ emailAddress: 'Kontakt@samorzad.ue.wroc.pl', historyId: '1' })
    expect(await polaczSkrzynke('KOD')).toBe('ok')
    expect(utworzonyZ).toHaveBeenCalledWith('refresh-2', 'dostep')
    expect(g.obserwuj).toHaveBeenCalledWith('projects/deck-samorzad/topics/skrzynka')
    expect(dane.zapiszStan).toHaveBeenCalledWith(expect.objectContaining({
      email: 'Kontakt@samorzad.ue.wroc.pl', token: 'enc:refresh-2', polaczona: true, historyId: '500', watchWygasa: 1792000000000,
      dzierzawaDo: 0, doPowtorki: false, import: { trwa: true, zrobione: 0, razem: 0 },
    }))
  })

  it('ponowne połączenie: punkt historii i import z poprzedniego stanu', async () => {
    dane.czytajStan.mockResolvedValue(stan({ polaczona: false, historyId: '120', import: { trwa: false, zrobione: 900, razem: 900 } }))
    g.profil.mockResolvedValue({ emailAddress: NASZ, historyId: '1' })
    await polaczSkrzynke('KOD')
    expect(dane.zapiszStan).toHaveBeenCalledWith(expect.objectContaining({ historyId: '120', import: { trwa: false, zrobione: 900, razem: 900 } }))
  })
})

describe('odnowObserwacje', () => {
  it('odnawia watch i zapisuje termin; niepołączona - nic', async () => {
    g.obserwuj.mockResolvedValue({ historyId: '600', expiration: '1793000000000' })
    await odnowObserwacje()
    expect(dane.zapiszStan).toHaveBeenCalledWith({ watchWygasa: 1793000000000 })
    dane.czytajStan.mockResolvedValue(stan({ polaczona: false }))
    g.obserwuj.mockClear()
    await odnowObserwacje()
    expect(g.obserwuj).not.toHaveBeenCalled()
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/synchronizacja.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `lib/skrzynka/synchronizacja.ts`**

```ts
import { BladSkrzynki, gmail as utworzGmail, wymienKod, type Gmail } from './google'
import { odszyfruj, zaszyfruj } from './szyfr'
import {
  czytajSprawy, czytajStan, pomijane, wezDzierzawe, zapiszStan, zapiszWynik, zwolnijDzierzawe, type StanSkrzynki,
} from './dane'
import { odczytajWatek } from './naglowki'
import { domena, drugaStrona, kontaktZAdresu, organizacjaZEmaila } from './kontakty'
import { kierunek, ocenSprawe } from './statusy'
import type { Kontakt, Organizacja, Sprawa, WynikSynchronizacji } from './typy'

export const ZAPYTANIE_IMPORTU = 'newer_than:365d'
const RUNDY = 3
const ROWNOLEGLE = 10
const MAKS_PRZEGLADU = 500

function nasz(): string {
  const e = process.env.DECK_OWNER_EMAIL
  if (!e) throw new BladSkrzynki('konfiguracja', 'Brak DECK_OWNER_EMAIL')
  return e.toLowerCase()
}

function temat(): string {
  const t = process.env.SKRZYNKA_TEMAT
  if (!t) throw new BladSkrzynki('konfiguracja', 'Brak SKRZYNKA_TEMAT')
  return t
}

const gmailZeStanu = (s: StanSkrzynki) => utworzGmail(odszyfruj(s.token))

/** Kilka zapytań do Gmaila naraz, ale nie sto - limit Gmail API liczy się na minutę. */
async function poKilka<T, W>(lista: T[], f: (x: T) => Promise<W>): Promise<W[]> {
  const wynik: W[] = []
  for (let i = 0; i < lista.length; i += ROWNOLEGLE) wynik.push(...(await Promise.all(lista.slice(i, i + ROWNOLEGLE).map(f))))
  return wynik
}

/** Odwołany dostęp oznaczamy w stanie - kafelek i panel powiedzą „rozłączona”. */
async function zRozlaczeniem<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f()
  } catch (e) {
    if (e instanceof BladSkrzynki && e.rodzaj === 'rozlaczona') await zapiszStan({ polaczona: false })
    throw e
  }
}

/** Pobiera wątki, przepuszcza przez automat statusów i zapisuje. Zwraca liczbę zapisanych spraw. */
export async function przetworzWatki(g: Gmail, ids: string[], k: { teraz: number; import: boolean }): Promise<number> {
  const unikalne = [...new Set(ids)]
  if (!unikalne.length) return 0
  const [surowe, poprzednie, pomin] = await Promise.all([
    poKilka(unikalne, (id) =>
      g.watek(id).catch((e) => {
        // Wątek usunięty między powiadomieniem a pobraniem - nie ma czego zapisać.
        if (e instanceof BladSkrzynki && e.rodzaj === 'brak-watku') return null
        throw e
      }),
    ),
    czytajSprawy(unikalne),
    pomijane(),
  ])
  const my = nasz()
  const sprawy: Sprawa[] = []
  const kontakty: Kontakt[] = []
  const organizacje: Organizacja[] = []

  for (const s of surowe) {
    if (!s) continue
    const w = odczytajWatek(s)
    if (!w.wiadomosci.length) continue
    const ostatnia = w.wiadomosci[w.wiadomosci.length - 1]
    const druga = drugaStrona(w, my)
    const org = druga ? organizacjaZEmaila(druga.email) : null
    const pop = poprzednie.get(w.id) ?? null
    const pomijana = !!druga && (pomin.adresy.includes(druga.email) || pomin.domeny.includes(domena(druga.email)))
    const stan = ocenSprawe(
      pop && { status: pop.status, oczekujeOd: pop.oczekujeOd, nowa: pop.nowa, ostatniaKiedy: pop.ostatnia.kiedy },
      w,
      { nasz: my, pomijana, teraz: k.teraz, import: k.import },
    )
    sprawy.push({
      id: w.id,
      temat: w.wiadomosci[0].temat || '(bez tematu)',
      ...stan,
      kontakt: druga?.email ?? null,
      organizacja: org?.domena ?? null,
      ostatnia: { kiedy: ostatnia.kiedy, kierunek: kierunek(ostatnia, my), fragment: ostatnia.fragment.slice(0, 200) },
      wiadomosci: w.wiadomosci.length,
      przypisana: pop?.przypisana ?? null,
      kategoriaGmail: w.wiadomosci.flatMap((m) => m.etykiety).find((e) => e.startsWith('CATEGORY_')) ?? null,
      zmieniono: k.teraz,
    })
    if (druga) kontakty.push(kontaktZAdresu(druga))
    if (org) organizacje.push(org)
  }
  await zapiszWynik({ sprawy, kontakty, organizacje })
  return sprawy.length
}

async function zmienioneWatki(g: Gmail, od: string): Promise<{ ids: string[]; nowyHistoryId: string }> {
  try {
    const ids: string[] = []
    let strona: string | null = null
    let nowy = od
    do {
      const h = await g.historia(od, strona)
      for (const wpis of h.history ?? []) for (const m of wpis.messagesAdded ?? []) ids.push(m.message.threadId)
      nowy = h.historyId
      strona = h.nextPageToken ?? null
    } while (strona)
    return { ids, nowyHistoryId: nowy }
  } catch (e) {
    if (!(e instanceof BladSkrzynki) || e.rodzaj !== 'historia-za-stara') throw e
    // Długa przerwa: Gmail nie pamięta już naszego punktu - przeglądamy 30 dni.
    const { historyId } = await g.profil()
    const ids: string[] = []
    let strona: string | null = null
    do {
      const l = await g.listaWatkow('newer_than:30d', strona)
      ids.push(...(l.threads ?? []).map((t) => t.id))
      strona = l.nextPageToken ?? null
    } while (strona && ids.length < MAKS_PRZEGLADU)
    return { ids, nowyHistoryId: historyId }
  }
}

/** Jedyna droga zmian w bazie poza importem. Woła ją push, cron, wejście do panelu i „Dociągnij”. */
export async function synchronizuj(teraz = Date.now()): Promise<WynikSynchronizacji> {
  const stan = await czytajStan()
  if (!stan?.polaczona || !stan.historyId) return { stan: 'niepolaczona' }
  if (!(await wezDzierzawe(teraz))) return { stan: 'zajete' }
  const g = gmailZeStanu(stan)
  let historyId = stan.historyId
  let watki = 0
  try {
    for (let runda = 0; runda < RUNDY; runda++) {
      const { ids, nowyHistoryId } = await zmienioneWatki(g, historyId)
      watki += await przetworzWatki(g, ids, { teraz, import: false })
      historyId = nowyHistoryId
      await zapiszStan({ historyId, ostatniaSynchronizacja: Date.now() })
      if (!(await zwolnijDzierzawe(Date.now()))) return { stan: 'zrobione', watki }
    }
    // Po ostatniej rundzie dzierżawa była przedłużona - zwalniamy ją; kolejne powiadomienie zacznie od nowa.
    await zapiszStan({ dzierzawaDo: 0 })
    return { stan: 'zrobione', watki }
  } catch (e) {
    await zapiszStan({ dzierzawaDo: 0 })
    if (e instanceof BladSkrzynki && e.rodzaj === 'rozlaczona') {
      await zapiszStan({ polaczona: false })
      return { stan: 'rozlaczona' }
    }
    throw e
  }
}

/** Jedna strona importu (100 wątków). Prowadzi ją przeglądarka - żadne wywołanie nie trwa długo. */
export async function importujStrone(
  strona: string | null,
  teraz = Date.now(),
): Promise<{ nastepnaStrona: string | null; zrobione: number; razem: number }> {
  const stan = await czytajStan()
  if (!stan?.polaczona) throw new BladSkrzynki('rozlaczona', 'Skrzynka nie jest połączona')
  return zRozlaczeniem(async () => {
    const g = gmailZeStanu(stan)
    const l = await g.listaWatkow(ZAPYTANIE_IMPORTU, strona)
    const ile = await przetworzWatki(g, (l.threads ?? []).map((t) => t.id), { teraz, import: true })
    const zrobione = (strona ? stan.import.zrobione : 0) + ile
    const razem = Math.max(zrobione, strona ? stan.import.razem : (l.resultSizeEstimate ?? zrobione))
    const nastepnaStrona = l.nextPageToken ?? null
    await zapiszStan({ import: { trwa: nastepnaStrona !== null, zrobione, razem } })
    return { nastepnaStrona, zrobione, razem }
  })
}

/**
 * Po zgodzie Google: tylko konto właściciela, token zaszyfrowany, obserwacja
 * włączona. Ponowne połączenie zachowuje punkt historii i stan importu -
 * synchronizacja dociągnie zmiany z czasu rozłączenia.
 */
export async function polaczSkrzynke(kod: string): Promise<'ok' | 'inne-konto'> {
  const { refreshToken, dostep } = await wymienKod(kod)
  const g = utworzGmail(refreshToken, dostep)
  const profil = await g.profil()
  if (profil.emailAddress.toLowerCase() !== nasz()) return 'inne-konto'
  const w = await g.obserwuj(temat())
  const poprzedni = await czytajStan()
  await zapiszStan({
    email: profil.emailAddress,
    token: zaszyfruj(refreshToken),
    polaczona: true,
    historyId: poprzedni?.historyId ?? w.historyId,
    watchWygasa: Number(w.expiration),
    dzierzawaDo: 0,
    doPowtorki: false,
    import: poprzedni ? poprzedni.import : { trwa: true, zrobione: 0, razem: 0 },
  })
  return 'ok'
}

/** Obserwacja Gmaila wygasa po 7 dniach - cron odnawia ją codziennie. */
export async function odnowObserwacje(): Promise<void> {
  const stan = await czytajStan()
  if (!stan?.polaczona) return
  await zRozlaczeniem(async () => {
    const w = await gmailZeStanu(stan).obserwuj(temat())
    await zapiszStan({ watchWygasa: Number(w.expiration) })
  })
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/skrzynka/synchronizacja.ts lib/skrzynka/synchronizacja.test.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): synchronizacja z historii Gmaila, import stronami i polaczenie

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 8: Trasy i cron

**Pliki:** nowe `app/api/skrzynka/polacz/route.ts`, `app/api/skrzynka/oauth/route.ts`, `app/api/skrzynka/import/route.ts`, `app/api/skrzynka/push/route.ts`, `app/api/skrzynka/cron/route.ts`, `app/api/skrzynka/synchronizuj/route.ts`, test `app/api/skrzynka/route.test.ts`; zmiana `vercel.json`

**Interfejsy:**
- Korzysta z: `tylkoWlasciciel(req, komunikat)` (`@/lib/asystent/tylkoWlasciciel`), `TYLKO_WLASCICIEL` (zadanie 1), `podpiszStan`, `sprawdzStan` (zadanie 3), `adresZgody`, `komunikatBledu` (zadanie 4), `zweryfikujPush` (zadanie 5), `polaczSkrzynke`, `importujStrone`, `synchronizuj`, `odnowObserwacje` (zadanie 7), `after` (`next/server`).
- Daje: `GET /api/skrzynka/polacz` → przekierowanie do zgody Google; `GET /api/skrzynka/oauth` → przekierowanie na `/skrzynka` albo `/skrzynka?blad=odmowa|stan|inne-konto|polaczenie|konfiguracja`; `POST /api/skrzynka/import` `{ strona }` → `{ nastepnaStrona, zrobione, razem }`; `POST /api/skrzynka/push` → 204/401; `GET /api/skrzynka/cron` (Bearer `CRON_SECRET`); `POST /api/skrzynka/synchronizuj` → `WynikSynchronizacji`.

- [ ] **Krok 1: Test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET as polacz } from '@/app/api/skrzynka/polacz/route'
import { GET as oauth } from '@/app/api/skrzynka/oauth/route'
import { POST as importuj } from '@/app/api/skrzynka/import/route'
import { POST as push } from '@/app/api/skrzynka/push/route'
import { GET as cron } from '@/app/api/skrzynka/cron/route'
import { POST as dociagnij } from '@/app/api/skrzynka/synchronizuj/route'
import { BladSkrzynki } from '@/lib/skrzynka/google'

const { ktoPyta, s, zweryfikujPush, sprawdzStan } = vi.hoisted(() => ({
  ktoPyta: vi.fn(),
  s: { polaczSkrzynke: vi.fn(), importujStrone: vi.fn(), synchronizuj: vi.fn(), odnowObserwacje: vi.fn() },
  zweryfikujPush: vi.fn(),
  sprawdzStan: vi.fn(),
}))

vi.mock('next/server', async (oryginal) => ({ ...(await oryginal<typeof import('next/server')>()), after: (f: () => unknown) => f() }))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/skrzynka/synchronizacja', () => s)
vi.mock('@/lib/skrzynka/push', () => ({ zweryfikujPush: (...a: unknown[]) => zweryfikujPush(...a) }))
vi.mock('@/lib/skrzynka/stanOauth', () => ({ podpiszStan: async (uid: string) => `stan-${uid}`, sprawdzStan: (...a: unknown[]) => sprawdzStan(...a) }))

const BAZA = 'https://ssuew-analytics.vercel.app'
const zadanie = (sciezka: string, o: { body?: unknown; naglowki?: Record<string, string> } = {}) =>
  ({ url: `${BAZA}${sciezka}`, nextUrl: new URL(`${BAZA}${sciezka}`), headers: new Headers(o.naglowki), json: async () => o.body }) as never

beforeEach(() => {
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u1', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  Object.values(s).forEach((f) => f.mockReset())
  zweryfikujPush.mockReset()
  sprawdzStan.mockReset().mockResolvedValue(true)
  vi.stubEnv('SKRZYNKA_CLIENT_ID', 'klient')
  vi.stubEnv('SKRZYNKA_CLIENT_SECRET', 'sekret')
  vi.stubEnv('SKRZYNKA_ADRES', BAZA)
  vi.stubEnv('DECK_OWNER_EMAIL', 'kontakt@samorzad.ue.wroc.pl')
  vi.stubEnv('CRON_SECRET', 'cron-sekret')
})
afterEach(() => vi.unstubAllEnvs())

describe('dostęp', () => {
  it('bez sesji 401, zarząd 403 - połączenie, oauth, import i dociąganie', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await polacz(zadanie('/api/skrzynka/polacz'))).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    for (const r of [
      await polacz(zadanie('/api/skrzynka/polacz')),
      await oauth(zadanie('/api/skrzynka/oauth?code=k&state=s')),
      await importuj(zadanie('/api/skrzynka/import', { body: {} })),
      await dociagnij(zadanie('/api/skrzynka/synchronizuj')),
    ]) {
      expect(r.status).toBe(403)
      expect((await r.json()).error).toBe('Skrzynka jest tylko dla właściciela')
    }
    expect(s.polaczSkrzynke).not.toHaveBeenCalled()
  })
})

describe('połączenie', () => {
  it('przekierowuje do zgody Google ze state związanym z kontem', async () => {
    const r = await polacz(zadanie('/api/skrzynka/polacz'))
    const u = new URL(r.headers.get('location')!)
    expect(u.host).toBe('accounts.google.com')
    expect(u.searchParams.get('state')).toBe('stan-u1')
  })

  it('bez konfiguracji - wraca do panelu z błędem', async () => {
    vi.stubEnv('SKRZYNKA_CLIENT_ID', '')
    const r = await polacz(zadanie('/api/skrzynka/polacz'))
    expect(r.headers.get('location')).toBe(`${BAZA}/skrzynka?blad=konfiguracja`)
  })

  it('powrót: odmowa, zły state, inne konto, błąd, sukces', async () => {
    const gdzie = async (q: string) => (await oauth(zadanie(`/api/skrzynka/oauth${q}`))).headers.get('location')
    expect(await gdzie('?error=access_denied')).toBe(`${BAZA}/skrzynka?blad=odmowa`)
    sprawdzStan.mockResolvedValueOnce(false)
    expect(await gdzie('?code=k&state=zly')).toBe(`${BAZA}/skrzynka?blad=stan`)
    expect(await gdzie('?state=s')).toBe(`${BAZA}/skrzynka?blad=stan`)
    s.polaczSkrzynke.mockResolvedValueOnce('inne-konto')
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka?blad=inne-konto`)
    s.polaczSkrzynke.mockRejectedValueOnce(new Error('sieć'))
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka?blad=polaczenie`)
    s.polaczSkrzynke.mockResolvedValueOnce('ok')
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka`)
    expect(sprawdzStan).toHaveBeenLastCalledWith('s', 'u1')
    expect(s.polaczSkrzynke).toHaveBeenLastCalledWith('k')
  })
})

describe('import i dociąganie', () => {
  it('import przekazuje stronę; rozłączona - 409', async () => {
    s.importujStrone.mockResolvedValueOnce({ nastepnaStrona: 'p3', zrobione: 200, razem: 900 })
    const r = await importuj(zadanie('/api/skrzynka/import', { body: { strona: 'p2' } }))
    expect(await r.json()).toEqual({ nastepnaStrona: 'p3', zrobione: 200, razem: 900 })
    expect(s.importujStrone).toHaveBeenCalledWith('p2')
    await importuj(zadanie('/api/skrzynka/import', { body: null }))
    expect(s.importujStrone).toHaveBeenLastCalledWith(null)
    s.importujStrone.mockRejectedValueOnce(new BladSkrzynki('rozlaczona', '401'))
    expect((await importuj(zadanie('/api/skrzynka/import', { body: {} }))).status).toBe(409)
  })

  it('dociąganie zwraca wynik synchronizacji', async () => {
    s.synchronizuj.mockResolvedValueOnce({ stan: 'zrobione', watki: 3 })
    expect(await (await dociagnij(zadanie('/api/skrzynka/synchronizuj'))).json()).toEqual({ stan: 'zrobione', watki: 3 })
  })
})

describe('push i cron', () => {
  it('push bez ważnego tokenu 401 i bez synchronizacji; z tokenem 204 i synchronizacja', async () => {
    zweryfikujPush.mockResolvedValueOnce(false)
    expect((await push(zadanie('/api/skrzynka/push', { naglowki: { authorization: 'Bearer zly' } }))).status).toBe(401)
    expect(s.synchronizuj).not.toHaveBeenCalled()
    zweryfikujPush.mockResolvedValueOnce(true)
    s.synchronizuj.mockResolvedValueOnce({ stan: 'zrobione', watki: 1 })
    expect((await push(zadanie('/api/skrzynka/push', { naglowki: { authorization: 'Bearer dobry' } }))).status).toBe(204)
    expect(zweryfikujPush).toHaveBeenLastCalledWith('Bearer dobry')
    expect(s.synchronizuj).toHaveBeenCalledTimes(1)
  })

  it('cron tylko z sekretem: odnawia obserwację i synchronizuje', async () => {
    expect((await cron(zadanie('/api/skrzynka/cron'))).status).toBe(401)
    expect((await cron(zadanie('/api/skrzynka/cron', { naglowki: { authorization: 'Bearer zly' } }))).status).toBe(401)
    s.synchronizuj.mockResolvedValueOnce({ stan: 'niepolaczona' })
    const r = await cron(zadanie('/api/skrzynka/cron', { naglowki: { authorization: 'Bearer cron-sekret' } }))
    expect(r.status).toBe(200)
    expect(s.odnowObserwacje).toHaveBeenCalled()
    vi.stubEnv('CRON_SECRET', '')
    expect((await cron(zadanie('/api/skrzynka/cron', { naglowki: { authorization: 'Bearer ' } }))).status).toBe(401)
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run app/api/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `app/api/skrzynka/polacz/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { adresZgody } from '@/lib/skrzynka/google'
import { podpiszStan } from '@/lib/skrzynka/stanOauth'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'

/** „Połącz skrzynkę” - do zgody Google, z podpowiedzią konta kontakt@. */
export async function GET(req: NextRequest) {
  const { kto, odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  try {
    return NextResponse.redirect(adresZgody(await podpiszStan(kto.uid), process.env.DECK_OWNER_EMAIL ?? ''))
  } catch (e) {
    console.error('[skrzynka] zgoda:', e)
    return NextResponse.redirect(new URL('/skrzynka?blad=konfiguracja', req.url))
  }
}
```

- [ ] **Krok 4: `app/api/skrzynka/oauth/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { sprawdzStan } from '@/lib/skrzynka/stanOauth'
import { polaczSkrzynke } from '@/lib/skrzynka/synchronizacja'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Powrót ze zgody Google. Każdy wynik kończy się w panelu - z komunikatem, gdy coś nie wyszło. */
export async function GET(req: NextRequest) {
  const { kto, odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const wroc = (blad?: string) => NextResponse.redirect(new URL(blad ? `/skrzynka?blad=${blad}` : '/skrzynka', req.url))
  const p = req.nextUrl.searchParams
  if (p.get('error')) return wroc('odmowa')
  const kod = p.get('code')
  const stan = p.get('state')
  if (!kod || !stan || !(await sprawdzStan(stan, kto.uid))) return wroc('stan')
  try {
    return wroc((await polaczSkrzynke(kod)) === 'ok' ? undefined : 'inne-konto')
  } catch (e) {
    console.error('[skrzynka] połączenie:', e)
    return wroc('polaczenie')
  }
}
```

- [ ] **Krok 5: `app/api/skrzynka/import/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { importujStrone } from '@/lib/skrzynka/synchronizacja'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const body = await req.json().catch(() => null)
  const strona = typeof body?.strona === 'string' && body.strona ? body.strona : null
  try {
    return NextResponse.json(await importujStrone(strona))
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
```

- [ ] **Krok 6: `app/api/skrzynka/push/route.ts`**

```ts
import { NextResponse, after, type NextRequest } from 'next/server'
import { zweryfikujPush } from '@/lib/skrzynka/push'
import { synchronizuj } from '@/lib/skrzynka/synchronizacja'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Powiadomienie Pub/Sub o zmianie w skrzynce. Odpowiadamy od razu, a
 * synchronizacja idzie w `after()` - Pub/Sub ponawia, gdy odpowiedź się
 * spóźnia. Treść powiadomienia nie jest potrzebna: synchronizacja zna swój
 * punkt historii.
 */
export async function POST(req: NextRequest) {
  if (!(await zweryfikujPush(req.headers.get('authorization')))) return new NextResponse(null, { status: 401 })
  after(() => synchronizuj().catch((e) => console.error('[skrzynka] push:', e)))
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Krok 7: `app/api/skrzynka/cron/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { odnowObserwacje, synchronizuj } from '@/lib/skrzynka/synchronizacja'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Codziennie: obserwacja Gmaila wygasa po 7 dniach, a synchronizacja łapie zgubione powiadomienia. Vercel wysyła `CRON_SECRET` jako Bearer. */
export async function GET(req: NextRequest) {
  const sekret = process.env.CRON_SECRET
  if (!sekret || req.headers.get('authorization') !== `Bearer ${sekret}`) {
    return NextResponse.json({ error: 'Brak dostępu' }, { status: 401 })
  }
  try {
    await odnowObserwacje()
    return NextResponse.json(await synchronizuj())
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
```

- [ ] **Krok 8: `app/api/skrzynka/synchronizuj/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { synchronizuj } from '@/lib/skrzynka/synchronizacja'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

/** „Dociągnij” w panelu. */
export async function POST(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  try {
    return NextResponse.json(await synchronizuj())
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
```

- [ ] **Krok 9: Cron w `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "crons": [{ "path": "/api/skrzynka/cron", "schedule": "0 5 * * *" }]
}
```

- [ ] **Krok 10: Uruchom - ma przejść**

Run: `npx vitest run app/api/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 11: Commit**

```bash
git add app/api/skrzynka vercel.json
git commit -m "$(cat <<'EOF'
feat(skrzynka): trasy polaczenia, importu, push, crona i dociagania

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 9: Panel `/skrzynka` (część 1)

**Pliki:** nowe `lib/skrzynka/klient.ts`, `components/skrzynka/PanelSkrzynki.tsx`, `components/skrzynka/ImportSkrzynki.tsx`, `app/skrzynka/page.tsx`, test `components/skrzynka/PanelSkrzynki.test.tsx`

**Interfejsy:**
- Korzysta z: `wywolaj`, `json` (`@/lib/asystent/klient`); `LicznikiSkrzynki`, `PostepImportu`, `WynikSynchronizacji` (zadanie 1); `czytajStan`, `liczniki` (zadanie 6); `synchronizuj` (zadanie 7); trasy z zadania 8.
- Daje: `klientSkrzynki.importuj(strona)`, `klientSkrzynki.synchronizuj()`; `PanelSkrzynki({ liczniki, postep, blad })`, `ImportSkrzynki({ start })`; strona `/skrzynka` (tylko właściciel).

- [ ] **Krok 1: Test**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PanelSkrzynki } from '@/components/skrzynka/PanelSkrzynki'
import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'

const refresh = vi.fn()
const klient = { importuj: vi.fn(), synchronizuj: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: { importuj: (...a: unknown[]) => klient.importuj(...a), synchronizuj: (...a: unknown[]) => klient.synchronizuj(...a) },
}))

const L: LicznikiSkrzynki = {
  stan: 'polaczona', doOdpowiedzi: 7, poTerminie: 2, doPrzejrzenia: 15, czekaNaNich: 4, wToku: 1,
  ostatniaSynchronizacja: Date.UTC(2026, 9, 14, 8, 5),
}

beforeEach(() => {
  refresh.mockReset()
  Object.values(klient).forEach((f) => f.mockReset())
})

describe('PanelSkrzynki', () => {
  it('bez połączenia - przycisk zgody Google', () => {
    render(<PanelSkrzynki liczniki={{ ...L, stan: 'brak' }} postep={null} blad={null} />)
    expect(screen.getByRole('link', { name: 'Połącz skrzynkę' })).toHaveAttribute('href', '/api/skrzynka/polacz')
  })

  it('rozłączona - ostrzeżenie i ponowne połączenie', () => {
    render(<PanelSkrzynki liczniki={{ ...L, stan: 'rozlaczona' }} postep={null} blad={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/rozłączona/)
    expect(screen.getByRole('link', { name: 'Połącz ponownie' })).toHaveAttribute('href', '/api/skrzynka/polacz')
  })

  it('błąd z powrotu zgody i nieczytelny stan', () => {
    render(<PanelSkrzynki liczniki={{ ...L, stan: 'brak' }} postep={null} blad="inne-konto" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/kontakt@samorzad\.ue\.wroc\.pl/)
    render(<PanelSkrzynki liczniki={null} postep={null} blad={null} />)
    expect(screen.getAllByRole('alert').at(-1)).toHaveTextContent(/Nie udało się odczytać stanu skrzynki/)
  })

  it('połączona - liczniki statusów i czas synchronizacji', () => {
    render(<PanelSkrzynki liczniki={L} postep={null} blad={null} />)
    const liczby = screen.getByRole('region', { name: 'Sprawy według statusu' })
    expect(liczby).toHaveTextContent('Do odpowiedzi7')
    expect(liczby).toHaveTextContent('Po terminie2')
    expect(liczby).toHaveTextContent('Do przejrzenia15')
    expect(screen.getByText(/14\.10\.2026, 10:05/)).toBeInTheDocument()
  })

  it('Dociągnij - synchronizacja i odświeżenie; błąd widać', async () => {
    klient.synchronizuj.mockResolvedValueOnce({ stan: 'zrobione', watki: 2 })
    render(<PanelSkrzynki liczniki={L} postep={null} blad={null} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dociągnij' }))
    })
    expect(refresh).toHaveBeenCalled()
    klient.synchronizuj.mockRejectedValueOnce(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dociągnij' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
  })

  it('import: strona po stronie z postępem, na koniec odświeżenie', async () => {
    klient.importuj
      .mockResolvedValueOnce({ nastepnaStrona: 'p2', zrobione: 100, razem: 230 })
      .mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 230, razem: 230 })
    await act(async () => {
      render(<PanelSkrzynki liczniki={L} postep={{ trwa: true, zrobione: 0, razem: 0 }} blad={null} />)
    })
    expect(await screen.findByText('Importuję 230 z ok. 230 wątków')).toBeInTheDocument()
    expect(klient.importuj.mock.calls).toEqual([[null], ['p2']])
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('import przerwany błędem - komunikat i ponowienie od początku', async () => {
    klient.importuj.mockRejectedValueOnce(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    await act(async () => {
      render(<PanelSkrzynki liczniki={L} postep={{ trwa: true, zrobione: 0, razem: 0 }} blad={null} />)
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
    klient.importuj.mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 5, razem: 5 })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }))
    })
    expect(klient.importuj).toHaveBeenLastCalledWith(null)
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `lib/skrzynka/klient.ts`**

```ts
'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type { WynikSynchronizacji } from './typy'

export const klientSkrzynki = {
  importuj: (strona: string | null) =>
    wywolaj<{ nastepnaStrona: string | null; zrobione: number; razem: number }>('/api/skrzynka/import', json('POST', { strona })),
  synchronizuj: () => wywolaj<WynikSynchronizacji>('/api/skrzynka/synchronizuj', { method: 'POST' }),
}
```

- [ ] **Krok 4: `components/skrzynka/ImportSkrzynki.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { klientSkrzynki } from '@/lib/skrzynka/klient'

/**
 * Import 12 miesięcy prowadzi przeglądarka, strona po stronie - żadne
 * wywołanie serwera nie trwa długo. Ponowienie zaczyna od początku: zapis
 * jest idempotentny, więc powtórzone strony niczego nie psują.
 */
export function ImportSkrzynki({ start }: { start: { zrobione: number; razem: number } }) {
  const router = useRouter()
  const [postep, setPostep] = useState(start)
  const [blad, setBlad] = useState<string | null>(null)
  const [proba, setProba] = useState(0)

  useEffect(() => {
    let aktywny = true
    void (async () => {
      let strona: string | null = null
      try {
        do {
          const w = await klientSkrzynki.importuj(strona)
          if (!aktywny) return
          setPostep({ zrobione: w.zrobione, razem: w.razem })
          strona = w.nastepnaStrona
        } while (strona)
        router.refresh()
      } catch (e) {
        if (aktywny) setBlad((e as Error).message)
      }
    })()
    return () => {
      aktywny = false
    }
  }, [router, proba])

  const procent = postep.razem ? Math.min(100, Math.round((postep.zrobione / postep.razem) * 100)) : 0
  return (
    <section aria-label="Import skrzynki" className="deck-card space-y-3 rounded-lg p-5 text-[12.5px]">
      <p className="font-semibold text-deck-text">Importuję {postep.zrobione} z ok. {postep.razem} wątków</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="deck-meter-fill h-full" style={{ width: `${procent}%` }} />
      </div>
      <p className="text-deck-muted">Ostatnie 12 miesięcy. Wątki starsze niż 30 dni trafiają od razu do archiwum. Nie zamykaj tej karty.</p>
      {blad && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-deck-danger">{blad}</p>
          <button
            type="button"
            onClick={() => {
              setBlad(null)
              setProba((p) => p + 1)
            }}
            className="deck-button rounded-md px-3 py-1 text-[11.5px]"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Krok 5: `components/skrzynka/PanelSkrzynki.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import type { LicznikiSkrzynki, PostepImportu } from '@/lib/skrzynka/typy'
import { ImportSkrzynki } from './ImportSkrzynki'

const BLEDY: Record<string, string> = {
  'inne-konto': 'Zgoda przyszła z innego konta niż kontakt@samorzad.ue.wroc.pl - zaloguj się w Google jako kontakt@ i spróbuj ponownie.',
  odmowa: 'Zgoda w Google nie została udzielona.',
  stan: 'Link połączenia wygasł albo jest nieprawidłowy - spróbuj jeszcze raz.',
  polaczenie: 'Nie udało się połączyć ze skrzynką - spróbuj ponownie.',
  konfiguracja: 'Skrzynka nie jest skonfigurowana na serwerze (zmienne SKRZYNKA_* na Vercelu).',
}

const kiedy = (ms: number) =>
  new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' }).format(ms)

export function PanelSkrzynki({ liczniki, postep, blad }: {
  liczniki: LicznikiSkrzynki | null
  postep: PostepImportu | null
  blad: string | null
}) {
  const router = useRouter()
  const [trwa, setTrwa] = useState(false)
  const [bladDociagania, setBladDociagania] = useState<string | null>(null)

  async function dociagnij() {
    setTrwa(true)
    setBladDociagania(null)
    try {
      await klientSkrzynki.synchronizuj()
      router.refresh()
    } catch (e) {
      setBladDociagania((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  const komunikat = blad ? (BLEDY[blad] ?? BLEDY.polaczenie) : null

  return (
    <div className="space-y-4">
      {komunikat && (
        <p role="alert" className="rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger">
          {komunikat}
        </p>
      )}

      {liczniki === null ? (
        <p role="alert" className="rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger">
          Nie udało się odczytać stanu skrzynki - odśwież stronę za chwilę.
        </p>
      ) : liczniki.stan !== 'polaczona' ? (
        <section className="deck-card max-w-[640px] space-y-3 rounded-lg p-5 text-[12.5px]">
          {liczniki.stan === 'rozlaczona' ? (
            <p role="alert" className="text-deck-danger">Skrzynka jest rozłączona - Google odwołał dostęp. Sprawy w D.E.C.K. zostają; po połączeniu dociągnę zmiany.</p>
          ) : (
            <p className="text-deck-muted">
              D.E.C.K. będzie czytać skrzynkę kontakt@, nadawać mailom statusy i wysyłać odpowiedzi z tego adresu. Zgodę daje się raz, zalogowanym w Google jako kontakt@samorzad.ue.wroc.pl.
            </p>
          )}
          <a href="/api/skrzynka/polacz" className="deck-button inline-flex rounded-md px-3 py-1.5 text-[12px]">
            {liczniki.stan === 'rozlaczona' ? 'Połącz ponownie' : 'Połącz skrzynkę'}
          </a>
        </section>
      ) : (
        <>
          {postep?.trwa && <ImportSkrzynki start={postep} />}
          <section aria-label="Sprawy według statusu" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Liczba etykieta="Do odpowiedzi" wartosc={liczniki.doOdpowiedzi} />
            <Liczba etykieta="Po terminie" wartosc={liczniki.poTerminie} alarm={liczniki.poTerminie > 0} />
            <Liczba etykieta="Do przejrzenia" wartosc={liczniki.doPrzejrzenia} />
            <Liczba etykieta="Czeka na nich" wartosc={liczniki.czekaNaNich} />
            <Liczba etykieta="W toku" wartosc={liczniki.wToku} />
          </section>
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-deck-muted">
            <span>
              Ostatnia synchronizacja: {liczniki.ostatniaSynchronizacja ? kiedy(liczniki.ostatniaSynchronizacja) : 'jeszcze nie było'}
            </span>
            <button type="button" onClick={dociagnij} disabled={trwa} className="deck-button inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
              <RefreshCw size={12} aria-hidden="true" className={trwa ? 'animate-spin' : ''} />
              Dociągnij
            </button>
            {bladDociagania && <span role="alert" className="text-deck-danger">{bladDociagania}</span>}
          </div>
          <p className="text-[12px] text-deck-muted">Lista spraw, odpowiedzi i kontakty pojawią się w kolejnym etapie.</p>
        </>
      )}
    </div>
  )
}

function Liczba({ etykieta, wartosc, alarm = false }: { etykieta: string; wartosc: number; alarm?: boolean }) {
  return (
    <div className="deck-card rounded-lg p-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-deck-muted/70">{etykieta}</div>
      <div className={`mt-1.5 text-[24px] font-semibold tabular-nums ${alarm ? 'text-deck-danger' : 'text-deck-text'}`}>{wartosc}</div>
    </div>
  )
}
```

- [ ] **Krok 6: `app/skrzynka/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ktoNaStronie } from '@/lib/auth/naStronie'
import { czytajStan, liczniki } from '@/lib/skrzynka/dane'
import { synchronizuj } from '@/lib/skrzynka/synchronizacja'
import { PanelSkrzynki } from '@/components/skrzynka/PanelSkrzynki'

export const maxDuration = 60
/** Dociągnięcie przy wejściu tylko wtedy, gdy push dawno nic nie przyniósł - tanie zabezpieczenie przed zgubionym powiadomieniem. */
const DOCIAGNIJ_PO_MS = 15 * 60_000

export default async function SkrzynkaPage({ searchParams }: { searchParams: Promise<{ blad?: string }> }) {
  const kto = await ktoNaStronie()
  if (!kto) redirect('/login')
  // Skrzynka instytucji jest tylko dla właściciela - zarząd wraca do kokpitu.
  if (kto.rola !== 'owner') redirect('/')

  const { blad } = await searchParams
  const teraz = Date.now()
  const [stan, l] = await Promise.all([czytajStan().catch(() => null), liczniki(teraz).catch(() => null)])
  if (stan?.polaczona && !stan.import.trwa && (stan.ostatniaSynchronizacja ?? 0) < teraz - DOCIAGNIJ_PO_MS) {
    after(() => synchronizuj().catch((e) => console.error('[skrzynka] wejście:', e)))
  }

  return (
    <main className="mx-auto w-full max-w-[1360px] p-[clamp(16px,2.4vw,34px)]">
      <header className="mb-5">
        <Link
          href="/"
          className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted transition hover:text-deck-text"
        >
          <ArrowLeft size={12} /> DECK
        </Link>
        <h1 className="text-lg font-semibold text-deck-text">Skrzynka</h1>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted/70">kontakt@samorzad.ue.wroc.pl</p>
      </header>
      {/* Do przeglądarki idą tylko liczby i postęp - nigdy token. */}
      <PanelSkrzynki liczniki={l} postep={stan?.import ?? null} blad={blad ?? null} />
    </main>
  )
}
```

- [ ] **Krok 7: Uruchom - ma przejść**

Run: `npx vitest run components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 8: Commit**

```bash
git add lib/skrzynka/klient.ts components/skrzynka app/skrzynka
git commit -m "$(cat <<'EOF'
feat(skrzynka): panel z polaczeniem, importem i licznikami spraw

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 10: Kafelek „Skrzynka” w kokpicie

**Pliki:** zmiana `components/deck/DeckHub.tsx`, `components/deck/DeckHub.test.tsx`, `app/page.tsx`

**Interfejsy:**
- Korzysta z: `LicznikiSkrzynki` (zadanie 1), `liczniki` (zadanie 6).
- Daje: prop `DeckHub.skrzynka: Promise<LicznikiSkrzynki | null> | null` (`null` dla zarządu; wewnętrzne `null` - odczyt zawiódł).

- [ ] **Krok 1: Testy - `components/deck/DeckHub.test.tsx`**

Dopisz import `import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'` i stałą obok `STRONY`:

```tsx
const SKRZYNKA: LicznikiSkrzynki = {
  stan: 'polaczona', doOdpowiedzi: 7, poTerminie: 2, doPrzejrzenia: 4, czekaNaNich: 3, wToku: 1, ostatniaSynchronizacja: 1,
}
```

W typie parametru `hub(...)` dopisz `skrzynka?: LicznikiSkrzynki | null | Promise<LicznikiSkrzynki | null>`, obok `strony`:

```tsx
  const skrzynka = rola === 'owner' ? obietnica(nadpisz.skrzynka === undefined ? SKRZYNKA : nadpisz.skrzynka) : null
```

i `skrzynka={skrzynka}` w `<DeckHub … />`. W pierwszym teście dopisz `skrzynka: nigdy()` do wywołania `hub`. Nowe testy na końcu `describe`:

```tsx
  it('kafelek Skrzynki: do odpowiedzi, po terminie i reszta statusów', async () => {
    await hub()
    expect(screen.getByRole('link', { name: /Skrzynka/ })).toHaveAttribute('href', '/skrzynka')
    expect(await screen.findByText('2 po terminie')).toBeInTheDocument()
    expect(screen.getByText('do przejrzenia 4 · czeka na nich 3')).toBeInTheDocument()
  })

  it('kafelek Skrzynki bez połączenia i po rozłączeniu', async () => {
    await hub({ skrzynka: { ...SKRZYNKA, stan: 'brak' } })
    expect(await screen.findByText(/Połącz skrzynkę kontakt@/)).toBeInTheDocument()
  })

  it('kafelek Skrzynki rozłączonej', async () => {
    await hub({ skrzynka: { ...SKRZYNKA, stan: 'rozlaczona' } })
    expect(await screen.findByText('Skrzynka rozłączona - połącz ponownie.')).toBeInTheDocument()
  })

  it('zarząd nie widzi kafelka Skrzynki', async () => {
    await hub({ rola: 'board', email: 'Jula' })
    expect(screen.queryByRole('heading', { name: 'Skrzynka' })).toBeNull()
  })
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/deck/DeckHub.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `components/deck/DeckHub.tsx`**

Import: `import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'`. W `Props` po `strony`:

```tsx
  /** Liczniki skrzynki kontakt@. Zarząd dostaje `null`; wewnętrzne `null` - odczyt zawiódł. */
  skrzynka: Promise<LicznikiSkrzynki | null> | null
```

Dopisz `skrzynka` do destrukturyzacji `DeckHub({ … })`. W `<main>` zaraz po bloku kafelka Stron:

```tsx
          {rola === 'owner' && skrzynka && (
            <Suspense fallback={<KafelekSkrzynki dane={undefined} />}>
              <KafelekSkrzynkiZDanymi skrzynka={skrzynka} />
            </Suspense>
          )}
```

Pod `KafelekStron`:

```tsx
function KafelekSkrzynkiZDanymi({ skrzynka }: { skrzynka: Promise<LicznikiSkrzynki | null> }) {
  return <KafelekSkrzynki dane={use(skrzynka)} />
}

/** `undefined` - liczby jeszcze płyną; `null` - odczyt zawiódł. */
function KafelekSkrzynki({ dane }: { dane: LicznikiSkrzynki | null | undefined }) {
  return (
    <DeckTile
      stan="zywy"
      href="/skrzynka"
      etykieta="moduł 05 · kontakt@"
      tytul="Skrzynka"
      odznaka={dane?.stan === 'polaczona' && dane.poTerminie > 0 ? `${dane.poTerminie} po terminie` : undefined}
    >
      {dane === undefined ? (
        <Brak />
      ) : dane === null ? (
        <p className="text-[12px] leading-relaxed text-deck-muted">Nie udało się odczytać skrzynki - szczegóły w panelu.</p>
      ) : dane.stan === 'brak' ? (
        <p className="text-[12px] leading-relaxed text-deck-muted">Połącz skrzynkę kontakt@, żeby żaden mail nie zginął.</p>
      ) : dane.stan === 'rozlaczona' ? (
        <p className="text-[12px] leading-relaxed text-deck-danger">Skrzynka rozłączona - połącz ponownie.</p>
      ) : (
        <div className="flex h-full flex-col justify-between gap-3">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[30px] font-bold leading-none tracking-[-0.03em]">
              <AnimatedNumber value={dane.doOdpowiedzi} />
            </span>
            <span className="text-[12px] font-medium text-deck-muted">do odpowiedzi</span>
          </div>
          <div className="font-mono text-[11px] text-deck-muted">
            do przejrzenia {dane.doPrzejrzenia} · czeka na nich {dane.czekaNaNich}
          </div>
        </div>
      )}
    </DeckTile>
  )
}
```

- [ ] **Krok 4: `app/page.tsx`**

Importy: `import { liczniki as licznikiSkrzynki } from '@/lib/skrzynka/dane'` i `import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'`. Obok `let strony …`:

```tsx
  let skrzynka: Promise<LicznikiSkrzynki | null> | null = null
```

W bloku `if (kto.rola === 'owner') { … }`, po `strony = …`:

```tsx
    // Same zapytania zliczające w Firestore - kokpit nigdy nie pyta Gmaila.
    skrzynka = licznikiSkrzynki(teraz.getTime()).catch((e) => {
      console.error('[skrzynka] kokpit:', e)
      return null
    })
```

i `skrzynka={skrzynka}` w `<DeckHub … />`.

- [ ] **Krok 5: Uruchom - ma przejść**

Run: `npx vitest run components/deck > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 6: Commit**

```bash
git add components/deck/DeckHub.tsx components/deck/DeckHub.test.tsx app/page.tsx
git commit -m "$(cat <<'EOF'
feat(kokpit): kafelek Skrzynka z licznikami spraw

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 11: Konfiguracja, sprawdzenie i wdrożenie

**Pliki:** zmiana `README.md`, `.env.example`

- [ ] **Krok 1: `.env.example` - po bloku Search Console**

```
# ─── Skrzynka kontakt@ (Gmail) ──────────────────────────────────────
# Projekt Google Cloud `deck-samorzad`: klient OAuth (ekran zgody „Wewnętrzny”),
# temat Pub/Sub i konto subskrypcji push. Szczegóły: README → Skrzynka.
SKRZYNKA_CLIENT_ID=
SKRZYNKA_CLIENT_SECRET=
# Stały adres produkcji - z niego powstają adres powrotu OAuth i odbiorca push.
SKRZYNKA_ADRES=https://ssuew-analytics.vercel.app
SKRZYNKA_TEMAT=projects/deck-samorzad/topics/skrzynka
SKRZYNKA_PUSH_KONTO=skrzynka-push@deck-samorzad.iam.gserviceaccount.com
# 32 losowe bajty w base64: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
SKRZYNKA_KLUCZ=
# Vercel wysyła go jako Bearer do /api/skrzynka/cron.
CRON_SECRET=
```

- [ ] **Krok 2: README - sekcja po „Strony (Google Search Console)”**

```markdown
## Skrzynka kontakt@ (Gmail)

Moduł 05 łączy się ze skrzynką kontakt@ wewnętrzną aplikacją OAuth w projekcie Google Cloud `deck-samorzad` (organizacja samorzad.ue.wroc.pl). Jednorazowo:

1. `deck-samorzad` → APIs & Services → Library: włącz **Gmail API** i **Cloud Pub/Sub API**.
2. OAuth consent screen: typ **Internal**, zakresy `gmail.readonly` i `gmail.send`.
3. Credentials → Create credentials → OAuth client ID → **Web application**, Authorized redirect URI: `https://ssuew-analytics.vercel.app/api/skrzynka/oauth`. Client ID i secret → `SKRZYNKA_CLIENT_ID`, `SKRZYNKA_CLIENT_SECRET`.
4. Pub/Sub → Topics → Create topic `skrzynka`; Permissions → Add principal `gmail-api-push@system.gserviceaccount.com`, rola **Pub/Sub Publisher**.
5. IAM → Service accounts → Create `skrzynka-push` (bez ról).
6. Temat `skrzynka` → Create subscription: typ **Push**, endpoint `https://ssuew-analytics.vercel.app/api/skrzynka/push`, **Enable authentication** kontem `skrzynka-push`, audience = ten sam endpoint.
7. Vercel (zespół DZIAŁ IT SAMORZĄDU, Production): `SKRZYNKA_CLIENT_ID`, `SKRZYNKA_CLIENT_SECRET`, `SKRZYNKA_ADRES`, `SKRZYNKA_TEMAT`, `SKRZYNKA_PUSH_KONTO`, `SKRZYNKA_KLUCZ`, `CRON_SECRET` (wzory w `.env.example`).
8. D.E.C.K. zalogowanym jako kontakt@ → Skrzynka → **Połącz skrzynkę** → zgoda Google → import 12 miesięcy.

Stan połączenia (z zaszyfrowanym tokenem) leży w Firestore `skrzynka/stan`, sprawy w `skrzynkaSprawy`, kontakty i organizacje w `skrzynkaKontakty` i `skrzynkaOrganizacje` - wszystko tylko dla serwera. Push budzi synchronizację przy każdej zmianie w Odebranych i Wysłanych; cron raz dziennie odnawia obserwację Gmaila (wygasa po 7 dniach). Kokpit czyta wyłącznie liczniki z Firestore.
```

- [ ] **Krok 3: Pełne sprawdzenie**

Run: `npx vitest run > "$TMP/vt.log" 2>&1; echo $?` → `0`
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`
Run: `npm run lint > "$TMP/lint.log" 2>&1; echo $?` → `0`
Run: `npm run build > "$TMP/build.log" 2>&1; echo $?` → `0`; w logu `ƒ /skrzynka` i trasy `/api/skrzynka/*`.
Run: `git diff --name-only main | xargs -r grep -l $'—\|–'; echo $?` → bez plików.

- [ ] **Krok 4: Commit i pull request**

```bash
git add README.md .env.example
git commit -m "$(cat <<'EOF'
docs(skrzynka): konfiguracja Google Cloud i zmiennych Vercela

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push -u origin deck-skrzynka-1
```

Pull request `deck-skrzynka-1` → `main` w `ssuew-it/ssuew-analytics` (adres podaje `git push`); scalenie po akceptacji użytkownika. Vercel zbuduje podgląd gałęzi, a po scaleniu produkcję.

- [ ] **Krok 5: Sprawdzenie na produkcji (po scaleniu i konfiguracji z kroku 2 README)**

- `GET /api/skrzynka/polacz` bez sesji → 401; `POST /api/skrzynka/push` bez tokenu → 401; `GET /api/skrzynka/cron` bez sekretu → 401.
- `/skrzynka` bez sesji → przekierowanie na logowanie.
- Właściciel (test użytkownika): Połącz skrzynkę → zgoda → import z postępem → liczniki na kafelku; wysłany testowy mail na kontakt@ pojawia się w „Do odpowiedzi” w ciągu minuty (push).
- Vercel → Settings → Cron Jobs: `/api/skrzynka/cron` widoczny.

- [ ] **Krok 6: Pamięć projektu** - stan Skrzynki części 1, co czeka na użytkownika, następny krok: plan części 2 (panel z listą i wysyłką).
