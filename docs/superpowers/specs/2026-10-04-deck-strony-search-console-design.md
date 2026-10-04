# D.E.C.K. - panel Strony (Google Search Console)

Data: 2026-10-04 · Stan: zaakceptowany projekt

## 1. Cel

Moduł 04 „Strony”: ruch z Google na stronach Samorządu i projektów - kliknięcia, wyświetlenia, CTR, średnia pozycja, trend, top zapytania i podstrony - z alertem spadku i z danymi dla asystenta D.E.C.K.

## 2. Decyzje użytkownika

| Temat | Decyzja |
|---|---|
| Strony na start | samorzad.ue.wroc.pl, jwk26.pl, dni-adaptacyjne.uew.pl |
| Kolejne strony | Lista do dopisywania w panelu (bez zmian w kodzie) |
| Stan w Search Console | Część stron zweryfikowana, część trzeba dodać |
| Zawartość | Liczby i trend, top zapytania, top podstrony, asystent i alerty |
| Dostęp | Tylko właściciel; zarząd nie widzi kafelka ani danych |
| Sposób dostępu do Google | Konto serwisowe z `FIREBASE_SERVICE_ACCOUNT` dodane w Search Console jako użytkownik „Ograniczone” |

## 3. Dostęp do Google

- Serwer podpisuje JWT konta serwisowego (`jose`, RS256, `scope: https://www.googleapis.com/auth/webmasters.readonly`), wymienia go na token dostępu (`https://oauth2.googleapis.com/token`) i trzyma token w pamięci procesu do 5 minut przed wygaśnięciem.
- Wywołania REST:
  - `GET https://searchconsole.googleapis.com/webmasters/v3/sites` - witryny, do których konto ma dostęp;
  - `POST https://searchconsole.googleapis.com/webmasters/v3/sites/{witryna}/searchAnalytics/query` - statystyki (`startDate`, `endDate`, `dimensions`, `rowLimit`).
- Witryna to identyfikator Search Console: `sc-domain:jwk26.pl` albo `https://samorzad.ue.wroc.pl/`.
- **Cache 6 h** (`fetch` z `next: { revalidate: 21600, tags: ['strony'] }`) dla zapytań o statystyki - dane Google i tak mają 2-3 dni opóźnienia, a wejście do panelu nie może zużywać CPU na wspólnym koncie Vercel.

## 4. Dane i obliczenia

**Okresy:** dziś (Warszawa) minus 3 dni to koniec okresu bieżącego; bieżący = 28 dni do końca włącznie, poprzedni = 28 dni przed nim.

**Na witrynę** (zapytania równolegle):
1. suma bez wymiarów za bieżący i poprzedni okres → kliknięcia, wyświetlenia, CTR, pozycja;
2. wymiar `date` za bieżący okres → seria dzienna;
3. wymiar `query`, `rowLimit: 10` → top zapytania;
4. wymiar `page`, `rowLimit: 10` → top podstrony.

**Model:**

```ts
interface Liczby { klikniecia: number; wyswietlenia: number; ctr: number; pozycja: number }
interface StatystykiStrony {
  witryna: string
  nazwa: string
  okres: { od: string; do: string }          // YYYY-MM-DD
  biezace: Liczby
  poprzednie: Liczby
  zmiana: { klikniecia: number | null; wyswietlenia: number | null }   // ułamek, null gdy poprzednie = 0
  dzienne: { data: string; klikniecia: number; wyswietlenia: number }[]
  zapytania: { tekst: string; klikniecia: number; wyswietlenia: number; pozycja: number }[]
  podstrony: { adres: string; klikniecia: number; wyswietlenia: number; pozycja: number }[]
  alert: boolean
}
type WynikStrony = { ok: true; dane: StatystykiStrony } | { ok: false; witryna: string; nazwa: string; blad: 'brak-dostepu' | 'api-wylaczone' | 'inny'; komunikat: string }
```

**Alert:** kliknięcia spadły o ≥ 30% wobec poprzedniego okresu przy co najmniej 50 kliknięciach w poprzednim okresie.

**Lista stron:** Firestore `ustawienia/strony` → `{ witryny: { witryna: string, nazwa: string }[] }`, czytana i pisana wyłącznie przez serwer (Admin SDK). Brak dokumentu = pusta lista. Nazwa domyślnie z adresu (`sc-domain:jwk26.pl` → `jwk26.pl`).

## 5. Serwer

| Trasa / miejsce | Działanie |
|---|---|
| strona `/strony` (serwerowa) | właściciel - panel; inaczej przekierowanie na `/` |
| `GET /api/strony` | lista stron i wyniki (`WynikStrony[]`) |
| `GET /api/strony/dostepne` | witryny z Search Console, których nie ma na liście, plus adres e-mail konta serwisowego do instrukcji |
| `POST /api/strony` | `{ witryna, nazwa? }` → dodaje (tylko z dostępnych) |
| `DELETE /api/strony?witryna=…` | usuwa z listy |

