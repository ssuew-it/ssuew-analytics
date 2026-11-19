# D.E.C.K. - Orbita: co dziś i od czego zacząć

Data: 2026-11-20 · Stan: projekt do zatwierdzenia · Zastępuje: `2026-08-11-deck-etap2-orbita-design.md`

## 1. Cel i powód

Orbita odpowiada rano na dwa pytania osoby pełniącej funkcję (konto `kontakt@`, rola `owner`):

1. **Co dziś jest priorytetem?**
2. **Jak to ruszyć?** Duże zadanie rozbite na etapy tak, żeby dało się usiąść i od razu pracować.

Powód, słowami użytkownika: przy zadaniach takich jak Zarządzenie Przewodniczącego ws. standaryzacji wprowadzania uchwał strategicznych albo standard Google Workspace Samorządu praca „utyka w momencie, gdy trzeba zrobić pierwszy krok”. Kolejność i tak pomaga ułożyć AI, ale „zebranie się trwa sporo”. Chce, „żeby planowanie było na zapas, a ja siadam i robię”.

Sukces: rano jeden rzut oka mówi, który etap którego zadania trzeba dziś zacząć, żeby zdążyć z terminem. Jedno kliknięcie daje gotowy wstęp do rozmowy z Claude, bez przypominania sobie, gdzie się skończyło.

## 2. Cele, nie-cele, anty-cele

**Cele**
- Zadania z etapami. Każdy etap ma cel, punkt startu, materiały, warunek „gotowe” i orientacyjną długość.
- Szkielet etapów dla dokumentów normatywnych (zarządzenie, standard, uchwała) z wartościami domyślnymi.
- „Dziś” wyliczane wstecz od terminu zadania: etap trafia na dziś, gdy kończy się zapas.
- „Kopiuj do Claude”: wstęp do rozmowy złożony z pól zadania i ustaleń z poprzednich etapów.
- Etapy oczekiwania (konsultacje RUSS i KR) pokazane jako „czekam do…”, poza zaległościami.
- „Weź do Orbity” przy obowiązkach z Dziennika Stratega.
- Kafelek w kokpicie i sekcja `orbita` w odprawie i czacie asystenta.
- Widoki: Dziś (domyślny), Radar, Lista.

**Nie-cele (teraz)**
- Claude wbudowany w D.E.C.K. albo wywoływany przez API: rozmowa odbywa się w claude.ai (decyzja użytkownika, droga A).
- Generowanie etapów lub wstępu przez Gemini: wstęp i szkielet są szablonami.
- Sprawy ze Skrzynki jako zadania: mają własną listę z terminami w Skrzynce.
- Przypomnienia mailem albo push.
- Zadania powtarzalne: obowiązki cykliczne opisuje Dziennik, do Orbity trafiają przez „Weź do Orbity”.
- Dni robocze w liczeniu zapasu, śledzenie czasu pracy.
- Dostęp dla roli `board`.

**Anty-cele** (porażka, nawet jeśli działa)
- Orbita wymaga codziennego porządkowania, żeby „dziś” miało sens - wtedy sama staje się zbieraniem się.
- „Dziś” ma kilkanaście pozycji i znów trzeba wybierać.
- Wstęp do Claude trzeba poprawiać przed wklejeniem albo brakuje w nim ustaleń z poprzednich etapów.
- Czekanie na RUSS i KR wygląda jak zaległość użytkownika.

## 3. Podejścia

**Sposób pracy z AI (wybór użytkownika: A)**

| | Za | Przeciw |
|---|---|---|
| **A. Gotowy wstęp do Claude, kopiowany do claude.ai** (wybrane) | Narzędzie, którego użytkownik już używa; brak kosztów i kluczy | Wynik rozmowy dopisuje się ręcznie jednym polem |
| B. Rozmowa w D.E.C.K. z obecnym asystentem (Gemini) | Kontekst i historia zapisują się same | Gemini, nie Claude; słabszy w tekstach prawnych |
| C. Claude przez API w D.E.C.K. | Najwygodniej | Osobny płatny klucz API, subskrypcja go nie obejmuje |

**Wybór „dziś” (wybór użytkownika: 2)**

| | Za | Przeciw |
|---|---|---|
| 1. Bieżący etap zadania z najbliższym terminem | Proste | Zawodzi przy dużym zadaniu z odległym terminem, które trzeba zacząć teraz |
| **2. Liczenie wstecz od terminu** (wybrane) | To jest „planowanie na zapas” | Jedno pole długości na etap (szkielet daje domyślne) |
| 3. Użytkownik wybiera rano | Pełna kontrola | Wymaga zebrania się, czyli tego, czego ma nie być |

