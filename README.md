# DECK

Prywatne centrum dowodzenia wspierające Wiceprzewodniczącego ds. Strategii i Działań Operacyjnych
**Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu**.

Kokpit z kafelkami, z którego prowadzi się wszystkie działania. Pierwszym i na razie jedynym
działającym modułem jest **SSUEW Analytics** - dashboard analityczny samorządu.

## Moduły

| Kafelek | Co robi | Stan |
|---|---|---|
| **SSUEW Analytics** | Rekrutacje, retencja kohort, KPI rok-do-roku, lejek, korelacje, prognozy, alerty | działa |
| **Orbita** | Prywatna tablica zadań jako radar: bliżej środka znaczy pilniej | etap 2 |
| **Planer semestru** | Kalendarz semestru, kolizje osób i sal, propozycje zmian od zarządu, tryb wspólnej sesji, rozmowa przy wydarzeniu i podgląd obecności | działa |
| **Strony** | Kliknięcia, wyświetlenia i pozycje nadzorowanych witryn z Search Console | etap 4 |

Analytics liczy statystyki **bez zewnętrznych bibliotek matematycznych** - korelacja Pearsona,
test t Welcha, regresja wieloraka OLS i z-score są zaimplementowane od zera
w [`lib/stats.ts`](lib/stats.ts).

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5** + **Tailwind CSS 4**
- **Recharts** - wykresy
- **Firebase Auth** - logowanie e-mailem i hasłem, weryfikacja tokenu przez `jose`
- **Arkusze Google + Apps Script** - baza danych bez bazy danych

### Dlaczego taki backend

Aplikacja nie ma własnej bazy. Dane analityczne mieszkają w arkuszu Google, prowadzonym i tak
ręcznie, a [Apps Script](apps-script/README.md) wystawia je jako JSON. Trasy `/api/*` w Next.js
istnieją po to, żeby robić dwie rzeczy, których przeglądarka zrobić nie może: chronić token
do skryptu i cache'ować wolne odpowiedzi (Apps Script odpowiada 1-3 s).

### Region funkcji

[`vercel.json`](vercel.json) przypina funkcje serwera do **Frankfurtu (`fra1`)**. Domyślny
Vercel to Waszyngton (`iad1`): każde kliknięcie leciało wtedy przez Atlantyk i z powrotem,
a Planer pytał Firestore (`eur3`, Europa) z USA - zmierzone ~230 ms na samo zapytanie
i ~1 s na obraz Planera. Użytkownicy, Firestore i arkusz są w Europie; serwer też ma być.

## Asystent D.E.C.K. (Gemini)

Odprawa w kokpicie i czat „Zapytaj D.E.C.K.” korzystają z Gemini API na darmowym poziomie.
Widzi je wyłącznie właściciel; zarząd ma w tym miejscu panel faktów bez AI.

| Zmienna | Gdzie | Co |
|---|---|---|
| `GEMINI_API_KEY` | `.env.local` i zmienne Vercela (Production) | klucz z Google AI Studio |
| `GEMINI_MODEL` | opcjonalnie | model albo lista po przecinku, próbowane po kolei; domyślnie `gemini-3.8-flash,gemini-3-flash-preview,gemini-flash-lite-latest` |

- `npm run gemini -- modele` - modele dostępne na kluczu; `npm run gemini -- proba` - jedno zapytanie ze schematem i czas odpowiedzi.
- Odprawa jest w Firestore `asystent/odprawa` (czyta i pisze tylko serwer; reguły klienta jej nie wpuszczają).
  Kokpit pokazuje zapisaną od razu, a nową liczy w tle (`after()`), najwyżej raz na godzinę i tylko po zmianie danych albo dnia.
- Do Google trafia obraz projektu z imionami i nazwiskami osób z Planera - świadoma decyzja z projektu
  `docs/superpowers/specs/2026-10-02-deck-asystent-kokpit-design.md`. W EOG darmowy poziom podlega warunkom przetwarzania jak płatny.

## Strony (Google Search Console)

Panel `/strony` czyta Search Console tym samym kontem serwisowym co Firebase (`FIREBASE_SERVICE_ACCOUNT`) - bez nowych zmiennych. Jednorazowo:

1. Google Cloud, projekt Firebase → APIs & Services → Library → włącz „Google Search Console API”.
2. Search Console każdej strony → Ustawienia → Użytkownicy i uprawnienia → Dodaj użytkownika: `client_email` z konta serwisowego, uprawnienie „Ograniczone”.
3. Strony, których nie ma w Search Console, najpierw tam dodaj i zweryfikuj.

