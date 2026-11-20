# DECK

Prywatne centrum dowodzenia wspierające Wiceprzewodniczącego ds. Strategii i Działań Operacyjnych
**Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu**.

Kokpit z kafelkami, z którego prowadzi się wszystkie działania. Pierwszym i na razie jedynym
działającym modułem jest **SSUEW Analytics** - dashboard analityczny samorządu.

## Moduły

| Kafelek | Co robi | Stan |
|---|---|---|
| **SSUEW Analytics** | Rekrutacje, retencja kohort, KPI rok-do-roku, lejek, korelacje, prognozy, alerty | działa |
| **Orbita** | Co dziś jest priorytetem i od czego zacząć: zadania z etapami, „dziś” liczone wstecz od terminu, gotowy wstęp do rozmowy z Claude | działa |
| **Planer semestru** | Kalendarz semestru, kolizje osób i sal, propozycje zmian od zarządu, tryb wspólnej sesji, rozmowa przy wydarzeniu i podgląd obecności | działa |
| **Strony** | Kliknięcia, wyświetlenia i pozycje nadzorowanych witryn z Search Console | etap 4 |
| **Dziennik Stratega** | Księga przechodnia funkcji: kalendarz obowiązków, luki, wątki w toku, pole do innowacji, strategie, przemyślenia - dopisywana przez kolejne kadencje | działa |

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

Panel `/strony` czyta Search Console kontem serwisowym z `SEARCH_CONSOLE_SERVICE_ACCOUNT` (plik JSON klucza; obecnie konto `deck-strony` w projekcie `deck-samorzad` organizacji samorzad.ue.wroc.pl). Bez tej zmiennej używa `FIREBASE_SERVICE_ACCOUNT`. Osobny projekt, bo projekt Firebase żyje na innym koncie Google. Jednorazowo:

1. Google Cloud, projekt konta serwisowego → APIs & Services → Library → włącz „Google Search Console API”.
2. Search Console każdej strony → Ustawienia → Użytkownicy i uprawnienia → Dodaj użytkownika: `client_email` z konta serwisowego, uprawnienie „Ograniczone”.
3. Strony, których nie ma w Search Console, najpierw tam dodaj i zweryfikuj.

Potem „Dodaj stronę” w panelu. Lista żyje w Firestore `strony/lista` (tylko serwer). Statystyki mają cache 6 h.

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

Panel `/skrzynka`: zakładki statusów z liczbami, wyszukiwarka (składnia Gmaila, wyniki tylko z zaimportowanych 12 miesięcy), lista spraw i wątek z treścią pobieraną z Gmaila na żywo. HTML maila wyświetla się w ramce bez skryptów i bez zewnętrznych obrazków; załączniki zawsze się pobierają. Ze sprawy: zmiana statusu, przypisanie osoby ze Składu zarządu (Planer → Skład), „Pomiń” i „Pomiń zawsze” (adres; domena tylko dla organizacji). Lista czyta pole `klucz` (`status|czas|id`) - bez indeksu złożonego w Firestore.

Odpowiedź z widoku sprawy idzie z kontakt@ jako „Samorząd Studentów UEW” w tym samym wątku - do Reply-To albo nadawcy ostatniej ich wiadomości (okno pokazuje adresata) - ze stopką z Ustawień; załączniki łącznie do 4 MB (limit żądania funkcji Vercela to 4,5 MB). Zgoda Google bez uprawnienia do wysyłki jest odrzucana przy połączeniu. Zakładki Kontakty i Organizacje: karta osoby albo organizacji z jej sprawami; nazwę i typ organizacji zmienia się na karcie, synchronizacja tego nie nadpisuje. Ustawienia: stopka, listy „zawsze pomijaj” (domeny skrzynek prywatnych i studentów odrzucane) i „Rozłącz” - odwołuje dostęp w Google, opcjonalnie usuwa sprawy, kontakty i organizacje (koniec kadencji). Po „Rozłącz” bez usuwania ponowne połączenie robi import od nowa.

Asystent: odprawa i czat widzą skrzynkę - liczby spraw, sprawy po terminie (temat, organizacja, dni czekania) i organizacje z ruchem w 7 dni. Bez treści maili i pól z adresami; tematy idą tak, jak są w Gmailu. Bez połączenia albo przy błędzie odczytu sekcji skrzynki nie ma. Odprawa ma obszar „Skrzynka” z odnośnikiem do `/skrzynka`. W widoku sprawy „Streść” i „Szkic odpowiedzi” wysyłają do Gemini temat, notatki i treść jednego wątku (bez cytowanych linii „>” z wersji tekstowej, do 20 000 znaków od końca) - dopiero po kliknięciu, bez zapisu. Szkic tylko wpisuje się do okna odpowiedzi; miejsca „[do uzupełnienia]” (także pisane wielkimi literami, bez ogonków albo z podpowiedzią po dwukropku) blokują wysyłkę.

## Planer → Kalendarz Samorządowicza

Przycisk **Wyślij do Kalendarza Samorządowicza** w Planerze (tylko właściciel) przenosi wydarzenia bieżącego semestru z kategorii Komisje, SSUEW, Projekty i Wydarzenia UE do głównego kalendarza kontakt@ (udostępnionego Działaczom jako Kalendarz Samorządowicza). Zebrania, Aplikacje i Inne nigdy tam nie trafiają. Wysyłka dotyczy jednego miesiąca semestru, wybieranego w oknie (domyślnie następny). Najpierw podsumowanie (przejmę / dodam / zmienię / usunę) z polem wyboru przy każdej pozycji; odznaczone są pomijane tylko w tej wysyłce. Zapis dopiero po „Wyślij zaznaczone”, a serwer wykonuje tylko pozycje zaznaczone i nadal aktualne; Google nikogo nie powiadamia (`sendUpdates=none`), bez uczestników i bez osób z Planera.