**Budowa (jedna rozsądna droga, zaakceptowana)**: jak Dziennik Stratega - Firestore przez trasy serwera z `tylkoWlasciciel`, czyste funkcje w `lib/orbita/`. Odrzucone: zapis z przeglądarki do `users/{uid}` (sierpniowy spec; drugi model bezpieczeństwa obok reszty D.E.C.K., gdzie `firestore.rules` zamyka wszystko) oraz zadania jako wpisy Dziennika (księga nic nie gubi, a zadania żyją krótko).

## 4. Zadanie i etapy

Zadanie: tytuł, kontekst (kilka zdań: czego dotyczy, co już wiadomo), termin końcowy (dzień) albo brak („kiedyś”), lista etapów.

Etap:

| Pole | Znaczenie |
|---|---|
| `nazwa` | np. „Koncepcja” |
| `rodzaj` | `praca` albo `czekanie` |
| `cel` | co trzeba rozstrzygnąć lub osiągnąć |
| `zacznijOd` | pierwsza czynność, zwykle „rozmowa z Claude, jak to może wyglądać” |
| `materialy` | tekst z linkami (Dysk, PDF, strona) |
| `gotoweGdy` | warunek zamknięcia |
| `dni` | orientacyjna długość w dniach kalendarzowych; przy `czekanie` - czas oczekiwania |
| `czekaNa` | tylko `czekanie`: kto ma odpowiedzieć, np. `['RUSS', 'KR']` |
| `wynik` | dopisywany przy zamknięciu: link do projektu, krótkie ustalenia |

Bieżący etap = pierwszy niezamknięty. Zamknięcie ostatniego etapu zamyka zadanie (trafia do „Zamknięte”, zwinięte, nie znika). Etapy można dodawać, usuwać, przestawiać i poprawiać, także w trakcie.

**Niezmiennik: zamknięte etapy tworzą początek listy.** Serwer odrzuca (400) zapis, który go łamie. Z tego wynika:
- zamknąć można tylko etap bieżący;
- otworzyć ponownie można tylko ostatni zamknięty - staje się bieżący; jeśli zadanie było zamknięte, `zamkniete` wraca na `null`, a `czekamDo` następnego etapu oczekiwania jest czyszczone (przy ponownym zamknięciu liczy się od nowa, od dnia tego zamknięcia);
- przestawiać można tylko etapy otwarte, między sobą; nowy etap trafia za zamknięte;
- zamkniętych etapów nie da się usunąć; usunięcie ostatniego otwartego etapu jest dozwolone tylko wtedy, gdy zostaje co najmniej jeden etap - zadanie się wtedy zamyka;
- pola zamkniętego etapu są tylko do odczytu, poza `wynik`.

**Szkielet „Dokument normatywny”** (przy tworzeniu zadania; wszystkie pola do zmiany):

| # | Nazwa | Rodzaj | Dni | Cel / zacznij od / gotowe gdy |
|---|---|---|---|---|
| 1 | Koncepcja | praca | 3 | Podstawa wprowadzenia, tryb i charakter dokumentu / Rozmowa z Claude, jak to może wyglądać / Koncepcja ustalona |
| 2 | Projekt | praca | 7 | Pełny tekst projektu / Rozmowa z Claude na podstawie ustaleń koncepcji / Projekt skompletowany i sprawdzony przez Claude |
| 3 | Konsultacje | czekanie | 14 | Uwagi RUSS i KR (`czekaNa: ['RUSS', 'KR']`) / Wysłanie projektu do RUSS i KR / Uwagi otrzymane albo minął termin |
| 4 | Poprawki | praca | 3 | Uwagi z konsultacji wprowadzone / Rozmowa z Claude z uwagami / Wersja ostateczna gotowa |
| 5 | Przyjęcie | praca | 7 | Podpis albo głosowanie i publikacja / Przekazanie do podpisu lub na posiedzenie / Dokument przyjęty i opublikowany |

Drugi wybór przy tworzeniu: **„Własne etapy”** - jeden pusty etap `praca`, resztę wpisuje użytkownik (np. Workspace: maile, mailingi, standard).

## 5. Zapas i „dziś”

Dni kalendarzowe, „dziś” = `dzisWarszawa` (`lib/czas.ts`), typ `Data` i `przesunDate`, `dniMiedzy` z `lib/planer/trwanie.ts`.