Wszystkie trasy: brak sesji 401, zarząd 403 (wspólna `tylkoWlasciciel`).

## 6. Panel `/strony`

- Nagłówek modułu jak w Analytics: tytuł „Strony”, okres („28 dni do 01.10”), przycisk „Dodaj stronę”.
- **Podsumowanie:** suma kliknięć i wyświetleń wszystkich stron ze zmianą, liczba alertów.
- **Zakładki stron;** w każdej:
  - cztery liczby (kliknięcia, wyświetlenia, CTR, pozycja) ze zmianą ▲/▼ (dla pozycji niżej = lepiej);
  - wykres dzienny (recharts, jak w Analytics): kliknięcia i wyświetlenia;
  - dwie tabele: top 10 zapytań i top 10 podstron;
  - alert na górze, gdy `alert`;
  - przy błędzie strony - komunikat z instrukcją, reszta panelu działa;
  - „Usuń z listy” (z potwierdzeniem).
- **Dodaj stronę:** lista dostępnych witryn do wyboru + pole nazwy; gdy pusta - instrukcja: dodaj `<e-mail konta serwisowego>` w Search Console → Ustawienia → Użytkownicy i uprawnienia, uprawnienie „Ograniczone”.
- **Pusta lista:** ta sama instrukcja plus kroki konfiguracji (§8).

## 7. Kokpit i asystent

- Kafelek „Strony” dla właściciela staje się aktywny: suma kliknięć z 28 dni, zmiana, odznaka liczby alertów. Zarząd nie widzi kafelka. Dane kafelka idą strumieniem i nie blokują kokpitu.
- Obraz projektu (`zbudujKontekst`) dostaje sekcję `strony`: na witrynę nazwa, kliknięcia, wyświetlenia, pozycja, zmiana kliknięć, alert i 3 najlepsze zapytania. Zmiana tych danych zmienia ślad odprawy (najwyżej raz na godzinę - jak dotąd).
- Gdy Search Console zawiedzie, sekcja jest pustą listą - odprawa i czat działają dalej.

## 8. Konfiguracja (użytkownik, jednorazowo)

1. Google Cloud, projekt Firebase z `FIREBASE_SERVICE_ACCOUNT` → włączyć „Google Search Console API”.
2. Search Console każdej strony → Ustawienia → Użytkownicy i uprawnienia → Dodaj użytkownika: `client_email` konta serwisowego, uprawnienie „Ograniczone”.
3. Zweryfikować w Search Console strony, których tam jeszcze nie ma.

## 9. Moduły

| Plik | Odpowiedzialność |
|---|---|
| `lib/strony/okresy.ts` | okresy, zmiana, alert, nazwa z witryny (czyste) |
| `lib/strony/model.ts` | typy i składanie odpowiedzi API w `StatystykiStrony` (czyste) |
| `lib/strony/google.ts` | token konta serwisowego, `listaWitryn`, `zapytanie` (z cache), nazwane błędy |
| `lib/strony/dane.ts` | serwer: lista stron w Firestore, `statystykiStron()` |
| `app/strony/page.tsx`, `components/strony/*` | panel |
| `app/api/strony/route.ts`, `app/api/strony/dostepne/route.ts` | trasy |
| `components/deck/DeckHub.tsx`, `app/page.tsx` | kafelek |
| `lib/asystent/kontekst.ts`, `lib/asystent/dane.ts` | sekcja `strony` |

## 10. Testy

| Co | Przypadki |
|---|---|
| `okresy.ts` | okresy względem daty Warszawy; zmiana (w tym poprzednie = 0); alert: próg 30% i minimum 50 kliknięć; nazwa z `sc-domain:` i z URL |
| `model.ts` | składanie sumy, serii, zapytań i podstron z odpowiedzi API; puste odpowiedzi |
| `google.ts` | podpis i wymiana tokenu (zaślepka `fetch`), ponowne użycie tokenu, 403 → `brak-dostepu`, „API not enabled” → `api-wylaczone` |
| trasy | 401/403; lista; dodanie tylko dostępnej witryny; usunięcie |
| komponenty | zakładki, liczby ze zmianą, alert, błąd strony z instrukcją, pusta lista, dodawanie |
| kontekst | sekcja `strony` w obrazie |

## 11. Ryzyka

| Ryzyko | Co z tym robimy |
|---|---|
| Zużycie CPU na Vercelu | Cache 6 h; kafelek strumieniem; jedno pobranie na wejście |
| Brak dostępu do części stron | Błąd per strona z instrukcją; reszta działa |
| Domena vs prefiks URL | Witrynę wybiera się z listy Search Console, nie wpisuje ręcznie |
| Klucz prywatny konta serwisowego | Tylko serwer; ten sam sekret co Firebase, nic nowego w przeglądarce |
