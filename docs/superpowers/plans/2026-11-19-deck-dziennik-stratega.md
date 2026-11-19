# Dziennik Stratega - plan wykonania

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moduł `/dziennik` - księga przechodnia funkcji z siedmioma działami, adnotacjami kolejnych kadencji, kopią na Dysku kontakt@, przekazaniem kadencji, kafelkiem w kokpicie i sekcją `dziennik` w obrazie asystenta.

**Architecture:** Dane w Firestore (`dziennikKadencje`, `dziennikWpisy`, `dziennik/stan`) tylko przez Admin SDK z tras `app/api/dziennik/**` chronionych `tylkoWlasciciel`. Czyste funkcje (terminy, walidacja, stan wpisu, HTML eksportu) w `lib/dziennik/`, dostęp do bazy w `lib/dziennik/dane.ts`. Kopia na Dysk przez istniejące połączenie OAuth skrzynki z nowym zakresem `drive.file` (wzór: kalendarz). Strona to komponent kliencki z zakładkami, pobierający całą księgę jednym GET.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, firebase-admin 14, Vitest + Testing Library, Tailwind 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-19-deck-dziennik-stratega-design.md` - czytaj razem z planem.

## Global Constraints

- Graf: przed pierwszym grep/odczytem kodu `graphify query "<pytanie>"`; po zmianach kodu `graphify update .`.
- Tylko rola `owner`. Trasy: `tylkoWlasciciel(req, 'Dziennik jest tylko dla właściciela')` z `lib/asystent/tylkoWlasciciel.ts` (bez sesji 401, zarząd 403). Strona `/dziennik`: `ktoNaStronie()`; brak → `redirect('/login')`, `board` → `redirect('/')`.
- Firestore tylko przez `bazaAdmin()` i refy w `lib/firebase/admin.ts`; `firestore.rules` bez zmian (reguła końcowa `allow read, write: if false` zamyka nowe kolekcje) - Zadanie 1 dopisuje test, który to potwierdza tekstowo.
- Interfejs i komunikaty po polsku z ogonkami; tylko łącznik „-”, nigdy „—” ani „–” (także w tekstach do Gemini).
- Limity ze specu: `tytul` 1-120 znaków, `tresc` do 4000 (przemyślenie do 20 000), komentarz adnotacji do 500, `ileCzasu` do 80, `wyprzedzenieTygodni` 0-12 (domyślnie 2), `miesiac` 1-12, `dzien` 1-31 lub null.
- Okno „Najbliższe” = 30 dni (`DNI_NAJBLIZSZYCH = 30`).
- Telefon 390 px bez przewijania w bok; wygląd jak moduły D.E.C.K. (`deck-shell`, `deck-chip`, kolory `deck-*`).
- Commity na `main` po każdym zadaniu, końcówka wiadomości: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push robi użytkownik (`! git push origin main`).
- Testy: `npx vitest run <ścieżka>`; na koniec `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Review Focus

1. Wpis z kadencji zamkniętej - PATCH/DELETE przez API (nie tylko ukryty przycisk) ma dać 409, także gdy przeglądarka wyśle `kadencjaId` bieżącej w ciele. → test w Zadaniu 3.
2. Dwie karty klikają „Przekaż księgę” / „Rozpocznij kadencję” naraz - druga dostaje 409, nigdy dwie otwarte kadencje. → test w Zadaniu 3 (transakcja widzi zmieniony wskaźnik).
3. Termin `dzien: 31` w lutym, 29 lutego w roku nieprzestępnym, termin dziś, termin wczoraj (przeskok na następny rok), przełom grudzień/styczeń w oknie 30 dni. → testy w Zadaniu 1.
4. Treść wpisu z `<script>`, `&`, cudzysłowami i adresem URL w eksporcie HTML - escapowanie, link klikalny, brak wykonania kodu. → test w Zadaniu 5.
5. Dysk niepołączony / brak zakresu / API Drive wyłączone - „Przekaż księgę” nic nie zamyka, komunikat mówi, co zrobić, „Pobierz plik” działa. → testy w Zadaniach 5 i 6.

---

### Task 1: Typy i terminy kalendarza pracy

**Files:**
- Create: `lib/dziennik/typy.ts`, `lib/dziennik/terminy.ts`
- Test: `lib/dziennik/terminy.test.ts`, `lib/dziennik/reguly.test.ts`

**Interfaces:**
- Produces (`lib/dziennik/typy.ts`):
  ```ts
  export const DZIALY = ['cykl', 'luka', 'watek', 'innowacja', 'strategia', 'przemyslenie'] as const
  export type Dzial = (typeof DZIALY)[number]
  export type StanWpisu = 'aktualne' | 'przejmuje' | 'zamkniete' | 'nieaktualne'
  export type StatusStrategii = 'projekt' | 'przyjeta' | 'wygasla' | 'zastapiona'
  export type StanCelu = 'realizowany' | 'zrealizowany' | 'porzucony'
  export interface Kadencja { id: string; nazwa: string; autor: string; funkcja: string | null; otwarta: number; zamknieta: number | null; kopia: { link: string; kiedy: number } | null }
  export interface Adnotacja { id: string; kadencjaId: string; stan: StanWpisu | null; celId: string | null; stanCelu: StanCelu | null; komentarz: string; kiedy: number }
  export interface Cel { id: string; tresc: string }
  interface WpisBaza { id: string; kadencjaId: string; tytul: string; tresc: string; utworzono: number; zmieniono: number; adnotacje: Adnotacja[] }
  export type Wpis =
    | (WpisBaza & { dzial: 'cykl'; miesiac: number; dzien: number | null; wyprzedzenieTygodni: number; obowiazkowe: boolean; rozlicza: string[] })
    | (WpisBaza & { dzial: 'luka'; ileCzasu: string })
    | (WpisBaza & { dzial: 'watek'; zostalo: string })
    | (WpisBaza & { dzial: 'innowacja' | 'przemyslenie' })
    | (WpisBaza & { dzial: 'strategia'; link: string; okresOd: number; okresDo: number; status: StatusStrategii; uchwala: string | null; cele: Cel[] })
  export type WpisCyklu = Extract<Wpis, { dzial: 'cykl' }>
  export interface Ksiega { otwartaKadencjaId: string | null; kadencje: Kadencja[]; wpisy: Wpis[] }
  export const DNI_NAJBLIZSZYCH = 30
  export const PODPOWIEDZI_ROZLICZA = ['Działacze', 'KR', 'RUSS']
  ```
