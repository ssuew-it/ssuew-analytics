# D.E.C.K. - Dziennik Stratega

Data: 2026-11-19 · Stan: projekt do zatwierdzenia

## 1. Cel i powód

Dziennik Stratega to **księga przechodnia funkcji**: każda kolejna osoba pełniąca funkcję (konto `kontakt@samorzad.ue.wroc.pl`, rola `owner`) ją przejmuje, czyta i dopisuje. Nic z niej nie znika.

Powód (słowa użytkownika o tym, czego brakowało przy przejęciu funkcji):

- gdzie coś ma luki i wymaga czasu;
- gdzie są miejsca na innowacje (zdaniem poprzednika);
- jakie obowiązki są obligatoryjne, bo Działacze, KR i RUSS rozliczą z nich następcę;
- co, kiedy i jak opracować;
- jakie koncepcje i mechanizmy są rozpoczęte i wymagają kontynuacji.

Do tego: miejsce na kolejne **Strategie Samorządu** (w obecnej kadencji powstaną co najmniej: Strategia Bezpieczeństwa Samorządności, Strategia Transformacji Instytucjonalnej, Strategia Cyfryzacji, Strategia 2-letnia) oraz na **przemyślenia ogólne** o Samorządzie, ludziach i przyszłości.

Sukces: następca w pierwszym tygodniu wie, czego nie może zawalić i kiedy, co jest w toku, gdzie są dziury i gdzie ma pole do własnych pomysłów, a po kilku kadencjach widać, które problemy ciągną się latami, a które ktoś zamknął.

## 2. Cele, nie-cele, anty-cele

**Cele**
- Siedem działów (sekcja 4) z wpisami opatrzonymi autorem i kadencją.
- Kolejne kadencje oznaczają i komentują wpisy poprzedników, nie kasując ich.
- Lista „najbliższe 30 dni” z kalendarza pracy na stronie Dziennika, na kafelku kokpitu i w odprawie asystenta.
- „Przekaż księgę”: zamknięcie kadencji i pełna kopia księgi jako dokument na Dysku kontakt@.
- Model terminów gotowy do odczytu przez Orbitę (sekcja 9).

**Nie-cele (teraz)**
- Przypomnienia na radarze Orbity - następny projekt; Dziennik tylko przygotowuje dane.
- Rozliczanie celów strategii liczbami z Analityki.
- Edytor z formatowaniem (nagłówki, tabele). Tekst to akapity, a adresy URL stają się linkami.
- Wgrywanie plików - tylko linki (Dysk, PDF, strona).
- Historia zmian treści wpisu.
- Dostęp dla roli `board`.
- Asystent czytający przemyślenia, luki czy strategie (dostaje tylko kalendarz pracy, sekcja 7).

**Anty-cele** (porażka, nawet jeśli działa)
- Wpis poprzednika da się usunąć albo przepisać.
- Dziennik dubluje kronikę z Planera, Skrzynki i Analityki zamiast mówić, co z tego wynika.
- Szczere przemyślenia o ludziach są widoczne dla zarządu.
- Księga istnieje tylko w D.E.C.K. i ginie razem z aplikacją.

## 3. Podejścia (wybór użytkownika)

| Podejście | Za | Przeciw |
|---|---|---|
| **1. Moduł w D.E.C.K. + eksport na Dysk przy przekazaniu** (wybrane) | Wpisy są danymi: statusy, autorzy, terminy, odczyt przez Orbitę i asystenta | Tekst bez formatowania |
| 2. Dokumenty Google, D.E.C.K. tylko spis | Pełne formatowanie, przeżyje każdą aplikację | Statusy i terminy to tylko tekst; Orbita i „30 dni” nie mają z czego liczyć |
| 3. Pola w D.E.C.K., długie teksty w Google Docs | Formatowanie tam, gdzie się przydaje | Księga w dwóch miejscach, eksport i tak musi zebrać oba |

Wybrano 1, bo ustalenia o statusach, autorach i przypomnieniach wymagają danych, a ryzyko „aplikacja umrze” pokrywa eksport przy każdym przekazaniu. Długie strategie mają własne dokumenty, Dziennik do nich linkuje.

## 4. Działy

Kolejność zakładek jak niżej; domyślna zakładka to **Najbliższe**.

