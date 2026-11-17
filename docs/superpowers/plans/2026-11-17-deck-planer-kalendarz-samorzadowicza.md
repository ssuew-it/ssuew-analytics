# Planer: wysyłka do Kalendarza Samorządowicza - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** przycisk w Planerze, który po podsumowaniu przenosi wydarzenia z czterech kategorii do głównego kalendarza kontakt@ (Kalendarz Samorządowicza): przejmuje pasujące ręczne wpisy, dodaje, zmienia i usuwa tylko wydarzenia ze znacznikiem D.E.C.K.

**Architecture:** czyste `lib/kalendarz/wydarzenie.ts` (Wydarzenie Planera → wydarzenie Google) i `lib/kalendarz/porownanie.ts` (Planer ↔ kalendarz → plan zmian); `lib/kalendarz/google.ts` rozmawia z Google Calendar API tokenem kontakt@; trasa `/api/planer/kalendarz` (GET podsumowanie, POST wysyłka) liczy plan po stronie serwera z `obrazPlanera(biezacySemestr(teraz).id)`. Zgoda Google: ten sam adres powrotu `/api/skrzynka/oauth`, cel rozpoznany po polu `cel` w podpisanym `state`.

**Tech Stack:** Next.js 16, React 19, Firestore Admin SDK, Google Calendar API v3 (REST przez `fetch`), Vitest 4 + Testing Library.

**Spec:** [docs/superpowers/specs/2026-11-17-deck-planer-kalendarz-samorzadowicza-design.md](../specs/2026-11-17-deck-planer-kalendarz-samorzadowicza-design.md)

## Global Constraints

- Po polsku, tylko „-”, nigdy długie myślniki. Commit po `npx vitest run <pliki> > "$TMP/vt.log" 2>&1; echo $?` = 0 i `npx tsc --noEmit` = 0, stopka `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Pracujemy na `main` (decyzja użytkownika), wypycha użytkownik `! git push origin main`.
- Kategorie do kalendarza: `KOMISJE`, `SSUEW`, `PROJEKTY`, `UE`. Pozostałe (`ZEBRANIA`, `APLIKACJE`, `INNE`) nigdy.
- Kalendarz docelowy: `primary` konta kontakt@ - stały, bez wyboru, bez zmian w samym kalendarzu, bez tworzenia nowego.
- Zakres OAuth kalendarza: `https://www.googleapis.com/auth/calendar.events`. Strefa: `Europe/Warsaw`. Każdy zapis z `sendUpdates=none`, bez uczestników i bez własnych przypomnień.
- Znacznik: `extendedProperties.private = { deck: '1', deckId: <id wydarzenia Planera>, deckSemestr: <id semestru> }`.
- D.E.C.K. nie zmienia ani nie usuwa wpisów bez znacznika - jedyny wyjątek to przejęcie (dokładnie jeden wpis bez znacznika z tym samym tytułem i datą startu).
- Dołożenie zakresu kalendarza nie może zresetować skrzynki: bez `polaczSkrzynke`, bez nowej obserwacji Gmaila, `historyId` i import nietknięte; token nadpisywany tylko, gdy nowy obejmuje też `gmail.readonly` i `gmail.send`.
- Wszystkie trasy: 401 bez sesji, 403 dla zarządu (`tylkoWlasciciel`).
- Zmiany przenoś narzędziem Edit/Write; pliki na dysku mają CRLF.

## Review Focus

1. **Wydarzenie przez północ** („18:00-04:00 (+1)”) - koniec następnego dnia, nie przed startem (test w zadaniu 1).
2. **Ten sam tytuł dwa razy tego samego dnia w kalendarzu** - żadne przejęcie, wpis w „do sprawdzenia”, nic nie dodane (test w zadaniu 2).
3. **Wydarzenie przeniesione w Planerze do Zebrań** - znika z kalendarza przy następnej wysyłce (test w zadaniu 2).
4. **Zgoda Google bez zakresów Gmaila** (ktoś odznaczył) - token skrzynki nienadpisany, komunikat (test w zadaniu 4).
5. **Częściowa porażka zapisu** (limit Google w połowie) - wynik mówi, co weszło, a ponowne kliknięcie dosyła resztę bez duplikatów (test w zadaniu 5).

---

## Mapa plików