- Produces (`lib/dziennik/terminy.ts`), daty jako `Data` z `@/lib/planer/trwanie`:
  - `najblizszyTermin(w: Pick<WpisCyklu, 'miesiac' | 'dzien'>, dzis: Data): Data`
  - `poczatekPrzygotowan(termin: Data, wyprzedzenieTygodni: number): Data`
  - `export interface PozycjaNajblizsza { wpis: WpisCyklu; termin: Data; od: Data; trwa: boolean }`
  - `najblizsze(wpisy: Wpis[], dzis: Data, dni = DNI_NAJBLIZSZYCH): PozycjaNajblizsza[]` - wpisy `cykl`, których okno `[od, termin]` przecina `[dzis, dzis + dni - 1]`; `trwa = od <= dzis`; sortowanie po `termin`, potem obowiązkowe przed nieobowiązkowymi; pomija wpisy w stanie `zamkniete`/`nieaktualne` (`stanWpisu` z Zadania 2 - w tym zadaniu wystarczy lokalny warunek na ostatniej adnotacji ze `stan`, Zadanie 2 podmieni na import).

- [ ] **Step 1: Write the failing tests** (`lib/dziennik/terminy.test.ts`)

```ts
const d = (rok: number, miesiac: number, dzien: number) => ({ rok, miesiac, dzien })
it('termin w tym roku, gdy jeszcze nie minął', () => expect(najblizszyTermin({ miesiac: 3, dzien: 15 }, d(2026, 11, 19))).toEqual(d(2027, 3, 15)))
it('termin dziś to dziś', () => expect(najblizszyTermin({ miesiac: 11, dzien: 19 }, d(2026, 11, 19))).toEqual(d(2026, 11, 19)))
it('termin wczoraj przeskakuje na następny rok', () => expect(najblizszyTermin({ miesiac: 11, dzien: 18 }, d(2026, 11, 19))).toEqual(d(2027, 11, 18)))
it('dzien null = ostatni dzień miesiąca', () => expect(najblizszyTermin({ miesiac: 2, dzien: null }, d(2027, 1, 1))).toEqual(d(2027, 2, 28)))
it('31 w lutym = ostatni dzień lutego, przestępny', () => expect(najblizszyTermin({ miesiac: 2, dzien: 31 }, d(2028, 1, 1))).toEqual(d(2028, 2, 29)))
it('29 lutego w roku nieprzestępnym = 28', () => expect(najblizszyTermin({ miesiac: 2, dzien: 29 }, d(2026, 12, 1))).toEqual(d(2027, 2, 28)))
it('dzien null w bieżącym miesiącu jeszcze trwa', () => expect(najblizszyTermin({ miesiac: 11, dzien: null }, d(2026, 11, 19))).toEqual(d(2026, 11, 30)))
it('przygotowania 2 tygodnie wcześniej', () => expect(poczatekPrzygotowan(d(2027, 3, 15), 2)).toEqual(d(2027, 3, 1)))
it('najblizsze: okno przez przełom roku i kolejność', () => {
  // dzis 2026-12-20; A termin 10.01 (wyprzedzenie 2 → od 27.12, w oknie), B termin 31.12 nieobowiązkowy,
  // C obowiązkowy też 31.12, D termin 15.03 z wyprzedzeniem 0 (poza oknem), E zamknięty adnotacją → pominięty
  expect(najblizsze([A, B, C, D, E], d(2026, 12, 20)).map((p) => p.wpis.id)).toEqual(['C', 'B', 'A'])
})
it('najblizsze: trwa, gdy przygotowania już się zaczęły', () => { /* termin 25.12, wyprzedzenie 2, dzis 20.12 → trwa true */ })
```

Fabryka `cykl(id, miesiac, dzien, wyprzedzenieTygodni, obowiazkowe, adnotacje = [])` w pliku testu.

Plus `lib/dziennik/reguly.test.ts`: czyta `firestore.rules` (`fs.readFileSync`) i sprawdza, że nie zawiera `dziennik` oraz zawiera `match /{document=**}` z `if false` - nowe kolekcje zostają zamknięte dla klienta.

- [ ] **Step 2:** `npx vitest run lib/dziennik` → FAIL (brak modułów).
- [ ] **Step 3:** Zaimplementuj `typy.ts` i `terminy.ts`. Porównania i przesunięcia dat przez `porownajDaty`, `przesunDate` z `lib/planer/trwanie.ts`; ostatni dzień miesiąca: `new Date(Date.UTC(rok, miesiac, 0)).getUTCDate()`.
- [ ] **Step 4:** `npx vitest run lib/dziennik` → PASS.
- [ ] **Step 5:** Commit `feat(dziennik): typy i terminy kalendarza pracy`.

---

### Task 2: Walidacja wpisów, adnotacji i stan wpisu

**Files:**
- Create: `lib/dziennik/walidacja.ts`, `lib/dziennik/stan.ts`
- Modify: `lib/dziennik/terminy.ts` (użyj `stanWpisu`)
- Test: `lib/dziennik/walidacja.test.ts`, `lib/dziennik/stan.test.ts`