Potem „Dodaj stronę” w panelu. Lista żyje w Firestore `strony/lista` (tylko serwer). Statystyki mają cache 6 h.

## Uruchomienie

```bash
npm install
cp .env.example .env.local   # i uzupełnij - patrz niżej
npm run dev
```

Aplikacja wystartuje na [http://localhost:3000](http://localhost:3000).

Bez skonfigurowanego arkusza Analytics działa na danych historycznych SSUEW zaszytych
w [`lib/useAnalyticsData.ts`](lib/useAnalyticsData.ts) i oznacza to w interfejsie.

### Konfiguracja

**Firebase** - załóż projekt na [console.firebase.google.com](https://console.firebase.google.com),
w *Authentication → Sign-in method* włącz **E-mail/hasło**, a z *Project settings → Your apps*
przepisz `apiKey`, `authDomain` i `projectId` do `.env.local`. Dwa konta zakładasz ręcznie
w *Authentication → Users* - rejestracja własna jest wyłączona.

**Dwie drogi wejścia.** Konto z hasłem mają dwie osoby: `DECK_OWNER_EMAIL` (pełne uprawnienia,
jako jedyny widzi Orbitę) i `DECK_BOARD_EMAILS`. Reszta zarządu wchodzi **kodem** z zakładki
`kody` w arkuszu - kod wiąże się z przeglądarką przy pierwszym użyciu i od tej pory tylko ona
nim wejdzie. Kod zawsze daje rolę `board`; pełne uprawnienia wymagają hasła.

**`DECK_SESSION_SECRET`** podpisuje bilety sesji kodowych. Minimum 32 znaki - bez niego
aplikacja odmawia działania zamiast po cichu wpuszczać kogokolwiek.

**Arkusz** - sześć kroków w [`apps-script/README.md`](apps-script/README.md). Skrypt sam zakłada
zakładki i wgrywa dane historyczne.

**Firestore** (dla Planera) - konsola Firebase → *Firestore Database* → *Create database*
→ tryb **produkcyjny**, lokalizacja **eur3**. Lokalizacji nie da się później zmienić. Reguły
wklej z [`firestore.rules`](firestore.rules). Reguły sprawdzają adres e-mail wprost z tokenu,
więc nie trzeba żadnych własnych oświadczeń ani Admin SDK - ale **te same dwa adresy muszą być
w `firestore.rules` i w zmiennych Vercela**. Zmieniasz w jednym miejscu, zmień i w drugim.

**`FIREBASE_SERVICE_ACCOUNT`** jest **wymagany**. Bez niego zarząd nie zobaczy Planera ani nie
zgłosi żadnej propozycji: osoby wchodzące kodem nie mają konta Firebase, więc reguły Firestore
ich nie wpuszczą i cały ich ruch idzie przez `/api/planer`. Konto właściciela działa bez tego,
bo pisze do Firestore wprost.

## Struktura

```
app/
  page.tsx            kokpit DECK
  analytics/          moduły analityczne (własna powłoka z sidebarem)
  api/                trasy danych i sesji
  login/              logowanie Google
components/
  deck/               kafelki kokpitu
  planer/             kalendarz semestru
  modules/            widoki modułów analitycznych
  ui/                 wspólne komponenty i powłoka
lib/
  stats.ts            ręcznie pisana statystyka
  gas/                klient Apps Script
  auth/               tożsamość, role, strażnik tras
  planer/             daty, kolizje, semestry - czyste funkcje
  firebase/           inicjalizacja Firestore
firestore.rules       reguły bezpieczeństwa bazy (wersjonowane tutaj)
apps-script/
  Kod.gs              backend na Arkuszach (wersjonowany tutaj)
docs/
  superpowers/        projekty i plany wdrożeń
  archiwum/           schemat wycofanej bazy Supabase
```

## Uwaga metodologiczna

Analizy opierają się na niewielkiej liczbie obserwacji (kilka-kilkanaście edycji), dlatego
prognozy i istotności statystyczne należy traktować **orientacyjnie**, jako wsparcie decyzji,
a nie twardy dowód. Wartości p są przybliżane progowo, a modele sygnalizują niskie dopasowanie
w polach `warning`.

## Skrypty

| Komenda | Działanie |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build` | build produkcyjny |
| `npm run start` | uruchomienie buildu |
| `npm run lint` | ESLint |
| `npm test` | vitest |
