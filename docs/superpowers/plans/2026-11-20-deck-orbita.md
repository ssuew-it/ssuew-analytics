# Orbita - plan wykonania

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moduł `/orbita` - zadania z etapami, „Dziś” liczone wstecz od terminu, „Kopiuj do Claude”, radar zapasu, „Weź do Orbity” z Dziennika, kafelek w kokpicie i sekcja `orbita` w obrazie asystenta.

**Architecture:** Jedna kolekcja `orbitaZadania` (etapy jako tablica w dokumencie) tylko przez Admin SDK z tras `app/api/orbita/**` chronionych `tylkoWlasciciel`. Cała logika (zapas, plan dnia, niezmiennik etapów, zamykanie, dopasowanie, wstęp do Claude, radar, obraz dla asystenta) to czyste funkcje w `lib/orbita/`. Strona to komponent kliencki pobierający wszystkie zadania jednym GET; wzór budowy: Dziennik Stratega.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, firebase-admin 14, Vitest + Testing Library, Tailwind 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-20-deck-orbita-design.md` - czytaj razem z planem.

## Global Constraints

- Graf: przed pierwszym grep/odczytem kodu `graphify query "<pytanie>"`; po zmianach kodu `graphify update .`. Ta reguła trafia do promptu każdego podagenta, który czyta kod.
- Tylko rola `owner`. Trasy: `tylkoWlasciciel(req, 'Orbita jest tylko dla właściciela')` z `lib/asystent/tylkoWlasciciel.ts`. Strona `/orbita`: `ktoNaStronie()` z `lib/auth/naStronie`; brak → `redirect('/login')`, `board` → `redirect('/')` (wzór `app/dziennik/page.tsx`).
- Firestore tylko przez `bazaAdmin()` i ref w `lib/firebase/admin.ts`; `firestore.rules` bez zmian.
- Daty: typ `Data` i `przesunDate`, `porownajDaty`, `dniMiedzy`, `naIso`, `zIso` z `lib/planer/trwanie.ts`; „dziś” = `dzisWarszawa` z `lib/czas.ts`. Termin i `czekamDo` w bazie jako `"RRRR-MM-DD"`. Dni kalendarzowe.
- Limity: `tytul` 1-120, `kontekst` do 4000, etapów 1-15, `nazwa` 1-60, `cel`/`zacznijOd`/`gotoweGdy` do 500, `materialy` do 2000, `wynik` do 2000, `dni` 0-90 (całkowite), `czekaNa` najwyżej 10 pozycji po 40 znaków.
- Komunikat kolizji (409): „Zadanie zmieniło się w innej karcie - odśwież”.
- Interfejs po polsku z ogonkami; tylko łącznik „-”, nigdy „—” ani „–” (także we wstępie do Claude i tekstach do Gemini). Telefon 390 px bez przewijania w bok; wygląd modułów D.E.C.K. (`deck-shell`, `deck-chip`, kolory `deck-*`, style z `components/dziennik/style.ts` jeśli pasują).
- Commity na `main` po każdym zadaniu, końcówka: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push robi użytkownik (`! git push origin main`).
- Testy: `npx vitest run <ścieżka>`; na koniec `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Review Focus

1. Zadanie z terminem bliższym niż suma etapów (np. szkielet 34 dni, termin za 20) - zapis dozwolony, ostrzeżenie z liczbami, „Dopasuj” nie rusza konsultacji, gdy nawet po skróceniu brakuje dni, mówi ile. → testy w Zadaniu 1 (`dopasuj`) i 6 (formularz).
2. PATCH z przeglądarki, który podmienia, usuwa albo przestawia zamknięty etap, albo ustawia `zamkniety` na nowym - serwer odrzuca 400, nie ufa ciału. → test w Zadaniu 2.
3. Dwie karty: jedna zamyka etap, druga wysyła edycję ze starym `zmieniono` → 409; druga zamyka ten sam etap drugi raz → 409 (już nie bieżący), nie podwójne zamknięcie. → testy w Zadaniu 3.
4. Zadanie bez terminu, zadanie z `termin` w przeszłości, etap oczekiwania bez `czekamDo` (dane sprzed reguły), `dni: 0`. → testy w Zadaniu 1.
5. Wstęp do Claude z pustymi materiałami, bez zamkniętych etapów, z wynikiem zawierającym nowe linie i adres URL - tekst gotowy do wklejenia bez poprawek, bez długich myślników. → test w Zadaniu 4.

---

### Task 1: Typy, szkielet, zapas, plan dnia, dopasowanie

**Files:**
- Create: `lib/orbita/typy.ts`, `lib/orbita/szkielet.ts`, `lib/orbita/zapas.ts`
- Test: `lib/orbita/zapas.test.ts`, `lib/orbita/szkielet.test.ts`

**Interfaces:**
- Produces (`lib/orbita/typy.ts`):
  ```ts
  export type RodzajEtapu = 'praca' | 'czekanie'
  export interface Etap { id: string; nazwa: string; rodzaj: RodzajEtapu; cel: string; zacznijOd: string; materialy: string; gotoweGdy: string; dni: number; czekaNa: string[]; czekamDo: string | null; zamkniety: number | null; wynik: string }
  export interface ZrodloDziennika { typ: 'dziennik'; wpisId: string; termin: string }
  export interface Zadanie { id: string; tytul: string; kontekst: string; termin: string | null; zrodlo: ZrodloDziennika | null; etapy: Etap[]; utworzono: number; zmieniono: number; zamkniete: number | null }
  export type PolaZadania = Pick<Zadanie, 'tytul' | 'kontekst' | 'termin' | 'zrodlo' | 'etapy'>
  export const LIMITY = { tytul: 120, kontekst: 4000, etapy: 15, nazwa: 60, krotkie: 500, materialy: 2000, wynik: 2000, dni: 90, czekaNa: 10, czekaNaZnaki: 40 } as const
  export const WIDOCZNE_DZIS = 3
  ```