**Interfaces:**
- Produces:
  - `export type PolaWpisu = Omit<Wpis, 'id' | 'kadencjaId' | 'utworzono' | 'zmieniono' | 'adnotacje'>` (unia rozdzielna po `dzial` - zdefiniuj jako `DistributiveOmit`).
  - `sprawdzWpis(x: unknown): { ok: true; pola: PolaWpisu } | { ok: false; blad: string }` - przycina teksty, egzekwuje limity z Global Constraints, `dzial` z `DZIALY`, pola działu wg sekcji 4 specu, `rozlicza` - niepuste przycięte, bez duplikatów, każdy do 40 znaków, najwyżej 10; `cele` - każdy z `id` (niepusty string; brak → serwer nada `crypto.randomUUID()`) i `tresc` 1-300, najwyżej 20; `link` strategii musi zaczynać się od `https://` albo być pusty; `okresOd <= okresDo`, lata 2000-2100. Pola spoza działu są odrzucane (nie zapisywane).
  - `sprawdzAdnotacje(x: unknown, celeWpisu: Cel[]): { ok: true; pola: Omit<Adnotacja, 'id' | 'kadencjaId' | 'kiedy'> } | { ok: false; blad: string }` - wymaga `stan` albo (`celId` z `celeWpisu` i `stanCelu`) albo niepustego `komentarz`; `celId` spoza listy celów = błąd.
  - `sprawdzKadencje(x: unknown): { ok: true; pola: Pick<Kadencja, 'nazwa' | 'autor' | 'funkcja'> } | { ok: false; blad: string }` - nazwa 1-40, autor 1-80, funkcja do 80 lub null.
  - `stanWpisu(w: Wpis): StanWpisu` - `stan` ostatniej (po `kiedy`) adnotacji z niepustym `stan`, domyślnie `'aktualne'`.
  - `stanCelu(w: Wpis, celId: string): StanCelu | null` - analogicznie dla celu.
  - `otwarty(s: StanWpisu): boolean` - `false` dla `zamkniete` i `nieaktualne`.

- [ ] **Step 1: Write the failing tests** - po jednym na każdą regułę powyżej, m.in.:
  - `sprawdzWpis({ dzial: 'cykl', tytul: '  Sprawozdanie  ', tresc: '', miesiac: 3, dzien: null, obowiazkowe: true, rozlicza: [' KR ', 'KR', ''] })` → `pola.tytul === 'Sprawozdanie'`, `rozlicza` `['KR']`, `wyprzedzenieTygodni === 2`.
  - `miesiac: 13`, `dzien: 0`, `wyprzedzenieTygodni: 13`, tytuł 121 znaków, przemyślenie 20 001 znaków, luka z treścią 4001 znaków → `ok: false`.
  - przemyślenie z 20 000 znaków → `ok: true`.
  - strategia z `link: 'javascript:alert(1)'` → `ok: false`; `okresOd: 2027, okresDo: 2026` → `ok: false`.
  - `{ dzial: 'luka', ..., miesiac: 3 }` → `pola` bez `miesiac`.
  - `sprawdzAdnotacje({ celId: 'x', stanCelu: 'zrealizowany' }, [{ id: 'y', tresc: 'Cel' }])` → `ok: false`.
  - `stanWpisu` z adnotacjami `[{stan:'przejmuje',kiedy:1},{stan:null,komentarz:'x',kiedy:2},{stan:'zamkniete',kiedy:3}]` → `'zamkniete'`; bez adnotacji → `'aktualne'`.
- [ ] **Step 2:** `npx vitest run lib/dziennik` → FAIL.
- [ ] **Step 3:** Zaimplementuj; w `terminy.ts` zamień lokalny warunek na `otwarty(stanWpisu(w))`.
- [ ] **Step 4:** `npx vitest run lib/dziennik` → PASS.
- [ ] **Step 5:** Commit `feat(dziennik): walidacja wpisów i adnotacji, stan wpisu`.

---

### Task 3: Dane w Firestore i trasy księgi

**Files:**
- Modify: `lib/firebase/admin.ts` (refy)
- Create: `lib/dziennik/dane.ts`, `app/api/dziennik/route.ts`, `app/api/dziennik/kadencja/route.ts`, `app/api/dziennik/wpisy/route.ts`, `app/api/dziennik/wpisy/[id]/route.ts`, `app/api/dziennik/wpisy/[id]/adnotacje/route.ts`, `app/api/dziennik/wpisy/[id]/adnotacje/[aid]/route.ts`
- Test: `lib/dziennik/dane.test.ts`, `app/api/dziennik/route.test.ts`, `app/api/dziennik/wpisy/route.test.ts`

**Interfaces:**
- Consumes: typy i walidacja z Zadań 1-2.
- Produces (`lib/firebase/admin.ts`): `dziennikKadencjeRef()`, `dziennikWpisyRef()`, `dziennikStanRef()` (= `bazaAdmin().collection('dziennik').doc('stan')`).
- Produces (`lib/dziennik/dane.ts`):
  ```ts
  export class BladDziennika extends Error { constructor(readonly rodzaj: 'brak-kadencji' | 'kadencja-zmieniona' | 'zamkniety' | 'nie-ma', wiadomosc: string) }
  export function czytajKsiege(): Promise<Ksiega>
  export function otworzKadencje(pola: Pick<Kadencja, 'nazwa' | 'autor' | 'funkcja'>, teraz: number): Promise<Kadencja>   // transakcja; gdy wskaźnik nie jest null → 'kadencja-zmieniona'
  export function zamknijKadencje(kadencjaId: string, teraz: number): Promise<void>     // transakcja; wskaźnik ≠ kadencjaId → 'kadencja-zmieniona'
  export function zapiszKopie(kadencjaId: string, kopia: { link: string; kiedy: number }): Promise<void>
  export function dodajWpis(pola: PolaWpisu, teraz: number): Promise<Wpis>             // kadencjaId z wskaźnika; brak → 'brak-kadencji'
  export function zmienWpis(id: string, pola: PolaWpisu, teraz: number): Promise<Wpis> // wpis innej kadencji niż otwarta → 'zamkniety'; zmiana działu → 'zamkniety' z komunikatem „Nie można zmienić działu wpisu”
  export function usunWpis(id: string): Promise<void>                                  // jw.
  export function dodajAdnotacje(wpisId: string, pola: ..., teraz: number): Promise<Adnotacja>  // wymaga otwartej kadencji; dozwolone na każdym wpisie
  export function zmienAdnotacje(wpisId: string, aid: string, pola: ..., teraz: number): Promise<Adnotacja>  // tylko adnotacja otwartej kadencji
  export function usunAdnotacje(wpisId: string, aid: string): Promise<void>            // jw.
  ```
  Każdy zapis wpisu/adnotacji czyta wskaźnik `dziennik/stan` w tej samej transakcji co dokument wpisu - własność rozstrzyga `kadencjaId` zapisany w bazie, nigdy wartość z ciała żądania. Odczyt wpisów: `naWpis(id, data)` tolerancyjny jak `naWiadomosci` w `lib/asystent/pamiecDane.ts` (złe pola → wartości domyślne, nieznany dział → pominięty).
