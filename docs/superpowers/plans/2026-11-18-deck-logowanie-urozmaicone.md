# Logowanie urozmaicone - plan

**Spec:** `docs/superpowers/specs/2026-11-18-deck-logowanie-urozmaicone-design.md`

## Zadanie 1: dane i losowanie (`lib/deck/ekranLogowania.ts`)

- `SCENY = ['deszcz','radar','siec'] as const`, `Scena`.
- `NAGLOWKI` (5 zdań, pierwsze to obecne), `PULA_TELEMETRII` (7 linii), `OSTATNIA_TELEMETRIA = 'sejf: czeka na operatora'`.
- `losujEkran(los = Math.random): { scena, naglowek, telemetria: string[] }` - telemetria to 3 różne linie z puli + ostatnia.
- Testy: deterministyczne `los` dają przewidywalny wybór; telemetria ma 4 linie, bez powtórek, kończy się stałą linią; skrajne `los` (0 i 0.9999) nie wychodzą poza tablice.

## Zadanie 2: `components/deck/Telemetria.tsx`

- `Telemetria({ linie, tempoMs = 22 })` - pisze znak po znaku, linia po linii; bieżąca linia z kursorem; przy ograniczeniu ruchu wszystko od razu.
- Testy (sztuczne zegary): na starcie nie ma ostatniej linii; po czasie wszystkie są; przy `reduce` wszystkie od razu.

## Zadanie 3: `components/deck/TloLogowania.tsx`

- `TloLogowania({ scena, moc = 0.3, przyspiesz = false })` - jedno płótno, trzy rysowniki, mnożnik tempa narasta do 4x przy `przyspiesz`.
- Bez testów jednostkowych rysowania (jsdom nie ma płótna); test: renderuje `canvas` z `aria-hidden` i `data-scena`. Weryfikacja na ekranie, każda scena.

## Zadanie 4: strona logowania

- Losowanie po zamontowaniu; nagłówek niewidoczny do wylosowania; teksty po polsku; klasa `deck-wejscie` na `main`, gdy `udalo || rola`.
- CSS `deck-wejscie` (treść gaśnie ~600 ms) w `app/globals.css`.
- Testy strony: polskie napisy, brak angielskich, ostatnia linia telemetrii po czasie, klasa przejścia po udanym kodzie.

## Weryfikacja

`npx vitest run`, `npx tsc --noEmit`, `npx eslint`, potem przeglądarka na localhost: każda scena (wymuszona `?scena=`? - nie, tylko przez kilka odświeżeń), przejście po kodzie.