- Produces (`lib/orbita/szkielet.ts`): `szkieletDokumentu(): Etap[]` (5 etapów z tabeli sekcji 4 specu, dosłowne teksty, `czekaNa: ['RUSS', 'KR']` tylko w Konsultacjach, nowe `id` z `crypto.randomUUID()`), `etapPusty(): Etap` (`praca`, `dni: 3`, puste teksty).
- Produces (`lib/orbita/zapas.ts`):
  - `biezacy(z: Zadanie): number | null` - indeks pierwszego niezamkniętego etapu.
  - `czekamDoEfektywne(e: Etap, dzis: Data): Data` - `zIso(e.czekamDo)` albo `przesunDate(dzis, e.dni)` gdy brak.
  - `zapas(z: Zadanie, dzis: Data): number | null` - `null` bez terminu albo gdy zadanie zamknięte; wzory z sekcji 5 specu (zwykły: `dniMiedzy(dzis, T) - suma dni od k`; bieżący `czekanie`: `dniMiedzy(czekamDoEfektywne, T) - suma dni po k`).
  - `czeka(z: Zadanie, dzis: Data): boolean` - bieżący to `czekanie` i `dzis <= czekamDoEfektywne`.
  - `export interface PozycjaDnia { zadanie: Zadanie; etap: number; zapas: number; poCzekaniu: boolean }`
  - `export interface PlanDnia { dzis: PozycjaDnia[]; podpowiedz: boolean; czekam: { zadanie: Zadanie; etap: number; do: Data }[]; najblizej: PozycjaDnia[]; kiedys: Zadanie[]; zamkniete: Zadanie[] }`
  - `planDnia(zadania: Zadanie[], dzis: Data): PlanDnia` - reguły sekcji 5; `dzis` po zapasie rosnąco (remis: termin, potem tytuł); `podpowiedz = true` i jedna pozycja z najmniejszym zapasem, gdy nic nie ma zapasu ≤ 0; `zamkniete` nowsze wyżej.
  - `ileBrakuje(etapy: Etap[], termin: string | null, dzis: Data): number` - `max(0, suma dni otwartych etapów - dniMiedzy(dzis, T))`; bez terminu 0.
  - `dopasuj(etapy: Etap[], termin: string, dzis: Data): { etapy: Etap[]; brakuje: number }` - algorytm niżej.

- [ ] **Step 1: Write the failing tests** (`lib/orbita/zapas.test.ts`, fabryki `etap(rodzaj, dni, zmiany?)` i `zadanie(termin, etapy)` w pliku):

```ts
const d = (rok: number, miesiac: number, dzien: number) => ({ rok, miesiac, dzien })
const DZIS = d(2026, 11, 20)
it('zapas: suma etapów od bieżącego wstecz od terminu', () => {
  // termin 20.12 (30 dni), etapy 3+7+14 otwarte → 30 - 24 = 6
  expect(zapas(zadanie('2026-12-20', [etap('praca', 3), etap('praca', 7), etap('czekanie', 14)]), DZIS)).toBe(6)
})
it('zapas pomija zamknięte etapy', () => { /* pierwszy zamknięty → 30 - 21 = 9 */ })
it('szkielet 34 dni przy terminie za 20 dni → -14', () => expect(zapas(zadanie('2026-12-10', szkieletDokumentu()), DZIS)).toBe(-14))
it('bez terminu i zamknięte → null', () => { /* termin null; wszystkie etapy zamknięte */ })
it('termin w przeszłości → ujemny zapas', () => { /* termin 2026-11-10, jeden etap 0 dni → -10 */ })
it('bieżący czekanie liczy od czekamDo', () => {
  // termin 20.12; [zamknięta praca, czekanie czekamDo 2026-12-05, praca 3] → dniMiedzy(5.12, 20.12)=15 - 3 = 12
})
it('czekanie bez czekamDo liczy od dziś + dni', () => { /* czekanie 14, brak czekamDo → czekamDoEfektywne = 4.12 */ })
it('planDnia: dziś, czekam, najbliżej, kiedyś, zamknięte', () => {
  // A zapas -2, B zapas 0, C zapas 5, D czeka do 28.11, E bez terminu, F zamknięte
  const p = planDnia([C, A, D, E, B, F], DZIS)
  expect(p.dzis.map((x) => x.zadanie.id)).toEqual(['A', 'B'])
  expect(p.podpowiedz).toBe(false)
  expect(p.czekam.map((x) => x.zadanie.id)).toEqual(['D'])
  expect(p.najblizej.map((x) => x.zadanie.id)).toEqual(['C'])
  expect(p.kiedys.map((z) => z.id)).toEqual(['E'])
  expect(p.zamkniete.map((z) => z.id)).toEqual(['F'])
})
it('planDnia: czekanie po czekamDo trafia na dziś z poCzekaniu', () => { /* czekamDo 2026-11-19 */ })
it('planDnia: nic nie pali się → podpowiedź z najmniejszym zapasem', () => { /* zapasy 5 i 9 → dzis=[5], podpowiedz true, najblizej=[9] */ })
it('ileBrakuje i dopasuj: konsultacje nietknięte, praca skrócona', () => {
  const s = szkieletDokumentu()                       // 3,7,14,3,7 przy terminie za 20 dni
  expect(ileBrakuje(s, '2026-12-10', DZIS)).toBe(14)
  const w = dopasuj(s, '2026-12-10', DZIS)
  expect(w.etapy.find((e) => e.rodzaj === 'czekanie')!.dni).toBe(14)
  expect(w.etapy.every((e) => e.dni >= 1)).toBe(true)
  expect(w.etapy.map((e) => e.dni)).toEqual([1, 2, 14, 1, 2]) // na pracę zostaje 6 dni: floor(3·6/20)=0→1, floor(7·6/20)=2
  expect(w.brakuje).toBe(0)
})
it('dopasuj: nawet po skróceniu brakuje', () => { /* termin za 10 dni → praca po 1 dzień (4), +14 → brakuje 8 */ })
```