- Trasy (wszystkie `runtime = 'nodejs'`, `tylkoWlasciciel`): `GET /api/dziennik` → `Ksiega`; `POST /api/dziennik/kadencja` (sprawdzKadencje → otworzKadencje) → 201; `POST /api/dziennik/wpisy` → 201; `PATCH|DELETE /api/dziennik/wpisy/[id]`; `POST /api/dziennik/wpisy/[id]/adnotacje` → 201; `PATCH|DELETE /api/dziennik/wpisy/[id]/adnotacje/[aid]`. Mapowanie błędów: walidacja 400 `{ error }`; `brak-kadencji` 409 „Najpierw rozpocznij kadencję”; `kadencja-zmieniona` 409 „Kadencja już się zmieniła - odśwież”; `zamkniety` 409 „Wpis poprzedniej kadencji można tylko skomentować”; `nie-ma` 404.

- [ ] **Step 1: Write the failing tests.** `lib/dziennik/dane.test.ts` mockuje `@/lib/firebase/admin` w pamięci (mapa dokumentów + `runTransaction`, które woła funkcję z obiektem `{ get, set, update, delete }`) - wzór mockowania jak w `lib/skrzynka/dane.test.ts`. Przypadki:
  - `otworzKadencje` dwa razy → drugie rzuca `kadencja-zmieniona`; w bazie jedna kadencja z `zamknieta: null`.
  - `zamknijKadencje('k1')` przy wskaźniku `k2` → `kadencja-zmieniona`; po poprawnym zamknięciu wskaźnik `null` i `zamknieta === teraz`.
  - `zmienWpis` i `usunWpis` na wpisie `kadencjaId: 'stara'` przy otwartej `nowa` → `zamkniety`; dokument bez zmian.
  - `dodajAdnotacje` na wpisie starej kadencji → zapisuje z `kadencjaId: 'nowa'`; `zmienAdnotacje` adnotacji `kadencjaId: 'stara'` → `zamkniety`.
  - `dodajWpis` bez otwartej kadencji → `brak-kadencji`.
  - `zmienWpis` z innym `dzial` niż w bazie → `zamkniety`.
  Trasy (`vi.mock('@/lib/auth/guard')` i `vi.mock('@/lib/dziennik/dane')` jak `app/api/asystent/notatki/route.test.ts`): bez sesji 401, `board` 403, zła treść 400, `BladDziennika('zamkniety')` → 409 z komunikatem, ciało z `kadencjaId` jest ignorowane (mock `zmienWpis` nie dostaje go w `pola`).
- [ ] **Step 2:** `npx vitest run lib/dziennik app/api/dziennik` → FAIL.
- [ ] **Step 3:** Zaimplementuj refy, `dane.ts` i trasy.
- [ ] **Step 4:** `npx vitest run lib/dziennik app/api/dziennik` → PASS.
- [ ] **Step 5:** Commit `feat(dziennik): księga w Firestore i trasy API`.

---

### Task 4: Zgoda na Dysk („Połącz Dysk”)

**Files:**
- Modify: `lib/skrzynka/google.ts` (`ZAKRES_DYSKU`, `adresZgodyDysku`), `lib/skrzynka/stanOauth.ts` (`CelOauth` + `'dysk'`), `lib/skrzynka/dane.ts` (`StanSkrzynki.dysk?: boolean`, odczyt `d.dysk === true`), `lib/skrzynka/synchronizacja.ts` (przy łączeniu skrzynki `dysk: zakresy.includes(ZAKRES_DYSKU)`), `lib/kalendarz/polaczenie.ts` (przy łączeniu kalendarza zapisz też `dysk: zakresy.includes(ZAKRES_DYSKU)`), `app/api/skrzynka/oauth/route.ts` (cel `dysk`), `components/skrzynka/UstawieniaSkrzynki.tsx` (wiersz „Dysk”)
- Create: `lib/dysk/polaczenie.ts`, `app/api/skrzynka/dysk/route.ts`
- Test: `lib/dysk/polaczenie.test.ts`, `lib/skrzynka/stanOauth.test.ts` (dopisz), `app/api/skrzynka/oauth/route.test.ts` (dopisz, jeśli istnieje; inaczej utwórz), `components/skrzynka/UstawieniaSkrzynki.test.tsx` (dopisz)

**Interfaces:**
- Produces:
  - `export const ZAKRES_DYSKU = 'https://www.googleapis.com/auth/drive.file'`
  - `adresZgodyDysku(stan: string, email: string): string` - jak `adresZgodyKalendarza`, `scope: ZAKRES_DYSKU`, `include_granted_scopes: 'true'`.
  - `export type WynikPolaczeniaDysku = 'ok' | 'niepolaczona' | 'inne-konto' | 'brak-dysku' | 'niepelna-zgoda'`
  - `polaczDysk(kod: string): Promise<WynikPolaczeniaDysku>` - lustro `polaczKalendarz`: wymaga połączonej skrzynki, `drive.file` w zakresach, obu zakresów Gmaila, konta `nasz()`; zapisuje `{ token, dysk: true, kalendarz: zakresy.includes(ZAKRES_KALENDARZA) }`.
  - `GET /api/skrzynka/dysk` → przekierowanie na `adresZgodyDysku(await podpiszStan(uid, 'dysk'), DECK_OWNER_EMAIL)`; błąd konfiguracji → `/dziennik?blad=konfiguracja`.
  - Powrót w `oauth/route.ts` dla celu `dysk`: `ok` → `/dziennik?dysk=ok`, inny wynik → `/dziennik?blad=<wynik>`.