| Plik | Odpowiedzialność | Zadanie |
|---|---|---|
| nowe `lib/kalendarz/wydarzenie.ts` (+ test) | `DO_KALENDARZA`, `naWydarzenieGoogle` | 1 |
| nowe `lib/kalendarz/porownanie.ts` (+ test) | `porownaj` - plan zmian z przejmowaniem | 2 |
| nowe `lib/kalendarz/google.ts` (+ test); zmiana `lib/skrzynka/google.ts` | klient Calendar API, `odswiezDostep`, `ZAKRES_KALENDARZA` | 3 |
| zmiana `lib/skrzynka/stanOauth.ts`, `lib/skrzynka/dane.ts`, `app/api/skrzynka/oauth/route.ts`; nowe `lib/kalendarz/polaczenie.ts`, `app/api/skrzynka/kalendarz/route.ts` (+ testy) | zgoda Google na kalendarz bez resetu skrzynki | 4 |
| nowe `app/api/planer/kalendarz/route.ts` (+ test) | GET podsumowanie, POST wysyłka | 5 |
| zmiana `components/skrzynka/UstawieniaSkrzynki.tsx`, `components/planer/PlanerClient.tsx`; nowe `components/planer/WyslijDoKalendarza.tsx` (+ testy); `README.md` | przyciski i okno podsumowania | 6 |

---

## Zadanie 1: Wydarzenie Planera jako wydarzenie Google

**Pliki:** nowe `lib/kalendarz/wydarzenie.ts`, `lib/kalendarz/wydarzenie.test.ts`

**Interfejsy:**
- Korzysta z: `Wydarzenie`, `Kategoria`, `POLA_DOMYSLNE` (`lib/planer/typy.ts`), `opisMiejsca`, `przezPolnoc` (`lib/planer/opis.ts`), `przesunDate`, `naIso` (`lib/planer/trwanie.ts`).
- Daje:
  - `DO_KALENDARZA: ReadonlySet<Kategoria>` = `KOMISJE, SSUEW, PROJEKTY, UE`;
  - `DOPISEK_BEZ_GODZINY = ' (godzina do ustalenia)'`;
  - `type Termin = { date: string } | { dateTime: string; timeZone: 'Europe/Warsaw' }`;
  - `interface WydarzenieGoogle { summary: string; start: Termin; end: Termin; location?: string; extendedProperties: { private: { deck: '1'; deckId: string; deckSemestr: string } } }`;
  - `naWydarzenieGoogle(w: Wydarzenie, semestrId: string): WydarzenieGoogle`.

- [ ] **Krok 1: Testy** - `lib/kalendarz/wydarzenie.test.ts`, fabryka `W(n: Partial<Wydarzenie>)` na `POLA_DOMYSLNE`, `{ id: 'w1', tytul: 'Komisja Dydaktyczna', kategoria: 'KOMISJE', rok: 2026, miesiac: 11, dzien: 21, godzina: '18:00', godzinaDo: '20:00', budynek: 'B/L', sala: '110L', osoby: ['Jula'] }`:
  - `'godziny od-do, miejsce jak w Planerze, znacznik, bez osób'`: `start` = `{ dateTime: '2026-11-21T18:00:00', timeZone: 'Europe/Warsaw' }`, `end` `…T20:00:00`, `location` = `'B/L 110L'`, `extendedProperties.private` = `{ deck: '1', deckId: 'w1', deckSemestr: '2026Z' }`, `JSON.stringify(wynik)` nie zawiera `'Jula'`.
  - `'przez północ - koniec następnego dnia'`: `godzina: '18:00', godzinaDo: '04:00'` → `end.dateTime` = `'2026-11-22T04:00:00'`.
  - `'sama godzina startu - godzina trwania'`: `godzinaDo: null` → `end.dateTime` = `'2026-11-21T19:00:00'`; `godzina: '23:30'` → `'2026-11-22T00:30:00'`.
  - `'cały dzień i wielodniowe'`: `calyDzien: true, dni: 3` → `start: { date: '2026-11-21' }`, `end: { date: '2026-11-24' }` (koniec wyłączny); `dni: 2` z godzinami 10:00-14:00 → start `2026-11-21T10:00:00`, koniec `2026-11-22T14:00:00`.
  - `'godzina nieustalona - całodniowe z dopiskiem'`: `calyDzien: false, godzina: null` → `start: { date: '2026-11-21' }`, `end: { date: '2026-11-22' }`, `summary` = `'Komisja Dydaktyczna (godzina do ustalenia)'`.
  - `'bez miejsca - bez pola location'`: `budynek: null, sala: null` → `'location' in wynik` = `false`.
  - `'kategorie do kalendarza'`: `[...DO_KALENDARZA].sort()` = `['KOMISJE', 'PROJEKTY', 'SSUEW', 'UE']`.

