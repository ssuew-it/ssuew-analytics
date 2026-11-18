# Logowanie D.E.C.K. - urozmaicone (projekt krótki)

Data: 2026-11-18. Zatwierdzone przez właściciela w rozmowie („tak”).

## Po co

Ekran logowania wygląda przy każdym wejściu tak samo (deszcz znaków, jedno zdanie, cztery stałe linie po angielsku), a po dobrym kodzie jest martwa chwila z napisem „Wchodzę...”. Ma być różnie przy każdym wejściu i bez martwej chwili.

## Co

1. **Losowane tło** przy każdym wejściu: `deszcz` (jak dziś), `radar` (obracająca się wiązka, zapalające się punkty), `siec` (dryfujące węzły łączone liniami). Te same zasady co deszcz: ok. 30 kl./s, stoi przy ukrytej karcie, wyłączone przy `prefers-reduced-motion`.
2. **Nagłówek losowany** z 5 polskich zdań; dekodowanie zostaje.
3. **Telemetria pisana linia po linii**, po polsku: 3 losowe z puli + stała ostatnia „sejf: czeka na operatora”.
4. **Napisy po polsku**: „kokpit szyfrowany”, „telemetria systemu”, „warstwa dostępu”, plakietka „NA ŻYWO”.
5. **Przejście po wejściu (~0,6 s)**: tło przyspiesza, treść gaśnie. Nie opóźnia przekierowania - idzie równolegle z wczytywaniem kokpitu.

Błędny kod - bez zmian (potrząśnięcie kratek).

## Podejścia

- **Wybrane:** losowanie po zamontowaniu (jak motyw kodu w `KodInput`), czyste dane i losowanie w `lib/deck/ekranLogowania.ts`, rysowanie scen na jednym płótnie w `components/deck/TloLogowania.tsx`.
- Odrzucone: losowanie po stronie serwera (strona jest kliencka, a ciasteczko tylko po to - przesada); osobne komponenty-płótna na każdą scenę (trzy kopie pętli, widoczności i DPR).

## Decyzje moje

- `MatrixRain` w kokpicie zostaje bez zmian.
- Do czasu wylosowania nagłówek jest niewidoczny (zajmuje miejsce), a tła nie ma - żeby nie mignęło coś, co zaraz się zmieni.
- `rola` albo udany kod uruchamia przejście; hasło też je dostaje.
