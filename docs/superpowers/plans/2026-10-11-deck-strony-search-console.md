# D.E.C.K. - panel Strony (Google Search Console): plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** moduł 04 „Strony” - ruch z Google na stronach Samorządu i projektów (kliknięcia, wyświetlenia, CTR, pozycja, trend, top zapytania i podstrony) z alertem spadku, kafelkiem w kokpicie i danymi dla asystenta.

**Architektura:** czyste funkcje w `lib/strony/okresy.ts` (daty, zmiana, alert, opis zmiany) i `lib/strony/model.ts` (typy, składanie odpowiedzi Google, podsumowanie, komunikaty). `lib/strony/google.ts` podpisuje JWT kontem serwisowym (`jose`), trzyma token w pamięci i woła REST Search Console. `lib/strony/dane.ts` trzyma listę stron w Firestore i liczy statystyki z cache 6 h (`unstable_cache`). Trasy `/api/strony*` tylko dla właściciela; panel `/strony` to strona serwerowa ze strumieniem danych i komponenty klienta w `components/strony/`. Kokpit dostaje żywy kafelek, a obraz projektu asystenta sekcję `strony`.

**Stack:** Next.js 16 (App Router, `unstable_cache`, `after`), React 19 (`use` + `Suspense`), Firestore Admin SDK, `jose` (RS256), Recharts, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-10-04-deck-strony-search-console-design.md](../specs/2026-10-04-deck-strony-search-console-design.md)

## Zasady wspólne

- Wszystko po polsku: nazwy, komunikaty, commity.
- W tekstach (UI, komentarze, commity) tylko zwykły łącznik „-”, nigdy długie myślniki.
- Commit dopiero po `npx vitest run <pliki> > "$TMP/vt.log" 2>&1; echo $?` = 0 (przy błędzie czytaj `$TMP/vt.log`). Stopka commita: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Okres: koniec = dziś w Warszawie minus 3 dni; bieżący = 28 dni do końca włącznie; poprzedni = 28 dni przed nim.
- Alert: kliknięcia spadły o ≥ 30% wobec poprzedniego okresu przy co najmniej 50 kliknięciach w poprzednim okresie.
- Cache statystyk: 6 h (21600 s), tag `strony`.
- Zakres Google: `https://www.googleapis.com/auth/webmasters.readonly`; token odnawiany 5 minut przed wygaśnięciem.
- Dostęp: brak sesji 401, zarząd 403; zarząd nie widzi kafelka ani danych, wejście na `/strony` odsyła na `/`.
- Lokalnie nie ma `FIREBASE_SERVICE_ACCOUNT` - Firestore i Google sprawdzamy testami z zaślepkami, a całość na produkcji.

### Poprawki wobec specu (świadome)

1. **Lista stron w `strony/lista`, nie w `ustawienia/strony`.** Reguła `match /ustawienia/{dokument}` w `firestore.rules` daje odczyt zarządowi, a spec wymaga, żeby listę czytał i pisał wyłącznie serwer. Kolekcja `strony` nie ma reguły, więc zamyka ją reguła końcowa.
2. **Cache na całe statystyki witryny (`unstable_cache`), nie na pojedyncze `fetch`.** Klucz cache `fetch` w Next zawiera nagłówki, a nagłówek `Authorization` zmienia się co godzinę z tokenem - cache 6 h nigdy by nie zadziałał. Kluczem są argumenty (witryna, nazwa, okresy), więc nowy dzień to nowy wpis, a błędy nie trafiają do cache.
3. **Nowy obszar odprawy `strony`** (odnośnik `/strony`) - inaczej asystent nie mógłby wskazać spadku ruchu jako zagrożenia.
4. **`tylkoWlasciciel(req, komunikat?)`** - domyślny komunikat 403 mówi o asystencie; trasy stron podają własny.

## Na co uważać w przeglądzie

1. **Dni bez ruchu** - Google pomija dni bez wyświetleń; seria dzienna ma mieć zera w tych dniach, a nie dziury (test w zadaniu 2).
2. **Nowa witryna albo zero w poprzednim okresie** - zmiana ma być „nowe” albo „-”, nigdy `NaN%`, `Infinity` czy „+0%” (testy w zadaniu 1).
3. **Identyfikatory witryn z `:` i `/`** (`sc-domain:jwk26.pl`, `https://samorzad.ue.wroc.pl/`) - kodowane w ścieżce API Google i w parametrze `DELETE` (testy w zadaniach 3, 5 i 6).
4. **Usunięcie wybranej zakładki** - po odświeżeniu panel wraca na pierwszą stronę, a nie pokazuje pustki (test w zadaniu 7).
5. **Jedna witryna bez dostępu** - pozostałe strony, podsumowanie, kafelek i odprawa działają dalej (testy w zadaniach 4 i 7).

---

## Mapa plików

| Plik | Odpowiedzialność | Zadanie |
|---|---|---|
| `lib/strony/okresy.ts` | okresy, dni okresu, `zmiana`, `alertSpadku`, `nazwaZWitryny`, `dataKrotka`, `opisZmiany` | 1 |
| `lib/strony/model.ts` | typy, `zlozStatystyki`, `podsumujStrony`, `komunikatStrony`, stałe | 2 |
| `lib/strony/google.ts` | token konta serwisowego, `listaWitryn`, `zapytanie`, `BladGoogle`, `emailKonta` | 3 |
| `lib/firebase/admin.ts`, `lib/strony/dane.ts` | `stronyRef`, lista stron, `statystykiStron` z cache | 4 |
| `lib/asystent/tylkoWlasciciel.ts`, `app/api/strony/route.ts`, `app/api/strony/dostepne/route.ts` | trasy | 5 |
| `lib/asystent/klient.ts`, `lib/strony/klient.ts`, `components/strony/DodajStrone.tsx`, `UsunStrone.tsx`, `InstrukcjaDostepu.tsx` | dodawanie i usuwanie z przeglądarki | 6 |
| `app/strony/page.tsx`, `components/strony/PanelStron.tsx`, `ZakladkaStrony.tsx`, `WykresStrony.tsx` | panel | 7 |
| `components/deck/DeckHub.tsx`, `app/page.tsx` | kafelek | 8 |
| `lib/asystent/kontekst.ts`, `dane.ts`, `odprawa.ts`, `czat.ts`, `components/deck/PanelOdprawy.tsx`, trasy czatu i odprawy | sekcja `strony` w obrazie projektu | 9 |
| `README.md` | konfiguracja | 10 |

---

## Zadanie 1: Okresy i opis zmiany

**Pliki:** nowy `lib/strony/okresy.ts`, test `lib/strony/okresy.test.ts`

**Interfejsy:**
- Korzysta z: `przesunDate(d: Data, oDni: number): Data`, `type Data = { rok; miesiac; dzien }` z `@/lib/planer/trwanie`.
- Daje: `DNI_OKRESU`, `OPOZNIENIE_DNI`, `PROG_SPADKU`, `MIN_KLIKNIEC_ALERTU`, `interface Okres { od: string; do: string }`, `okresy(dzis: Data): { biezacy: Okres; poprzedni: Okres }`, `dniOkresu(o: Okres): string[]`, `zmiana(biez: number, pop: number): number | null`, `alertSpadku(biez: number, pop: number): boolean`, `nazwaZWitryny(witryna: string): string`, `dataKrotka(iso: string): string`, `type Miara`, `interface OpisZmiany`, `opisZmiany(miara: Miara, biez: number, pop: number): OpisZmiany`.

- [ ] **Krok 1: Test**

```ts
import { describe, it, expect } from 'vitest'
import { alertSpadku, dataKrotka, dniOkresu, nazwaZWitryny, okresy, opisZmiany, zmiana } from '@/lib/strony/okresy'

describe('okresy', () => {
  it('bieżący kończy się 3 dni przed dziś i ma 28 dni; poprzedni leży tuż przed nim', () => {
    expect(okresy({ rok: 2026, miesiac: 10, dzien: 4 })).toEqual({
      biezacy: { od: '2026-09-04', do: '2026-10-01' },
      poprzedni: { od: '2026-08-07', do: '2026-09-03' },
    })
  })

  it('przez granicę roku', () => {
    expect(okresy({ rok: 2026, miesiac: 1, dzien: 2 }).biezacy).toEqual({ od: '2025-12-03', do: '2025-12-30' })
  })
})

describe('dniOkresu', () => {
  it('wszystkie dni po kolei, z oboma końcami', () => {
    const dni = dniOkresu({ od: '2026-09-04', do: '2026-10-01' })
    expect(dni).toHaveLength(28)
    expect(dni[0]).toBe('2026-09-04')
    expect(dni[26]).toBe('2026-09-30')
    expect(dni[27]).toBe('2026-10-01')
  })
})

describe('zmiana i alert', () => {
  it('zmiana to ułamek; przy zerze w poprzednim okresie null', () => {
    expect(zmiana(150, 100)).toBe(0.5)
    expect(zmiana(50, 100)).toBe(-0.5)
    expect(zmiana(5, 0)).toBeNull()
    expect(zmiana(0, 0)).toBeNull()
  })

  it('alert od 30% spadku i tylko przy co najmniej 50 kliknięciach wcześniej', () => {
    expect(alertSpadku(70, 100)).toBe(true)
    expect(alertSpadku(71, 100)).toBe(false)
    expect(alertSpadku(35, 50)).toBe(true)
    expect(alertSpadku(0, 49)).toBe(false)
    expect(alertSpadku(0, 0)).toBe(false)
  })
})

describe('nazwaZWitryny i dataKrotka', () => {
  it('domena, prefiks URL ze ścieżką i coś nieczytelnego', () => {
    expect(nazwaZWitryny('sc-domain:jwk26.pl')).toBe('jwk26.pl')
    expect(nazwaZWitryny('https://samorzad.ue.wroc.pl/')).toBe('samorzad.ue.wroc.pl')
    expect(nazwaZWitryny('https://www.uew.pl/dni/')).toBe('www.uew.pl/dni')
    expect(nazwaZWitryny('dziwne')).toBe('dziwne')
  })

  it('data DD.MM', () => {
    expect(dataKrotka('2026-10-01')).toBe('01.10')
  })
})

describe('opisZmiany', () => {
  it('kliknięcia i wyświetlenia w procentach', () => {
    expect(opisZmiany('klikniecia', 150, 100)).toEqual({ tekst: '+50%', kierunek: 'gora', dobra: true })
    expect(opisZmiany('wyswietlenia', 50, 100)).toEqual({ tekst: '-50%', kierunek: 'dol', dobra: false })
    expect(opisZmiany('klikniecia', 100, 100)).toEqual({ tekst: '0%', kierunek: 'brak', dobra: null })
  })

  it('bez poprzedniego okresu - „nowe” albo „-”, nigdy NaN ani Infinity', () => {
    expect(opisZmiany('klikniecia', 7, 0)).toEqual({ tekst: 'nowe', kierunek: 'brak', dobra: null })
    expect(opisZmiany('klikniecia', 0, 0)).toEqual({ tekst: '-', kierunek: 'brak', dobra: null })
    expect(opisZmiany('ctr', 0, 0)).toEqual({ tekst: '-', kierunek: 'brak', dobra: null })
    expect(opisZmiany('pozycja', 0, 9.4)).toEqual({ tekst: '-', kierunek: 'brak', dobra: null })
    expect(opisZmiany('pozycja', 8.2, 0)).toEqual({ tekst: '-', kierunek: 'brak', dobra: null })
  })

  it('CTR w punktach procentowych', () => {
    expect(opisZmiany('ctr', 0.054, 0.05)).toEqual({ tekst: '+0,4 p.p.', kierunek: 'gora', dobra: true })
  })

  it('pozycja: mniejsza liczba to lepiej', () => {
    expect(opisZmiany('pozycja', 8.2, 9.4)).toEqual({ tekst: '-1,2', kierunek: 'dol', dobra: true })
    expect(opisZmiany('pozycja', 9.4, 8.2)).toEqual({ tekst: '+1,2', kierunek: 'gora', dobra: false })
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/strony/okresy.test.ts > "$TMP/vt.log" 2>&1; echo $?`
Expected: `1` (nie ma modułu `@/lib/strony/okresy`).

- [ ] **Krok 3: `lib/strony/okresy.ts`**