- [ ] **Krok 2: Uruchom - ma paść** (brak modułu): `npx vitest run lib/kalendarz/wydarzenie.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: Implementacja** `lib/kalendarz/wydarzenie.ts` - daty przez `przesunDate`/`naIso` (bez `Date` - bez przesunięć stref); godzina trwania przy braku `godzinaDo` = 60 min, z przejściem na następny dzień.

- [ ] **Krok 4: Uruchom - ma przejść** (to samo polecenie → `0`) i `npx tsc --noEmit` → `0`.

- [ ] **Krok 5: Commit** `feat(kalendarz): wydarzenie Planera jako wydarzenie Google`.

---

## Zadanie 2: Porównanie Planera z kalendarzem

**Pliki:** nowe `lib/kalendarz/porownanie.ts`, `lib/kalendarz/porownanie.test.ts`

**Interfejsy:**
- Korzysta z: zadania 1.
- Daje:
  - `interface WpisKalendarza { id: string; summary: string; start: Termin; end: Termin; location: string | null; deckId: string | null; deckSemestr: string | null }`;
  - `interface PlanKalendarza { przejmij: { wpisId: string; wydarzenie: WydarzenieGoogle }[]; dodaj: WydarzenieGoogle[]; zmien: { wpisId: string; wydarzenie: WydarzenieGoogle }[]; usun: WpisKalendarza[]; doSprawdzenia: { wydarzenie: WydarzenieGoogle; kandydaci: number }[] }`;
  - `porownaj(wydarzenia: Wydarzenie[], wpisy: WpisKalendarza[], semestrId: string): PlanKalendarza` (czysta).

**Reguły (spec, „Zasady zapisu”):** tylko kategorie `DO_KALENDARZA`; para po `deckId` w obrębie `deckSemestr === semestrId`; różnica = `summary`, `start`, `end` albo `location`; wpis ze znacznikiem tego semestru bez pary → `usun`; wpis ze znacznikiem innego semestru - nigdy nie rusza; bez pary ze znacznikiem → szukaj wpisów bez znacznika z `summary` równym (trim, bez wielkości liter, bez `DOPISEK_BEZ_GODZINY`) i tą samą datą startu (część daty z `date` albo `dateTime`); dokładnie jeden, jeszcze nieprzejęty → `przejmij`; więcej niż jeden → `doSprawdzenia` (nic nie dodaj); zero → `dodaj`.

- [ ] **Krok 1: Testy** - `lib/kalendarz/porownanie.test.ts`, wpisy budowane z `naWydarzenieGoogle` (pomocnik `wpis(g, id, znacznik?)`):
  - `'nowe wydarzenie - dodaj; Zebrania, Aplikacje, Inne pominięte'`.
  - `'bez zmian - nic do zrobienia'`: wszystkie listy puste.
  - `'zmieniona sala albo godzina - zmień'`.
  - `'usunięte z Planera albo przeniesione do Zebrań - usuń'` (Review Focus 3).
  - `'wpis ze znacznikiem innego semestru - nietknięty'`.
  - `'ręczny wpis z tym samym tytułem (inna wielkość liter) i datą - przejmij zamiast dodaj'`.
  - `'dwa pasujące ręczne wpisy - do sprawdzenia, nic nie dodane'` (Review Focus 2): `doSprawdzenia[0].kandydaci` = `2`, `dodaj` puste.
  - `'jeden ręczny wpis nie zostanie przejęty przez dwa wydarzenia'`: dwa wydarzenia Planera o tym samym tytule i dniu, jeden wpis → jedno `przejmij`, jedno `dodaj`.
  - `'ręczny wpis bez pary w Planerze - nietknięty'`: nie pojawia się w żadnej liście.

- [ ] **Krok 2: Uruchom - ma paść** → `1` (brak modułu).
- [ ] **Krok 3: Implementacja** `porownaj` według reguł wyżej.
- [ ] **Krok 4: Uruchom - ma przejść** → `0`; `tsc` → `0`.
- [ ] **Krok 5: Commit** `feat(kalendarz): porównanie Planera z kalendarzem i przejmowanie ręcznych wpisów`.

---

## Zadanie 3: Klient Google Calendar

**Pliki:** nowe `lib/kalendarz/google.ts`, `lib/kalendarz/google.test.ts`; zmiana `lib/skrzynka/google.ts`

**Interfejsy:**
- Korzysta z: zadań 1-2; w `lib/skrzynka/google.ts` - prywatna `token(cialo)`.
- Daje:
  - w `lib/skrzynka/google.ts`: `export const ZAKRES_KALENDARZA = 'https://www.googleapis.com/auth/calendar.events'`, `export const ZAKRESY_GMAILA` (dotychczasowa `ZAKRESY`), `export async function odswiezDostep(refreshToken: string): Promise<string>`;
  - `class BladKalendarza extends Error { rodzaj: 'brak-zgody' | 'api-wylaczone' | 'limit' | 'google' }`;
  - `wpisyKalendarza(dostep: string, semestrId: string, od: string, do: string): Promise<WpisKalendarza[]>` - wpisy ze znacznikiem semestru (`privateExtendedProperty=deckSemestr=<id>`) plus wpisy z okna `od`-`do` (`timeMin`/`timeMax`, `singleEvents=true`), połączone bez powtórzeń; obie listy ze stronicowaniem `nextPageToken`;
  - `wykonajPlan(dostep: string, plan: PlanKalendarza): Promise<{ udane: number; nieudane: { tytul: string; powod: string }[] }>` - `przejmij` i `zmien` przez `PATCH` (całe `summary/start/end/location/extendedProperties`), `dodaj` przez `POST`, `usun` przez `DELETE`; każde z `sendUpdates=none`; po 5 równolegle; błąd pojedynczego zapisu trafia do `nieudane`, reszta idzie dalej.
- Adres: `https://www.googleapis.com/calendar/v3/calendars/primary/events`.
- Mapowanie błędów Google: 401/403 `insufficientPermissions` → `brak-zgody`; 403 `accessNotConfigured` → `api-wylaczone`; 429 i 403 `rateLimitExceeded` → `limit`; inne → `google`.