`szkielet.test.ts`: 5 etapów, nazwy `['Koncepcja','Projekt','Konsultacje','Poprawki','Przyjęcie']`, dni `[3,7,14,3,7]`, tylko Konsultacje `czekanie` z `czekaNa ['RUSS','KR']`, różne `id` przy dwóch wywołaniach, żaden tekst nie zawiera `—` ani `–`.

- [ ] **Step 2:** `npx vitest run lib/orbita` → FAIL (brak modułów).
- [ ] **Step 3:** Zaimplementuj. Algorytm `dopasuj` (dotyczy tylko otwartych etapów; zamknięte bez zmian):

```ts
const dostepne = dniMiedzy(dzis, zIso(termin)!)
const czekanie = suma dni otwartych 'czekanie'
const praca = otwarte 'praca'
const cel = dostepne - czekanie
const sumaPracy = suma dni praca
if (sumaPracy <= cel) return { etapy, brakuje: 0 }
const nowe = praca.map((e) => Math.max(1, Math.floor((e.dni * Math.max(cel, 0)) / sumaPracy)))
brakuje = Math.max(0, suma(nowe) + czekanie - dostepne)
```
Pozostałe pola etapów kopiowane bez zmian, kolejność zachowana.
- [ ] **Step 4:** `npx vitest run lib/orbita` → PASS.
- [ ] **Step 5:** Commit `feat(orbita): typy, szkielet dokumentu, zapas i plan dnia`.

---

### Task 2: Walidacja zadania i operacje na etapach

**Files:**
- Create: `lib/orbita/walidacja.ts`, `lib/orbita/etapy.ts`
- Test: `lib/orbita/walidacja.test.ts`, `lib/orbita/etapy.test.ts`

**Interfaces:**
- Consumes: typy i `LIMITY` (Zadanie 1).
- Produces:
  - `export class BladOrbity extends Error { constructor(readonly rodzaj: 'nie-ma' | 'zmienione' | 'walidacja' | 'nie-biezacy', wiadomosc: string) }` (w `etapy.ts`).
  - `sprawdzZadanie(x: unknown): { ok: true; pola: PolaZadania } | { ok: false; blad: string }` - przycina, egzekwuje `LIMITY`; `termin` `null` albo poprawne `zIso`; `zrodlo` `null` albo `{ typ: 'dziennik', wpisId niepusty, termin poprawne zIso }`; etap: brak/zły `id` → `crypto.randomUUID()`, `rodzaj` z dwóch, `dni` całkowite 0-90; `czekaNa` przycięte, bez pustych i duplikatów, tylko przy `czekanie` (przy `praca` → `[]`); `czekamDo` tylko przy `czekanie` (poprawne zIso albo `null`), przy `praca` → `null`; `zamkniety` z ciała ignorowany (zawsze `null`), `wynik` przycięty. Pola spoza listy odrzucane.
  - `scalEdycje(stare: Zadanie, nowe: PolaZadania, teraz: number): Zadanie | string` - string = komunikat błędu walidacji. Zamknięte etapy `stare` muszą być w `nowe.etapy` na początku, w tej samej kolejności (po `id`) → inaczej „Zamkniętych etapów nie można usuwać ani przestawiać”; ich pola biorą się ze `stare`, poza `wynik`. Pozostałe etapy otwarte (`zamkniety: null`). Brak otwartych etapów i brak etapów w ogóle → „Zadanie musi mieć co najmniej jeden etap”. Wszystkie zamknięte (usunięto ostatni otwarty) → `zamkniete = teraz`. `zmieniono = teraz`.
  - `zamknijEtap(z: Zadanie, etapId: string, wynik: string, teraz: number, dzis: Data): Zadanie` - etap musi być bieżący, inaczej `BladOrbity('nie-biezacy', KOMUNIKAT_KOLIZJI)`; ustawia `zamkniety`, `wynik` (przycięty, ≤ 2000); jeśli następny etap to `czekanie` → `czekamDo = naIso(przesunDate(dzis, nastepny.dni))`; wszystkie zamknięte → `zamkniete = teraz`; `zmieniono = teraz`.
  - `otworzEtap(z: Zadanie, etapId: string, teraz: number): Zadanie` - musi być ostatnim zamkniętym, inaczej `nie-biezacy`; `zamkniety = null`; następny etap, jeśli `czekanie` → `czekamDo = null`; `zamkniete = null`; `zmieniono = teraz`.
  - `export const KOMUNIKAT_KOLIZJI = 'Zadanie zmieniło się w innej karcie - odśwież'`