| Zakładka | Dział (`dzial`) | Pola poza wspólnymi |
|---|---|---|
| Najbliższe | - (widok) | Wpisy kalendarza pracy, których okno przygotowania (sekcja 6) zaczyna się w ciągu 30 dni lub już trwa, oraz liczba otwartych wątków i luk |
| Kalendarz pracy | `cykl` | `miesiac` 1-12, `dzien` 1-31 lub null („w ciągu miesiąca”), `wyprzedzenieTygodni` 0-12 (domyślnie 2), `obowiazkowe` boolean, `rozlicza` string[] (podpowiedzi: Działacze, KR, RUSS; dowolny tekst) |
| Luki | `luka` | `ileCzasu` tekst do 80 znaków („semestr”, „2 kadencje”) |
| Wątki w toku | `watek` | `zostalo` tekst - co zostało do zrobienia |
| Pole do innowacji | `innowacja` | - |
| Strategie | `strategia` | `link`, `okresOd` i `okresDo` (rok), `status` (projekt / przyjęta / wygasła / zastąpiona), `uchwala` (tekst lub null), `cele`: `{ id, tresc }[]` |
| Przemyślenia | `przemyslenie` | - (dłuższy limit treści) |

Działy 1 i 2 z rozmowy (obowiązki i „co kiedy jak”) są **jednym wpisem** w `cykl`: obowiązek to wpis z `obowiazkowe: true` i listą `rozlicza`. Kalendarz pracy pokazuje oś roku (12 miesięcy, od miesiąca bieżącego), obowiązkowe wyróżnione.

## 5. Dane

Firestore, wyłącznie przez Admin SDK z tras serwera chronionych `tylkoWlasciciel` (jak notatki asystenta). Brak reguł klienta - zamyka je reguła końcowa w `firestore.rules`.

**`dziennikKadencje/{id}`**
```ts
{
  nazwa: string            // dowolna, np. "2025/26"
  autor: string            // imię i nazwisko - konto jest wspólne, więc autora nie da się wziąć z logowania
  funkcja: string | null   // np. "Przewodniczący"
  otwarta: number          // ms
  zamknieta: number | null // ms; null = kadencja bieżąca (najwyżej jedna)
  kopia: { link: string, kiedy: number } | null   // ostatni eksport
}
```

**`dziennikWpisy/{id}`**
```ts
{
  dzial: 'cykl' | 'luka' | 'watek' | 'innowacja' | 'strategia' | 'przemyslenie'
  kadencjaId: string
  tytul: string            // 1-120 znaków
  tresc: string            // do 4000 znaków; przemyślenie do 20 000
  utworzono: number
  zmieniono: number
  // pola działu z sekcji 4
  adnotacje: {
    id: string
    kadencjaId: string
    stan: 'aktualne' | 'przejmuje' | 'zamkniete' | 'nieaktualne' | null
    celId: string | null   // adnotacja do celu strategii
    stanCelu: 'realizowany' | 'zrealizowany' | 'porzucony' | null
    komentarz: string      // do 500 znaków
    kiedy: number
  }[]
}
```

**`dziennik/stan`** - jeden dokument-wskaźnik: `{ otwartaKadencjaId: string | null }`. Otwarcie i zamknięcie kadencji to transakcja Firestore na tym dokumencie i dokumencie kadencji, więc „najwyżej jedna otwarta” trzyma serwer, także przy dwóch kartach naraz (druga dostaje 409 z komunikatem „Kadencja już się zmieniła - odśwież”).

Stan wpisu na liście = `stan` ostatniej adnotacji z niepustym `stan` (brak = „aktualne”). Wpisy `zamkniete` i `nieaktualne` są na liście zwinięte pod „Zamknięte (n)”, nie znikają.

## 6. Zachowanie

**Pierwsze wejście / brak otwartej kadencji.** Zamiast działów formularz „Rozpocznij kadencję” (nazwa, autor, funkcja). Bez otwartej kadencji nie da się nic dopisać, ale całą księgę da się czytać.

**Własne a cudze wpisy.**
- Wpis kadencji bieżącej: edycja i usunięcie dozwolone.
- Wpis kadencji zamkniętej: tylko odczyt; można dodać adnotację (stan + komentarz). Własne adnotacje kadencji bieżącej można poprawić i usunąć, cudze nie.
- Serwer egzekwuje to po `kadencjaId` (nie tylko interfejs): wpis lub adnotacja jest „własna”, gdy jej `kadencjaId` = `dziennik/stan.otwartaKadencjaId`. Konto jest wspólne, a w kadencji pisze jedna osoba, więc pole autora przy adnotacji nie jest potrzebne.
- Cele strategii: dodawanie, poprawianie i usuwanie tylko we wpisie kadencji bieżącej. Strategia z kadencji zamkniętej ma cele zamrożone - następca dodaje adnotacje (`celId` + `stanCelu`), a gdy strategię trzeba przepisać, dodaje nową ze statusem poprzedniej „zastąpiona”.

