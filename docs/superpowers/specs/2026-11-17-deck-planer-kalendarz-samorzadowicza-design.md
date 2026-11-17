# D.E.C.K. - Planer: wysyłka do Kalendarza Samorządowicza

Data: 2026-11-17. Status: do akceptacji użytkownika.

## Po co

Właściciel prowadzi dla działaczy kalendarz Google „Kalendarz Samorządowicza”. Po każdej Sesji Operacyjnej przepisuje do niego wydarzenia z Planera ręcznie, jedno po drugim - to męczące i podatne na pomyłki. Cel: jednym przyciskiem w Planerze przenieść gotowy plan do tego kalendarza, a przy kolejnych zmianach w Planerze - zaktualizować to, co już tam jest.

## Cele

- Przycisk w Planerze „Wyślij do Kalendarza Samorządowicza” (tylko właściciel).
- Przed zapisem podsumowanie zmian: ile wydarzeń D.E.C.K. doda, zmieni, usunie - z listą tytułów i dat. Zapis dopiero po zatwierdzeniu.
- Do kalendarza trafiają wydarzenia z kategorii: **Komisje, SSUEW, Projekty, Wydarzenia UE** (w kodzie: `KOMISJE`, `SSUEW`, `PROJEKTY`, `UE`). Zebrania, Aplikacje i Inne zostają tylko w Planerze.
- Ponowne wysłanie aktualizuje: wydarzenie zmienione w Planerze zmienia się w kalendarzu, usunięte z Planera (albo przeniesione do kategorii spoza listy) znika z kalendarza.

## Poza zakresem

- Wysyłka automatyczna przy każdej zmianie w Planerze - świadomie nie: w trakcie sesji wydarzenia przesuwają się wiele razy, działacze mają widzieć dopiero gotowy plan (decyzja użytkownika).
- Odczyt z kalendarza do Planera (zmiany zrobione ręcznie w kalendarzu nie wracają do Planera).
- Plik `.ics` i link do subskrypcji (warianty A i C - zob. „Podejścia”).
- Wysyłka przez rolę zarządu.

## Anty-cele (porażka mimo działania)

- D.E.C.K. zmienia albo usuwa wydarzenie, które właściciel dodał do Kalendarza Samorządowicza ręcznie.
- Działacze widzą wewnętrzne informacje Zarządu: listę osób przypisanych do wydarzenia, wydarzenia z kategorii Zebrania/Aplikacje/Inne.
- Ponowne wysłanie tworzy duplikaty.
- Dołożenie uprawnień do kalendarza psuje albo resetuje skrzynkę kontakt@ (np. wymusza ponowny import 665 spraw albo gubi statusy).

## Ograniczenia

- „Kalendarz Samorządowicza” to **główny kalendarz konta kontakt@samorzad.ue.wroc.pl** (link użytkownika `calendar.google.com/calendar/u/0?cid=…`, `cid` = base64 adresu kontakt@), udostępniony działaczom. Identyfikator kalendarza: `primary` konta kontakt@. To samo konto, którym D.E.C.K. obsługuje skrzynkę (`lib/skrzynka/google.ts`, OAuth z zakresami Gmaila, token odświeżania zaszyfrowany w Firestore) - prawo zapisu jest z definicji.
- **Kalendarza nie zmieniamy i nie tworzymy nowego** (wymóg użytkownika): bez zmiany nazwy, udostępnień, ustawień; D.E.C.K. tylko dodaje/zmienia/usuwa swoje wydarzenia i przejmuje pasujące ręczne. Główny kalendarz kontakt@ może zawierać też inne wpisy (np. zaproszenia na spotkania) - te podlegają zasadzie „bez znacznika nietknięte”, a przejmowanie wymaga zgodności tytułu i daty z wydarzeniem Planera.
- Dziś połączenie ma tylko zakresy `gmail.readonly` i `gmail.send` - kalendarz wymaga nowych zakresów, czyli jednorazowo nowej zgody Google na koncie kontakt@.
- Strefa czasowa: Europe/Warsaw.
- Projekt Google Cloud `deck-samorzad` - trzeba w nim włączyć Google Calendar API (krok ręczny po stronie użytkownika, jak przy Gmail API).
- Vercel Hobby: trasa ma 60 s; semestr to dziesiątki wydarzeń - mieści się, ale zapis ma iść partiami albo równolegle z limitem, nie po jednym w 60 s.

## Podejścia

| | Na czym polega | Za | Przeciw |
|---|---|---|---|
| **A. Plik `.ics` do importu** | Planer generuje plik, właściciel importuje go w Google Kalendarzu | Działa z każdym kalendarzem, bez nowych uprawnień | Każda zmiana = ponowny import, ryzyko duplikatów, wciąż ręczna czynność |
| **B. D.E.C.K. zapisuje przez Google Calendar API** (wybrane) | Przycisk porównuje Planer z kalendarzem i dodaje/zmienia/usuwa wydarzenia | Jedno kliknięcie, aktualizacje bez duplikatów, ręczne wpisy nietknięte | Nowa zgoda Google na kontakt@, włączenie Calendar API |
| **C. Link do subskrypcji** | Działacze subskrybują kalendarz generowany przez D.E.C.K. | Zero kliknięć po stronie właściciela | Google odświeża subskrypcje co kilka-kilkanaście godzin; działacze musieliby zmienić kalendarz, który znają |