- W Ustawieniach Skrzynki pod „Kalendarz” wiersz „Dysk (kopie Dziennika Stratega)”: połączony → „Połączony”; nie → link-przycisk „Połącz Dysk” do `/api/skrzynka/dysk`, z podpisem „Najpierw włącz Google Drive API i zakres drive.file w projekcie deck-samorzad”.

- [ ] **Step 1: Write the failing tests**: `polaczDysk` - brak `drive.file` → `brak-dysku`; brak `gmail.send` → `niepelna-zgoda`; inne konto → `inne-konto`; sukces zapisuje `dysk: true` i zachowuje `kalendarz` wg zakresów. `celStanu` dla podpisu z `'dysk'` → `'dysk'`. Oauth: cel `dysk` + `ok` → `Location` kończy się `/dziennik?dysk=ok`. Ustawienia: bez `dysk` widać link „Połącz Dysk” z `href="/api/skrzynka/dysk"`.
- [ ] **Step 2:** `npx vitest run lib/dysk lib/skrzynka app/api/skrzynka components/skrzynka` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** Te same testy → PASS (istniejące testy skrzynki i kalendarza też zielone).
- [ ] **Step 5:** Commit `feat(dziennik): zgoda na Dysk dla kopii księgi`.

---

### Task 5: Eksport księgi - HTML i zapis na Dysku

**Files:**
- Create: `lib/dziennik/eksport.ts`, `lib/dysk/google.ts`
- Test: `lib/dziennik/eksport.test.ts`, `lib/dysk/google.test.ts`

**Interfaces:**
- Produces:
  - `ksiegaNaHtml(k: Ksiega, dzis: Data): string` - pełny dokument HTML (`<!doctype html>`, `<meta charset="utf-8">`, `<title>`), tytuł „Dziennik Stratega - stan na DD.MM.RRRR”. Kolejność: lista kadencji (nazwa, autor, funkcja, od-do), potem działy w kolejności zakładek (Kalendarz pracy wg miesiąca, reszta: otwarte przed zamkniętymi, nowsze wyżej). Przy wpisie: tytuł, kadencja i autor, stan, pola działu, treść (akapity z pustych linii), adnotacje z nazwą kadencji. Strategia: link, okres, status, uchwała, cele ze stanem. Każdy tekst przez `escapujHtml`; adresy `https?://\S+` w treści po escapowaniu zamienione na `<a href>`.
  - `export function escapujHtml(s: string): string`
  - `export const LIMIT_EKSPORTU = 4 * 1024 * 1024`
  - `export type RodzajBleduDysku = 'brak-zgody' | 'api-wylaczone' | 'limit' | 'za-duzy' | 'google'`
  - `export class BladDysku extends Error { readonly rodzaj: RodzajBleduDysku }`
  - `zapiszNaDysku(dostep: string, nazwa: string, html: string): Promise<{ id: string; link: string }>` - `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`, `multipart/related` z metadanymi `{ name, mimeType: 'application/vnd.google-apps.document' }` i częścią `text/html; charset=UTF-8`; bajty (`Buffer.byteLength`) > `LIMIT_EKSPORTU` → `BladDysku('za-duzy')` bez wywołania; mapowanie błędów jak `rodzajBledu` w `lib/kalendarz/google.ts`.

- [ ] **Step 1: Write the failing tests**:
  - wpis z tytułem `<script>alert(1)</script>` i treścią `A & "B" https://drive.google.com/x?a=1&b=2` → HTML nie zawiera `<script>alert`, zawiera `&lt;script&gt;`, `&amp;`, `<a href="https://drive.google.com/x?a=1&amp;b=2">`.
  - kolejność działów i to, że adnotacja pokazuje nazwę kadencji („2026/27”), a nie id.
  - `zapiszNaDysku` (mock `fetch`): wysyła na adres z `uploadType=multipart`, nagłówek `Authorization: Bearer d`, w ciele `application/vnd.google-apps.document`; zwraca `{ id, link: webViewLink }`; 403 z `accessNotConfigured` → `api-wylaczone`; 403 `insufficientPermissions` → `brak-zgody`; 429 → `limit`; HTML 4 MB + 1 bajt → `za-duzy` i `fetch` nie wołany.
- [ ] **Step 2:** `npx vitest run lib/dziennik/eksport.test.ts lib/dysk` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(dziennik): eksport księgi do HTML i na Dysk`.

---

### Task 6: Trasy kopii i przekazania

**Files:**
- Create: `app/api/dziennik/kopia/route.ts`, `app/api/dziennik/przekaz/route.ts`, `lib/dziennik/kopia.ts`
- Test: `lib/dziennik/kopia.test.ts`, `app/api/dziennik/przekaz/route.test.ts`

**Interfaces:**
- Consumes: `czytajKsiege`, `zapiszKopie`, `zamknijKadencje` (Zadanie 3); `ksiegaNaHtml`, `zapiszNaDysku`, `BladDysku` (Zadanie 5); `czytajStan` z `lib/skrzynka/dane.ts`, `odswiezDostep` z `lib/skrzynka/google.ts`, `odszyfruj` z `lib/skrzynka/szyfr.ts`, `dzisWarszawa`.
- Produces:
  - `export type WynikKopii = { ok: true; link: string } | { ok: false; powod: 'brak-dysku' | RodzajBleduDysku; komunikat: string }`
  - `zrobKopie(teraz: Date): Promise<WynikKopii>` - bez połączonej skrzynki albo bez `stan.dysk` → `brak-dysku` z komunikatem „Połącz Dysk w Skrzynka → Ustawienia albo pobierz plik”; inaczej HTML → Dysk → `zapiszKopie(otwartaKadencjaId, …)` gdy jest otwarta kadencja. Komunikaty: `api-wylaczone` „Włącz Google Drive API w projekcie deck-samorzad”, `brak-zgody` „Połącz Dysk ponownie w Ustawieniach Skrzynki”, `limit` „Google chwilowo odmawia - spróbuj za minutę”, `za-duzy` „Księga przekracza 4 MB - pobierz plik”, `google` „Dysk nie odpowiedział - spróbuj ponownie”.
  - `POST /api/dziennik/kopia` → 200 `{ link }` albo 409 `{ error, powod }`; `maxDuration = 60`.
  - `GET /api/dziennik/kopia` → `ksiegaNaHtml` jako załącznik: `Content-Type: text/html; charset=utf-8`, `Content-Disposition: attachment; filename="dziennik-stratega-RRRR-MM-DD.html"`.
  - `POST /api/dziennik/przekaz` z ciałem `{ kadencjaId }` (ta, którą widział użytkownik): brak otwartej lub inna → 409 „Kadencja już się zmieniła - odśwież”; `zrobKopie` nieudana → 409 z jej komunikatem, **nic nie zamknięte**; potem `zamknijKadencje(kadencjaId)` → 200 `{ link }`.

- [ ] **Step 1: Write the failing tests** (mocki `lib/dziennik/dane`, `lib/dysk/google`, `lib/skrzynka/dane`, `lib/skrzynka/google`):
  - `zrobKopie` bez `dysk` → `brak-dysku`, `zapiszNaDysku` nie wołane.
  - `zrobKopie` sukces → `zapiszKopie('k1', { link, kiedy })`.
  - przekaz: kopia z `api-wylaczone` → 409, `zamknijKadencje` nie wołane; sukces → `zamknijKadencje('k1', …)` po kopii (kolejność wywołań); `{ kadencjaId: 'k0' }` przy otwartej `k1` → 409 bez kopii.
  - `GET /kopia` → nagłówki jak wyżej, ciało zaczyna się od `<!doctype html>`.
- [ ] **Step 2:** `npx vitest run lib/dziennik/kopia.test.ts app/api/dziennik` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(dziennik): kopia na Dysku i przekazanie księgi`.