**Daty.** `najblizszyTermin` przyjmuje i zwraca daty `"RRRR-MM-DD"`; „dziś” liczone helperem z `lib/czas.ts` (Europe/Warsaw), jak w odprawie i Skrzynce.

**Okno przygotowania (kalendarz pracy).** Najbliższe wystąpienie terminu = najbliższa data `miesiac`/`dzien` dziś lub później (dla `dzien: null` - ostatni dzień miesiąca). Okno zaczyna się `wyprzedzenieTygodni` tygodni wcześniej. Czysta funkcja `najblizszyTermin(wpis, dzis)` w `lib/dziennik/terminy.ts`; `dzien` 31 w miesiącu krótszym = ostatni dzień miesiąca; 29 lutego w roku nieprzestępnym = 28. Daty w strefie Europe/Warsaw, dni kalendarzowe (jak w odprawie).

**Przekaż księgę.** Przycisk w Dzienniku, z potwierdzeniem opisującym skutki:
1. zapis kopii na Dysku (jak „Zapisz kopię” niżej) - jeśli się nie uda, przekazanie się zatrzymuje i nic nie jest zamknięte;
2. `zamknieta = teraz` dla bieżącej kadencji i `otwartaKadencjaId = null` w jednej transakcji. Jeśli kopia powstała, a zamknięcie się nie udało, ponowne kliknięcie robi nową kopię i próbuje zamknąć jeszcze raz - nadmiarowa kopia na Dysku jest nieszkodliwa;
3. Dziennik pokazuje formularz „Rozpocznij kadencję” dla następcy.

Zamknięcia nie da się cofnąć z interfejsu (świadomie: to moment przekazania).

**Zapisz kopię na Dysku.** Dostępne w każdej chwili, nie tylko przy przekazaniu. Tworzy na Dysku kontakt@ dokument Google „Dziennik Stratega - stan na RRRR-MM-DD” z całą księgą: kadencje, działy, wpisy z autorami, adnotacje, cele strategii. Technicznie: HTML wysłany do Drive API z konwersją do Google Doc, zakres `drive.file`, przez istniejące połączenie OAuth konta kontakt@ (to samo co Skrzynka i Kalendarz). Link zapisany w `kopia` kadencji i widoczny w Dzienniku.
- Wysyłka synchroniczna, jedno żądanie multipart do Drive API (limit 5 MB). Księga to tekst - setki kilobajtów nawet po kilku kadencjach - więc wysyłka wznawialna nie jest potrzebna; gdy HTML przekroczy 4 MB, serwer odmawia z komunikatem zamiast próbować. Limit 4,5 MB Vercela dotyczy odpowiedzi do przeglądarki, której eksport na Dysk nie przesyła (zwraca tylko link); „Pobierz plik” podlega mu, przy tym rozmiarze bez znaczenia.
- Brak zakresu wykrywany z zapisanej listy `zakresy` połączenia, tak jak kalendarz (`lib/kalendarz/polaczenie.ts`: `brak-kalendarza`). „Połącz Dysk” to osobna zgoda na sam `drive.file` z `include_granted_scopes`, wzorowana na `adresZgodyKalendarza`; sprawdzanie zgody Gmaila (wymóg `gmail.send`) zostaje bez zmian.
- Gdy połączenie nie ma zakresu `drive.file`: komunikat z linkiem do Skrzynka → Ustawienia („Połącz Dysk”, analogicznie do „Połącz kalendarz”), a obok „Pobierz plik” - ten sam HTML do pobrania.

## 7. Kokpit i asystent

- **Kafelek „Dziennik Stratega”** (tylko `owner`): najbliższe 1-2 pozycje z „Najbliższe”, obowiązkowe z oznaczeniem, kto rozlicza; bez otwartej kadencji - zachęta „Rozpocznij kadencję”.
- **Obraz projektu dla asystenta** (`lib/asystent/kontekst.ts`): nowa sekcja `dziennik` = wpisy `cykl` w oknie 30 dni (tytuł, termin, obowiązkowe, rozlicza). Bez treści przemyśleń, luk i strategii. Błąd odczytu = sekcja `null` z logiem `[asystent] dziennik:` (jak `skrzynka`). Odprawa i czat korzystają z tej samej sekcji.

## 8. Wygląd

Moduł D.E.C.K. jak Analityka: nagłówek z nazwą zakładki, pasek zakładek (na telefonie u góry, na szerokim ekranie z boku), wpisy jako karty. Telefon 390 px bez przewijania w bok.