Dla zadania z terminem `T` i bieżącym etapem `k`:
- **ostatni bezpieczny start** etapu `k` = `T` minus suma `dni` etapów od `k` do ostatniego;
- **zapas** = liczba dni od dziś do ostatniego bezpiecznego startu (ujemny = spóźnienie).

Zadanie bez terminu nie ma zapasu - trafia do „Kiedyś”.

**Etapy dłuższe niż czas do terminu** (decyzja użytkownika). Przy zapisie zadania, gdy zapas wychodzi ujemny już w chwili zapisu, formularz pokazuje „Etapy trwają <n> dni, do terminu zostało <m>” i przycisk **Dopasuj**: proporcjonalnie skraca `dni` otwartych etapów `praca` (zaokrąglenie w dół, każdy co najmniej 1 dzień), etapów `czekanie` nie rusza. Jeśli po dopasowaniu nadal się nie mieści, mówi to wprost („Nawet po skróceniu brakuje <k> dni - przesuń termin albo skróć konsultacje”). Zapis bez dopasowania jest dozwolony - zadanie trafia wtedy do „Dziś” jako spóźnione.

Gdy bieżący jest etap oczekiwania z ustalonym `czekamDo`, zapas liczy się od jego końca: zapas = (`T` minus suma `dni` etapów po nim) minus `czekamDo`. Przedłużenie `czekamDo` od razu zmniejsza zapas; `dni` służy tylko do wyliczenia domyślnego `czekamDo`.

**Etap oczekiwania.** Gdy zamknie się etap przed nim, `czekamDo` = dzień zamknięcia + `dni` (zapisywane przy zamknięciu poprzedniego etapu, edytowalne). Do `czekamDo` włącznie etap jest w sekcji „Czekam” i nie trafia do „Dziś”. Po tej dacie wraca do „Dziś” z dopiskiem „Termin konsultacji minął - zamknij etap albo przedłuż”. Jeśli etap oczekiwania jest bieżący, a poprzedni zamknięto przed wprowadzeniem tej reguły (brak `czekamDo`), liczy się `czekamDo` od dziś.

**Sekcje widoku Dziś**, w tej kolejności:
1. **Dziś** - bieżące etapy `praca` z zapasem ≤ 0 oraz etapy oczekiwania po `czekamDo`, posortowane od najbardziej spóźnionych. Gdy takich nie ma: jeden etap z najmniejszym zapasem z dopiskiem „Nic nie musi ruszyć dziś - najbliżej:”. Więcej niż 3 pozycje: pierwsze 3 widoczne, reszta pod „i jeszcze n”.
2. **Czekam** - etapy oczekiwania przed `czekamDo`: „<etap> (<czekaNa>) do <data>”.
3. **Najbliżej** - pozostałe zadania z terminem, po zapasie rosnąco.
4. **Kiedyś** - bez terminu, zwinięte.
5. **Zamknięte (n)** - zwinięte.

Karta etapu na „Dziś”: tytuł zadania, „etap k/n <nazwa>”, zapas („zapas 0 dni”, „spóźnione o 2 dni”), cel, przyciski **Kopiuj do Claude** i **Zamknij etap**.

```
ORBITA · czwartek 20 listopada
DZIŚ
 ● Zarządzenie ws. uchwał strategicznych · etap 1/5 Koncepcja   zapas 0 dni
   Cel: podstawa wprowadzania, tryb i charakter dokumentu
   [Kopiuj do Claude]  [Zamknij etap]
CZEKAM
 ◌ Standard Workspace · Konsultacje (RUSS, KR) do 28.11
NAJBLIŻEJ
   Sprawozdanie dla KR (z Dziennika) · Projekt   zapas 4 dni
[+ Zadanie]                                    Widok: Dziś | Radar | Lista
```

**Zamknij etap**: okno z polem „Wynik” (link, ustalenia, do 2000 znaków, może być puste) i przyciskiem „Zamknij”. Wynik trafia do wstępu kolejnych etapów.

## 6. Wstęp do Claude

Szablon tekstowy (bez AI), składany z pól, kopiowany do schowka jednym kliknięciem. Treść:

```
Pracuję nad: <tytuł zadania>
Termin: <DD.MM.RRRR albo „bez terminu”>
Kontekst: <kontekst>

Teraz etap <k> z <n>: <nazwa>
Cel etapu: <cel>
Zacznij od: <zacznijOd>
Gotowe, gdy: <gotoweGdy>
Materiały: <materiały albo „brak”>

Ustalenia z poprzednich etapów:
- <nazwa etapu>: <wynik>          (tylko etapy zamknięte z niepustym wynikiem; brak = „brak”)

Pozostałe etapy: <nazwy kolejnych etapów, po przecinku>

Pomóż mi przejść ten etap. Zacznij od pytań, jeśli czegoś brakuje.
```