---

### Task 7: Strona `/dziennik` - powłoka, kadencja, Najbliższe, kopia i przekazanie

**Files:**
- Create: `app/dziennik/page.tsx`, `components/dziennik/DziennikClient.tsx`, `components/dziennik/RozpocznijKadencje.tsx`, `components/dziennik/Najblizsze.tsx`, `components/dziennik/PasekKsiegi.tsx`, `lib/dziennik/klient.ts`
- Test: `components/dziennik/DziennikClient.test.tsx`, `components/dziennik/Najblizsze.test.tsx`, `app/dziennik/page.test.tsx`

**Interfaces:**
- Consumes: `Ksiega`, `najblizsze`, `stanWpisu`, `otwarty` (Zadania 1-2); trasy z Zadań 3 i 6.
- Produces:
  - `lib/dziennik/klient.ts` - funkcje fetch używane przez komponenty: `pobierzKsiege(): Promise<Ksiega>`, `rozpocznijKadencje(pola)`, `dodajWpis(pola)`, `zmienWpis(id, pola)`, `usunWpis(id)`, `dodajAdnotacje(wpisId, pola)`, `zmienAdnotacje(wpisId, aid, pola)`, `usunAdnotacje(wpisId, aid)`, `zrobKopie(): Promise<{ link: string }>`, `przekaz(kadencjaId: string): Promise<{ link: string }>`; każda przy `!res.ok` rzuca `Error(body.error)`. Wzór: `lib/asystent/klient.ts` (w tym `lib/auth/odnow.ts`, jeśli tam używane).
  - `export const ZAKLADKI: { klucz: 'najblizsze' | Dzial; etykieta: string }[]` w `DziennikClient.tsx` - kolejność i etykiety ze specu sekcja 4 (Najbliższe, Kalendarz pracy, Luki, Wątki w toku, Pole do innowacji, Strategie, Przemyślenia). Aktywna zakładka w `?dzial=` (bez parametru = Najbliższe).
  - `DziennikClient({ dzis }: { dzis: Data })` - pobiera księgę; renderuje `PasekKsiegi`, zakładki (poziomy pasek z przewijaniem w poziomie wewnątrz paska poniżej `lg`, pionowa kolumna od `lg`) i treść zakładki. Zakładki działów w tym zadaniu renderują `props.renderDzial?.(dzial, ksiega, odswiez)`; Zadanie 8 je wypełnia.
  - `app/dziennik/page.tsx` - strażnik roli; czyta `searchParams` `dysk`/`blad` i podaje do klienta komunikat (`dysk=ok` → „Dysk połączony”; `blad=<wynik>` → tekst jak w Ustawieniach Skrzynki dla kalendarza); `dzis = dzisWarszawa(new Date())`.
  - `PasekKsiegi` - nagłówek „DZIENNIK STRATEGA · kadencja <nazwa> · <autor>” (bez otwartej: „brak otwartej kadencji”), przyciski „Zapisz kopię” (POST kopia; błąd `brak-dysku` pokazuje komunikat i link „Pobierz plik” do `GET /api/dziennik/kopia`) i „Przekaż księgę” (tylko przy otwartej kadencji). Przekazanie: okno potwierdzenia z tekstem „Księga zostanie zapisana na Dysku, a kadencja <nazwa> zamknięta. Jej wpisów nie będzie można już zmieniać - tylko komentować. Tego nie da się cofnąć.” i przyciskami „Przekaż” / „Anuluj”; w trakcie przycisk zablokowany; po sukcesie odświeżenie księgi i link do kopii. Ostatnia kopia: „Ostatnia kopia: DD.MM.RRRR” z linkiem.
  - `RozpocznijKadencje` - formularz (nazwa, autor, funkcja), widoczny zamiast treści zakładek, gdy `otwartaKadencjaId === null`; nad nim „Księga ma <n> wpisów z <m> kadencji - przeczytasz je po rozpoczęciu albo od razu w zakładkach” tylko gdy wpisy istnieją, a zakładki są wtedy nadal klikalne do czytania (bez przycisków dodawania).
  - `Najblizsze` - lista `najblizsze(wpisy, dzis)`: tytuł, „do <dzień> <miesiąc słownie>” albo „<miesiąc>” przy `dzien: null`, „przygotuj od …”, znacznik „OBOWIĄZKOWE” + `rozlicza` złączone „ · ”, „trwa” gdy `trwa`. Pod listą „W toku: <n> wątków, <m> luk” (otwarte wg `stanWpisu`, `odmiana` z `lib/asystent/fakty.ts`). Pusta lista: „W ciągu 30 dni nic z kalendarza pracy” + link do zakładki Kalendarz pracy.