```
DZIENNIK STRATEGA · kadencja 2025/26 · Mikołaj R.    [Zapisz kopię] [Przekaż księgę]
┌ Najbliższe ┐ Kalendarz pracy  Luki  Wątki  Innowacje  Strategie  Przemyślenia
│ ● OBOWIĄZKOWE  Sprawozdanie dla KR        do 15 mar  · KR · przygotuj od 1 mar
│   Budżet na semestr letni                 luty       · od 18 sty
│ W toku: 4 wątki, 3 luki
└──────────
Karta wpisu: tytuł · autor · kadencja · stan
  treść...
  ↳ 2026/27, Anna K.: przejmuję - "zmieniamy termin na kwiecień"
```

Bez długich myślników w interfejsie (tylko „-”).

## 9. Most do Orbity (na później)

Orbita (następny projekt) czyta wpisy `cykl` przez `najblizszyTermin` i pokazuje je na radarze jako zadania „z Dziennika”, bez kopiowania do własnej kolekcji. Dziennik nie zakłada niczego o Orbicie poza tym, że funkcja i pola `cykl` są stabilne. Spec Orbity z 2026-08-11 trzeba odświeżyć przy jej burzy (m.in. zadania zapisane pod `users/{uid}` należą do konta kontakt@, więc też przechodzą na następcę).

## 10. Ograniczenia

- Tylko `owner`; trasy `app/api/dziennik/**` przez `tylkoWlasciciel`, strona `/dziennik` przekierowuje `board` (jak Orbita w specu).
- Vercel Hobby; odpowiedzi poniżej 4,5 MB (eksport wysyłany do Google z serwera, nie przez przeglądarkę).
- Nowy zakres OAuth wymaga od użytkownika: włączenia Google Drive API i dodania `drive.file` na ekranie zgody w projekcie `deck-samorzad`, potem „Połącz Dysk”.
- Interfejs po polsku z ogonkami; liczby z przecinkiem.

## 11. Decyzje użytkownika

| Temat | Decyzja |
|---|---|
| Charakter | Księga przechodnia, dopisywana przez kolejne kadencje |
| Działy | Obowiązki, co-kiedy-jak, luki, wątki do kontynuacji, pole do innowacji, Strategie Samorządu, przemyślenia ogólne |
| Obowiązki z terminami | Teraz Dziennik opisuje + „30 dni” + odprawa; przypomnienia w Orbicie w następnym projekcie |
| Podejście | Moduł w D.E.C.K. + eksport na Dysk przy przekazaniu |
| Rozliczanie celów strategii liczbami | Nie teraz |

## 12. Decyzje projektanta (do sprawdzenia przy czytaniu)

- Dostęp tylko `owner` (kontakt@); prywatny adres użytkownika (`board`) Dziennika nie widzi.
- Autor wpisywany ręcznie przy otwarciu kadencji, bo konto jest wspólne.
- Obowiązek i jego termin to jeden wpis w kalendarzu pracy.
- Termin roczny (miesiąc + opcjonalny dzień) z wyprzedzeniem w tygodniach; obowiązki semestralne = dwa wpisy.
- Zamknięte wpisy zwinięte, nie ukryte.
- Przekazanie nieodwracalne z interfejsu i wymaga udanej kopii na Dysku.
- Kopia jako Google Doc przez `drive.file`; plik HTML do pobrania jako wyjście awaryjne.
- Asystent dostaje tylko kalendarz pracy z okna 30 dni. Tytuły trafiają do Gemini tak jak dziś tematy spraw ze Skrzynki; asystent jest tylko dla `owner`, zarząd ich nie widzi.
- „Najwyżej jedna otwarta kadencja” przez dokument `dziennik/stan` i transakcje.
- „Własne” = należące do otwartej kadencji; bez pola autora przy adnotacjach.
- Cele strategii zamrożone po zamknięciu kadencji; zmiana strategii = nowa strategia, stara „zastąpiona”.
- Eksport synchroniczny, jedno żądanie multipart, odmowa powyżej 4 MB.
- „Połącz Dysk” jako osobna zgoda wzorowana na kalendarzu.

## 13. Zostawione wykonawcy

- Adnotacje jako tablica w dokumencie (jak wyżej) czy podkolekcja - tablica wystarczy przy kilku adnotacjach na kadencję; zmiana dozwolona, jeśli plan wykaże potrzebę.
- Układ formularzy wpisu i dokładny wygląd kart w ramach stylu D.E.C.K.
- Szablon HTML eksportu.
- Kolejność sortowania w działach innych niż kalendarz (domyślnie: otwarte przed zamkniętymi, nowsze wyżej).