- [ ] **Krok 1: Testy** (fetch podstawiony):
  - `'wpisy: znacznik semestru i okno czasu, stronicowanie, bez powtórzeń'` - drugi adres z `pageToken`, ten sam `id` w obu listach liczony raz, `deckId` odczytany z `extendedProperties.private`.
  - `'wykonaj plan: POST/PATCH/DELETE z sendUpdates=none'`.
  - `'częściowa porażka - reszta idzie dalej'` (Review Focus 5): drugi zapis 429 → `udane` = liczba pozostałych, `nieudane[0].powod` zawiera `limit`.
  - `'Calendar API wyłączone - błąd api-wylaczone'`: odpowiedź 403 z `error.errors[0].reason = 'accessNotConfigured'` przy listowaniu → `rejects.toMatchObject({ rodzaj: 'api-wylaczone' })`.
  - w `lib/skrzynka/google.test.ts`: `'odswiezDostep - access token z refresh tokena'`.
- [ ] **Krok 2: Uruchom - ma paść** → `1`.
- [ ] **Krok 3: Implementacja.**
- [ ] **Krok 4: Uruchom - ma przejść** (`npx vitest run lib/kalendarz lib/skrzynka`) → `0`; `tsc` → `0`.
- [ ] **Krok 5: Commit** `feat(kalendarz): klient Google Calendar z planem zmian`.

---

## Zadanie 4: Zgoda Google na kalendarz bez resetu skrzynki

**Pliki:** zmiana `lib/skrzynka/stanOauth.ts`, `lib/skrzynka/dane.ts`, `app/api/skrzynka/oauth/route.ts`, `lib/skrzynka/google.ts`; nowe `lib/kalendarz/polaczenie.ts`, `app/api/skrzynka/kalendarz/route.ts`; testy obok (`*.test.ts`)