- [ ] **Step 1: Write the failing tests** - m.in.:
  - `sprawdzZadanie`: tytuł 121 znaków, 16 etapów, `dni: 91`, `dni: 2.5`, `termin: '2026-13-01'`, `zrodlo` bez `wpisId` → `ok: false`; etap `praca` z `czekaNa: ['KR']` i `czekamDo` → oba wyczyszczone; `czekaNa: [' KR ', 'KR', '']` przy `czekanie` → `['KR']`; `zamkniety: 123` w ciele → `null`.
  - `scalEdycje`: stare `[z1 zamknięty, o2]`; nowe `[o2, z1]` → string; nowe bez `z1` → string; nowe `[z1 ze zmienioną nazwą i wynikiem, o2]` → nazwa ze starego, wynik nowy; nowe `[z1]` (usunięto o2) → `zamkniete === teraz`; nowe `[]` → string.
  - `zamknijEtap`: na niebieżącym → rzuca `nie-biezacy`; zamknięcie przed Konsultacjami przy `dzis` 20.11 i `dni: 14` → `czekamDo === '2026-12-04'`; ostatni → `zamkniete` ustawione.
  - `otworzEtap`: na pierwszym z dwóch zamkniętych → rzuca; na ostatnim zamkniętym → bieżący, `czekamDo` następnego `null`, `zamkniete null`.
- [ ] **Step 2:** `npx vitest run lib/orbita` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** `npx vitest run lib/orbita` → PASS.
- [ ] **Step 5:** Commit `feat(orbita): walidacja zadań i zamykanie etapów`.

---

### Task 3: Firestore i trasy API

**Files:**
- Modify: `lib/firebase/admin.ts` (`orbitaZadaniaRef()` = `bazaAdmin().collection('orbitaZadania')`)
- Create: `lib/orbita/dane.ts`, `app/api/orbita/route.ts`, `app/api/orbita/[id]/route.ts`, `app/api/orbita/[id]/etapy/[eid]/route.ts`, `app/api/orbita/zrodla/route.ts`
- Test: `lib/orbita/dane.test.ts`, `app/api/orbita/route.test.ts`

**Interfaces:**
- Consumes: Zadania 1-2.
- Produces (`lib/orbita/dane.ts`):
  ```ts
  export function naZadanie(id: string, d: DocumentData): Zadanie | null   // tolerancyjny jak naWpis w lib/dziennik/dane.ts; bez etapów → null
  export function czytajZadania(): Promise<Zadanie[]>
  export function dodajZadanie(pola: PolaZadania, teraz: number): Promise<Zadanie>
  export function zmienZadanie(id: string, pola: PolaZadania, zmieniono: number, teraz: number): Promise<Zadanie>  // transakcja; brak → 'nie-ma'; zmieniono ≠ bazowe → 'zmienione'; scalEdycje string → 'walidacja'
  export function usunZadanie(id: string): Promise<void>                    // brak → 'nie-ma'
  export function akcjaEtapu(id: string, etapId: string, akcja: 'zamknij' | 'otworz', wynik: string, teraz: number, dzis: Data): Promise<Zadanie>  // transakcja, bez kontroli zmieniono
  export function zrodlaOtwartych(): Promise<{ wpisId: string; termin: string; zadanieId: string }[]>
  ```
- Trasy (wszystkie `runtime = 'nodejs'`, `tylkoWlasciciel`): `GET /api/orbita` → `{ zadania }`; `POST /api/orbita` (`sprawdzZadanie`) → 201 `Zadanie`; `PATCH /api/orbita/[id]` ciało `{ ...pola, zmieniono: number }` → 200; `DELETE /api/orbita/[id]` → 200 `{ ok: true }`; `POST /api/orbita/[id]/etapy/[eid]` ciało `{ akcja: 'zamknij' | 'otworz', wynik?: string }` → 200 `Zadanie` (`dzis = dzisWarszawa(new Date())`); `GET /api/orbita/zrodla` → `{ zrodla }`. Mapowanie: walidacja 400 `{ error }`, `nie-ma` 404, `zmienione` i `nie-biezacy` 409 z `KOMUNIKAT_KOLIZJI`, inne 500 bez szczegółów (wzór `app/api/dziennik/wpisy/route.ts`).

- [ ] **Step 1: Write the failing tests.** `dane.test.ts` - mock `@/lib/firebase/admin` w pamięci z `runTransaction` (wzór `lib/dziennik/dane.test.ts`):
  - `zmienZadanie` ze starym `zmieniono` → rzuca `zmienione`, dokument bez zmian.
  - `akcjaEtapu('zamknij')` dwa razy na tym samym etapie → drugie rzuca `nie-biezacy`; w bazie jedno `zamkniety`.
  - `zmienZadanie` przestawiające zamknięty etap → rzuca `walidacja`.
  - `naZadanie` z `etapy: 'x'` → `null`; z etapem bez `rodzaj` → `rodzaj: 'praca'`.
  - `zrodlaOtwartych` pomija zamknięte zadania i zadania bez `zrodlo`.
  Trasy (`vi.mock('@/lib/auth/guard')`, `vi.mock('@/lib/orbita/dane')` jak `app/api/dziennik/wpisy/route.test.ts`): bez sesji 401, `board` 403 na każdej trasie; POST ze złym ciałem 400; PATCH bez liczbowego `zmieniono` 400; `BladOrbity('zmienione')` → 409 z `KOMUNIKAT_KOLIZJI`; akcja inna niż `zamknij`/`otworz` → 400; nieoczekiwany błąd → 500 bez treści błędu.