Bez długich myślników. Po skopiowaniu krótkie potwierdzenie „Skopiowano - wklej w Claude”. Gdy schowek jest niedostępny: okno z zaznaczonym tekstem do skopiowania ręcznie.

## 7. Dane

Firestore wyłącznie przez Admin SDK z tras `app/api/orbita/**` chronionych `tylkoWlasciciel` (wzór: `app/api/dziennik/**`). `firestore.rules` bez zmian - reguła końcowa zamyka nową kolekcję.

**`orbitaZadania/{id}`**
```ts
{
  tytul: string              // 1-120
  kontekst: string           // do 4000
  termin: string | null      // "RRRR-MM-DD" (naIso/zIso); null = kiedyś
  zrodlo: { typ: 'dziennik'; wpisId: string; termin: string } | null
  etapy: {
    id: string
    nazwa: string            // 1-60
    rodzaj: 'praca' | 'czekanie'
    cel: string              // do 500
    zacznijOd: string        // do 500
    materialy: string        // do 2000
    gotoweGdy: string        // do 500
    dni: number              // 0-90
    czekaNa: string[]        // tylko czekanie; każdy do 40, najwyżej 10
    czekamDo: string | null  // "RRRR-MM-DD", tylko czekanie
    zamkniety: number | null // ms
    wynik: string            // do 2000
  }[]                        // 1-15 etapów
  utworzono: number
  zmieniono: number
  zamkniete: number | null   // ms; ustawiane, gdy wszystkie etapy zamknięte
}
```

Zadanie można usunąć (z potwierdzeniem) - to nie księga. Edycja zadania i etapów zapisuje cały dokument z kontrolą `zmieniono`: zapis z nieaktualnym `zmieniono` dostaje 409 „Zadanie zmieniło się w innej karcie - odśwież”. **Zamknięcie i ponowne otwarcie etapu** mają osobną trasę (transakcja na jednym zadaniu, bez `zmieniono`): zamknięcie wymaga, by wskazany etap był bieżący, otwarcie - by był ostatnim zamkniętym; inaczej 409 z tym samym komunikatem.

## 8. Dziennik Stratega → Orbita

W Dzienniku, przy pozycjach „Najbliższe” i wpisach kalendarza pracy (tylko dział `cykl` - inne działy nie mają terminu i nie dostają przycisku), przycisk **„Weź do Orbity”**. Otwiera w Orbicie formularz nowego zadania wypełniony z wpisu: tytuł, kontekst = treść wpisu, termin = `najblizszyTermin(wpis, dzis)`, `zrodlo = { typ: 'dziennik', wpisId, termin }`, szkielet do wyboru (domyślnie „Własne etapy”).

Gdy **otwarte** zadanie ma już to samo `zrodlo` (ten sam wpis i termin), w Dzienniku zamiast przycisku jest „w Orbicie” z linkiem; zamknięte zadania się nie liczą. Dziennik pobiera tę listę osobnym lekkim GET (np. `/api/orbita/zrodla` → `{ wpisId, termin, zadanieId }[]` otwartych zadań); błąd tego odczytu = przyciski „Weź do Orbity” bez oznaczeń, Dziennik działa dalej. Po upływie terminu rocznego nic nie proponuje zadania „na przyszły rok” - następne wystąpienie wpisu ma inny termin, więc przycisk wraca sam. Zadania z Dziennika mają w Orbicie dopisek „(z Dziennika)”. Dziennik niczego w Orbicie nie zmienia i odwrotnie - usunięcie wpisu w Dzienniku zostawia zadanie bez zmian.

## 9. Radar i Lista

**Radar** (drugi widok). Punkt = bieżący etap zadania. Odległość od środka koduje zapas:

| Stan | Promień | Wygląd |
|---|---|---|
| spóźnione (zapas < 0) | 0,10 | pulsuje, kolor alarmu |
| zapas 0 | 0,20 | akcent |
| 1-3 dni | 0,40 | pełna jasność |
| 4-14 dni | 0,62 | przygaszone |
| więcej | 0,82 | przygaszone |
| kiedyś | 0,95 | ledwo widoczne |
| czekam | wg zapasu całego planu | pusty okrąg |

Zamknięte zadania nie są na radarze. Kąt stały dla zadania, z jego identyfikatora (jak kolory osób w Planerze). Kliknięcie punktu pokazuje kartę etapu. Poniżej 640 px zamiast radaru jest Lista.