Wydarzenia D.E.C.K. mają znacznik w `extendedProperties.private` (`deck`, `deckId`, `deckSemestr`) - tylko je D.E.C.K. zmienia i usuwa. Ręczny wpis z tym samym tytułem (bez wielkości liter) i dniem startu D.E.C.K. **przejmuje** (dostaje znacznik) zamiast dublować; gdy pasuje więcej niż jeden ręczny wpis, wydarzenie ląduje w „Do sprawdzenia ręcznie” i nic nie jest dodawane. Godzina nieustalona = wydarzenie całodniowe z dopiskiem „(godzina do ustalenia)”. Ponowne kliknięcie po częściowej porażce dosyła tylko brakujące.

Jednorazowo:

1. `deck-samorzad` → APIs & Services → Library: włącz **Google Calendar API**.
2. OAuth consent screen: dodaj zakres `calendar.events` (sam kalendarz i jego udostępnienie zostają nietknięte).
3. D.E.C.K. jako kontakt@ → Skrzynka → Ustawienia → **Połącz kalendarz**. Ten sam adres powrotu co skrzynka; zgoda dokłada kalendarz do zgody Gmaila (`include_granted_scopes`), skrzynka nie łączy się od nowa. Zgoda bez uprawnień Gmaila jest odrzucana, żeby skrzynka nie straciła dostępu.

## Dziennik Stratega

Strona `/dziennik` (tylko właściciel, czyli konto kontakt@) to księga, którą każda kolejna osoba na funkcji przejmuje i dopisuje. Działy: **Najbliższe** (kalendarz pracy w oknie 30 dni), **Kalendarz pracy** (obowiązki z terminem rocznym, kto z nich rozlicza, ile tygodni wcześniej zacząć), **Luki**, **Wątki w toku**, **Pole do innowacji**, **Strategie** (dokument, okres, status, uchwała, cele) i **Przemyślenia**.

- Konto jest wspólne, więc autor przedstawia się przy **Rozpocznij kadencję**. Wpisy otwartej kadencji można poprawiać i usuwać; wpisy kadencji zamkniętych tylko komentować (stan: aktualne / przejmuję / zamknięte / nieaktualne, przy strategii stan każdego celu). Nic nie znika - zamknięte lądują zwinięte.
- **Przekaż księgę** zapisuje kopię na Dysku i dopiero wtedy zamyka kadencję (bez udanej kopii nic się nie zamyka; nie da się tego cofnąć). **Zapisz kopię** działa w każdej chwili; gdy Dysku nie ma, **Pobierz plik** daje tę samą księgę jako HTML.
- Dane: `dziennikKadencje`, `dziennikWpisy`, wskaźnik `dziennik/stan` - tylko przez Admin SDK; otwarcie i zamknięcie kadencji to transakcja, więc otwarta jest najwyżej jedna. Asystent dostaje wyłącznie terminy kalendarza pracy z 30 dni (bez treści wpisów).

Jednorazowo, dla kopii na Dysku:

1. `deck-samorzad` → APIs & Services → Library: włącz **Google Drive API**.
2. OAuth consent screen: dodaj zakres `drive.file` (D.E.C.K. widzi tylko pliki, które sam utworzył).
3. D.E.C.K. jako kontakt@ → Skrzynka → Ustawienia → **Połącz Dysk**. Jak przy kalendarzu: ten sam adres powrotu, zgoda dokładana do zgody Gmaila (`include_granted_scopes`), zgoda bez uprawnień Gmaila odrzucana. Po zgodzie wracasz do Dziennika.

## Orbita

Strona `/orbita` (tylko właściciel, konto kontakt@) odpowiada rano na dwa pytania: co dziś jest priorytetem i od czego zacząć. Zadanie ma termin (albo „kiedyś”) i etapy; każdy etap ma cel, punkt startu („zacznij od”), materiały, warunek „gotowe”, długość w dniach i rodzaj: praca albo czekanie na innych (np. konsultacje RUSS i KR).

- **Dziś** liczy się wstecz od terminu: zapas = dni do ostatniego bezpiecznego startu bieżącego etapu. Na „dziś” trafia to, czemu zapas się skończył (najwyżej 3 widoczne); gdy nic się nie pali - najbliższy etap jako podpowiedź. Konsultacje w toku są w „Czekam”, nie w zaległościach.
- **Dokument normatywny** daje gotowy szkielet: Koncepcja 3 dni, Projekt 7, Konsultacje 14 (czekanie), Poprawki 3, Przyjęcie 7. Gdy etapy nie mieszczą się przed terminem, formularz ostrzega, a **Dopasuj** skraca pracę, nie ruszając konsultacji.
- **Kopiuj do Claude** składa z pól zadania wstęp do rozmowy w claude.ai (cel, kontekst, ustalenia z poprzednich etapów, materiały, warunek „gotowe”). **Zamknij etap** zapisuje wynik (link, ustalenia), który trafia do wstępu następnych etapów.
- Widoki: Dziś, Radar (odległość od środka = zapas; na telefonie lista), Lista (edycja, ponowne otwarcie ostatniego zamkniętego etapu, usuwanie).
- Z Dziennika: przy obowiązkach kalendarza pracy **Weź do Orbity** tworzy zadanie z najbliższym terminem; gdy jest już otwarte zadanie na to wystąpienie - „w Orbicie”.
- Dane: kolekcja `orbitaZadania` (etapy w dokumencie) tylko przez Admin SDK. Zamknięte etapy zawsze stoją na początku listy - pilnuje tego serwer. Asystent dostaje etapy na dziś i czekające (bez kontekstu, materiałów i wyników).

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