- [ ] **Step 2:** `npx vitest run lib/orbita app/api/orbita` → FAIL.
- [ ] **Step 3:** Zaimplementuj ref, `dane.ts` i trasy.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(orbita): zadania w Firestore i trasy API`.

---

### Task 4: Wstęp do Claude

**Files:**
- Create: `lib/orbita/wstep.ts`
- Test: `lib/orbita/wstep.test.ts`

**Interfaces:**
- Produces: `wstepDoClaude(z: Zadanie): string` - dokładnie szablon z sekcji 6 specu dla bieżącego etapu (zadanie zamknięte → wstęp dla ostatniego etapu). Termin `DD.MM.RRRR` albo „bez terminu”; puste materiały → „brak”; brak ustaleń → linia „brak” pod nagłówkiem; „Pozostałe etapy:” → „brak” przy ostatnim. Wynik wieloliniowy wcięty dwiema spacjami od drugiej linii. Zawsze kończy się zdaniem „Pomóż mi przejść ten etap. Zacznij od pytań, jeśli czegoś brakuje.”

- [ ] **Step 1: Write the failing test** - pełne porównanie `toBe` dla zadania: tytuł „Zarządzenie ws. uchwał strategicznych”, termin `2026-12-20`, kontekst „Standaryzacja trybu”, etapy szkieletu z zamkniętą Koncepcją (`wynik: 'Tryb: zarządzenie\nhttps://docs.google.com/x'`) → oczekiwany tekst zaczyna się od `'Pracuję nad: Zarządzenie ws. uchwał strategicznych\nTermin: 20.12.2026\n'`, zawiera `'Teraz etap 2 z 5: Projekt'`, `'- Koncepcja: Tryb: zarządzenie\n  https://docs.google.com/x'`, `'Pozostałe etapy: Konsultacje, Poprawki, Przyjęcie'`, `'Materiały: brak'`. Drugi test: bez terminu i bez zamkniętych → `'Termin: bez terminu'` i `'Ustalenia z poprzednich etapów:\nbrak'`. Trzeci: wynik nie zawiera `—` ani `–`.
- [ ] **Step 2:** `npx vitest run lib/orbita/wstep.test.ts` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(orbita): wstęp do rozmowy z Claude`.

---

### Task 5: Strona `/orbita` - powłoka i widok Dziś

**Files:**
- Create: `app/orbita/page.tsx`, `lib/orbita/klient.ts`, `components/orbita/OrbitaClient.tsx`, `components/orbita/Dzis.tsx`, `components/orbita/KartaEtapu.tsx`, `components/orbita/ZamknijEtap.tsx`
- Test: `app/orbita/page.test.tsx`, `components/orbita/Dzis.test.tsx`, `components/orbita/KartaEtapu.test.tsx`

**Interfaces:**
- Consumes: `planDnia`, `WIDOCZNE_DZIS` (Zadanie 1), `wstepDoClaude` (Zadanie 4), trasy (Zadanie 3).
- Produces:
  - `lib/orbita/klient.ts`: `export const klientOrbity = { zadania, dodaj, zmien(id, pola, zmieniono), usun, zamknij(id, etapId, wynik), otworz(id, etapId), zrodla }` - przez `wywolaj` i `json` z `lib/asystent/klient.ts` (wzór `lib/dziennik/klient.ts`).
  - `app/orbita/page.tsx` - strażnik roli; `dzis = dzisWarszawa(new Date())`; podaje `searchParams.widok` (`dzis` | `radar` | `lista`, inne → `dzis`) i `searchParams.zDziennika` do klienta.
  - `OrbitaClient({ dzis, widok, zDziennika }: { dzis: Data; widok: 'dzis' | 'radar' | 'lista'; zDziennika: string | null })` - nagłówek „ORBITA · <dzień tygodnia> <dzień> <miesiąc>”, przełącznik Dziś | Radar | Lista (w `?widok=`), przycisk „+ Zadanie”; pobiera zadania raz, `odswiez()` po każdej zmianie; widoki Radar i Lista oraz formularz renderuje przez props `renderWidok?(widok, zadania, odswiez)` i `renderFormularz?(...)`, wypełniane w Zadaniach 6-7 (wzór `renderDzial` w Dzienniku). Błąd wczytania - komunikat i „Spróbuj ponownie”.
  - `Dzis({ plan, odswiez })` - sekcje i teksty z sekcji 5 specu: „Dziś” (najwyżej `WIDOCZNE_DZIS`, reszta pod „i jeszcze <n>” rozwijanym), przy `podpowiedz` nagłówek „Nic nie musi ruszyć dziś - najbliżej:”, „Czekam” („<etap> (<czekaNa złączone ', '>) do DD.MM”), „Najbliżej”, „Kiedyś” i „Zamknięte (n)” jako `<details>`. Zadanie ze `zrodlo` z dopiskiem „(z Dziennika)”. Pusto (zero zadań): „Nic tu jeszcze nie ma. Dodaj zadanie, które czeka na pierwszy krok.”
  - `KartaEtapu({ pozycja, odswiez })` - „<tytuł> · etap k/n <nazwa>”, zapas („zapas <n> dni” z `odmiana` z `lib/asystent/fakty.ts`, „spóźnione o <n> dni” przy ujemnym), przy `poCzekaniu` dopisek „Termin konsultacji minął - zamknij etap albo przedłuż”, cel, „Kopiuj do Claude” (`navigator.clipboard.writeText(wstepDoClaude(z))` → status „Skopiowano - wklej w Claude”; wyjątek albo brak schowka → okno z `<textarea readOnly>` z zaznaczonym tekstem), „Zamknij etap” → `ZamknijEtap`.
  - `ZamknijEtap({ zadanie, etapId, onGotowe, onAnuluj })` - pole „Wynik” (licznik do 2000), „Zamknij” (zablokowany w trakcie) woła `klientOrbity.zamknij`; błąd serwera nad przyciskiem.