**Lista**: wszystkie otwarte zadania po zapasie (bez terminu na końcu), rozwijane do etapów; edycja zadania i etapów stąd.

## 10. Kokpit i asystent

- **Kafelek „Orbita”** (tylko `owner`, zastępuje zablokowany kafelek „etap 2” w `components/deck/DeckHub.tsx`): pierwsza pozycja z „Dziś” (tytuł zadania, etap, zapas), liczba „czekam”; odznaka z liczbą spóźnionych (ton `uwaga`) - spóźnione = pozycje „Dziś” z zapasem < 0, w tym etapy oczekiwania po `czekamDo` (ich zapas liczy wzór z sekcji 5, więc zawsze jest liczbą). Pusto: „Nic na dziś. Dodaj zadanie, które czeka na pierwszy krok.” Błąd odczytu: „Zadań nie dało się odczytać.”
- **Obraz projektu dla asystenta**: sekcja `orbita` = `{ dzis: { zadanie, etap, zapasDni, termin }[], czekam: { zadanie, etap, czekaNa, do }[] }`. Bez kontekstu, materiałów i wyników. Błąd = `null` z logiem `[asystent] orbita:` (wzór `dziennik`). Nowy obszar odprawy `orbita` z odnośnikiem `/orbita`; zdanie o sekcji w instrukcjach odprawy i czatu.

## 11. Ograniczenia

- Tylko `owner`; strona `/orbita` przekierowuje `board` na `/`, brak sesji na `/login`.
- Vercel Hobby; jedna kolekcja, odczyt całości jednym GET (zadań będą dziesiątki).
- Interfejs po polsku z ogonkami, tylko łącznik „-”. Telefon 390 px bez przewijania w bok; wygląd modułów D.E.C.K. (`deck-shell`, `deck-chip`).
- Zadania należą do funkcji, nie osoby: konto `kontakt@` przechodzi na następcę razem z nimi.

## 12. Decyzje użytkownika

| Temat | Decyzja |
|---|---|
| Po co | Co dziś jest priorytetem i jak to rozbić, żeby było wykonalne; planowanie na zapas |
| Etapy | Duże, wokół cyklu dokumentu (koncepcja z Claude, projekt sprawdzony przez Claude, konsultacje RUSS i KR), nie drobne kroki |
| AI | Gotowy wstęp kopiowany do Claude (A) |
| „Dziś” | Liczenie wstecz od terminu (2) |
| Ekran | Szkic z sekcji 5 zaakceptowany („chyba jest okej”), radar jako drugi widok |
| Etapy dłuższe niż czas do terminu | Ostrzeżenie i przycisk „Dopasuj” (skraca pracę, konsultacje zostawia) |
| Budowa | Jak Dziennik: Firestore przez serwer |

## 13. Decyzje projektanta (do sprawdzenia przy czytaniu)

- Wstęp i szkielet to szablony, bez AI.
- Domyślne długości etapów dokumentu: 3 / 7 / 14 (czekanie) / 3 / 7 dni.
- Dni kalendarzowe, nie robocze.
- Sprawy Skrzynki zostają w Skrzynce; Dziennik wchodzi tylko przez „Weź do Orbity”, nie automatycznie.
- Gdy nic nie musi ruszyć dziś - jeden etap z najmniejszym zapasem jako podpowiedź.
- Najwyżej 3 pozycje „Dziś” widoczne od razu.
- Zadanie można usunąć; zamknięte zostają zwinięte.
- Radar koduje zapas, nie termin.
- Zamknięte etapy zawsze tworzą początek listy (zamyka się tylko bieżący, otwiera tylko ostatni zamknięty); serwer tego pilnuje.
- Zamknięcie i otwarcie etapu mają osobną trasę bez kontroli `zmieniono`, żeby szybka akcja nie dawała 409.
- Przy bieżącym etapie oczekiwania zapas liczy się od `czekamDo`, więc przedłużenie konsultacji od razu zjada zapas.
- „Weź do Orbity” tylko przy wpisach `cykl`; „w Orbicie” liczy wyłącznie otwarte zadania; brak propozycji „na przyszły rok”.
- Odznaka spóźnionych liczy też konsultacje po terminie.

## 14. Zostawione wykonawcy

- Dokładne progi promienia radaru i wygląd kart w stylu D.E.C.K.
- Układ formularza zadania i edycji etapów (przestawianie: strzałki wystarczą).
- Fallback schowka.
- Kolejność tras API i podział komponentów.