**Interfejsy:**
- Korzysta z: `ZAKRES_KALENDARZA`, `ZAKRESY_GMAILA`, `wymienKod` (zwraca `zakresy`), `zaszyfruj`, `zapiszStan`, `czytajStan`, `nasz()`.
- Daje:
  - `stanOauth.ts`: `type CelOauth = 'skrzynka' | 'kalendarz'`; `podpiszStan(uid: string, cel: CelOauth = 'skrzynka')`; `celStanu(stan: string, uid: string): Promise<CelOauth | null>` (stary `state` bez `cel` = `'skrzynka'`); `sprawdzStan` bez zmian w zachowaniu.
  - `google.ts`: `adresZgodyKalendarza(stan: string, email: string): string` - `scope` = `ZAKRES_KALENDARZA`, `include_granted_scopes: 'true'`, `access_type: 'offline'`, `prompt: 'consent'`, ten sam `redirect_uri` co skrzynka.
  - `StanSkrzynki.kalendarz?: boolean`.
  - `polaczKalendarz(kod: string): Promise<'ok' | 'niepolaczona' | 'inne-konto' | 'brak-kalendarza' | 'niepelna-zgoda'>` - wymaga połączonej skrzynki; `zakresy` muszą zawierać `ZAKRES_KALENDARZA` (`brak-kalendarza`) oraz oba zakresy Gmaila (`niepelna-zgoda`, token nienadpisany); konto = `nasz()` (profil Gmaila nowym tokenem); potem `zapiszStan({ token: zaszyfruj(refreshToken), kalendarz: true })` i nic więcej.
  - `GET /api/skrzynka/kalendarz` - przekierowanie do `adresZgodyKalendarza(await podpiszStan(uid, 'kalendarz'), DECK_OWNER_EMAIL)`.
  - `/api/skrzynka/oauth` - `celStanu`: `'kalendarz'` → `polaczKalendarz`, powrót `/skrzynka?kalendarz=ok` albo `/skrzynka?blad=<wynik>`; `'skrzynka'` → jak dziś.

- [ ] **Krok 1: Testy:**
  - `stanOauth.test.ts`: `'cel kalendarza w state; stary state bez celu to skrzynka; cudzy uid - null'`.
  - `lib/kalendarz/polaczenie.test.ts`: `'ok - zapisuje tylko token i kalendarz: true'` (`zapiszStan` wołane raz z dokładnie `{ token, kalendarz: true }`; `watch` niewołane); `'zgoda bez zakresów Gmaila - token skrzynki nienadpisany'` (Review Focus 4, `zapiszStan` niewołane, wynik `niepelna-zgoda`); `'bez zakresu kalendarza - brak-kalendarza'`; `'inne konto - inne-konto'`; `'skrzynka niepołączona - niepolaczona'`.
  - `app/api/skrzynka/route.test.ts` (istniejący) albo nowy test trasy oauth: `'state kalendarza idzie do polaczKalendarz, nie do polaczSkrzynke'`.
  - test trasy `GET /api/skrzynka/kalendarz`: `'zarząd 403; właściciel - przekierowanie z include_granted_scopes i calendar.events'`.
- [ ] **Krok 2: Uruchom - ma paść** → `1`.
- [ ] **Krok 3: Implementacja.**
- [ ] **Krok 4: Uruchom - ma przejść** (`npx vitest run lib/kalendarz lib/skrzynka app/api/skrzynka`) → `0`; `tsc` → `0`.
- [ ] **Krok 5: Commit** `feat(kalendarz): zgoda Google na kalendarz bez resetu skrzynki`.

---

## Zadanie 5: Trasa wysyłki

**Pliki:** nowe `app/api/planer/kalendarz/route.ts`, `app/api/planer/kalendarz/route.test.ts`

**Interfejsy:**
- Korzysta z: `tylkoWlasciciel`, `biezacySemestr`, `obrazPlanera`, `czytajStan`, `odszyfruj`, `odswiezDostep`, `wpisyKalendarza`, `porownaj`, `wykonajPlan`, `BladKalendarza`.
- Daje:
  - `GET /api/planer/kalendarz` → `200 { semestr: string; plan: PlanKalendarza }`;
  - `POST /api/planer/kalendarz` → liczy plan od nowa (nie ufa klientowi) i wykonuje → `200 { udane: number; nieudane: { tytul: string; powod: string }[] }`;
  - błędy: brak `stan.kalendarz` → `409 { error: 'Kalendarz niepołączony - połącz go w Ustawieniach skrzynki.' }`; `brak-zgody` → 409 (ten sam komunikat); `api-wylaczone` → `503 { error: 'Włącz Google Calendar API w projekcie deck-samorzad.' }`; `limit` → `429`; `google` → `502`.