- [ ] **Step 1: Write the failing tests**:
  - page: brak sesji → `redirect('/login')`, `board` → `redirect('/')` (wzór `app/dziennik/page.test.tsx`).
  - Dzis: plan z 5 pozycjami „Dziś” → widać 3 i „i jeszcze 2”; `podpowiedz` → nagłówek z podpowiedzią; czekanie z `czekaNa ['RUSS','KR']` i `do` 28.11 → „Konsultacje (RUSS, KR) do 28.11”; zero zadań → komunikat pustki.
  - KartaEtapu: „Kopiuj do Claude” woła `navigator.clipboard.writeText` z tekstem zaczynającym się od „Pracuję nad:” i pokazuje „Skopiowano - wklej w Claude”; gdy `writeText` rzuca → widać `textarea` z tym tekstem; zapas -2 → „spóźnione o 2 dni”; „Zamknij etap” → wpisanie wyniku i „Zamknij” woła `klientOrbity.zamknij(id, etapId, 'link')`.
- [ ] **Step 2:** `npx vitest run components/orbita app/orbita` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(orbita): strona z widokiem Dziś i kopiowaniem do Claude`.

---

### Task 6: Formularz zadania, edycja etapów, Lista

**Files:**
- Create: `components/orbita/FormularzZadania.tsx`, `components/orbita/EdytorEtapow.tsx`, `components/orbita/Lista.tsx`, `lib/orbita/zDziennika.ts`
- Modify: `components/orbita/OrbitaClient.tsx` (podłącz formularz i Listę)
- Test: `components/orbita/FormularzZadania.test.tsx`, `components/orbita/Lista.test.tsx`, `lib/orbita/zDziennika.test.ts`

**Interfaces:**
- Consumes: `szkieletDokumentu`, `etapPusty`, `ileBrakuje`, `dopasuj`, `zapas`, `planDnia` (Zadanie 1); `najblizszyTermin` z `lib/dziennik/terminy.ts`; `klientDziennika.ksiega()`.
- Produces:
  - `szkicZDziennika(w: WpisCyklu, dzis: Data): PolaZadania` - tytuł i kontekst (= `tresc`) z wpisu, `termin = naIso(najblizszyTermin(w, dzis))`, `zrodlo = { typ: 'dziennik', wpisId: w.id, termin }`, `etapy = [etapPusty()]`.
  - `FormularzZadania({ dzis, zadanie?, szkic?, onZapisz, onAnuluj })` - tytuł, kontekst (licznik do 4000), termin (`<input type="date">` + „bez terminu”), przy nowym zadaniu wybór „Dokument normatywny” / „Własne etapy” (podmienia etapy na `szkieletDokumentu()` / `[etapPusty()]`), `EdytorEtapow`. Gdy `ileBrakuje > 0`: „Etapy trwają <suma> dni, do terminu zostało <m>” + przycisk „Dopasuj” (`dopasuj`); gdy po dopasowaniu `brakuje > 0`: „Nawet po skróceniu brakuje <k> dni - przesuń termin albo skróć konsultacje”. Zapis dozwolony mimo ostrzeżenia. Nowe → `klientOrbity.dodaj`, edycja → `klientOrbity.zmien(id, pola, zadanie.zmieniono)`; błąd serwera (w tym 409) nad przyciskiem; przycisk zablokowany w trakcie.
  - `EdytorEtapow({ etapy, onChange })` - pola etapu z sekcji 4 specu; `czekaNa` (pola wyboru RUSS, KR + „inne” po przecinku) i `czekamDo` tylko przy `czekanie`; strzałki góra/dół i „Usuń” tylko na otwartych, nie przenoszą przed zamknięte; zamknięty etap: pola tylko do odczytu poza „Wynik”; „Dodaj etap” dokłada `etapPusty()` na końcu.
  - `Lista({ zadania, dzis, odswiez })` - otwarte zadania po zapasie (bez terminu na końcu), rozwijane do etapów (zamknięte z „Otwórz ponownie” tylko przy ostatnim zamkniętym → `klientOrbity.otworz`), „Popraw” (formularz z `zadanie`), „Usuń” z potwierdzeniem „Usunąć zadanie „<tytuł>”? Tego nie da się cofnąć.”.
  - `OrbitaClient` przy `zDziennika` pobiera księgę, znajduje wpis `cykl` o tym `id` i otwiera formularz z `szkicZDziennika`; brak wpisu → komunikat „Nie znaleziono wpisu w Dzienniku”.

- [ ] **Step 1: Write the failing tests**:
  - `szkicZDziennika`: wpis `{ miesiac: 3, dzien: 15 }` przy `dzis` 20.11.2026 → `termin '2027-03-15'`, `zrodlo.termin '2027-03-15'`.
  - FormularzZadania: wybór „Dokument normatywny” przy terminie za 20 dni → tekst „Etapy trwają 34 dni, do terminu zostało 20”; „Dopasuj” → ostrzeżenie znika, Konsultacje nadal 14; zapis woła `dodaj` z 5 etapami; edycja z odpowiedzią 409 → komunikat „Zadanie zmieniło się w innej karcie - odśwież” widoczny.
  - EdytorEtapow (w teście formularza): zamknięty pierwszy etap - brak strzałek i „Usuń”, pole nazwy `readOnly`; strzałka „w górę” na drugim (pierwszym otwartym) zablokowana.
  - Lista: „Otwórz ponownie” tylko przy ostatnim zamkniętym etapie; „Usuń” woła `usun` dopiero po potwierdzeniu.
- [ ] **Step 2:** `npx vitest run components/orbita lib/orbita/zDziennika.test.ts` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(orbita): formularz zadania z szkieletem i dopasowaniem, lista`.