- [ ] **Step 1: Write the failing tests**:
  - page: `board` → `redirect('/')`, brak sesji → `redirect('/login')` (mock `ktoNaStronie`, `redirect` jak w testach innych stron, np. `app/skrzynka` - jeśli brak wzoru, mock `next/navigation`).
  - DziennikClient (mock `lib/dziennik/klient`): bez otwartej kadencji widać „Rozpocznij kadencję”, brak „Przekaż księgę”; z otwartą - zakładki w kolejności `ZAKLADKI`, domyślnie Najbliższe; potwierdzenie przekazania woła `przekaz('k1')` dopiero po „Przekaż”; błąd `brak-dysku` z „Zapisz kopię” pokazuje link „Pobierz plik” z `href="/api/dziennik/kopia"`.
  - Najblizsze: obowiązkowy wpis z `rozlicza: ['KR','RUSS']` → tekst „OBOWIĄZKOWE” i „KR · RUSS”; `dzien: null` → nazwa miesiąca bez dnia; pusta lista → komunikat.
- [ ] **Step 2:** `npx vitest run components/dziennik app/dziennik` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(dziennik): strona księgi z kadencją, najbliższymi terminami i przekazaniem`.

---

### Task 8: Działy - karty, formularze, adnotacje, cele strategii

**Files:**
- Create: `components/dziennik/Dzial.tsx`, `components/dziennik/KartaWpisu.tsx`, `components/dziennik/FormularzWpisu.tsx`, `components/dziennik/Adnotacje.tsx`, `components/dziennik/TekstZLinkami.tsx`
- Modify: `components/dziennik/DziennikClient.tsx` (podłącz `Dzial` jako `renderDzial`)
- Test: `components/dziennik/Dzial.test.tsx`, `components/dziennik/FormularzWpisu.test.tsx`, `components/dziennik/Adnotacje.test.tsx`

**Interfaces:**
- Consumes: `Ksiega`, `Wpis`, `stanWpisu`, `stanCelu`, `otwarty`, `PODPOWIEDZI_ROZLICZA`, funkcje z `lib/dziennik/klient.ts`.
- Produces:
  - `Dzial({ dzial, ksiega, odswiez })` - przycisk „Dodaj wpis” tylko przy otwartej kadencji; lista: dla `cykl` oś 12 miesięcy od bieżącego (nagłówek miesiąca, wpisy po dniu, `null` na końcu miesiąca, obowiązkowe wyróżnione); dla reszty otwarte (nowsze wyżej) i pod nimi zwinięte „Zamknięte (n)” (`<details>`). Pusty dział: jedno zdanie, co tu wpisać (np. Luki: „Gdzie coś kuleje i ile czasu trzeba, żeby to naprawić.”).
  - `KartaWpisu` - tytuł, „<kadencja> · <autor>”, stan (jeśli nie `aktualne`), pola działu, treść przez `TekstZLinkami`, `Adnotacje`. Wpis otwartej kadencji: „Popraw” i „Usuń” (usunięcie z potwierdzeniem). Wpis zamkniętej kadencji: bez tych przycisków.
  - `FormularzWpisu({ dzial, wpis?, onZapisz, onAnuluj })` - pola zależne od działu (sekcja 4 specu); `rozlicza` jako pola wyboru `PODPOWIEDZI_ROZLICZA` + pole „inne”; cele strategii jako lista z dodawaniem i usuwaniem; licznik znaków treści przy limicie; błąd serwera wyświetlany nad przyciskiem; przycisk zablokowany w trakcie zapisu.
  - `Adnotacje({ wpis, ksiega, odswiez })` - lista „<kadencja>: <stan> - „<komentarz>”” (cudzysłowy polskie), przy celach strategii stan każdego celu; przy otwartej kadencji formularz: wybór stanu (Aktualne, Przejmuję, Zamknięte, Nieaktualne) lub stan celu, komentarz do 500; własne adnotacje z „Popraw”/„Usuń”.
  - `TekstZLinkami({ tekst })` - akapity z pustych linii, adresy `https?://` jako `<a target="_blank" rel="noopener noreferrer">`, bez `dangerouslySetInnerHTML`.

- [ ] **Step 1: Write the failing tests**:
  - Dzial `luka`: wpis starej kadencji bez „Popraw”/„Usuń”, wpis bieżącej z nimi; wpis z adnotacją `zamkniete` jest w „Zamknięte (1)”.
  - Dzial `cykl` przy `dzis` 19.11.2026: kolejność nagłówków zaczyna się od „listopad”, wpis marcowy pod „marzec”.
  - FormularzWpisu `strategia`: dodanie dwóch celów i zapis woła `onZapisz` z `cele` o dwóch elementach; `cykl`: zaznaczenie KR i wpisanie „Senat” w „inne” → `rozlicza: ['KR', 'Senat']`.
  - Adnotacje: na wpisie starej kadencji formularz woła `dodajAdnotacje(wpisId, { stan: 'przejmuje', celId: null, stanCelu: null, komentarz: 'od marca' })`.
  - TekstZLinkami: `'<b>x</b> https://a.pl'` → widoczny tekst `<b>x</b>` (nie pogrubienie) i link `https://a.pl`.
