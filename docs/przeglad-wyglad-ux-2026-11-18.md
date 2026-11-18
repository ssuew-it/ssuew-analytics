# Przegląd wyglądu i obsługi - 2026-11-18

Produkcja https://ssuew-analytics.vercel.app, konto właściciela (sesja „hasło”), ekran 1440 px. Przeszedłem: kokpit (z odprawą), Analitykę (wszystkie 10 zakładek), Planer, Skrzynkę, Strony. Tylko oglądanie - nic nie zmieniałem.

**Nie sprawdzone:** telefon (okno przeglądarki jest zmaksymalizowane i nie dało się go zwęzić), czat „Zapytaj D.E.C.K.” w rozmowie.

## A. Liczby, które mylą (najpierw)

| # | Gdzie | Co widać | Dlaczego źle |
|---|---|---|---|
| A1 | Analityka - wnioski i Alerty | „47 → 28 (60% r/r)”, „2 → 1 (50% r/r)” | To stosunek, nie zmiana: 47 → 28 to spadek o 40%. Lista KPI obok pokazuje zmianę („-50%”), więc dwa sposoby na jednej stronie. `lib/stats.ts:558`. |
| A2 | Analityka - Przegląd i KPI | „średnia zmiana 129% r/r” | To średni stosunek (1,29), czyli średnio +29%, a nie +129%. Moja wczorajsza zmiana podpisu („średni ratio” → „średnia zmiana”) zrobiła z tego błąd. Do tego jeden skok 1 → 5 (Gala, +400%) ciągnie całą średnią. |
| A3 | Alerty, wnioski, odprawa | „KRYTYCZNY: Koordynatorzy ME 2 → 1” | Zmiana o jedną osobę oznaczona jako krytyczna. Strony mają próg minimalny (50 kliknięć), KPI nie mają żadnego - szum zalewa listę i odprawę. |
| A4 | Odprawa | „Zapaść w rekrutacji W'26: 18 zgłoszeń” | Edycja wiosenna jest zawsze mała (28, 31, 18). Porównanie z jesienią albo ze średnią wszystkich edycji udaje kryzys. |
| A5 | Prognozy | Prognoza rekrutacji i retencji | Linia skacze jesień-wiosna-jesień, a prognoza „prog 1 / prog 2” ciągnie ją przez oba sezony. Prognoza retencji wyskakuje ponad całą historię (~6 sem. przy historii 2,7-4,4). |
| A6 | Wszędzie | „24.0”, „3.81”, „37.1%” obok „3,5%”, „4,16”, „8,1” | Raz kropka, raz przecinek. Po polsku przecinek. |
| A7 | Kokpit vs Analityka | Kondycja 78/100 „stabilny wzrost” obok odprawy z 5 zagrożeniami | Dwa obrazy tej samej organizacji bez wyjaśnienia (zgłaszane 17.11, wciąż razi). |

## B. Dwa różne wyglądy jednej aplikacji

| # | Co |
|---|---|
| B1 | Kokpit, Planer, Skrzynka, Strony to D.E.C.K. (pełna szerokość, „← DECK”), Analityka to osobna aplikacja: boczny pasek, logo „SSUEW / Analityka samorządu”, własny nagłówek z adresem i wylogowaniem. Wyjście z Analityki przez mały „← DECK” w pasku. |
| B2 | Nagłówek Analityki na każdej zakładce mówi „Kokpit analityczny samorządu”, zamiast nazwy zakładki (Retencja, Lejek...). Na kokpicie D.E.C.K. też jest „kokpit” - dwa kokpity. |
| B3 | Przyciski: zielono-złoty gradient z poświatą raz oznacza główną akcję („Dodaj wydarzenie”), a w Skrzynce dwa naraz („Dociągnij”, „Ustawienia”), więc nic się nie wyróżnia. „Szukaj” obok jest wyszarzony. |
| B4 | Kolory nie niosą znaczenia: alerty i „106 PO TERMINIE” mają zieloną plakietkę (zielony = dobrze), w Lejku słupek „Przyjęci” jest czerwony, paski w KPI strategicznych raz zielone, raz złote bez powodu. |
| B5 | Resztki angielskiego i żargonu: „KPI INTELLIGENCE”, „Avg ret.”, „Max”, „CR%”, „Korelacja R 0.949”, „Per edycja”, „onboarding”, „Sprawdź onboarding”. |
| B6 | Deszcz znaków na kokpicie leci przez nagłówek - pod adresem i datą w prawym górnym rogu. |
| B7 | Na ikonie wskaźnika „Kondycja” nachodzi napis „KONDYCJA”. |

## C. Układ i puste miejsca

| # | Gdzie | Co |
|---|---|---|
| C1 | Kokpit | Kafel „Orbita - etap 2” zajmuje miejsce i nic nie robi. Kafel Sesji mówi „eksport do Excela i CRA”, a nie wspomina o Kalendarzu Samorządowicza. |
| C2 | Kokpit | Pasek na dole („arkusz 357 ms · Firestore ok · sesja hasło”) to diagnostyka dla programisty, nie dla użytkownika. |
| C3 | Analityka - Projekty | Cała strona pusta: „Brak danych o projektach”. Moduł w menu, który nic nie pokazuje. |
| C4 | Analityka - Członkowie | Domyślnie wybrana kohorta J'22 ma 0 osób - wejście kończy się pustą siatką i samymi zerami. |
| C5 | Lejek, Korelacje, Wpis | Treść zajmuje ćwierć ekranu, reszta pusta. Macierz korelacji to mała tabelka liczb na 7 edycjach (z tak małej próby korelacje nic nie mówią). |
| C6 | Analityka - Przegląd | Wykres „Zgłoszenia i przyjęci” bez legendy: nie wiadomo, który kolor co znaczy. |
| C7 | Strony | „Kliknięcia dziennie” rysowane gładką krzywą przy wartościach 0-4 - wygląda, jakby były ułamki. Słupki byłyby uczciwsze. |
| C8 | Skrzynka | Duży prawy panel pusty („Wybierz sprawę z listy.”), lista wąska. |

## D. Obsługa

| # | Gdzie | Co |
|---|---|---|
| D1 | Skrzynka | „Do odpowiedzi” zaczyna się od najstarszych (15.09, 19.09...). 106 z 114 ma „PO TERMINIE”, więc etykieta przestała cokolwiek wyróżniać. Sprawy z września (Dni Adaptacyjne) dawno nieaktualne. |
| D2 | Planer | Wydarzenia wielodniowe to paski między tygodniami, oderwane od dni - trudno odczytać, które dni zajmują. |
| D3 | Planer | Dużo wydarzeń z końcem 23:59 („16:30-23:59”) - wygląda na brak godziny końca udający koniec dnia. Do sprawdzenia, czy to dane, czy wyświetlanie. |
| D4 | Odprawa | „rozwiń” to drobny napis w rogu; cały wiersz powinien rozwijać. To samo „Zapytaj D.E.C.K.”. |
| D5 | Analityka | Dane wpisuje się w dwóch miejscach: w tabelach modułów (Rekrutacje, Retencja) i w „Wpisz dane”. |
| D6 | Analityka | Filtry „od” / „do” i trzy ikony eksportu bez podpisów - nie wiadomo, co robią, dopóki się nie najedzie. |