---

### Task 7: Radar

**Files:**
- Create: `lib/orbita/radar.ts`, `components/orbita/Radar.tsx`
- Modify: `components/orbita/OrbitaClient.tsx` (widok `radar`)
- Test: `lib/orbita/radar.test.ts`, `components/orbita/Radar.test.tsx`

**Interfaces:**
- Produces:
  - `promien(zapas: number | null): number` - progi z tabeli sekcji 9 specu (`null` → 0,95; `< 0` → 0,10; `0` → 0,20; 1-3 → 0,40; 4-14 → 0,62; więcej → 0,82).
  - `kat(id: string): number` - radiany z hasza jak `kolorOsoby` w `lib/planer/obecnosc.ts` (`h % 360` → stopnie → radiany).
  - `Radar({ plan, onWybierz })` - SVG z okręgami, punkt na każde otwarte zadanie (`dzis`, `najblizej`, `czekam`, `kiedys`); spóźnione z klasą alarmu i pulsowaniem (`motion-safe:`), czekające jako pusty okrąg (promień z `zapas` zadania), etykieta z tytułem skróconym do 24 znaków; kliknięcie → `onWybierz(zadanieId)` pokazuje pod radarem `KartaEtapu`. W `OrbitaClient` widok `radar` renderuje `Radar` w `hidden sm:block` i `Lista` w `sm:hidden` (poniżej 640 px lista).