Użytkownik wybrał **B**; aktualizacja na przycisk z podsumowaniem (nie automatycznie).

## Jak wygląda wydarzenie w kalendarzu (ustalone)

- **Tytuł** jak w Planerze.
- **Termin**:
  - godzina od-do → wydarzenie z godzinami; koniec po północy (`18:00-04:00 (+1)`, `przezPolnoc` w `lib/planer/opis.ts`) → koniec następnego dnia;
  - sama godzina startu (bez `godzinaDo`) → *decyzja budującego, zob. niżej*;
  - „cały dzień” (`calyDzien`) → wydarzenie całodniowe;
  - wielodniowe (`dni > 1`) → obejmuje wszystkie dni;
  - godzina jeszcze nieustalona (`godzina: null`, nie „cały dzień”) → wydarzenie całodniowe z dopiskiem w tytule „(godzina do ustalenia)”.
- **Miejsce**: tak jak Planer je opisuje (`opisMiejsca` w `lib/planer/opis.ts`: „B/L 110L”, miejsca specjalne, nazwa miejsca spoza uczelni).
- **Bez listy osób** - to wewnętrzne przydziały Zarządu.
- Wydarzenie oznaczone ukrytym znacznikiem D.E.C.K. (Google: `extendedProperties.private`) z identyfikatorem wydarzenia Planera i semestru - po nim D.E.C.K. rozpoznaje „swoje” wydarzenia.

## Zasady zapisu (ustalone)

- D.E.C.K. dotyka **wyłącznie** wydarzeń ze swoim znacznikiem. Wydarzenia bez znacznika (ręczne) nigdy nie są zmieniane ani usuwane.
- Porównanie obejmuje bieżący semestr Planera: wydarzenia z czterech kategorii ↔ wydarzenia ze znacznikiem D.E.C.K. i tym samym semestrem w kalendarzu.
  - jest w Planerze, nie ma w kalendarzu → **dodaj**;
  - jest w obu, różni się tytuł/termin/miejsce → **zmień**;
  - jest w kalendarzu ze znacznikiem, nie ma w Planerze (usunięte albo kategoria spoza listy) → **usuń**;
  - bez różnic → pomiń (nie wysyłamy zbędnych zapisów).
- **Przejmowanie ręcznych wpisów (decyzja użytkownika).** Wydarzenie z Planera, które nie ma jeszcze swojego odpowiednika ze znacznikiem, najpierw szuka w kalendarzu wpisu **bez znacznika** z tym samym tytułem (bez rozróżniania wielkości liter i spacji na brzegach, bez dopisku „(godzina do ustalenia)”) i tą samą datą startu. Dokładnie jeden taki wpis → **przejmij**: dołóż znacznik i popraw tytuł/termin/miejsce według Planera (nie twórz nowego). Dwa i więcej → nie przejmuj żadnego, nie dodawaj nowego, pokaż w podsumowaniu jako „do sprawdzenia ręcznie” (inaczej powstałby duplikat albo przejęty zostałby zły wpis). Jeden ręczny wpis może być przejęty tylko przez jedno wydarzenie Planera. Ręczne wpisy bez pary w Planerze zostają nietknięte. Podsumowanie pokazuje przejęcia osobno: „przejmę 20”. Działa przy każdej wysyłce, nie tylko pierwszej - wpis dodany ręcznie później też zostanie przejęty, jeśli pasuje.
- Ręczna zmiana wydarzenia D.E.C.K. w kalendarzu (np. poprawiona sala) zostanie nadpisana przy najbliższym wysłaniu, jeśli różni się od Planera - Planer jest źródłem prawdy dla wydarzeń ze znacznikiem. Podsumowanie pokaże to jako „zmień”.

## Przepływ dla właściciela

1. Jednorazowo: Ustawienia skrzynki → „Połącz kalendarz” (nowa zgoda Google na kontakt@ z zakresem kalendarza). Kalendarz docelowy jest stały - główny kalendarz kontakt@; nie ma wyboru z listy.
2. W Planerze przycisk „Wyślij do Kalendarza Samorządowicza” (obok „Eksport do CRA” i „Pobierz miesiąc”).
3. Okno podsumowania: „Przejmę 20 · dodam 12 · zmienię 3 · usunę 1” (+ „do sprawdzenia ręcznie”, gdy są), pod spodem lista (tytuł, data, co się zmieni). Przyciski „Wyślij” i „Anuluj”. Przy braku zmian: „Kalendarz jest aktualny”.
4. Po wysłaniu: wynik („Wysłano: 16 zmian”) albo lista tych, które się nie udały, z powodem. Ponowne kliknięcie dosyła resztę (porównanie liczy się od nowa).