```ts
import { przesunDate, type Data } from '@/lib/planer/trwanie'

export const DNI_OKRESU = 28
/** Search Console ma 2-3 dni opóźnienia - ostatnie dni byłyby niepełne i udawały spadek. */
export const OPOZNIENIE_DNI = 3
export const PROG_SPADKU = 0.3
/** Przy kilku kliknięciach 30% to szum, nie spadek. */
export const MIN_KLIKNIEC_ALERTU = 50

/** Daty YYYY-MM-DD, oba końce włącznie - tak przyjmuje je Search Console. */
export interface Okres {
  od: string
  do: string
}

const dwie = (n: number) => String(n).padStart(2, '0')
const naIso = (d: Data) => `${d.rok}-${dwie(d.miesiac)}-${dwie(d.dzien)}`
const zIso = (s: string): Data => {
  const [rok, miesiac, dzien] = s.split('-').map(Number)
  return { rok, miesiac, dzien }
}

export function okresy(dzis: Data): { biezacy: Okres; poprzedni: Okres } {
  const koniec = przesunDate(dzis, -OPOZNIENIE_DNI)
  const poczatek = przesunDate(koniec, -(DNI_OKRESU - 1))
  const koniecPoprzedniego = przesunDate(poczatek, -1)
  const poczatekPoprzedniego = przesunDate(koniecPoprzedniego, -(DNI_OKRESU - 1))
  return {
    biezacy: { od: naIso(poczatek), do: naIso(koniec) },
    poprzedni: { od: naIso(poczatekPoprzedniego), do: naIso(koniecPoprzedniego) },
  }
}

export function dniOkresu(o: Okres): string[] {
  const dni: string[] = []
  let d = zIso(o.od)
  // Bezpiecznik na wypadek odwróconego okresu - nigdy nie więcej niż rok dni.
  for (let i = 0; i < 366; i++) {
    const iso = naIso(d)
    dni.push(iso)
    if (iso >= o.do) break
    d = przesunDate(d, 1)
  }
  return dni
}

/** Ułamek zmiany; `null`, gdy w poprzednim okresie było zero - procent od zera nic nie znaczy. */
export function zmiana(biez: number, pop: number): number | null {
  return pop === 0 ? null : (biez - pop) / pop
}

export function alertSpadku(biez: number, pop: number): boolean {
  return pop >= MIN_KLIKNIEC_ALERTU && (pop - biez) / pop >= PROG_SPADKU
}

/** `sc-domain:jwk26.pl` → `jwk26.pl`; `https://a.pl/b/` → `a.pl/b`. */
export function nazwaZWitryny(witryna: string): string {
  if (witryna.startsWith('sc-domain:')) return witryna.slice('sc-domain:'.length)
  try {
    const u = new URL(witryna)
    return `${u.host}${u.pathname}`.replace(/\/+$/, '')
  } catch {
    return witryna
  }
}