- [ ] **Step 2:** `npx vitest run components/dziennik` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(dziennik): działy, wpisy, adnotacje i cele strategii`.

---

### Task 9: Asystent - sekcja `dziennik` w obrazie projektu

**Files:**
- Modify: `lib/asystent/kontekst.ts`, `lib/asystent/dane.ts`, `app/api/asystent/czat/route.ts`, `app/api/asystent/odprawa/route.ts`, `app/page.tsx` (przekazanie do `odswiezOdpraweWTle`), `lib/asystent/odprawa.ts` (`OBSZARY` + `'dziennik'`, `ODNOSNIK_OBSZARU.dziennik = '/dziennik'`, zdanie w `INSTRUKCJA_ODPRAWY`), `lib/asystent/czat.ts` (zdanie w `INSTRUKCJA_CZATU`), `components/deck/PanelOdprawy.tsx` (`ETYKIETA_OBSZARU.dziennik = 'Dziennik'`)
- Create: `lib/dziennik/obraz.ts`
- Test: `lib/asystent/kontekst.test.ts`, `lib/asystent/dane.test.ts`, `lib/dziennik/obraz.test.ts`, istniejące testy tras czatu i odprawy

**Interfaces:**
- Produces:
  - `export interface PozycjaDziennikaAsystenta { tytul: string; termin: string /* DD.MM.RRRR */; przygotowaniaOd: string; obowiazkowe: boolean; rozlicza: string[] }`
  - `obrazDziennika(k: Ksiega, dzis: Data): PozycjaDziennikaAsystenta[]` - czysta, z `najblizsze`.
  - `pobierzObrazDziennika(dzis: Data): Promise<PozycjaDziennikaAsystenta[] | null>` w `lib/asystent/dane.ts` - nigdy nie rzuca; błąd → `console.error('[asystent] dziennik:', e)` i `null` (wzór `pobierzObrazSkrzynki`).
  - `DaneProjektu.dziennik: PozycjaDziennikaAsystenta[] | null`; `daneProjektu(..., skrzynka, dziennik)` - nowy ostatni parametr; wszystkie cztery wywołania uzupełnione; `zbudujKontekst` zwraca `dziennik: d.dziennik`.
  - Zdanie do obu instrukcji: „dziennik - obowiązki i prace z kalendarza Dziennika Stratega w najbliższych 30 dniach (obowiazkowe: true - rozliczają z nich podmioty z pola rozlicza; przygotowaniaOd - od kiedy zacząć); null - brak danych, nie wnioskuj z tego”.
- Ślad odprawy (`sladKontekstu`) obejmie sekcję automatycznie - zmiana w Dzienniku odświeży odprawę; to zamierzone.

- [ ] **Step 1: Write the failing tests**: `obrazDziennika` - wpis obowiązkowy w oknie → pozycja z `termin: '15.12.2026'`, wpis poza oknem i wpis zamknięty pominięte, żadnego pola `tresc`; `kontekst.test.ts` - `dziennik` przechodzi bez zmian, `null` zostaje `null`; `dane.test.ts` - `pobierzObrazDziennika` przy rzucającym `czytajKsiege` → `null`; `sprawdzOdprawe` przyjmuje zagrożenie z `obszar: 'dziennik'`.
- [ ] **Step 2:** `npx vitest run lib/asystent lib/dziennik app/api/asystent components/deck` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS (wszystkie istniejące testy asystenta też).
- [ ] **Step 5:** Commit `feat(dziennik): najbliższe obowiązki w odprawie i czacie asystenta`.

---

### Task 10: Kafelek w kokpicie, README, sprawdzenie na ekranie

**Files:**
- Modify: `app/page.tsx` (obietnica `dziennik` dla `owner`), `components/deck/DeckHub.tsx` (prop `dziennik`, kafelek), `README.md` (sekcja „Dziennik Stratega” + krok „Połącz Dysk”)
- Test: `components/deck/DeckHub.test.tsx`

**Interfaces:**
- Consumes: `pobierzObrazDziennika` (Zadanie 9) - kafelek i odprawa biorą z tej samej obietnicy, tak jak `skrzynka`.
- Produces: `DeckHub` prop `dziennik: Promise<{ otwarta: boolean; pozycje: PozycjaDziennikaAsystenta[] } | null> | null` (zarząd `null`); `app/page.tsx` składa go z `czytajKsiege()` (raz) → `{ otwarta: k.otwartaKadencjaId !== null, pozycje: obrazDziennika(k, dzis) }`, a odprawa dostaje `pozycje` z tej samej obietnicy. Kafelek `DeckTile` `stan="zywy"`, `href="/dziennik"`, `etykieta="moduł 06 · dla następcy"`, `tytul="Dziennik Stratega"`: bez kadencji „Rozpocznij kadencję, żeby zacząć księgę.”; pusto „Nic z kalendarza pracy w 30 dniach.”; inaczej najwyżej 2 pozycje (tytuł, termin, „OBOWIĄZKOWE · KR”), odznaka z liczbą obowiązkowych (`odmiana`, ton `uwaga`); `null` wewnątrz → „Księgi nie dało się odczytać.” Kafelek dla `board` się nie renderuje; zaktualizuj komentarz o siatce i `span` tak, by rząd nie miał dziury (sprawdź na ekranie).

- [ ] **Step 1: Write the failing tests**: `owner` z dwiema pozycjami → widać obie i odznakę „1 obowiązkowy”/wg `odmiana`; `board` (`dziennik: null`) → brak tytułu „Dziennik Stratega”; bez kadencji → tekst zachęty.
- [ ] **Step 2:** `npx vitest run components/deck` → FAIL.
- [ ] **Step 3:** Zaimplementuj; dopisz README.
- [ ] **Step 4:** `npx vitest run` (całość), `npx tsc --noEmit`, `npm run lint`, `npm run build` → zielone. `graphify update .`.
- [ ] **Step 5:** Commit `feat(dziennik): kafelek w kokpicie i opis w README`.
- [ ] **Step 6: Sprawdzenie na ekranie** (po pushu użytkownika, produkcja `https://ssuew-analytics.vercel.app`, konto kontakt@): kokpit - kafelek bez dziury w siatce; `/dziennik` - rozpoczęcie kadencji, wpis w każdym dziale, adnotacja, „Zapisz kopię” (bez Dysku → link „Pobierz plik” działa), widok 390 px (ramka iframe jak w poprzednich przeglądach) bez przewijania w bok. Testowe wpisy usuń po sprawdzeniu; **nie** klikaj „Przekaż księgę” na produkcji (nieodwracalne) - przekazanie sprawdzają testy.