```
┌ Wyślij do Kalendarza Samorządowicza ─────────────┐
│ Dodam 12 · zmienię 3 · usunę 1                   │
│ + 21.11  Komisja Dydaktyczna 18:00-20:00  B/L 110│
│ ~ 25.11  Juwenalia - spotkanie  (sala: 9J → 110L)│
│ - 02.12  Warsztaty SSUEW (usunięte z Planera)    │
│                         [Anuluj]  [Wyślij]       │
└──────────────────────────────────────────────────┘
```

## Błędy, które właściciel ma rozumieć

- Kalendarz niepołączony albo zgoda bez zakresów kalendarza → komunikat z odnośnikiem do Ustawień.
- Calendar API wyłączone w projekcie Google → komunikat mówiący, co włączyć.
- Limit/przeciążenie Google → co się udało, co nie; ponowne kliknięcie dosyła resztę.

## Rozstrzygnięte przez użytkownika

- Wariant B, przycisk z podsumowaniem, cztery kategorie, kalendarz na koncie kontakt@.
- Ręczne wpisy już obecne w kalendarzu są przejmowane (tytuł + data), nie dublowane.

## Moje decyzje (do sprawdzenia przy czytaniu)

- Bez listy osób w opisie; godzina nieustalona jako całodniowe z dopiskiem w tytule.
- Planer nadpisuje ręczne zmiany wydarzeń ze znacznikiem D.E.C.K.
- Zakres porównania: cały bieżący semestr, także wydarzenia już minione (ich zmiana nikomu nie szkodzi, a lista w kalendarzu zgadza się z Planerem).
- **Który semestr:** ten, który pokazuje Planer - `biezacySemestr(teraz)` (strona `/planer` innego nie otwiera). Trasa wyznacza go po stronie serwera, nie bierze identyfikatora od klienta. Znacznik niesie identyfikator semestru, więc wysyłka nigdy nie rusza wydarzeń innego semestru.
- **Zgoda Google:** osobny przycisk i osobny powrót z Google („Połącz kalendarz”), z `include_granted_scopes=true` - dokłada zakresy kalendarza, nie przechodzi przez `polaczSkrzynke` i nie zmienia zapisu skrzynki (token odświeżania aktualizowany tylko wtedy, gdy Google zwróci nowy; obserwacja Gmaila, `historyId` i import nietknięte). Ekran zgody projektu `deck-samorzad` jest „Internal” (domena samorzad.ue.wroc.pl), więc bez ostrzeżenia o niezweryfikowanej aplikacji i bez 7-dniowego wygasania tokenów.
- **Powiadomienia:** zapisy z `sendUpdates=none`, bez uczestników i bez własnych przypomnień - obowiązują domyślne przypomnienia kalendarza.
- **Wielodniowe wychodzące poza semestr:** w kalendarzu w pełnej długości (do semestru wydarzenie należy po dniu startu).

## Zostawione budującemu

- Szczegóły dołożenia zakresu `https://www.googleapis.com/auth/calendar.events` do istniejącego połączenia bez resetu skrzynki (zgoda przyrostowa, osobny powrót z Google) - pod warunkiem anty-celu o skrzynce.
- Sama godzina startu bez końca: domyślna długość (np. 1 h) albo inny sposób.
- Porównanie i zapis: pobranie wydarzeń ze znacznikiem przez `privateExtendedProperty`, równoległość i partie w limicie 60 s.
- Testy: czyste przepisanie wydarzenia Planera na wydarzenie Google (wszystkie przypadki terminu), porównanie (dodaj/zmień/usuń/pomiń, ręczne nietknięte), trasa (401/403, brak połączenia, brak zakresu, błąd Google), okno podsumowania.

## Zmiana 2026-11-17: miesiąc i zaznaczanie (zaakceptowane)

- Okno ma wybór miesiąca z bieżącego semestru, domyślnie następny (gdy go nie ma w semestrze - bieżący, potem pierwszy). Wysyłka dotyczy tylko wybranego miesiąca: wydarzenia Planera startujące w nim, wpisy D.E.C.K. startujące w nim i ręczne wpisy z jego okna. Para (wydarzenie, wpis ze znacznikiem) wchodzi do planu, gdy którekolwiek z nich startuje w wybranym miesiącu - przeniesienie grudzień → styczeń to „zmienię” istniejącego wpisu, nie nowy wpis.
- Każda pozycja ≈ + ~ - ma pole wyboru, domyślnie zaznaczone; odznaczona jest pomijana tylko w tej wysyłce. „Do sprawdzenia ręcznie” bez pól. Trwałe wyłączenie = zmiana kategorii w Planerze na Inne.
- POST wysyła `{ miesiac, wybrane }`; serwer liczy plan od nowa i wykonuje tylko pozycje zarówno zaznaczone, jak i nadal obecne w planie (klucze `przejmij:<deckId>`, `dodaj:<deckId>`, `zmien:<deckId>`, `usun:<id wpisu>`).