/** `2026-10-01` → `01.10`. */
export function dataKrotka(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`
}

export type Miara = 'klikniecia' | 'wyswietlenia' | 'ctr' | 'pozycja'

export interface OpisZmiany {
  tekst: string
  kierunek: 'gora' | 'dol' | 'brak'
  /** Czy zmiana jest na plus; `null`, gdy nie ma czego oceniać. */
  dobra: boolean | null
}

const BRAK: OpisZmiany = { tekst: '-', kierunek: 'brak', dobra: null }
const jedno = (n: number) => n.toFixed(1).replace('.', ',')
const znak = (n: number) => (n > 0 ? '+' : '')

export function opisZmiany(miara: Miara, biez: number, pop: number): OpisZmiany {
  let roznica: number
  let tekst: string
  if (miara === 'klikniecia' || miara === 'wyswietlenia') {
    const z = zmiana(biez, pop)
    if (z === null) return biez > 0 ? { tekst: 'nowe', kierunek: 'brak', dobra: null } : BRAK
    roznica = Math.round(z * 100)
    tekst = `${znak(roznica)}${roznica}%`
  } else if (miara === 'ctr') {
    if (!biez && !pop) return BRAK
    roznica = Math.round((biez - pop) * 1000) / 10
    tekst = `${znak(roznica)}${jedno(roznica)} p.p.`
  } else {
    // Pozycja 0 znaczy „brak wyświetleń”, a nie pierwsze miejsce.
    if (!biez || !pop) return BRAK
    roznica = Math.round((biez - pop) * 10) / 10
    tekst = `${znak(roznica)}${jedno(roznica)}`
  }
  if (roznica === 0) return { tekst: tekst.replace(/^-/, ''), kierunek: 'brak', dobra: null }
  // Pozycja w Google: mniejsza liczba to wyżej w wynikach.
  const dobra = miara === 'pozycja' ? roznica < 0 : roznica > 0
  return { tekst, kierunek: roznica > 0 ? 'gora' : 'dol', dobra }
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/strony/okresy.test.ts > "$TMP/vt.log" 2>&1; echo $?`
Expected: `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/strony/okresy.ts lib/strony/okresy.test.ts
git commit -m "$(cat <<'EOF'
feat(strony): okresy, zmiana, alert spadku i opis zmiany

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 2: Model i składanie odpowiedzi Google

**Pliki:** nowy `lib/strony/model.ts`, test `lib/strony/model.test.ts`

**Interfejsy:**
- Korzysta z: `alertSpadku`, `dniOkresu`, `zmiana`, `type Okres` z zadania 1.
- Daje: `Liczby`, `WpisStrony`, `StatystykiStrony`, `RodzajBledu`, `WynikStrony`, `PodsumowanieStron`, `DostepneWitryny`, `WierszApi`, `OdpowiedzApi`, `DLUGOSC_NAZWY`, `TYLKO_WLASCICIEL`, `zlozStatystyki(w)`, `podsumujStrony(wyniki)`, `komunikatStrony(rodzaj, email)`.

- [ ] **Krok 1: Test**

```ts
import { describe, it, expect } from 'vitest'
import { komunikatStrony, podsumujStrony, zlozStatystyki, type StatystykiStrony, type WynikStrony } from '@/lib/strony/model'

const OKRES = { od: '2026-09-04', do: '2026-10-01' }
const STRONA = { witryna: 'sc-domain:jwk26.pl', nazwa: 'jwk26.pl' }
const pusta = { rows: undefined }

describe('zlozStatystyki', () => {
  it('sumy, zmiana, alert, zapytania i podstrony', () => {
    const s = zlozStatystyki({
      strona: STRONA,
      okres: OKRES,
      suma: { rows: [{ clicks: 60, impressions: 2000, ctr: 0.03, position: 7.3 }] },
      sumaPoprzednia: { rows: [{ clicks: 100, impressions: 1600, ctr: 0.0625, position: 8.1 }] },
      dzienne: { rows: [{ keys: ['2026-09-05'], clicks: 4, impressions: 90, ctr: 0.04, position: 6 }] },
      zapytania: { rows: [{ keys: ['juwenalia wrocław'], clicks: 20, impressions: 300, ctr: 0.07, position: 4.2 }] },
      podstrony: { rows: [{ keys: ['https://jwk26.pl/zapisy'], clicks: 30, impressions: 900, ctr: 0.03, position: 3.1 }] },
    })
    expect(s.biezace).toEqual({ klikniecia: 60, wyswietlenia: 2000, ctr: 0.03, pozycja: 7.3 })
    expect(s.poprzednie.klikniecia).toBe(100)
    expect(s.zmiana).toEqual({ klikniecia: -0.4, wyswietlenia: 0.25 })
    expect(s.alert).toBe(true)
    expect(s.zapytania).toEqual([{ tekst: 'juwenalia wrocław', klikniecia: 20, wyswietlenia: 300, pozycja: 4.2 }])
    expect(s.podstrony).toEqual([{ adres: 'https://jwk26.pl/zapisy', klikniecia: 30, wyswietlenia: 900, pozycja: 3.1 }])
    expect(s).toMatchObject({ witryna: 'sc-domain:jwk26.pl', nazwa: 'jwk26.pl', okres: OKRES })
  })

  it('dni, których Google nie zwrócił, mają zera - wykres nie łączy linią dziur', () => {
    const s = zlozStatystyki({
      strona: STRONA, okres: OKRES, suma: pusta, sumaPoprzednia: pusta, zapytania: pusta, podstrony: pusta,
      dzienne: { rows: [{ keys: ['2026-09-05'], clicks: 4, impressions: 90, ctr: 0.04, position: 6 }] },
    })
    expect(s.dzienne).toHaveLength(28)
    expect(s.dzienne[0]).toEqual({ data: '2026-09-04', klikniecia: 0, wyswietlenia: 0 })
    expect(s.dzienne[1]).toEqual({ data: '2026-09-05', klikniecia: 4, wyswietlenia: 90 })
  })

  it('pusta odpowiedź - zera, zmiana null, bez alertu, puste listy', () => {
    const s = zlozStatystyki({ strona: STRONA, okres: OKRES, suma: pusta, sumaPoprzednia: pusta, dzienne: pusta, zapytania: pusta, podstrony: pusta })
    expect(s.biezace).toEqual({ klikniecia: 0, wyswietlenia: 0, ctr: 0, pozycja: 0 })
    expect(s.zmiana).toEqual({ klikniecia: null, wyswietlenia: null })
    expect(s.alert).toBe(false)
    expect(s.zapytania).toEqual([])
    expect(s.podstrony).toEqual([])
  })
})

const stat = (k: number, kp: number, alert = false): StatystykiStrony => ({
  witryna: 'w', nazwa: 'w', okres: OKRES,
  biezace: { klikniecia: k, wyswietlenia: k * 10, ctr: 0, pozycja: 0 },
  poprzednie: { klikniecia: kp, wyswietlenia: kp * 10, ctr: 0, pozycja: 0 },
  zmiana: { klikniecia: null, wyswietlenia: null }, dzienne: [], zapytania: [], podstrony: [], alert,
})

describe('podsumujStrony', () => {
  it('sumuje tylko strony, które odpowiedziały; liczy alerty i błędy', () => {
    const wyniki: WynikStrony[] = [
      { ok: true, dane: stat(60, 100, true) },
      { ok: true, dane: stat(40, 20) },
      { ok: false, witryna: 'x', nazwa: 'x', blad: 'brak-dostepu', komunikat: '...' },
    ]
    expect(podsumujStrony(wyniki)).toEqual({
      stron: 3, klikniecia: 100, wyswietlenia: 1000, poprzednieKlikniecia: 120, poprzednieWyswietlenia: 1200, alerty: 1, bledy: 1,
    })
  })

  it('pusta lista', () => {
    expect(podsumujStrony([])).toEqual({
      stron: 0, klikniecia: 0, wyswietlenia: 0, poprzednieKlikniecia: 0, poprzednieWyswietlenia: 0, alerty: 0, bledy: 0,
    })
  })
})

describe('komunikatStrony', () => {
  it('brak dostępu podaje adres konta serwisowego', () => {
    expect(komunikatStrony('brak-dostepu', 'deck@p.iam.gserviceaccount.com')).toMatch(/deck@p\.iam\.gserviceaccount\.com/)
    expect(komunikatStrony('brak-dostepu', 'deck@p.iam.gserviceaccount.com')).toMatch(/Ograniczone/)
    expect(komunikatStrony('api-wylaczone', null)).toMatch(/Google Search Console API/)
    expect(komunikatStrony('inny', null)).toMatch(/spróbuj później/)
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/strony/model.test.ts > "$TMP/vt.log" 2>&1; echo $?`
Expected: `1`.

- [ ] **Krok 3: `lib/strony/model.ts`**

```ts
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
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/strony/model.test.ts > "$TMP/vt.log" 2>&1; echo $?`
Expected: `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/strony/model.ts lib/strony/model.test.ts
git commit -m "$(cat <<'EOF'
feat(strony): model statystyk, podsumowanie i komunikaty bledow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 3: Klient Google Search Console

**Pliki:** nowy `lib/strony/google.ts`, test `lib/strony/google.test.ts`

**Interfejsy:**
- Korzysta z: `RodzajBledu`, `OdpowiedzApi` z zadania 2; `SignJWT`, `importPKCS8` z `jose`; zmienna `FIREBASE_SERVICE_ACCOUNT` (JSON z `client_email` i `private_key`).
- Daje: `class BladGoogle extends Error { rodzaj: RodzajBledu }`, `emailKonta(): string | null`, `rodzajBledu(status: number, tresc: string): RodzajBledu`, `listaWitryn(): Promise<string[]>`, `interface ZapytanieApi { startDate: string; endDate: string; dimensions?: ('date' | 'query' | 'page')[]; rowLimit?: number }`, `zapytanie(witryna: string, z: ZapytanieApi): Promise<OdpowiedzApi>`.

- [ ] **Krok 1: Test**

Środowisko `node`: tak jak w `lib/auth/session.test.ts`, `jose` w jsdom nie rozpoznaje własnego `Uint8Array`. Token żyje w pamięci modułu, więc każdy test ładuje moduł na nowo.

```ts
// @vitest-environment node
// jose w jsdom nie rozpoznaje Uint8Array z innej realm - moduł i tak żyje tylko na serwerze.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair } from 'jose'

const EMAIL = 'deck@projekt.iam.gserviceaccount.com'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
let konto = ''
const fetchMock = vi.fn()

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  konto = JSON.stringify({ client_email: EMAIL, private_key: await exportPKCS8(privateKey) })
})

const odp = (status: number, dane: unknown) =>
  new Response(typeof dane === 'string' ? dane : JSON.stringify(dane), { status })

/** Google, który wydaje token i na każde inne pytanie odpowiada `api`. */
function google(api: { status: number; dane: unknown } = { status: 200, dane: { siteEntry: [] } }) {
  fetchMock.mockImplementation(async (url: string) =>
    url === TOKEN_URL ? odp(200, { access_token: 'tok-1', expires_in: 3600 }) : odp(api.status, api.dane),
  )
}

const wywolaniaTokenu = () => fetchMock.mock.calls.filter(([u]) => u === TOKEN_URL)
const modul = () => import('@/lib/strony/google')

beforeEach(() => {
  vi.resetModules()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', konto)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('token konta serwisowego', () => {
  it('podpisuje JWT kluczem konta i wymienia go na token dostępu', async () => {
    google()
    const { listaWitryn } = await modul()
    await listaWitryn()
    const cialo = new URLSearchParams(wywolaniaTokenu()[0][1].body)
    expect(cialo.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    const jwt = cialo.get('assertion')!
    expect(decodeProtectedHeader(jwt).alg).toBe('RS256')
    expect(decodeJwt(jwt)).toMatchObject({
      iss: EMAIL,
      aud: TOKEN_URL,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    })
    const [, api] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/sites'))!
    expect(api.headers.Authorization).toBe('Bearer tok-1')
  })

  it('ten sam token przy kolejnym pytaniu; nowy 5 minut przed wygaśnięciem', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-04T10:00:00Z'))
    google()
    const { listaWitryn } = await modul()
    await listaWitryn()
    await listaWitryn()
    expect(wywolaniaTokenu()).toHaveLength(1)
    vi.setSystemTime(new Date('2026-10-04T10:56:00Z'))
    await listaWitryn()
    expect(wywolaniaTokenu()).toHaveLength(2)
  })

  it('emailKonta: adres z konta albo null bez konfiguracji', async () => {
    expect((await modul()).emailKonta()).toBe(EMAIL)
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '')
    expect((await modul()).emailKonta()).toBeNull()
  })
})

describe('wywołania Search Console', () => {
  it('listaWitryn pomija witryny bez weryfikacji', async () => {
    google({
      status: 200,
      dane: {
        siteEntry: [
          { siteUrl: 'sc-domain:jwk26.pl', permissionLevel: 'siteRestrictedUser' },
          { siteUrl: 'https://obca.pl/', permissionLevel: 'siteUnverifiedUser' },
        ],
      },
    })
    expect(await (await modul()).listaWitryn()).toEqual(['sc-domain:jwk26.pl'])
  })

  it('zapytanie koduje identyfikator witryny w ścieżce i wysyła parametry', async () => {
    google({ status: 200, dane: { rows: [{ clicks: 5, impressions: 50, ctr: 0.1, position: 3 }] } })
    const { zapytanie } = await modul()
    const w = await zapytanie('sc-domain:jwk26.pl', {
      startDate: '2026-09-04', endDate: '2026-10-01', dimensions: ['query'], rowLimit: 10,
    })
    expect(w.rows?.[0].clicks).toBe(5)
    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(url).toBe('https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Ajwk26.pl/searchAnalytics/query')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ startDate: '2026-09-04', endDate: '2026-10-01', dimensions: ['query'], rowLimit: 10 })
  })

  it('błędy mają rodzaj: brak dostępu, wyłączone API, inny', async () => {
    const przypadki = [
      [403, '{"error":{"message":"User does not have sufficient permission for site"}}', 'brak-dostepu'],
      [403, '{"error":{"message":"Google Search Console API has not been used in project 1 before or it is disabled."}}', 'api-wylaczone'],
      [500, 'Backend Error', 'inny'],
    ] as const
    for (const [status, dane, rodzaj] of przypadki) {
      vi.resetModules()
      google({ status, dane })
      const { zapytanie, BladGoogle } = await modul()
      const blad = await zapytanie('https://samorzad.ue.wroc.pl/', { startDate: '2026-09-04', endDate: '2026-10-01' }).catch((e) => e)
      expect(blad).toBeInstanceOf(BladGoogle)
      expect(blad.rodzaj).toBe(rodzaj)
    }
  })

  it('bez konta serwisowego - BladGoogle, nie wyjątek JSON-a', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '')
    const { listaWitryn, BladGoogle } = await modul()
    await expect(listaWitryn()).rejects.toBeInstanceOf(BladGoogle)
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/strony/google.test.ts > "$TMP/vt.log" 2>&1; echo $?`
Expected: `1`.

- [ ] **Krok 3: `lib/strony/google.ts`**

```ts
import { SignJWT, importPKCS8 } from 'jose'
import type { OdpowiedzApi, RodzajBledu } from './model'

const ZAKRES = 'https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://searchconsole.googleapis.com/webmasters/v3'
/** Token odnawiamy z zapasem - zegar serwera i Google nie muszą się zgadzać co do sekundy. */
const ZAPAS_MS = 5 * 60 * 1000

export class BladGoogle extends Error {
  readonly rodzaj: RodzajBledu
  constructor(rodzaj: RodzajBledu, wiadomosc: string) {
    super(wiadomosc)
    this.name = 'BladGoogle'
    this.rodzaj = rodzaj
  }
}

interface Konto {
  client_email: string
  private_key: string
}

/**
 * To samo konto serwisowe co Firebase Admin - nic nowego do przechowywania.
 * W Search Console dodaje się je jako użytkownika „Ograniczone”.
 */
function konto(): Konto {
  const surowe = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!surowe) throw new BladGoogle('inny', 'Brak FIREBASE_SERVICE_ACCOUNT')
  let k: Partial<Konto>
  try {
    k = JSON.parse(surowe)
  } catch {
    throw new BladGoogle('inny', 'FIREBASE_SERVICE_ACCOUNT nie jest JSON-em')
  }
  if (typeof k.client_email !== 'string' || typeof k.private_key !== 'string') {
    throw new BladGoogle('inny', 'Konto serwisowe bez client_email albo private_key')
  }
  return { client_email: k.client_email, private_key: k.private_key }
}

/** Adres do instrukcji „dodaj użytkownika w Search Console”. */
export function emailKonta(): string | null {
  try {
    return konto().client_email
  } catch {
    return null
  }
}

let token: { wartosc: string; wygasa: number } | null = null

async function tokenDostepu(): Promise<string> {
  const teraz = Date.now()
  if (token && token.wygasa - ZAPAS_MS > teraz) return token.wartosc
  const k = konto()
  const klucz = await importPKCS8(k.private_key, 'RS256')
  const sekundy = Math.floor(teraz / 1000)
  const jwt = await new SignJWT({ scope: ZAKRES })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(k.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(sekundy)
    .setExpirationTime(sekundy + 3600)
    .sign(klucz)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    cache: 'no-store',
  })
  const dane = await res.json().catch(() => ({}))
  if (!res.ok || typeof dane.access_token !== 'string') {
    throw new BladGoogle('inny', `Token Google ${res.status}: ${dane.error_description ?? dane.error ?? ''}`.trim())
  }
  token = { wartosc: dane.access_token, wygasa: teraz + (Number(dane.expires_in) || 3600) * 1000 }
  return token.wartosc
}

/** Wyłączone API też daje 403 - rozpoznajemy je po treści, bo instrukcja naprawy jest inna. */
export function rodzajBledu(status: number, tresc: string): RodzajBledu {
  if (/has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(tresc)) return 'api-wylaczone'
  if (status === 401 || status === 403) return 'brak-dostepu'
  return 'inny'
}

async function wywolaj<T>(sciezka: string, cialo?: unknown): Promise<T> {
  const naglowki: Record<string, string> = { Authorization: `Bearer ${await tokenDostepu()}` }
  if (cialo !== undefined) naglowki['Content-Type'] = 'application/json'
  const res = await fetch(`${API}${sciezka}`, {
    method: cialo === undefined ? 'GET' : 'POST',
    headers: naglowki,
    body: cialo === undefined ? undefined : JSON.stringify(cialo),
    // Cache robi `lib/strony/dane.ts` na całych statystykach - klucz `fetch`
    // zawierałby nagłówek z tokenem, który zmienia się co godzinę.
    cache: 'no-store',
  })
  if (!res.ok) {
    const tresc = await res.text().catch(() => '')
    throw new BladGoogle(rodzajBledu(res.status, tresc), `Search Console ${res.status}: ${tresc.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

/** Witryny, do których konto ma dostęp. Niezweryfikowane pomijamy - i tak nie dadzą danych. */
export async function listaWitryn(): Promise<string[]> {
  const d = await wywolaj<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>('/sites')
  return (d.siteEntry ?? []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser').map((s) => s.siteUrl)
}

export interface ZapytanieApi {
  startDate: string
  endDate: string
  dimensions?: ('date' | 'query' | 'page')[]
  rowLimit?: number
}

export async function zapytanie(witryna: string, z: ZapytanieApi): Promise<OdpowiedzApi> {
  return wywolaj<OdpowiedzApi>(`/sites/${encodeURIComponent(witryna)}/searchAnalytics/query`, z)
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/strony/google.test.ts > "$TMP/vt.log" 2>&1; echo $?`
Expected: `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/strony/google.ts lib/strony/google.test.ts
git commit -m "$(cat <<'EOF'
feat(strony): klient Search Console na koncie serwisowym

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 4: Lista stron w Firestore i statystyki z cache

**Pliki:** zmiana `lib/firebase/admin.ts`; nowy `lib/strony/dane.ts`, test `lib/strony/dane.test.ts`

**Interfejsy:**
- Korzysta z: `zapytanie`, `BladGoogle`, `emailKonta` (zadanie 3); `zlozStatystyki`, `komunikatStrony`, typy (zadanie 2); `okresy`, `nazwaZWitryny`, `type Okres` (zadanie 1); `dzisWarszawa(teraz: Date): Data` z `@/lib/czas`; `unstable_cache` z `next/cache`.
- Daje: `stronyRef()` w `admin.ts`; `listaStron(): Promise<WpisStrony[]>`, `dodajStrone(wpis: WpisStrony): Promise<void>`, `usunStrone(witryna: string): Promise<void>`, `statystykiStron(teraz?: Date): Promise<WynikStrony[]>` (rzuca tylko, gdy nie da się odczytać listy).

- [ ] **Krok 1: Test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

let zapisane: unknown
const zapytanie = vi.fn()
vi.mock('next/cache', () => ({ unstable_cache: (f: unknown) => f }))
vi.mock('@/lib/firebase/admin', () => ({
  stronyRef: () => ({
    get: async () => ({ data: () => zapisane }),
    set: async (d: unknown) => {
      zapisane = d
    },
  }),
}))
vi.mock('@/lib/strony/google', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/strony/google')>()),
  zapytanie: (...a: unknown[]) => zapytanie(...a),
}))

import { dodajStrone, listaStron, statystykiStron, usunStrone } from '@/lib/strony/dane'
import { BladGoogle } from '@/lib/strony/google'

beforeEach(() => {
  zapisane = undefined
  zapytanie.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('lista stron', () => {
  it('bez dokumentu pusta; zepsute wpisy pominięte; brak nazwy - nazwa z adresu', async () => {
    expect(await listaStron()).toEqual([])
    zapisane = { witryny: [{ witryna: 'sc-domain:jwk26.pl', nazwa: ' JWK 26 ' }, { nazwa: 'bez adresu' }, { witryna: 'https://samorzad.ue.wroc.pl/' }] }
    expect(await listaStron()).toEqual([
      { witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK 26' },
      { witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'samorzad.ue.wroc.pl' },
    ])
  })

  it('dodaje bez dublowania i usuwa', async () => {
    await dodajStrone({ witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK' })
    await dodajStrone({ witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK' })
    await dodajStrone({ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'Samorząd' })
    expect((await listaStron()).map((s) => s.witryna)).toEqual(['sc-domain:jwk26.pl', 'https://samorzad.ue.wroc.pl/'])
    await usunStrone('sc-domain:jwk26.pl')
    expect(await listaStron()).toEqual([{ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'Samorząd' }])
  })
})

describe('statystykiStron', () => {
  it('pyta o okres liczony od daty Warszawy; błąd jednej strony nie zasłania drugiej', async () => {
    zapisane = { witryny: [{ witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK' }, { witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'Samorząd' }] }
    zapytanie.mockImplementation(async (witryna: string) => {
      if (witryna.startsWith('https://samorzad')) throw new BladGoogle('brak-dostepu', '403')
      return { rows: [{ keys: ['x'], clicks: 10, impressions: 100, ctr: 0.1, position: 5 }] }
    })
    const wyniki = await statystykiStron(new Date('2026-10-04T10:00:00Z'))
    expect(zapytanie).toHaveBeenCalledWith('sc-domain:jwk26.pl', {
      startDate: '2026-09-04', endDate: '2026-10-01', dimensions: ['query'], rowLimit: 10,
    })
    expect(zapytanie).toHaveBeenCalledWith('sc-domain:jwk26.pl', { startDate: '2026-08-07', endDate: '2026-09-03' })
    expect(wyniki[0]).toMatchObject({ ok: true, dane: { nazwa: 'JWK', biezace: { klikniecia: 10 } } })
    expect(wyniki[1]).toMatchObject({ ok: false, witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'Samorząd', blad: 'brak-dostepu' })
    expect(wyniki[1].ok === false && wyniki[1].komunikat).toMatch(/Ograniczone/)
  })

  it('nieznany błąd to „inny”', async () => {
    zapisane = { witryny: [{ witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK' }] }
    zapytanie.mockRejectedValue(new Error('sieć'))
    expect((await statystykiStron())[0]).toMatchObject({ ok: false, blad: 'inny' })
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/strony/dane.test.ts > "$TMP/vt.log" 2>&1; echo $?`
Expected: `1`.

- [ ] **Krok 3: `stronyRef` na końcu `lib/firebase/admin.ts`**

```ts
/**
 * Lista stron panelu Strony. Celowo poza `ustawienia/` - tamtą kolekcję reguła
 * daje do odczytu zarządowi, a strony są tylko dla właściciela. Kolekcja
 * `strony` nie ma reguły klienta, więc zamyka ją reguła końcowa.
 */
export function stronyRef() {
  return bazaAdmin().collection('strony').doc('lista')
}
```

- [ ] **Krok 4: `lib/strony/dane.ts`**

```ts
import { unstable_cache } from 'next/cache'
import { stronyRef } from '@/lib/firebase/admin'
import { dzisWarszawa } from '@/lib/czas'
import { BladGoogle, emailKonta, zapytanie } from './google'
import { nazwaZWitryny, okresy, type Okres } from './okresy'
import { komunikatStrony, zlozStatystyki, type StatystykiStrony, type WpisStrony, type WynikStrony } from './model'

/** Dane Google mają 2-3 dni opóźnienia - częstsze pytanie nic nie da, a kosztuje CPU wspólnego konta Vercel. */
const CACHE_S = 6 * 60 * 60

export async function listaStron(): Promise<WpisStrony[]> {
  const d = (await stronyRef().get()).data()
  const surowe: unknown[] = Array.isArray(d?.witryny) ? d.witryny : []
  return surowe.flatMap((x) => {
    const w = x as { witryna?: unknown; nazwa?: unknown }
    if (typeof w?.witryna !== 'string' || !w.witryna) return []
    const nazwa = typeof w.nazwa === 'string' && w.nazwa.trim() ? w.nazwa.trim() : nazwaZWitryny(w.witryna)
    return [{ witryna: w.witryna, nazwa }]
  })
}

export async function dodajStrone(wpis: WpisStrony): Promise<void> {
  const lista = await listaStron()
  if (lista.some((s) => s.witryna === wpis.witryna)) return
  await stronyRef().set({ witryny: [...lista, wpis] })
}

export async function usunStrone(witryna: string): Promise<void> {
  const lista = await listaStron()
  await stronyRef().set({ witryny: lista.filter((s) => s.witryna !== witryna) })
}

/**
 * Pięć zapytań na witrynę, równolegle. Argumenty są kluczem cache, więc nowy
 * dzień (nowe okresy) to nowy wpis. Wyjątek nie trafia do cache - dodanie
 * uprawnień w Search Console działa od następnego wejścia.
 */
const pobierzStatystyki = unstable_cache(
  async (strona: WpisStrony, biezacy: Okres, poprzedni: Okres): Promise<StatystykiStrony> => {
    const okres = { startDate: biezacy.od, endDate: biezacy.do }
    const [suma, sumaPoprzednia, dzienne, zapytania, podstrony] = await Promise.all([
      zapytanie(strona.witryna, okres),
      zapytanie(strona.witryna, { startDate: poprzedni.od, endDate: poprzedni.do }),
      zapytanie(strona.witryna, { ...okres, dimensions: ['date'] }),
      zapytanie(strona.witryna, { ...okres, dimensions: ['query'], rowLimit: 10 }),
      zapytanie(strona.witryna, { ...okres, dimensions: ['page'], rowLimit: 10 }),
    ])
    return zlozStatystyki({ strona, okres: biezacy, suma, sumaPoprzednia, dzienne, zapytania, podstrony })
  },
  ['strony-statystyki'],
  { revalidate: CACHE_S, tags: ['strony'] },
)

/** Błąd jednej witryny zostaje w jej wyniku. Rzuca tylko, gdy nie da się odczytać listy. */
export async function statystykiStron(teraz = new Date()): Promise<WynikStrony[]> {
  const lista = await listaStron()
  const { biezacy, poprzedni } = okresy(dzisWarszawa(teraz))
  return Promise.all(
    lista.map(async (strona): Promise<WynikStrony> => {
      try {
        return { ok: true, dane: await pobierzStatystyki(strona, biezacy, poprzedni) }
      } catch (e) {
        console.error('[strony]', strona.witryna, e)
        const blad = e instanceof BladGoogle ? e.rodzaj : 'inny'
        return { ok: false, witryna: strona.witryna, nazwa: strona.nazwa, blad, komunikat: komunikatStrony(blad, emailKonta()) }
      }
    }),
  )
}
```

- [ ] **Krok 5: Uruchom - ma przejść**

Run: `npx vitest run lib/strony/dane.test.ts > "$TMP/vt.log" 2>&1; echo $?`
Expected: `0`.

- [ ] **Krok 6: Commit**

```bash
git add lib/firebase/admin.ts lib/strony/dane.ts lib/strony/dane.test.ts
git commit -m "$(cat <<'EOF'
feat(strony): lista stron w bazie i statystyki z cache 6 h

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 5: Trasy `/api/strony`

**Pliki:** zmiana `lib/asystent/tylkoWlasciciel.ts` i jego testu; nowe `app/api/strony/route.ts`, `app/api/strony/dostepne/route.ts`, test `app/api/strony/route.test.ts`

**Interfejsy:**
- Korzysta z: `statystykiStron`, `listaStron`, `dodajStrone`, `usunStrone` (zadanie 4); `listaWitryn`, `emailKonta`, `BladGoogle` (zadanie 3); `komunikatStrony`, `DLUGOSC_NAZWY`, `TYLKO_WLASCICIEL`, `DostepneWitryny` (zadanie 2); `nazwaZWitryny` (zadanie 1).
- Daje: `tylkoWlasciciel(req, komunikat?)`; `GET /api/strony` → `WynikStrony[]`; `POST /api/strony` `{ witryna, nazwa? }` → 201 `WpisStrony`; `DELETE /api/strony?witryna=…` → `{ ok: true }`; `GET /api/strony/dostepne` → `DostepneWitryny` (zawsze 200 dla właściciela, błąd Google w polu `blad`).

- [ ] **Krok 1: Test bramki - dopisz w `lib/asystent/tylkoWlasciciel.test.ts`**

```ts
  it('przyjmuje własny komunikat odmowy', async () => {
    ktoPyta.mockResolvedValueOnce({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    const { odmowa } = await tylkoWlasciciel({} as never, 'Strony są tylko dla właściciela')
    expect(await odmowa?.json()).toEqual({ error: 'Strony są tylko dla właściciela' })
  })
```

- [ ] **Krok 2: Test tras - `app/api/strony/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST, DELETE } from '@/app/api/strony/route'
import { GET as dostepne } from '@/app/api/strony/dostepne/route'
import { BladGoogle } from '@/lib/strony/google'

const ktoPyta = vi.fn()
const listaWitryn = vi.fn()
const dane = { statystykiStron: vi.fn(), listaStron: vi.fn(), dodajStrone: vi.fn(), usunStrone: vi.fn() }
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/strony/dane', () => ({
  statystykiStron: (...a: unknown[]) => dane.statystykiStron(...a),
  listaStron: (...a: unknown[]) => dane.listaStron(...a),
  dodajStrone: (...a: unknown[]) => dane.dodajStrone(...a),
  usunStrone: (...a: unknown[]) => dane.usunStrone(...a),
}))
vi.mock('@/lib/strony/google', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/strony/google')>()),
  listaWitryn: (...a: unknown[]) => listaWitryn(...a),
  emailKonta: () => 'deck@p.iam.gserviceaccount.com',
}))

const zadanie = (body?: unknown, szukaj = '') =>
  ({ json: async () => body, nextUrl: new URL(`http://deck.test/api/strony${szukaj}`) }) as never

beforeEach(() => {
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'ja', rola: 'owner' })
  listaWitryn.mockReset().mockResolvedValue(['sc-domain:jwk26.pl', 'https://samorzad.ue.wroc.pl/'])
  Object.values(dane).forEach((f) => f.mockReset())
  dane.listaStron.mockResolvedValue([])
})

describe('/api/strony - dostęp', () => {
  it('bez sesji 401, zarząd 403 z komunikatem o stronach', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await GET(zadanie())).status).toBe(401)
    expect((await dostepne(zadanie())).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    const res = await POST(zadanie({ witryna: 'sc-domain:jwk26.pl' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Strony są tylko dla właściciela')
    expect((await DELETE(zadanie(undefined, '?witryna=x'))).status).toBe(403)
    expect(dane.dodajStrone).not.toHaveBeenCalled()
    expect(dane.usunStrone).not.toHaveBeenCalled()
  })
})

describe('/api/strony', () => {
  it('GET zwraca wyniki stron', async () => {
    dane.statystykiStron.mockResolvedValue([{ ok: false, witryna: 'x', nazwa: 'x', blad: 'inny', komunikat: '...' }])
    expect(await (await GET(zadanie())).json()).toHaveLength(1)
  })

  it('POST dodaje tylko witrynę z Search Console; nazwa z adresu albo przycięta', async () => {
    const res = await POST(zadanie({ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: '  ' }))
    expect(res.status).toBe(201)
    expect(dane.dodajStrone).toHaveBeenCalledWith({ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'samorzad.ue.wroc.pl' })
    await POST(zadanie({ witryna: 'sc-domain:jwk26.pl', nazwa: 'x'.repeat(80) }))
    expect(dane.dodajStrone).toHaveBeenLastCalledWith({ witryna: 'sc-domain:jwk26.pl', nazwa: 'x'.repeat(60) })
  })

  it('POST: pusta 400, spoza Search Console 400, Google zawiódł 502', async () => {
    expect((await POST(zadanie({ witryna: ' ' }))).status).toBe(400)
    expect((await POST(zadanie(null))).status).toBe(400)
    expect((await POST(zadanie({ witryna: 'https://obca.pl/' }))).status).toBe(400)
    listaWitryn.mockRejectedValue(new BladGoogle('api-wylaczone', '403'))
    const res = await POST(zadanie({ witryna: 'sc-domain:jwk26.pl' }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/Google Search Console API/)
    expect(dane.dodajStrone).not.toHaveBeenCalled()
  })

  it('DELETE odkodowuje adres witryny; bez parametru 400', async () => {
    const res = await DELETE(zadanie(undefined, `?witryna=${encodeURIComponent('https://samorzad.ue.wroc.pl/')}`))
    expect(res.status).toBe(200)
    expect(dane.usunStrone).toHaveBeenCalledWith('https://samorzad.ue.wroc.pl/')
    expect((await DELETE(zadanie())).status).toBe(400)
  })
})

describe('/api/strony/dostepne', () => {
  it('witryny spoza listy z nazwą i adres konta serwisowego', async () => {
    dane.listaStron.mockResolvedValue([{ witryna: 'sc-domain:jwk26.pl', nazwa: 'JWK' }])
    expect(await (await dostepne(zadanie())).json()).toEqual({
      email: 'deck@p.iam.gserviceaccount.com',
      witryny: [{ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'samorzad.ue.wroc.pl' }],
      blad: null,
    })
  })

  it('błąd Google - 200 z komunikatem, żeby panel pokazał instrukcję', async () => {
    listaWitryn.mockRejectedValue(new BladGoogle('brak-dostepu', '403'))
    const res = await dostepne(zadanie())
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.witryny).toEqual([])
    expect(d.blad).toMatch(/deck@p\.iam\.gserviceaccount\.com/)
  })
})
```

- [ ] **Krok 3: Uruchom - ma paść**

Run: `npx vitest run lib/asystent/tylkoWlasciciel.test.ts app/api/strony/route.test.ts > "$TMP/vt.log" 2>&1; echo $?`
Expected: `1`.

- [ ] **Krok 4: `lib/asystent/tylkoWlasciciel.ts` - drugi parametr**

Zamień całą funkcję na:

```ts
/** Wspólna bramka tras tylko dla właściciela: bez sesji 401, zarząd 403. */
export async function tylkoWlasciciel(
  req: NextRequest,
  komunikat = 'Asystent jest tylko dla właściciela',
): Promise<{ kto: Pytajacy; odmowa: null } | { kto: null; odmowa: NextResponse }> {
  const kto = await ktoPyta(req)
  if (!kto) return { kto: null, odmowa: NextResponse.json({ error: 'Wymagane logowanie' }, { status: 401 }) }
  if (kto.rola !== 'owner') return { kto: null, odmowa: NextResponse.json({ error: komunikat }, { status: 403 }) }
  return { kto, odmowa: null }
}
```

- [ ] **Krok 5: `app/api/strony/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { dodajStrone, statystykiStron, usunStrone } from '@/lib/strony/dane'
import { BladGoogle, emailKonta, listaWitryn } from '@/lib/strony/google'
import { DLUGOSC_NAZWY, TYLKO_WLASCICIEL, komunikatStrony } from '@/lib/strony/model'
import { nazwaZWitryny } from '@/lib/strony/okresy'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  return NextResponse.json(await statystykiStron())
}

/** Dodać można tylko witrynę z listy Search Console - ręcznie wpisany adres myliłby domenę z prefiksem URL. */
export async function POST(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const body = await req.json().catch(() => null)
  const witryna = typeof body?.witryna === 'string' ? body.witryna.trim() : ''
  if (!witryna) return NextResponse.json({ error: 'Wybierz witrynę' }, { status: 400 })

  let dostepne: string[]
  try {
    dostepne = await listaWitryn()
  } catch (e) {
    const rodzaj = e instanceof BladGoogle ? e.rodzaj : 'inny'
    return NextResponse.json({ error: komunikatStrony(rodzaj, emailKonta()) }, { status: 502 })
  }
  if (!dostepne.includes(witryna)) {
    return NextResponse.json({ error: 'Konto serwisowe nie ma dostępu do tej witryny w Search Console.' }, { status: 400 })
  }

  const nazwa =
    typeof body?.nazwa === 'string' && body.nazwa.trim() ? body.nazwa.trim().slice(0, DLUGOSC_NAZWY) : nazwaZWitryny(witryna)
  await dodajStrone({ witryna, nazwa })
  return NextResponse.json({ witryna, nazwa }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const witryna = req.nextUrl.searchParams.get('witryna')
  if (!witryna) return NextResponse.json({ error: 'Brak witryny' }, { status: 400 })
  await usunStrone(witryna)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Krok 6: `app/api/strony/dostepne/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { listaStron } from '@/lib/strony/dane'
import { BladGoogle, emailKonta, listaWitryn } from '@/lib/strony/google'
import { TYLKO_WLASCICIEL, komunikatStrony, type DostepneWitryny } from '@/lib/strony/model'
import { nazwaZWitryny } from '@/lib/strony/okresy'

export const runtime = 'nodejs'

/** Witryny do dodania. Błąd Google idzie w polu `blad` - panel pokazuje wtedy instrukcję zamiast listy. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const email = emailKonta()
  try {
    const [wszystkie, lista] = await Promise.all([listaWitryn(), listaStron()])
    const obecne = new Set(lista.map((s) => s.witryna))
    const witryny = wszystkie.filter((w) => !obecne.has(w)).map((w) => ({ witryna: w, nazwa: nazwaZWitryny(w) }))
    return NextResponse.json({ email, witryny, blad: null } satisfies DostepneWitryny)
  } catch (e) {
    const rodzaj = e instanceof BladGoogle ? e.rodzaj : 'inny'
    return NextResponse.json({ email, witryny: [], blad: komunikatStrony(rodzaj, email) } satisfies DostepneWitryny)
  }
}
```

- [ ] **Krok 7: Uruchom - ma przejść (z testami tras asystenta, które używają bramki)**

Run: `npx vitest run lib/asystent/tylkoWlasciciel.test.ts app/api/strony app/api/asystent > "$TMP/vt.log" 2>&1; echo $?`
Expected: `0`.

- [ ] **Krok 8: Commit**

```bash
git add lib/asystent/tylkoWlasciciel.ts lib/asystent/tylkoWlasciciel.test.ts app/api/strony
git commit -m "$(cat <<'EOF'
feat(strony): trasy listy stron i dostepnych witryn

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 6: Dodawanie i usuwanie stron w przeglądarce

**Pliki:** zmiana `lib/asystent/klient.ts`; nowe `lib/strony/klient.ts`, `components/strony/InstrukcjaDostepu.tsx`, `components/strony/DodajStrone.tsx`, `components/strony/UsunStrone.tsx`, test `components/strony/ZarzadzanieStronami.test.tsx`

**Interfejsy:**
- Korzysta z: tras z zadania 5; `DostepneWitryny`, `WpisStrony`, `DLUGOSC_NAZWY` (zadanie 2); `wywolaj`, `json`, `BladKlienta` z `lib/asystent/klient.ts` (po wyeksportowaniu).
- Daje: `klientStron.dostepne() / dodaj(witryna, nazwa) / usun(witryna)`; komponenty `InstrukcjaDostepu({ email })`, `DodajStrone()`, `UsunStrone({ witryna, nazwa })`. Po zmianie oba wołają `router.refresh()`.

- [ ] **Krok 1: Test**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DodajStrone } from '@/components/strony/DodajStrone'
import { UsunStrone } from '@/components/strony/UsunStrone'

const refresh = vi.fn()
const klient = { dostepne: vi.fn(), dodaj: vi.fn(), usun: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/lib/strony/klient', () => ({
  klientStron: {
    dostepne: (...a: unknown[]) => klient.dostepne(...a),
    dodaj: (...a: unknown[]) => klient.dodaj(...a),
    usun: (...a: unknown[]) => klient.usun(...a),
  },
}))

const EMAIL = 'deck@p.iam.gserviceaccount.com'

beforeEach(() => {
  refresh.mockReset()
  Object.values(klient).forEach((f) => f.mockReset())
})

async function otworz() {
  render(<DodajStrone />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Dodaj stronę/ }))
  })
}

describe('DodajStrone', () => {
  it('wybór z listy Search Console, nazwa podpowiedziana, po dodaniu odświeża panel', async () => {
    klient.dostepne.mockResolvedValue({
      email: EMAIL,
      witryny: [
        { witryna: 'sc-domain:jwk26.pl', nazwa: 'jwk26.pl' },
        { witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'samorzad.ue.wroc.pl' },
      ],
      blad: null,
    })
    klient.dodaj.mockResolvedValue({ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'Samorząd' })
    await otworz()
    expect(screen.getByLabelText('Nazwa w panelu')).toHaveValue('jwk26.pl')
    fireEvent.change(screen.getByLabelText('Witryna z Search Console'), { target: { value: 'https://samorzad.ue.wroc.pl/' } })
    expect(screen.getByLabelText('Nazwa w panelu')).toHaveValue('samorzad.ue.wroc.pl')
    fireEvent.change(screen.getByLabelText('Nazwa w panelu'), { target: { value: 'Samorząd' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }))
    })
    expect(klient.dodaj).toHaveBeenCalledWith('https://samorzad.ue.wroc.pl/', 'Samorząd')
    expect(refresh).toHaveBeenCalled()
  })

  it('pusta lista - instrukcja z adresem konta serwisowego', async () => {
    klient.dostepne.mockResolvedValue({ email: EMAIL, witryny: [], blad: null })
    await otworz()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    expect(screen.getByText(/Ograniczone/)).toBeInTheDocument()
  })

  it('błąd Search Console i błąd dodawania widać, panel się nie odświeża', async () => {
    klient.dostepne.mockResolvedValue({ email: EMAIL, witryny: [], blad: 'Google Search Console API jest wyłączone.' })
    await otworz()
    expect(screen.getByRole('alert')).toHaveTextContent('Google Search Console API jest wyłączone.')

    klient.dostepne.mockResolvedValue({ email: EMAIL, witryny: [{ witryna: 'sc-domain:jwk26.pl', nazwa: 'jwk26.pl' }], blad: null })
    klient.dodaj.mockRejectedValue(new Error('Konto serwisowe nie ma dostępu do tej witryny w Search Console.'))
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Dodaj stronę/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/nie ma dostępu/)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('UsunStrone', () => {
  it('pyta o potwierdzenie, usuwa po „Tak” i odświeża', async () => {
    klient.usun.mockResolvedValue({ ok: true })
    render(<UsunStrone witryna="https://samorzad.ue.wroc.pl/" nazwa="Samorząd" />)
    fireEvent.click(screen.getByRole('button', { name: /Usuń z listy/ }))
    expect(screen.getByText('Usunąć Samorząd z listy?')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tak, usuń' }))
    })
    expect(klient.usun).toHaveBeenCalledWith('https://samorzad.ue.wroc.pl/')
    expect(refresh).toHaveBeenCalled()
  })

  it('„Nie” wraca bez usuwania', () => {
    render(<UsunStrone witryna="w" nazwa="W" />)
    fireEvent.click(screen.getByRole('button', { name: /Usuń z listy/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Nie' }))
    expect(klient.usun).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Usuń z listy/ })).toBeInTheDocument()
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/strony/ZarzadzanieStronami.test.tsx > "$TMP/vt.log" 2>&1; echo $?`
Expected: `1`.

- [ ] **Krok 3: Wyeksportuj pomocników w `lib/asystent/klient.ts`**

Zamień `async function wywolaj<T>(` na `export async function wywolaj<T>(` i `const json = (` na `export const json = (`. Nic więcej się nie zmienia.

- [ ] **Krok 4: `lib/strony/klient.ts`**

```ts
'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type { DostepneWitryny, WpisStrony } from './model'

export const klientStron = {
  dostepne: () => wywolaj<DostepneWitryny>('/api/strony/dostepne'),
  dodaj: (witryna: string, nazwa: string) => wywolaj<WpisStrony>('/api/strony', json('POST', { witryna, nazwa })),
  // Identyfikator ma „:” i „/” - bez kodowania serwer dostałby obcięty adres.
  usun: (witryna: string) =>
    wywolaj<{ ok: true }>(`/api/strony?witryna=${encodeURIComponent(witryna)}`, { method: 'DELETE' }),
}
```

- [ ] **Krok 5: `components/strony/InstrukcjaDostepu.tsx`**

```tsx
/** Jednorazowa konfiguracja Search Console - ta sama w pustym panelu i przy dodawaniu. */
export function InstrukcjaDostepu({ email }: { email: string | null }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-[12px] leading-relaxed text-deck-muted">
      <li>W Google Cloud, w projekcie Firebase, włącz „Google Search Console API”.</li>
      <li>
        W Search Console strony: Ustawienia → Użytkownicy i uprawnienia → Dodaj użytkownika:{' '}
        <code className="break-all text-deck-text">{email ?? 'adres konta serwisowego (client_email)'}</code>, uprawnienie
        „Ograniczone”.
      </li>
      <li>Stronę, której nie ma w Search Console, najpierw tam dodaj i zweryfikuj.</li>
    </ol>
  )
}
```

- [ ] **Krok 6: `components/strony/DodajStrone.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { klientStron } from '@/lib/strony/klient'
import { DLUGOSC_NAZWY, type DostepneWitryny } from '@/lib/strony/model'
import { InstrukcjaDostepu } from './InstrukcjaDostepu'

export function DodajStrone() {
  const router = useRouter()
  const [otwarte, setOtwarte] = useState(false)
  const [dostepne, setDostepne] = useState<DostepneWitryny | null>(null)
  const [wybrana, setWybrana] = useState('')
  const [nazwa, setNazwa] = useState('')
  const [blad, setBlad] = useState<string | null>(null)
  const [trwa, setTrwa] = useState(false)

  async function otworz() {
    setOtwarte(true)
    setBlad(null)
    setDostepne(null)
    try {
      const d = await klientStron.dostepne()
      setDostepne(d)
      setWybrana(d.witryny[0]?.witryna ?? '')
      setNazwa(d.witryny[0]?.nazwa ?? '')
    } catch (e) {
      setBlad((e as Error).message)
    }
  }

  function wybierz(witryna: string) {
    setWybrana(witryna)
    setNazwa(dostepne?.witryny.find((w) => w.witryna === witryna)?.nazwa ?? '')
  }

  async function dodaj(e: React.FormEvent) {
    e.preventDefault()
    if (!wybrana || trwa) return
    setTrwa(true)
    setBlad(null)
    try {
      await klientStron.dodaj(wybrana, nazwa.trim())
      setOtwarte(false)
      router.refresh()
    } catch (er) {
      setBlad((er as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  if (!otwarte) {
    return (
      <button type="button" onClick={otworz} className="deck-button inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px]">
        <Plus size={13} aria-hidden="true" /> Dodaj stronę
      </button>
    )
  }

  return (
    <section aria-label="Dodaj stronę" className="deck-card w-full max-w-[520px] space-y-3 rounded-lg p-4 text-[12.5px]">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-deck-text">Dodaj stronę</h2>
        <button type="button" onClick={() => setOtwarte(false)} className="text-[11.5px] text-deck-muted hover:underline">
          Zamknij
        </button>
      </div>
      {blad && <p role="alert" className="text-[11.5px] text-deck-danger">{blad}</p>}
      {dostepne === null && !blad && <p className="font-mono text-[11px] text-deck-muted">Pytam Search Console…</p>}
      {dostepne?.blad && <p role="alert" className="text-[11.5px] text-deck-danger">{dostepne.blad}</p>}
      {dostepne && !dostepne.blad && dostepne.witryny.length === 0 && (
        <>
          <p className="text-deck-muted">Search Console nie pokazuje żadnej nowej witryny. Żeby się pojawiła:</p>
          <InstrukcjaDostepu email={dostepne.email} />
        </>
      )}
      {dostepne && dostepne.witryny.length > 0 && (
        <form onSubmit={dodaj} className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-deck-muted">Witryna z Search Console</span>
            <select value={wybrana} onChange={(e) => wybierz(e.target.value)} className="deck-input w-full rounded-md px-2.5 py-1.5">
              {dostepne.witryny.map((w) => (
                <option key={w.witryna} value={w.witryna}>
                  {w.witryna}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-deck-muted">Nazwa w panelu</span>
            <input
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              maxLength={DLUGOSC_NAZWY}
              className="deck-input w-full rounded-md px-2.5 py-1.5"
            />
          </label>
          <button type="submit" disabled={!wybrana || trwa} className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
            {trwa ? 'Dodaję…' : 'Dodaj'}
          </button>
        </form>
      )}
    </section>
  )
}
```

- [ ] **Krok 7: `components/strony/UsunStrone.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { klientStron } from '@/lib/strony/klient'
import type { WpisStrony } from '@/lib/strony/model'

export function UsunStrone({ witryna, nazwa }: WpisStrony) {
  const router = useRouter()
  const [pyta, setPyta] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)

  async function usun() {
    setBlad(null)
    try {
      await klientStron.usun(witryna)
      router.refresh()
    } catch (e) {
      setBlad((e as Error).message)
      setPyta(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
      {blad && <span role="alert" className="text-deck-danger">{blad}</span>}
      {pyta ? (
        <>
          <span className="text-deck-muted">Usunąć {nazwa} z listy?</span>
          <button type="button" onClick={usun} className="text-deck-danger hover:underline">
            Tak, usuń
          </button>
          <button type="button" onClick={() => setPyta(false)} className="text-deck-muted hover:underline">
            Nie
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setPyta(true)}
          className="inline-flex items-center gap-1 text-deck-muted transition hover:text-deck-danger"
        >
          <Trash2 size={12} aria-hidden="true" /> Usuń z listy
        </button>
      )}
    </div>
  )
}
```

- [ ] **Krok 8: Uruchom - ma przejść (z testami czatu, który używa `klient.ts`)**

Run: `npx vitest run components/strony components/deck/CzatDeck.test.tsx > "$TMP/vt.log" 2>&1; echo $?`
Expected: `0`.

- [ ] **Krok 9: Commit**

```bash
git add lib/asystent/klient.ts lib/strony/klient.ts components/strony
git commit -m "$(cat <<'EOF'
feat(strony): dodawanie i usuwanie stron z instrukcja dostepu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 7: Panel `/strony`

**Pliki:** nowe `components/strony/WykresStrony.tsx`, `components/strony/ZakladkaStrony.tsx`, `components/strony/PanelStron.tsx`, `app/strony/page.tsx`, test `components/strony/PanelStron.test.tsx`

**Interfejsy:**
- Korzysta z: `statystykiStron` (zadanie 4), `emailKonta` (zadanie 3), `podsumujStrony`, typy (zadanie 2), `okresy`, `opisZmiany`, `dataKrotka`, `DNI_OKRESU` (zadanie 1), `DodajStrone`, `UsunStrone`, `InstrukcjaDostepu` (zadanie 6), `odmiana` z `@/lib/asystent/fakty`, `chartTheme`, `axisTick`, `tooltipStyle` z `@/lib/chartTheme`, `ktoNaStronie` z `@/lib/auth/naStronie`.
- Daje: `PanelStron({ wyniki: Promise<WynikStrony[] | null>; email: string | null })`, `SzkieletStron()`, `ZakladkaStrony({ wynik })`, `Liczba`, `Zmiana`, `liczba(n)`, `WykresStrony({ dzienne })`.

**Wykres:** dwa małe wykresy jeden pod drugim (kliknięcia, wyświetlenia), wspólna oś dni, każdy z jedną osią Y. Nie jeden wykres z dwiema osiami - dwie skale na jednym rysunku sugerują związek, którego dane nie mówią, a wyświetleń bywa sto razy więcej niż kliknięć. Jedna seria na wykres: bez legendy, nazwę niesie tytuł; tooltip Recharts daje odczyt dnia.

- [ ] **Krok 1: Test**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Suspense } from 'react'
import { PanelStron } from '@/components/strony/PanelStron'
import type { StatystykiStrony, WynikStrony } from '@/lib/strony/model'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
// Recharts w jsdom nie ma rozmiaru - wykres sprawdza build i oko na produkcji.
vi.mock('@/components/strony/WykresStrony', () => ({ WykresStrony: () => <div data-testid="wykres" /> }))

const EMAIL = 'deck@p.iam.gserviceaccount.com'

const stat = (nadpisz: Partial<StatystykiStrony> = {}): StatystykiStrony => ({
  witryna: 'sc-domain:jwk26.pl',
  nazwa: 'jwk26.pl',
  okres: { od: '2026-09-04', do: '2026-10-01' },
  biezace: { klikniecia: 60, wyswietlenia: 2000, ctr: 0.03, pozycja: 7.3 },
  poprzednie: { klikniecia: 100, wyswietlenia: 2000, ctr: 0.05, pozycja: 8.1 },
  zmiana: { klikniecia: -0.4, wyswietlenia: 0 },
  dzienne: [],
  zapytania: [{ tekst: 'juwenalia wrocław', klikniecia: 20, wyswietlenia: 300, pozycja: 4.2 }],
  podstrony: [{ adres: 'https://jwk26.pl/zapisy', klikniecia: 30, wyswietlenia: 900, pozycja: 3.1 }],
  alert: true,
  ...nadpisz,
})

const JWK: WynikStrony = { ok: true, dane: stat() }
const SAMORZAD: WynikStrony = {
  ok: false, witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'samorzad.ue.wroc.pl', blad: 'brak-dostepu',
  komunikat: `Brak dostępu. Dodaj ${EMAIL}, uprawnienie „Ograniczone”.`,
}

const drzewo = (wyniki: WynikStrony[] | null) => (
  <Suspense fallback={null}>
    <PanelStron wyniki={Promise.resolve(wyniki)} email={EMAIL} />
  </Suspense>
)

async function panel(wyniki: WynikStrony[] | null) {
  let wynik!: ReturnType<typeof render>
  await act(async () => {
    wynik = render(drzewo(wyniki))
  })
  return wynik
}

describe('PanelStron', () => {
  it('lista nieczytelna - komunikat', async () => {
    await panel(null)
    expect(screen.getByRole('alert')).toHaveTextContent(/Nie udało się odczytać listy stron/)
  })

  it('pusta lista - instrukcja konfiguracji z adresem konta', async () => {
    await panel([])
    expect(screen.getByText('Nie ma jeszcze żadnej strony')).toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
  })

  it('zakładka strony: alert, liczby ze zmianą, wykres, zapytania i podstrony', async () => {
    await panel([JWK, SAMORZAD])
    expect(screen.getByRole('tab', { name: /jwk26\.pl/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Kliknięcia spadły o 40% wobec poprzednich 28 dni.')
    expect(screen.getAllByText('-40%').length).toBeGreaterThan(0)
    expect(screen.getByText('-2,0 p.p.')).toBeInTheDocument()
    expect(screen.getByText('-0,8')).toBeInTheDocument()
    expect(screen.getByTestId('wykres')).toBeInTheDocument()
    expect(screen.getByText('juwenalia wrocław')).toBeInTheDocument()
    expect(screen.getByText('jwk26.pl/zapisy')).toBeInTheDocument()
  })

  it('podsumowanie liczy alerty i strony z błędem', async () => {
    await panel([JWK, SAMORZAD])
    const podsumowanie = screen.getByRole('region', { name: 'Podsumowanie wszystkich stron' })
    expect(podsumowanie).toHaveTextContent('Kliknięcia razem60')
    expect(podsumowanie).toHaveTextContent('Alerty spadku1')
    expect(podsumowanie).toHaveTextContent('1 z błędem')
  })

  it('zakładka z błędem pokazuje instrukcję i pozwala usunąć stronę; reszta działa', async () => {
    await panel([JWK, SAMORZAD])
    fireEvent.click(screen.getByRole('tab', { name: /samorzad/ }))
    expect(screen.getByRole('alert')).toHaveTextContent(EMAIL)
    expect(screen.getByRole('button', { name: /Usuń z listy/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /jwk26\.pl/ })).toBeInTheDocument()
  })

  it('po usunięciu wybranej strony panel wraca na pierwszą', async () => {
    const { rerender } = await panel([JWK, SAMORZAD])
    fireEvent.click(screen.getByRole('tab', { name: /samorzad/ }))
    await act(async () => {
      rerender(drzewo([JWK]))
    })
    expect(screen.getByRole('tab', { name: /jwk26\.pl/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('juwenalia wrocław')).toBeInTheDocument()
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/strony/PanelStron.test.tsx > "$TMP/vt.log" 2>&1; echo $?`
Expected: `1`.

- [ ] **Krok 3: `components/strony/WykresStrony.tsx`**

```tsx
'use client'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisTick, chartTheme, tooltipStyle } from '@/lib/chartTheme'
import { dataKrotka } from '@/lib/strony/okresy'
import type { StatystykiStrony } from '@/lib/strony/model'

type Dzienne = StatystykiStrony['dzienne']

/**
 * Dwa małe wykresy zamiast jednego z dwiema osiami: wyświetleń bywa sto razy
 * więcej niż kliknięć, a dwie skale na jednym rysunku sugerują związek,
 * którego dane nie mówią. Wspólna oś dni pozwala porównać kształt.
 */
export function WykresStrony({ dzienne }: { dzienne: Dzienne }) {
  const dane = dzienne.map((d) => ({ ...d, dzien: dataKrotka(d.data) }))
  return (
    <div className="grid gap-4">
      <Seria dane={dane} klucz="klikniecia" tytul="Kliknięcia dziennie" kolor={chartTheme.accent} />
      <Seria dane={dane} klucz="wyswietlenia" tytul="Wyświetlenia dziennie" kolor={chartTheme.violet} />
    </div>
  )
}

function Seria({ dane, klucz, tytul, kolor }: {
  dane: (Dzienne[number] & { dzien: string })[]
  klucz: 'klikniecia' | 'wyswietlenia'
  tytul: string
  kolor: string
}) {
  return (
    <figure aria-label={tytul}>
      <figcaption className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-deck-muted/70">{tytul}</figcaption>
      <div className="h-[130px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dane} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis dataKey="dzien" tick={axisTick} interval="preserveStartEnd" minTickGap={28} />
            <YAxis tick={axisTick} allowDecimals={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toLocaleString('pl-PL'), tytul]} />
            <Line type="monotone" dataKey={klucz} stroke={kolor} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
```

- [ ] **Krok 4: `components/strony/ZakladkaStrony.tsx`**

```tsx
'use client'
import { AlertTriangle } from 'lucide-react'
import { DNI_OKRESU, opisZmiany, type OpisZmiany } from '@/lib/strony/okresy'
import type { StatystykiStrony, WynikStrony } from '@/lib/strony/model'
import { UsunStrone } from './UsunStrone'
import { WykresStrony } from './WykresStrony'

export const liczba = (n: number) => n.toLocaleString('pl-PL')
const jedno = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function ZakladkaStrony({ wynik }: { wynik: WynikStrony }) {
  if (!wynik.ok) {
    return (
      <section className="space-y-3">
        <div role="alert" className="rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger">
          {wynik.komunikat}
        </div>
        <UsunStrone witryna={wynik.witryna} nazwa={wynik.nazwa} />
      </section>
    )
  }

  const s = wynik.dane
  const spadek = s.zmiana.klikniecia === null ? 0 : Math.round(-s.zmiana.klikniecia * 100)
  return (
    <section className="space-y-4">
      {s.alert && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-deck-warn/40 bg-deck-warn/10 px-4 py-3 text-[12.5px] text-deck-text">
          <AlertTriangle size={14} className="flex-none text-deck-warn" aria-hidden="true" />
          Kliknięcia spadły o {spadek}% wobec poprzednich {DNI_OKRESU} dni.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Liczba etykieta="Kliknięcia" wartosc={liczba(s.biezace.klikniecia)} zmiana={opisZmiany('klikniecia', s.biezace.klikniecia, s.poprzednie.klikniecia)} />
        <Liczba etykieta="Wyświetlenia" wartosc={liczba(s.biezace.wyswietlenia)} zmiana={opisZmiany('wyswietlenia', s.biezace.wyswietlenia, s.poprzednie.wyswietlenia)} />
        <Liczba etykieta="CTR" wartosc={`${jedno(s.biezace.ctr * 100)}%`} zmiana={opisZmiany('ctr', s.biezace.ctr, s.poprzednie.ctr)} />
        <Liczba
          etykieta="Średnia pozycja"
          wartosc={s.biezace.pozycja ? jedno(s.biezace.pozycja) : '-'}
          zmiana={opisZmiany('pozycja', s.biezace.pozycja, s.poprzednie.pozycja)}
        />
      </div>
      <div className="deck-card rounded-lg p-4">
        <WykresStrony dzienne={s.dzienne} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Tabela tytul="Top zapytania" kolumna="Zapytanie" wiersze={s.zapytania.map((z) => ({ ...z, klucz: z.tekst, pokaz: z.tekst }))} />
        <Tabela
          tytul="Top podstrony"
          kolumna="Podstrona"
          wiersze={s.podstrony.map((p) => ({ ...p, klucz: p.adres, pokaz: p.adres.replace(/^https?:\/\//, '') }))}
        />
      </div>
      <UsunStrone witryna={s.witryna} nazwa={s.nazwa} />
    </section>
  )
}

export function Zmiana({ z }: { z: OpisZmiany }) {
  const kolor = z.dobra === null ? 'text-deck-muted' : z.dobra ? 'text-deck-accent' : 'text-deck-danger'
  const strzalka = z.kierunek === 'gora' ? '▲ ' : z.kierunek === 'dol' ? '▼ ' : ''
  return (
    <span className={`font-mono text-[11px] ${kolor}`}>
      {strzalka && <span aria-hidden="true">{strzalka}</span>}
      {z.tekst}
    </span>
  )
}

export function Liczba({ etykieta, wartosc, zmiana, opis }: { etykieta: string; wartosc: string; zmiana?: OpisZmiany; opis?: string }) {
  return (
    <div className="deck-card rounded-lg p-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-deck-muted/70">{etykieta}</div>
      <div className="mt-1.5 text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-deck-text">{wartosc}</div>
      <div className="mt-1">
        {zmiana ? <Zmiana z={zmiana} /> : <span className="font-mono text-[11px] text-deck-muted">{opis}</span>}
      </div>
    </div>
  )
}

type Wiersz = Omit<StatystykiStrony['zapytania'][number], 'tekst'> & { klucz: string; pokaz: string }

function Tabela({ tytul, kolumna, wiersze }: { tytul: string; kolumna: string; wiersze: Wiersz[] }) {
  return (
    <section className="deck-card rounded-lg p-4">
      <h3 className="mb-2 text-[13px] font-semibold text-deck-text">{tytul}</h3>
      {wiersze.length === 0 ? (
        <p className="text-[12px] text-deck-muted">Brak danych za ten okres.</p>
      ) : (
        <table className="w-full table-fixed text-[12px]">
          <thead>
            <tr className="text-left font-mono text-[9.5px] uppercase tracking-[0.14em] text-deck-muted/70">
              <th className="py-1 font-normal">{kolumna}</th>
              <th className="w-16 py-1 text-right font-normal">Klik.</th>
              <th className="w-16 py-1 text-right font-normal">Wyśw.</th>
              <th className="w-12 py-1 text-right font-normal">Poz.</th>
            </tr>
          </thead>
          <tbody>
            {wiersze.map((w) => (
              <tr key={w.klucz} className="border-t border-white/[0.06]">
                <td className="truncate py-1.5 pr-2 text-deck-text" title={w.klucz}>{w.pokaz}</td>
                <td className="py-1.5 text-right tabular-nums">{liczba(w.klikniecia)}</td>
                <td className="py-1.5 text-right tabular-nums">{liczba(w.wyswietlenia)}</td>
                <td className="py-1.5 text-right tabular-nums">{jedno(w.pozycja)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
```

- [ ] **Krok 5: `components/strony/PanelStron.tsx`**

```tsx
'use client'
import { use, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { podsumujStrony, type WynikStrony } from '@/lib/strony/model'
import { opisZmiany } from '@/lib/strony/okresy'
import { InstrukcjaDostepu } from './InstrukcjaDostepu'
import { Liczba, ZakladkaStrony, liczba } from './ZakladkaStrony'

const witrynaWyniku = (w: WynikStrony) => (w.ok ? w.dane.witryna : w.witryna)
const nazwaWyniku = (w: WynikStrony) => (w.ok ? w.dane.nazwa : w.nazwa)

/** `wyniki` = `null`, gdy nie dało się odczytać samej listy stron. */
export function PanelStron({ wyniki, email }: { wyniki: Promise<WynikStrony[] | null>; email: string | null }) {
  const lista = use(wyniki)
  const [wybrana, setWybrana] = useState<string | null>(null)

  if (lista === null) {
    return (
      <p role="alert" className="rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger">
        Nie udało się odczytać listy stron - odśwież stronę za chwilę.
      </p>
    )
  }

  if (lista.length === 0) {
    return (
      <section className="deck-card max-w-[640px] space-y-3 rounded-lg p-5 text-[12.5px]">
        <h2 className="font-semibold text-deck-text">Nie ma jeszcze żadnej strony</h2>
        <p className="text-deck-muted">Panel czyta dane z Google Search Console przez konto serwisowe. Jednorazowo:</p>
        <InstrukcjaDostepu email={email} />
        <p className="text-deck-muted">Potem „Dodaj stronę” u góry.</p>
      </section>
    )
  }

  const p = podsumujStrony(lista)
  // Po usunięciu wybranej strony jej identyfikatora już nie ma - wracamy na pierwszą.
  const wynik = lista.find((w) => witrynaWyniku(w) === wybrana) ?? lista[0]

  return (
    <div className="space-y-5">
      <section aria-label="Podsumowanie wszystkich stron" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Liczba etykieta="Kliknięcia razem" wartosc={liczba(p.klikniecia)} zmiana={opisZmiany('klikniecia', p.klikniecia, p.poprzednieKlikniecia)} />
        <Liczba etykieta="Wyświetlenia razem" wartosc={liczba(p.wyswietlenia)} zmiana={opisZmiany('wyswietlenia', p.wyswietlenia, p.poprzednieWyswietlenia)} />
        <Liczba etykieta="Alerty spadku" wartosc={String(p.alerty)} opis={p.alerty ? 'spadek ≥ 30%' : 'bez spadków'} />
        <Liczba etykieta="Strony" wartosc={String(p.stron)} opis={p.bledy ? `${p.bledy} z błędem` : 'wszystkie odpowiadają'} />
      </section>

      <div>
        <div role="tablist" aria-label="Strony" className="mb-3 flex flex-wrap gap-1.5">
          {lista.map((w) => {
            const id = witrynaWyniku(w)
            const aktywna = id === witrynaWyniku(wynik)
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aktywna}
                onClick={() => setWybrana(id)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition ${
                  aktywna ? 'border-deck-accent/50 bg-deck-accent/10 text-deck-text' : 'border-white/10 text-deck-muted hover:text-deck-text'
                }`}
              >
                {nazwaWyniku(w)}
                {!w.ok && <span className="text-deck-danger">(błąd)</span>}
                {w.ok && w.dane.alert && <AlertTriangle size={11} className="text-deck-warn" aria-label="spadek" />}
              </button>
            )
          })}
        </div>
        <div role="tabpanel" aria-label={nazwaWyniku(wynik)}>
          <ZakladkaStrony key={witrynaWyniku(wynik)} wynik={wynik} />
        </div>
      </div>
    </div>
  )
}

export function SzkieletStron() {
  return (
    <div aria-busy="true" aria-label="Wczytuję dane Search Console" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="deck-card h-[96px] animate-pulse rounded-lg" />
      ))}
    </div>
  )
}
```

- [ ] **Krok 6: `app/strony/page.tsx`**

```tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ktoNaStronie } from '@/lib/auth/naStronie'
import { dzisWarszawa } from '@/lib/czas'
import { statystykiStron } from '@/lib/strony/dane'
import { emailKonta } from '@/lib/strony/google'
import { DNI_OKRESU, dataKrotka, okresy } from '@/lib/strony/okresy'
import { DodajStrone } from '@/components/strony/DodajStrone'
import { PanelStron, SzkieletStron } from '@/components/strony/PanelStron'

export default async function StronyPage() {
  const kto = await ktoNaStronie()
  if (!kto) redirect('/login')
  // Zarząd nie widzi ani kafelka, ani danych - wejście z adresu odsyłamy do kokpitu.
  if (kto.rola !== 'owner') redirect('/')

  const { biezacy } = okresy(dzisWarszawa(new Date()))
  // Bez await: nagłówek idzie od razu, liczby dopływają strumieniem.
  const wyniki = statystykiStron().catch((e) => {
    console.error('[strony] lista:', e)
    return null
  })

  return (
    <main className="mx-auto w-full max-w-[1360px] p-[clamp(16px,2.4vw,34px)]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted transition hover:text-deck-text"
          >
            <ArrowLeft size={12} /> DECK
          </Link>
          <h1 className="text-lg font-semibold text-deck-text">Strony</h1>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted/70">
            Google Search Console · {DNI_OKRESU} dni do {dataKrotka(biezacy.do)}
          </p>
        </div>
        <DodajStrone />
      </header>

      <Suspense fallback={<SzkieletStron />}>
        <PanelStron wyniki={wyniki} email={emailKonta()} />
      </Suspense>
    </main>
  )
}
```

- [ ] **Krok 7: Uruchom - ma przejść**

Run: `npx vitest run components/strony > "$TMP/vt.log" 2>&1; echo $?`
Expected: `0`.

Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?`
Expected: `0`. Jeśli `formatter` w `Tooltip` nie przejdzie typów Recharts 3, zmień sygnaturę na `(v) => [Number(v).toLocaleString('pl-PL'), tytul]`.

- [ ] **Krok 8: Commit**

```bash
git add components/strony app/strony
git commit -m "$(cat <<'EOF'
feat(strony): panel Strony - podsumowanie, zakladki, wykresy i tabele

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 8: Kafelek „Strony” w kokpicie

**Pliki:** zmiana `components/deck/DeckHub.tsx`, `components/deck/DeckHub.test.tsx`, `app/page.tsx`

**Interfejsy:**
- Korzysta z: `statystykiStron` (zadanie 4), `podsumujStrony`, `PodsumowanieStron`, `WynikStrony` (zadanie 2), `opisZmiany`, `DNI_OKRESU` (zadanie 1).
- Daje: nowy prop `DeckHub.strony: Promise<PodsumowanieStron | null> | null` (`null` dla zarządu; wewnętrzne `null`, gdy listy nie dało się odczytać). W `app/page.tsx` obietnica `wynikiStron: Promise<WynikStrony[] | null>` - zadanie 9 poda ją do odprawy.

- [ ] **Krok 1: Testy - zmiany w `components/deck/DeckHub.test.tsx`**

Dopisz import i stałą obok `PLANER`:

```tsx
import type { PodsumowanieStron } from '@/lib/strony/model'

const STRONY: PodsumowanieStron = {
  stron: 2, klikniecia: 125, wyswietlenia: 4000, poprzednieKlikniecia: 100, poprzednieWyswietlenia: 3000, alerty: 1, bledy: 0,
}
```

W `hub(...)` dopisz pole `strony?: PodsumowanieStron | null | Promise<PodsumowanieStron | null>` do typu parametru, obok `odprawa` policz:

```tsx
  const strony = rola === 'owner' ? obietnica(nadpisz.strony === undefined ? STRONY : nadpisz.strony) : null
```

i przekaż `strony={strony}` do `<DeckHub … />`. W pierwszym teście (`nagłówek, kafelki…`) dopisz `strony: nigdy()` do wywołania `hub`. Nowe testy na końcu `describe`:

```tsx
  it('właściciel ma żywy kafelek Stron: kliknięcia, zmiana i alert', async () => {
    await hub()
    expect(screen.getByRole('link', { name: /Strony/ })).toHaveAttribute('href', '/strony')
    expect(await screen.findByText('+25%')).toBeInTheDocument()
    expect(screen.getByText('1 alert')).toBeInTheDocument()
  })

  it('kafelek Stron bez stron zachęca do dodania pierwszej', async () => {
    await hub({ strony: { ...STRONY, stron: 0, klikniecia: 0, poprzednieKlikniecia: 0, alerty: 0 } })
    expect(await screen.findByText(/Dodaj pierwszą stronę/)).toBeInTheDocument()
  })

  it('kafelek Stron, gdy Search Console zawiódł', async () => {
    await hub({ strony: null })
    expect(await screen.findByText(/Search Console nie odpowiada/)).toBeInTheDocument()
  })

  it('zarząd nie widzi kafelka Stron', async () => {
    await hub({ rola: 'board', email: 'Jula' })
    expect(screen.queryByRole('heading', { name: 'Strony' })).toBeNull()
  })
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/deck/DeckHub.test.tsx > "$TMP/vt.log" 2>&1; echo $?`
Expected: `1`.

- [ ] **Krok 3: `components/deck/DeckHub.tsx`**

Importy:

```tsx
import { DNI_OKRESU, opisZmiany } from '@/lib/strony/okresy'
import type { PodsumowanieStron } from '@/lib/strony/model'
```

W `Props` po `odprawa`:

```tsx
  /** Podsumowanie Search Console. Zarząd dostaje `null`; wewnętrzne `null` - listy stron nie dało się odczytać. */
  strony: Promise<PodsumowanieStron | null> | null
```

Dopisz `strony` do destrukturyzacji `DeckHub({ … })`. Zamień zablokowany kafelek (cały blok `<DeckTile stan="zablokowany" href="/strony" …>…</DeckTile>`) na:

```tsx
          {rola === 'owner' && strony && (
            <Suspense fallback={<KafelekStron dane={undefined} />}>
              <KafelekStronZDanymi strony={strony} />
            </Suspense>
          )}
```

Pod `KafelekSesji` dopisz:

```tsx
function KafelekStronZDanymi({ strony }: { strony: Promise<PodsumowanieStron | null> }) {
  return <KafelekStron dane={use(strony)} />
}

/** `undefined` - dane jeszcze płyną; `null` - listy stron nie dało się odczytać. */
function KafelekStron({ dane }: { dane: PodsumowanieStron | null | undefined }) {
  const z = dane ? opisZmiany('klikniecia', dane.klikniecia, dane.poprzednieKlikniecia) : null
  return (
    <DeckTile
      stan="zywy"
      href="/strony"
      etykieta="moduł 04 · search console"
      tytul="Strony"
      odznaka={dane && dane.alerty > 0 ? odmiana(dane.alerty, ['alert', 'alerty', 'alertów']) : undefined}
    >
      {dane === undefined ? (
        <Brak />
      ) : dane === null ? (
        <p className="text-[12px] leading-relaxed text-deck-muted">Search Console nie odpowiada - szczegóły w panelu.</p>
      ) : dane.stron === 0 ? (
        <p className="text-[12px] leading-relaxed text-deck-muted">Dodaj pierwszą stronę, żeby śledzić ruch z Google.</p>
      ) : (
        <div className="flex h-full flex-col justify-between gap-3">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[30px] font-bold leading-none tracking-[-0.03em]">
              <AnimatedNumber value={dane.klikniecia} />
            </span>
            <span className="text-[12px] font-medium text-deck-muted">kliknięć · {DNI_OKRESU} dni</span>
          </div>
          <div className="font-mono text-[11px] text-deck-muted">
            {z && <span className={z.dobra === null ? '' : z.dobra ? 'text-deck-accent' : 'text-deck-danger'}>{z.tekst}</span>}{' '}
            wobec poprzednich {DNI_OKRESU} dni
            {dane.bledy > 0 && (
              <div className="mt-1 text-deck-danger">{odmiana(dane.bledy, ['strona z błędem', 'strony z błędem', 'stron z błędem'])}</div>
            )}
          </div>
        </div>
      )}
    </DeckTile>
  )
}
```

- [ ] **Krok 4: `app/page.tsx`**

Importy:

```tsx
import { statystykiStron } from '@/lib/strony/dane'
import { podsumujStrony, type PodsumowanieStron, type WynikStrony } from '@/lib/strony/model'
```

Zamień blok `let odprawa …; if (kto.rola === 'owner') { … }` na:

```tsx
  // Asystent i Strony są tylko dla właściciela. Zapisaną odprawę pokazujemy od
  // razu; ewentualną nową liczymy już po wysłaniu strony.
  let odprawa: Promise<ZapisanaOdprawa | null> | null = null
  let strony: Promise<PodsumowanieStron | null> | null = null
  if (kto.rola === 'owner') {
    const zapisana = czytajOdprawe().catch(() => null)
    odprawa = zapisana
    // Jedno pobranie na wejście - kafelek i odprawa biorą z tej samej obietnicy.
    const wynikiStron: Promise<WynikStrony[] | null> = statystykiStron().catch((e) => {
      console.error('[strony] kokpit:', e)
      return null
    })
    strony = wynikiStron.then((w) => (w ? podsumujStrony(w) : null))
    after(() => odswiezOdpraweWTle({
      arkusz, planer, zapisana, notatki: tresciNotatek().catch(() => []), semestr: { id: semestr.id, nazwa: semestr.nazwa }, teraz,
    }))
  }
```

i dopisz `strony={strony}` do `<DeckHub … />`.

- [ ] **Krok 5: Uruchom - ma przejść**

Run: `npx vitest run components/deck > "$TMP/vt.log" 2>&1; echo $?`
Expected: `0`.

Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?`
Expected: `0`.

- [ ] **Krok 6: Commit**

```bash
git add components/deck/DeckHub.tsx components/deck/DeckHub.test.tsx app/page.tsx
git commit -m "$(cat <<'EOF'
feat(kokpit): zywy kafelek Strony dla wlasciciela

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 9: Strony w obrazie projektu asystenta

**Pliki:** zmiana `lib/asystent/kontekst.ts`, `lib/asystent/kontekst.test.ts`, `lib/asystent/dane.ts`, nowy test `lib/asystent/dane.test.ts`, `lib/asystent/odprawa.ts`, `lib/asystent/odprawa.test.ts`, `lib/asystent/czat.ts`, `components/deck/PanelOdprawy.tsx`, `app/api/asystent/czat/route.ts` i test, `app/api/asystent/odprawa/route.ts` i test, `app/page.tsx`

**Interfejsy:**
- Korzysta z: `statystykiStron` (zadanie 4), `StatystykiStrony`, `WynikStrony` (zadanie 2), `wynikiStron` w `app/page.tsx` (zadanie 8).
- Daje: `DaneProjektu.strony: StatystykiStrony[]`; sekcja `strony` w `KontekstProjektu`; `daneProjektu(a, p, semestr, notatki, strony: WynikStrony[])`; `odswiezOdpraweWTle({ …, strony: Promise<WynikStrony[]> })`; obszar odprawy `strony` → `/strony`.

- [ ] **Krok 1: Testy**

W `lib/asystent/kontekst.test.ts` w fabryce `dane()` dopisz `strony: []` (obok `notatki: []`), import `import type { StatystykiStrony } from '@/lib/strony/model'` i test:

```ts
  it('strony: liczby, zmiana w procentach, alert i 3 najlepsze zapytania', () => {
    const strona: StatystykiStrony = {
      witryna: 'sc-domain:jwk26.pl', nazwa: 'jwk26.pl', okres: { od: '2026-09-01', do: '2026-09-28' },
      biezace: { klikniecia: 60, wyswietlenia: 2000, ctr: 0.03, pozycja: 7.26 },
      poprzednie: { klikniecia: 100, wyswietlenia: 2000, ctr: 0.05, pozycja: 8.1 },
      zmiana: { klikniecia: -0.4, wyswietlenia: 0 }, dzienne: [],
      zapytania: ['jwk', 'jwk 2026', 'juwenalia', 'czwarte'].map((tekst) => ({ tekst, klikniecia: 1, wyswietlenia: 1, pozycja: 1 })),
      podstrony: [], alert: true,
    }
    expect(zbudujKontekst(dane({ strony: [strona] }), DZIS).strony).toEqual([{
      strona: 'jwk26.pl', okres: '2026-09-01 - 2026-09-28', klikniecia: 60, wyswietlenia: 2000,
      sredniaPozycja: 7.3, zmianaKlikniecProc: -40, alertSpadku: true, topZapytania: ['jwk', 'jwk 2026', 'juwenalia'],
    }])
  })
```

Nowy `lib/asystent/dane.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { StatystykiStrony } from '@/lib/strony/model'

// `dane.ts` ciągnie arkusz i Firestore - tu potrzebna jest tylko czysta `daneProjektu`.
vi.mock('@/lib/gas/client', () => ({ gasList: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({
  odprawaRef: vi.fn(), propozycjeRef: vi.fn(), semestrRef: vi.fn(), wydarzeniaRef: vi.fn(), ustawieniaRef: vi.fn(),
}))

import { daneProjektu } from '@/lib/asystent/dane'

describe('daneProjektu', () => {
  it('do obrazu idą tylko strony, które odpowiedziały', () => {
    const strona = { witryna: 'sc-domain:jwk26.pl' } as StatystykiStrony
    const d = daneProjektu(
      { rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [], czasMs: 1 },
      { wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, ok: true },
      { id: '2026Z', nazwa: 'Z' },
      [],
      [{ ok: true, dane: strona }, { ok: false, witryna: 'x', nazwa: 'x', blad: 'inny', komunikat: '' }],
    )
    expect(d.strony).toEqual([strona])
  })
})
```

W `lib/asystent/odprawa.test.ts`, w teście „każdy obszar ma odnośnik do modułu”, dopisz:

```ts
    expect(ODNOSNIK_OBSZARU.strony).toBe('/strony')
```

W `app/api/asystent/czat/route.test.ts` i `app/api/asystent/odprawa/route.test.ts` dopisz obok pozostałych `vi.mock`:

```ts
vi.mock('@/lib/strony/dane', () => ({ statystykiStron: async () => [] }))
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/asystent app/api/asystent > "$TMP/vt.log" 2>&1; echo $?`
Expected: `1` (brak sekcji `strony`, brak obszaru `strony`).

- [ ] **Krok 3: `lib/asystent/kontekst.ts`**

Import: `import type { StatystykiStrony } from '@/lib/strony/model'`. W `DaneProjektu` po `notatki`:

```ts
  /** Strony z Search Console, które odpowiedziały - błędne pomijamy, asystent nie zgaduje. */
  strony: StatystykiStrony[]
```

W obiekcie zwracanym przez `zbudujKontekst`, między `czlonkowie,` a `notatki: d.notatki,`:

```ts
    strony: d.strony.map((s) => ({
      strona: s.nazwa,
      okres: `${s.okres.od} - ${s.okres.do}`,
      klikniecia: s.biezace.klikniecia,
      wyswietlenia: s.biezace.wyswietlenia,
      sredniaPozycja: Math.round(s.biezace.pozycja * 10) / 10,
      zmianaKlikniecProc: s.zmiana.klikniecia === null ? null : Math.round(s.zmiana.klikniecia * 100),
      alertSpadku: s.alert,
      topZapytania: s.zapytania.slice(0, 3).map((z) => z.tekst),
    })),
```

- [ ] **Krok 4: `lib/asystent/dane.ts`**

Import: `import type { WynikStrony } from '@/lib/strony/model'`. `daneProjektu` dostaje piąty parametr i pole:

```ts
export function daneProjektu(
  a: DaneArkusza,
  p: StanPlanera,
  semestr: { id: string; nazwa: string },
  notatki: string[],
  strony: WynikStrony[],
): DaneProjektu {
  return {
    rekrutacje: a.rekrutacje, kohorty: a.kohorty, punkty: a.punkty, projekty: a.projekty, czlonkowie: a.czlonkowie,
    semestr, wydarzenia: p.wydarzenia, sesja: p.sesja, sklad: p.sklad, propozycje: p.propozycje, notatki,
    strony: strony.flatMap((w) => (w.ok ? [w.dane] : [])),
  }
}
```

W `odswiezOdpraweWTle`: do typu parametru dopisz `strony: Promise<WynikStrony[]>`, a w ciele:

```ts
    const [a, p, zapisana, notatki, strony] = await Promise.all([w.arkusz, w.planer, w.zapisana, w.notatki, w.strony])
    // …bez zmian…
    const k = zbudujKontekst(daneProjektu(a, p, w.semestr, notatki, strony), dzisWarszawa(w.teraz))
```

- [ ] **Krok 5: Trasy i kokpit**

`app/api/asystent/czat/route.ts`: import `import { statystykiStron } from '@/lib/strony/dane'`; w `Promise.all` dopisz piąty element `statystykiStron().catch(() => [])`, rozpakuj `const [a, p, notatki, zapisana, strony] = …` i podaj `daneProjektu(a, p, { id: semestr.id, nazwa: semestr.nazwa }, notatki, strony)`.

`app/api/asystent/odprawa/route.ts`: ten sam import; `const [a, p, notatki, strony] = await Promise.all([pobierzArkusz(), pobierzPlaner(semestr.id, kto.rola), tresciNotatek().catch(() => []), statystykiStron().catch(() => [])])` i `daneProjektu(…, notatki, strony)`.

`app/page.tsx`: w wywołaniu `odswiezOdpraweWTle({ … })` dopisz `strony: wynikiStron.then((w) => w ?? []),`.

- [ ] **Krok 6: Obszar `strony` w odprawie i instrukcje**

`lib/asystent/odprawa.ts`:
- `OBSZARY` → `['kpi', 'rekrutacja', 'retencja', 'projekty', 'planer', 'zespol', 'strony'] as const`;
- w `ODNOSNIK_OBSZARU` dopisz `strony: '/strony',`;
- w `INSTRUKCJA_ODPRAWY` zamień `Planer najbliższych 21 dni (wydarzenia, kolizje, Sesja Operacyjna, propozycje) i członków.` na `Planer najbliższych 21 dni (wydarzenia, kolizje, Sesja Operacyjna, propozycje), członków i ruch z Google na stronach (Search Console, 28 dni do 3 dni temu).`

`lib/asystent/czat.ts`, w `INSTRUKCJA_CZATU` zamień `Planer najbliższych 21 dni, członków, notatki i ostatnią odprawę.` na `Planer najbliższych 21 dni, członków, ruch z Google na stronach (Search Console), notatki i ostatnią odprawę.`

`components/deck/PanelOdprawy.tsx`: w `ETYKIETA_OBSZARU` dopisz `strony: 'Strony',` (TypeScript wymusi to przez `Record<Obszar, string>`).

- [ ] **Krok 7: Uruchom - ma przejść**

Run: `npx vitest run lib/asystent app/api/asystent components/deck > "$TMP/vt.log" 2>&1; echo $?`
Expected: `0`.

Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?`
Expected: `0`.

Na koniec sprawdź, że w zmienionych plikach nie ma długich myślników:

Run: `git diff --name-only main | PYTHONIOENCODING=utf-8 python -c "import sys,io; print([p for p in sys.stdin.read().split() if any(z in io.open(p,encoding='utf-8').read() for z in ('\u2014','\u2013'))])"` → `[]`.
Expected: brak plików i `1`.

- [ ] **Krok 8: Commit**

```bash
git add lib/asystent components/deck/PanelOdprawy.tsx app/api/asystent app/page.tsx
git commit -m "$(cat <<'EOF'
feat(asystent): ruch z Search Console w obrazie projektu i odprawie

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 10: Konfiguracja, pełne sprawdzenie i wdrożenie

**Pliki:** zmiana `README.md`

- [ ] **Krok 1: README**

Znajdź sekcję z konfiguracją asystenta (`grep -n "GEMINI_API_KEY" README.md`) i pod nią dopisz:

```markdown
### Strony (Google Search Console)

Panel `/strony` czyta Search Console tym samym kontem serwisowym co Firebase (`FIREBASE_SERVICE_ACCOUNT`) - bez nowych zmiennych. Jednorazowo:

1. Google Cloud, projekt Firebase → APIs & Services → Library → włącz „Google Search Console API”.
2. Search Console każdej strony → Ustawienia → Użytkownicy i uprawnienia → Dodaj użytkownika: `client_email` z konta serwisowego, uprawnienie „Ograniczone”.
3. Strony, których nie ma w Search Console, najpierw tam dodaj i zweryfikuj.

Potem „Dodaj stronę” w panelu. Lista żyje w Firestore `strony/lista` (tylko serwer). Statystyki mają cache 6 h.
```

- [ ] **Krok 2: Pełne testy, typy, lint, build**

Run: `npx vitest run > "$TMP/vt.log" 2>&1; echo $?` → `0`
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`
Run: `npm run lint > "$TMP/lint.log" 2>&1; echo $?` → `0`
Run: `npm run build > "$TMP/build.log" 2>&1; echo $?` → `0`; w logu trasa `/strony` jako dynamiczna (ƒ).

- [ ] **Krok 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(strony): konfiguracja Search Console w README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Krok 4: Wdrożenie - tylko po zgodzie użytkownika**

`git push origin main` (Vercel buduje z `main`). Poczekaj na stan READY wdrożenia.

- [ ] **Krok 5: Sprawdzenie na produkcji**

- `GET /api/strony` i `GET /api/strony/dostepne` bez sesji → 401.
- Z biletem zarządu → 403 `Strony są tylko dla właściciela`; `/strony` odsyła na `/`; w kokpicie nie ma kafelka Strony.
- Logi Vercela bez `[strony] kokpit:` po wejściu na kokpit.
- Właściciel (test użytkownika): kafelek „Dodaj pierwszą stronę”, panel z instrukcją; po konfiguracji z §8 specu - dodanie `samorzad.ue.wroc.pl`, `jwk26.pl`, `dni-adaptacyjne.uew.pl` i liczby w zakładkach.

- [ ] **Krok 6: Pamięć**

Zaktualizuj pamięć projektu: panel Strony na produkcji, lista w `strony/lista`, co czeka na użytkownika (włączenie API i dodanie konta serwisowego w Search Console trzech stron).