- [ ] **Step 1: Write the failing tests**: `promien` dla `null, -3, 0, 2, 10, 30` → `0.95, 0.10, 0.20, 0.40, 0.62, 0.82`; `kat('a') === kat('a')`, `kat('a') !== kat('b')`, wynik w `[0, 2π)`. Radar: 3 otwarte zadania → 3 punkty (`data-zadanie`); spóźnione ma klasę zawierającą `deck-danger`; kliknięcie woła `onWybierz` z id.
- [ ] **Step 2:** `npx vitest run lib/orbita/radar.test.ts components/orbita/Radar.test.tsx` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(orbita): radar zapasu`.

---

### Task 8: „Weź do Orbity” w Dzienniku

**Files:**
- Modify: `components/dziennik/DziennikClient.tsx` (pobranie `klientOrbity.zrodla()` obok księgi, przekazanie w dół), `components/dziennik/Najblizsze.tsx`, `components/dziennik/KartaWpisu.tsx` (tylko `cykl`)
- Create: `components/dziennik/WezDoOrbity.tsx`
- Test: `components/dziennik/WezDoOrbity.test.tsx`, dopisz w `components/dziennik/Najblizsze.test.tsx`

**Interfaces:**
- Consumes: `klientOrbity.zrodla` (Zadanie 5), `najblizszyTermin`, `naIso`.
- Produces: `WezDoOrbity({ wpis, dzis, zrodla }: { wpis: WpisCyklu; dzis: Data; zrodla: { wpisId: string; termin: string; zadanieId: string }[] | null })` - gdy w `zrodla` jest pozycja z `wpisId === wpis.id` i `termin === naIso(najblizszyTermin(wpis, dzis))` → link „w Orbicie” do `/orbita?widok=lista`; inaczej link „Weź do Orbity” do `/orbita?zDziennika=<id>`. `zrodla === null` (błąd odczytu) → zawsze „Weź do Orbity”. Błąd `zrodla()` nie blokuje Dziennika (łapany, `null`).

- [ ] **Step 1: Write the failing tests**: wpis w `zrodla` z tym samym terminem → „w Orbicie”; z innym terminem (zeszłoroczne) → „Weź do Orbity” z `href="/orbita?zDziennika=w1"`; `zrodla null` → „Weź do Orbity”. Najblizsze: każda pozycja ma jeden z tych linków. Wpis działu `luka` w `KartaWpisu` nie ma przycisku.
- [ ] **Step 2:** `npx vitest run components/dziennik` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS (istniejące testy Dziennika też).
- [ ] **Step 5:** Commit `feat(orbita): obowiązki z Dziennika do Orbity`.

---

### Task 9: Asystent - sekcja `orbita`

**Files:**
- Create: `lib/orbita/obraz.ts`
- Modify: `lib/asystent/kontekst.ts`, `lib/asystent/dane.ts`, `app/api/asystent/czat/route.ts`, `app/api/asystent/odprawa/route.ts`, `app/page.tsx` (do `odswiezOdpraweWTle`), `lib/asystent/odprawa.ts` (`OBSZARY` + `'orbita'`, `ODNOSNIK_OBSZARU.orbita = '/orbita'`, zdanie w `INSTRUKCJA_ODPRAWY`), `lib/asystent/czat.ts` (zdanie w `INSTRUKCJA_CZATU`), `components/deck/PanelOdprawy.tsx` (`ETYKIETA_OBSZARU.orbita = 'Orbita'`)
- Test: `lib/orbita/obraz.test.ts`, `lib/asystent/kontekst.test.ts`, `lib/asystent/dane.test.ts`, istniejące testy tras czatu i odprawy

**Interfaces:**
- Produces:
  - `export interface ObrazOrbity { dzis: { zadanie: string; etap: string; zapasDni: number; termin: string /* DD.MM.RRRR */ }[]; podpowiedz: boolean; czekam: { zadanie: string; etap: string; czekaNa: string[]; do: string /* DD.MM.RRRR */ }[] }`
  - `obrazOrbity(zadania: Zadanie[], dzis: Data): ObrazOrbity` - czysta, z `planDnia`; wszystkie pozycje „Dziś” (bez limitu 3); bez kontekstu, materiałów, wyników.
  - `pobierzObrazOrbity(dzis: Data): Promise<ObrazOrbity | null>` w `lib/asystent/dane.ts` - nigdy nie rzuca; błąd → `console.error('[asystent] orbita:', e)` i `null`.
  - `DaneProjektu.orbita: ObrazOrbity | null`; `daneProjektu(..., dziennik, orbita)` - nowy ostatni parametr; wszystkie cztery wywołania; `zbudujKontekst` zwraca `orbita: d.orbita`; `odswiezOdpraweWTle` dostaje `orbita: Promise<ObrazOrbity | null>`.
  - Zdanie do obu instrukcji: „orbita - etapy zadań na dziś (zapasDni: ile dni zapasu do ostatniego bezpiecznego startu, ujemny = spóźnienie; podpowiedz: true - nic nie musi ruszyć dziś, to tylko najbliższy etap) i etapy czekające na innych (czekaNa, do kiedy); null - brak danych z Orbity, nie wnioskuj z tego”.

- [ ] **Step 1: Write the failing tests**: `obrazOrbity` - zadanie z zapasem -1 → pozycja z `zapasDni: -1`, `termin` `DD.MM.RRRR`; czekające → w `czekam` z `do`; w JSON wyniku brak `kontekst`, `wynik`, `materialy`. `kontekst.test.ts`: `orbita` przechodzi bez zmian, `null` zostaje `null`. `dane.test.ts`: `pobierzObrazOrbity` przy rzucającym `czytajZadania` → `null`. `sprawdzOdprawe` przyjmuje zagrożenie z `obszar: 'orbita'`.
- [ ] **Step 2:** `npx vitest run lib/asystent lib/orbita app/api/asystent components/deck` → FAIL.
- [ ] **Step 3:** Zaimplementuj.
- [ ] **Step 4:** → PASS (wszystkie istniejące testy asystenta też).
- [ ] **Step 5:** Commit `feat(orbita): etapy na dziś w odprawie i czacie asystenta`.

---

### Task 10: Kafelek w kokpicie, README, sprawdzenie na ekranie

**Files:**
- Modify: `app/page.tsx` (obietnica `orbita` dla `owner`), `components/deck/DeckHub.tsx` (prop `orbita`, kafelek zamiast zablokowanego „etap 2”), `README.md` (sekcja „Orbita”)
- Test: `components/deck/DeckHub.test.tsx`

**Interfaces:**
- Consumes: `czytajZadania`, `obrazOrbity` (Zadania 3, 9).
- Produces: `DeckHub` prop `orbita: Promise<ObrazOrbity | null> | null` (zarząd `null`); `app/page.tsx` składa ją raz z `czytajZadania().then((z) => obrazOrbity(z, dzis))` z `.catch` → `null` i logiem `[asystent] orbita:`; ta sama obietnica idzie do `odswiezOdpraweWTle`. Kafelek `DeckTile` `stan="zywy"`, `href="/orbita"`, `etykieta="moduł 03 · zadania"`, `tytul="Orbita"`, `span={2}`: pierwsza pozycja `dzis` („<zadanie> · <etap>”, „zapas <n> dni” / „spóźnione o <n> dni”, przy `podpowiedz` prefiks „najbliżej:”), linia „czeka: <n>” gdy `czekam` niepuste; odznaka „<n> spóźnione” (`odmiana`, ton `uwaga`) gdy są pozycje z `zapasDni < 0`; pusto: „Nic na dziś. Dodaj zadanie, które czeka na pierwszy krok.”; `null` w środku: „Zadań nie dało się odczytać.” Komentarz o siatce bez zmian (kafelek zachowuje `span={2}`).

- [ ] **Step 1: Write the failing tests**: `owner` z pozycją o zapasie -2 → widać tytuł zadania, „spóźnione o 2 dni” i odznakę; `podpowiedz` → „najbliżej:”; `board` (`orbita: null`) → brak „Orbita”; pusto → tekst pustki; obietnica z `null` → „Zadań nie dało się odczytać.”
- [ ] **Step 2:** `npx vitest run components/deck` → FAIL.
- [ ] **Step 3:** Zaimplementuj; dopisz README (czym jest Orbita, szkielet dokumentu, „Kopiuj do Claude”, „Weź do Orbity”).
- [ ] **Step 4:** `npx vitest run` (całość), `npx tsc --noEmit`, `npm run lint`, `npm run build` → zielone. `graphify update .`.
- [ ] **Step 5:** Commit `feat(orbita): kafelek w kokpicie i opis w README`.
- [ ] **Step 6: Sprawdzenie na ekranie** (po pushu użytkownika, produkcja `https://ssuew-analytics.vercel.app`, konto kontakt@, Claude in Chrome): kokpit - kafelek Orbity bez dziury w siatce; `/orbita` - zadanie ze szkieletu „TEST zarządzenie” z terminem za 20 dni (ostrzeżenie, „Dopasuj”), „Kopiuj do Claude” (sprawdź tekst w schowku przez `navigator.clipboard.readText()` albo okno awaryjne), „Zamknij etap” z wynikiem i wynik we wstępie następnego etapu, Radar i Lista, „Weź do Orbity” z wpisu kalendarza pracy w Dzienniku (testowy wpis `cykl` dodany i potem usunięty), widok 390 px (ramka iframe) bez przewijania w bok. Wszystkie testowe zadania i wpisy usuń po sprawdzeniu; kadencji Dziennika 2026/2027 nie ruszaj.