- Okno wpisów: od pierwszego dnia pierwszego miesiąca semestru do pierwszego dnia miesiąca po ostatnim (`T00:00:00+01:00`/`+02:00` - przez `polnocWarszawa`).
- `maxDuration = 60`, `runtime = 'nodejs'`.

- [ ] **Krok 1: Testy** (moduły podstawione): `'bez sesji 401, zarząd 403'`; `'GET - plan liczony z bieżącego semestru'`; `'POST liczy plan od nowa i zwraca wynik'`; `'kalendarz niepołączony - 409 z odnośnikiem do Ustawień'`; `'Calendar API wyłączone - 503 z instrukcją'`; `'częściowa porażka - 200 z listą nieudanych'` (Review Focus 5); `'drugie wysłanie po częściowej porażce nie dubluje'` - drugi `GET` z wpisami zawierającymi już dodane (ze znacznikiem) daje `dodaj` tylko dla brakujących.
- [ ] **Krok 2-4:** paść → implementacja → przejść (`npx vitest run app/api/planer lib/kalendarz`), `tsc` → `0`.
- [ ] **Krok 5: Commit** `feat(planer): trasa wysyłki do Kalendarza Samorządowicza`.

---

## Zadanie 6: Przyciski, okno podsumowania, README, wdrożenie

**Pliki:** nowe `components/planer/WyslijDoKalendarza.tsx`, `components/planer/WyslijDoKalendarza.test.tsx`; zmiana `components/planer/PlanerClient.tsx` (obok `<PobierzMiesiac …/>`, tylko `wlascicielem`), `components/skrzynka/UstawieniaSkrzynki.tsx` (+ test), `README.md`

**Interfejsy:**
- Korzysta z: trasy z zadania 5 i `GET /api/skrzynka/kalendarz`.
- Daje: `WyslijDoKalendarza()` - przycisk „Wyślij do Kalendarza Samorządowicza”; klik → `GET`, okno (`role="dialog"`) z linią „Przejmę N · dodam N · zmienię N · usunę N” (pomija zera), listą (data `DD.MM`, tytuł, znak `≈` przejęcie, `+`, `~`, `-`), sekcją „Do sprawdzenia ręcznie” gdy niepusta; „Wyślij” → `POST`, wynik „Wysłano: N zmian” albo lista nieudanych; bez zmian → „Kalendarz jest aktualny”. W Ustawieniach skrzynki sekcja „Kalendarz Samorządowicza” z linkiem „Połącz kalendarz” (`/api/skrzynka/kalendarz`) albo „Połączony” i krótkim opisem, które kategorie trafiają do kalendarza.

- [ ] **Krok 1: Testy:** `'podsumowanie z przejęciem, dodaniem, zmianą i usunięciem; Wyślij wysyła POST i pokazuje wynik'`; `'bez zmian - Kalendarz jest aktualny, bez przycisku Wyślij'`; `'do sprawdzenia ręcznie widoczne'`; `'błąd 409 - komunikat z odnośnikiem do Ustawień'`; `'zarząd nie widzi przycisku'` (w teście `PlanerClient`); w `UstawieniaSkrzynki.test.tsx`: `'kalendarz niepołączony - link Połącz kalendarz; połączony - napis Połączony'`.
- [ ] **Krok 2-4:** paść → implementacja → przejść (`npx vitest run components`), `tsc`, `npm run lint` → `0`.
- [ ] **Krok 5: README** - w sekcji Planera akapit: przycisk, cztery kategorie, przejmowanie ręcznych wpisów, jednorazowo „Połącz kalendarz” i włączenie Google Calendar API w projekcie `deck-samorzad`.
- [ ] **Krok 6: Pełne sprawdzenie:** `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (potem `rm -rf .next/types`), brak długich myślników w zmienionych plikach - każde → `0` / `[]`.
- [ ] **Krok 7: Commit** `feat(planer): wysyłka do Kalendarza Samorządowicza w Planerze i Ustawieniach`; przegląd końcowy `superpowers:requesting-code-review` (opus); poprawki Critical/Important; prośba do użytkownika o `! git push origin main`.
- [ ] **Krok 8: Po wdrożeniu (użytkownik):** włączyć Google Calendar API w `deck-samorzad`; Ustawienia skrzynki → „Połącz kalendarz”; Planer → „Wyślij do Kalendarza Samorządowicza” i przejrzeć podsumowanie (przejęcia!) przed „Wyślij”; sprawdzić w kalendarzu jedno przejęte i jedno nowe wydarzenie.
