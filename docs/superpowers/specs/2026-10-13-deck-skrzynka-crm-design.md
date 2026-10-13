# D.E.C.K. - Skrzynka: CRM poczty kontakt@samorzad.ue.wroc.pl

Data: 2026-10-13 · Stan: projekt do przeglądu

## 1. Cel

Moduł 05 „Skrzynka”: każdy mail na kontakt@samorzad.ue.wroc.pl staje się sprawą ze statusem, nic nie ginie, reklamy nie zaśmiecają listy, widać historię z każdą osobą i organizacją, a odpowiedź (z załącznikami i szkicem od asystenta) wysyła się prosto z D.E.C.K.

## 2. Decyzje użytkownika

| Temat | Decyzja |
|---|---|
| Cele | Nic nie ginie, podział pracy (bez reklam), baza kontaktów, obraz skrzynki |
| Odpowiedzi | Z D.E.C.K., wysyłka z kontakt@ |
| Dostęp do Gmaila | Wewnętrzna aplikacja OAuth w projekcie Google Cloud w organizacji samorzad.ue.wroc.pl (użytkownik może tam tworzyć projekty, nie jest superadministratorem) |
| Kto widzi | Tylko właściciel. Przypisanie to osoba ze Składu zarządu - furtka na późniejszy dostęp zarządu bez przebudowy danych |
| Sprawa | Jeden wątek Gmaila |
| Statusy | Do przejrzenia, Do odpowiedzi, W toku, Czeka na nich, Załatwiona, Pominięta (§5) |
| Reklamy | Nie trafiają same do Pominiętych - automat odkłada je do „Do przejrzenia” |
| Import | Ostatnie 12 miesięcy; wątki starsze niż 30 dni od razu jako Załatwione (archiwum) |
| Organizacje | Z domeny; typy: Partner, Sponsor, Uczelnia, Organizacja studencka, Media, Inne |
| Asystent | Nagłówki i liczby automatycznie; treść wątku do Gemini tylko po kliknięciu „Streść” / „Szkic odpowiedzi” |
| Okno odpowiedzi | Tekst w wątku + załączniki, łącznie do 4 MB, stała stopka Samorządu |
| Synchronizacja | Push z Gmaila (Pub/Sub) + kopia nagłówków w Firestore; oszczędnie z zasobami Vercela |

## 3. Dostęp do Google (konfiguracja jednorazowa, użytkownik)

1. console.cloud.google.com, konto z domeny samorzad.ue.wroc.pl → Nowy projekt w organizacji samorzad.ue.wroc.pl (np. `deck-skrzynka`).
2. Włączyć **Gmail API** i **Cloud Pub/Sub API**.
3. Ekran zgody OAuth: typ **Wewnętrzny**, zakresy `gmail.readonly` i `gmail.send`.
4. Klient OAuth „Aplikacja internetowa”, adres przekierowania `https://<domena D.E.C.K.>/api/skrzynka/oauth`.
5. Pub/Sub: temat `skrzynka`; uprawnienie „Publikujący Pub/Sub” dla `gmail-api-push@system.gserviceaccount.com`.
6. Konto serwisowe `skrzynka-push` (bez ról) i subskrypcja push tematu na `https://<domena D.E.C.K.>/api/skrzynka/push` z uwierzytelnianiem OIDC tym kontem, odbiorca = ten sam adres.
7. Vercel (production): `SKRZYNKA_CLIENT_ID`, `SKRZYNKA_CLIENT_SECRET`, `SKRZYNKA_TEMAT` (`projects/<id>/topics/skrzynka`), `SKRZYNKA_PUSH_KONTO` (e-mail konta z kroku 6), `SKRZYNKA_KLUCZ` (32 losowe bajty w base64 do szyfrowania tokenu), `CRON_SECRET`.
8. W D.E.C.K. zalogowanym jako kontakt@: panel Skrzynka → „Połącz skrzynkę”.

Klient OAuth i temat Pub/Sub są w tym samym projekcie (wymóg `users.watch`). Firebase zostaje w obecnym projekcie - nic się tam nie zmienia.

## 4. Przepływ danych

**Połączenie.** `GET /api/skrzynka/polacz` przekierowuje na zgodę Google (`access_type=offline`, `prompt=consent`, `login_hint=kontakt@…`, `state` podpisany sekretem sesji D.E.C.K.). `GET /api/skrzynka/oauth` wymienia kod na tokeny, sprawdza w `users.getProfile`, że adres to `DECK_OWNER_EMAIL` (inaczej odmowa), szyfruje refresh token (AES-256-GCM, `SKRZYNKA_KLUCZ`), zapisuje stan, uruchamia `users.watch` i odsyła do panelu, który zaczyna import.

**Import.** Przeglądarka woła `POST /api/skrzynka/import` w pętli; każde wywołanie pobiera jedną stronę `threads.list` (`q: newer_than:365d`, 100 wątków), dla każdego `threads.get` z `format=metadata` i zapisuje sprawy, kontakty i organizacje partią. Odpowiedź niesie `nastepnaStrona` i licznik - panel pokazuje „Importuję 400 z ok. 2300”. Wątek, którego ostatnia wiadomość jest starsza niż 30 dni, dostaje status Załatwiona. Import zapamiętuje `historyId` z początku, więc nic, co przyjdzie w trakcie, nie zginie.

**Push.** `POST /api/skrzynka/push` weryfikuje token OIDC Google (podpis, `aud` = adres trasy, `email` = `SKRZYNKA_PUSH_KONTO`), odpowiada 204 i woła `synchronizuj()`. `users.watch` obejmuje tylko etykiety `INBOX` i `SENT` (`labelFilterBehavior: include`) - przeczytanie maila czy zmiana etykiety nie budzi serwera.

**`synchronizuj()`** - jedyna droga zmian w bazie:
1. Dzierżawa w transakcji na `skrzynka/stan` (60 s). Gdy trwa inna synchronizacja - koniec; tamta i tak pobierze wszystko od zapamiętanego punktu. Tak kilka powiadomień naraz daje jedną synchronizację.
2. `history.list` od zapisanego `historyId` (`historyTypes: messageAdded`), zebranie zmienionych `threadId`.
3. `threads.get` (`format=metadata`) dla każdego, automat statusów (§5), zapis partią, nowy `historyId`.
4. Gdy Gmail odpowie 404 (punkt historii za stary) - pełne przejrzenie wątków z ostatnich 30 dni.

**Dociągnięcie przy wejściu.** Panel `/skrzynka` (nie kokpit) woła `synchronizuj()` w `after()`, jeśli ostatnia synchronizacja była ponad 15 minut temu. Przycisk „Dociągnij” robi to od razu.

**Cron (raz dziennie, `vercel.json`).** `GET /api/skrzynka/cron` z `Authorization: Bearer CRON_SECRET`: odnowienie `users.watch` (wygasa po 7 dniach) i `synchronizuj()`.

**Treść.** `GET /api/skrzynka/sprawy/{id}` pobiera wątek z Gmaila (`format=full`) na żywo; treść i załączniki nie są kopiowane do bazy.

## 5. Statusy

| Zdarzenie | Skutek |
|---|---|
| nowy wątek z etykietą `CATEGORY_PROMOTIONS`, `CATEGORY_UPDATES`, `CATEGORY_SOCIAL` albo `CATEGORY_FORUMS`, z nagłówkiem `List-Unsubscribe` albo `Precedence: bulk` | Do przejrzenia |
| nowy wątek od adresu albo domeny z listy „zawsze pomijaj” | Pominięta |
| inny nowy wątek z mailem od nich | Do odpowiedzi |
| nowy wątek rozpoczęty przez nas | Czeka na nich |
| ich mail w sprawie Czeka na nich albo Załatwiona | Do odpowiedzi |
| ich mail w sprawie W toku | W toku + znacznik „nowa wiadomość” |
| ich mail w sprawie Pominięta albo Do przejrzenia | bez zmian (znacznik „nowa wiadomość”) |
| nasz mail w sprawie Do odpowiedzi | Czeka na nich |
| nasz mail w sprawie W toku | bez zmian |
| ręcznie | dowolny status; „Pomiń” z opcją „zawsze pomijaj adres / domenę” |

„Nasz” mail to mail z nadawcą `DECK_OWNER_EMAIL` - wysłany z D.E.C.K. albo z Gmaila. Otwarcie sprawy w panelu zdejmuje znacznik „nowa wiadomość”.

**Alarm:** status Do odpowiedzi trwa dłużej niż 3 dni robocze (pn-pt, czas Warszawy, bez świąt), liczone od pierwszego ich maila bez naszej odpowiedzi.

## 6. Dane (Firestore, tylko serwer)

Kolekcje bez reguły klienta - zamyka je reguła końcowa `firestore.rules`.

| Dokument | Pola |
|---|---|
| `skrzynka/stan` | `email`, `token` (szyfrogram), `historyId`, `watchWygasa`, `ostatniaSynchronizacja`, `dzierzawaDo`, `polaczona`, `import: { trwa, strona, zrobione, razem }` |
| `skrzynka/ustawienia` | `stopka`, `pomijaneAdresy[]`, `pomijaneDomeny[]` |
| `skrzynkaSprawy/{threadId}` | `temat`, `status`, `kontakt` (e-mail), `organizacja` (domena albo null), `ostatnia: { kiedy, kierunek: 'my' \| 'oni', fragment }`, `oczekujeOd` (kiedy zaczęło się Do odpowiedzi, albo null), `wiadomosci`, `nowa`, `przypisana` (osoba ze Składu albo null), `kategoriaGmail`, `zmieniono` |
| `skrzynkaKontakty/{email}` | `imie`, `email`, `organizacja`, `typ` (`student` albo null), `watki`, `ostatniKontakt` |
| `skrzynkaOrganizacje/{domena}` | `nazwa`, `typ`, `watki`, `ostatniKontakt` |

**Organizacja z domeny:** skrzynki prywatne (gmail.com, googlemail.com, wp.pl, o2.pl, onet.pl, op.pl, interia.pl, outlook.com, hotmail.com, live.com, icloud.com, yahoo.com, proton.me, protonmail.com) - bez organizacji; `student.ue.wroc.pl` - bez organizacji, kontakt z typem `student`; `ue.wroc.pl` - organizacja „Uniwersytet Ekonomiczny”, typ Uczelnia; inne - organizacja o nazwie z domeny, typ Inne, do zmiany ręcznie. Druga strona sprawy to pierwszy adres w wątku inny niż `DECK_OWNER_EMAIL`.

Odczyty kokpitu to zapytania zliczające (`count()`), nie listy.

## 7. Serwer

| Trasa | Działanie |
|---|---|
| `GET /api/skrzynka/polacz`, `GET /api/skrzynka/oauth` | połączenie (§4) |
| `POST /api/skrzynka/rozlacz` | `{ usunDane: boolean }` - odwołanie tokenu w Google, opcjonalnie usunięcie spraw, kontaktów i organizacji |
| `POST /api/skrzynka/import` | jedna strona importu |
| `POST /api/skrzynka/push` | powiadomienie Pub/Sub (weryfikacja OIDC zamiast sesji) |
| `GET /api/skrzynka/cron` | odnowienie watch + synchronizacja (`CRON_SECRET` zamiast sesji) |
| `POST /api/skrzynka/synchronizuj` | „Dociągnij” |
| `GET /api/skrzynka/sprawy?status=…&po=…` | lista spraw (50 na stronę) |
| `GET /api/skrzynka/szukaj?q=…` | wyszukiwanie Gmaila (`threads.list q`) → sprawy z bazy |
| `GET /api/skrzynka/sprawy/{id}` | wątek z Gmaila + sprawa z bazy |
| `PATCH /api/skrzynka/sprawy/{id}` | `{ status?, przypisana?, pomin?: 'adres' \| 'domena' }` |
| `GET /api/skrzynka/sprawy/{id}/zalacznik/{zalacznikId}` | pobranie załącznika z Gmaila |
| `POST /api/skrzynka/sprawy/{id}/odpowiedz` | `multipart/form-data`: tekst + załączniki (łącznie ≤ 4 MB) → MIME → `messages.send` z `threadId`, `In-Reply-To`, `References`, `Re:` |
| `POST /api/skrzynka/sprawy/{id}/asystent` | `{ tryb: 'strescz' \| 'szkic' }` - wątek do Gemini, wynik do okna |
| `GET/PATCH /api/skrzynka/kontakty`, `…/organizacje` | listy, karta z wątkami, zmiana nazwy i typu organizacji |
| `GET/PATCH /api/skrzynka/ustawienia` | stopka, listy pomijanych |

Trasy z sesją: brak sesji 401, zarząd 403 (`tylkoWlasciciel`, komunikat „Skrzynka jest tylko dla właściciela”). Gdy skrzynka nie jest połączona - 409 z komunikatem, a panel pokazuje „Połącz skrzynkę”.

**Mail wysyłany:** `From: Samorząd Studentów UEW <kontakt@…>`, temat w RFC 2047 (UTF-8), treść `text/plain` UTF-8 z dopisaną stopką, załączniki base64 w `multipart/mixed`. Po wysyłce sprawa przechodzi przez automat (§5) od razu, bez czekania na push.

## 8. Panel `/skrzynka` i kafelek

**Kafelek „Skrzynka”** (tylko właściciel, `moduł 05 · kontakt@`): liczba Do odpowiedzi, odznaka „N po terminie”, linijka „do przejrzenia X · czeka na nich Y”; bez połączenia „Połącz skrzynkę”; po odwołaniu dostępu „Skrzynka rozłączona - połącz ponownie”. Dane strumieniem, nie blokują kokpitu.

**Panel:**
- nagłówek: tytuł, czas ostatniej synchronizacji, „Dociągnij”, ustawienia (stopka, pomijani, „Rozłącz”);
- zakładki z licznikami: Do odpowiedzi (domyślna; najpierw po terminie, potem od najstarszej), W toku, Czeka na nich, Do przejrzenia, Załatwione, Pominięte, Kontakty, Organizacje;
- wyszukiwarka (Gmail);
- lista: kto (osoba · organizacja), temat, fragment, wiek, znaczniki alarmu / nowej wiadomości / przypisania;
- widok sprawy (na komputerze obok listy, na telefonie pełny ekran): wiadomości wątku (tekst, albo HTML w `<iframe sandbox>` bez skryptów i bez zewnętrznych obrazków), załączniki do pobrania, przyciski statusu, „Przypisz” (Skład z `ustawienia/sklad`), „Pomiń”, „Otwórz w Gmailu”, okno odpowiedzi (tekst, załączniki z licznikiem 4 MB, podgląd stopki), „Streść” i „Szkic odpowiedzi”;
- Do przejrzenia: przy każdej sprawie „Pomiń” i „Do odpowiedzi” jednym kliknięciem;
- Kontakty / Organizacje: lista z filtrem typu, karta z wątkami i statusami, zmiana nazwy i typu organizacji;
- przy pierwszym połączeniu: pasek postępu importu.

Zarząd nie widzi kafelka; wejście na `/skrzynka` odsyła na `/`.

## 9. Asystent

- Obraz projektu (`zbudujKontekst`) dostaje sekcję `skrzynka`: liczby spraw w statusach, sprawy po terminie (temat, organizacja, dni czekania; najwyżej 10), organizacje z mailami z ostatnich 7 dni. Bez treści i bez fragmentów.
- Nowy obszar odprawy `skrzynka` → `/skrzynka`.
- „Streść” / „Szkic odpowiedzi”: treść wątku (tekst, bez załączników, najwyżej 20 000 znaków od końca) + notatki asystenta do Gemini; szkic po polsku, w tonie Samorządu, bez stopki (dopisze ją wysyłka). Wynik trafia do okna, nigdy nie wysyła się sam.
- Gdy skrzynka nie jest połączona albo zawiedzie, sekcja jest pusta - odprawa i czat działają dalej.

## 10. Koszty i limity

| Zasób | Szacunek (50-100 maili dziennie) | Limit |
|---|---|---|
| Wywołania funkcji Vercel | 3-5 tys. / mies. | 1 mln (Hobby) |
| CPU Vercel | 15-30 min / mies. | 4 h (Hobby) |
| Cron | 1 dziennie | 1 dziennie (Hobby) |
| Firestore zapisy | ok. 300 / dzień; import do 10 tys. jednorazowo | 20 tys. / dzień |
| Firestore odczyty | wejście do kokpitu: 4 liczniki | 50 tys. / dzień |
| Pub/Sub | kilka MB / mies. | 10 GB |
| Gmail API | setki jednostek / dzień | 15 tys. jednostek / min na użytkownika |

Kokpit nigdy nie pyta Gmaila. Bezpiecznik przy zbliżaniu się do limitu: dłuższy próg dociągania przy wejściu.

## 11. Moduły

| Plik | Odpowiedzialność |
|---|---|
| `lib/skrzynka/statusy.ts` | automat statusów, alarm, dni robocze (czyste) |
| `lib/skrzynka/kontakty.ts` | druga strona wątku, organizacja z domeny, typ kontaktu (czyste) |
| `lib/skrzynka/naglowki.ts` | odczyt metadanych wątku Gmaila w `SprawaZGmaila` (czyste) |
| `lib/skrzynka/mime.ts` | składanie maila do wysłania (czyste) |
| `lib/skrzynka/tresc.ts` | odczyt treści wątku `format=full`: tekst, HTML, załączniki (czyste) |
| `lib/skrzynka/szyfr.ts` | AES-256-GCM tokenu |
| `lib/skrzynka/google.ts` | OAuth (adres zgody, wymiana kodu, odświeżanie tokenu), wywołania Gmail API, `BladSkrzynki` |
| `lib/skrzynka/push.ts` | weryfikacja OIDC Pub/Sub |
| `lib/skrzynka/dane.ts` | Firestore: stan, sprawy, kontakty, organizacje, ustawienia, liczniki |
| `lib/skrzynka/synchronizacja.ts` | `synchronizuj()`, import strony, dzierżawa |
| `app/api/skrzynka/**` | trasy z §7 |
| `app/skrzynka/page.tsx`, `components/skrzynka/*` | panel |
| `components/deck/DeckHub.tsx`, `app/page.tsx` | kafelek |
| `lib/asystent/kontekst.ts`, `dane.ts`, `odprawa.ts` | sekcja `skrzynka`, obszar odprawy |
| `vercel.json` | cron |

## 12. Testy

| Co | Przypadki |
|---|---|
| `statusy.ts` | każdy wiersz tabeli §5; alarm przez weekend (pt → wt to 2 dni robocze); granica 3 dni |
| `kontakty.ts` | domena prywatna, student, ue.wroc.pl, zwykła firma; wątek z samymi naszymi mailami; wielu odbiorców |
| `naglowki.ts` | nagłówki zakodowane RFC 2047, `"Nazwisko, Imię" <a@b>`, brak tematu |
| `mime.ts` | polskie znaki w temacie i treści, `In-Reply-To`/`References`, załącznik binarny, stopka |
| `tresc.ts` | tylko tekst, tylko HTML, `multipart/alternative`, załącznik zagnieżdżony |
| `szyfr.ts` | szyfr → odszyfr; zmieniony bajt → błąd; inny klucz → błąd |
| `google.ts` | odświeżenie tokenu, `invalid_grant` → rozłączona, 404 historii |
| `push.ts` | dobry token; zły `aud`; obce konto; brak nagłówka |
| `synchronizacja.ts` | scalanie (druga synchronizacja w trakcie dzierżawy kończy się od razu); 404 historii → przegląd 30 dni; import: starsze niż 30 dni jako Załatwione |
| trasy | 401/403; 409 bez połączenia; odpowiedź > 4 MB → 413; oauth z innym kontem → odmowa; cron bez sekretu → 401 |
| komponenty | kafelek (połączona, rozłączona, alarm); zakładki i liczniki; widok sprawy; okno odpowiedzi (błąd wysyłki zostawia tekst); Do przejrzenia; import z postępem |
| kontekst | sekcja `skrzynka` bez treści |

## 13. Ryzyka

| Ryzyko | Co z tym robimy |
|---|---|
| Ktoś połączy złą skrzynkę | Oauth odrzuca adres inny niż `DECK_OWNER_EMAIL` |
| Wyciek bazy | Token zaszyfrowany kluczem spoza Firestore |
| Fałszywe powiadomienia push | Weryfikacja OIDC: podpis, odbiorca, konto |
| Zgubione powiadomienia, wygasły watch | Dociągnięcie przy wejściu + codzienny cron |
| Złośliwy HTML w mailu | `iframe sandbox` bez skryptów, bez zewnętrznych obrazków |
| Odwołany dostęp / zmiana hasła kontakt@ | Stan „rozłączona”, dane zostają, ponowne połączenie dociąga zmiany |
| Treść maili w Gemini | Tylko po kliknięciu, jeden wątek. W EOG darmowy poziom Gemini podlega warunkom przetwarzania jak płatny (bez użycia treści do ulepszania modeli), ale treść i tak wychodzi poza skrzynkę - stąd decyzja B (§2) |
| Limit 4,5 MB żądania Vercela | Załączniki łącznie ≤ 4 MB, sprawdzane w przeglądarce i na serwerze |
| Kategorie Gmaila wyłączone w Workspace | Zapasowo `List-Unsubscribe` i `Precedence: bulk` |
| Koniec kadencji | „Rozłącz i usuń dane”; dostęp przechodzi z kontakt@ na nową osobę bez zmian w kodzie |

## 14. Kolejność wdrożenia

Spec jest jeden, planów wdrożenia będzie trzy, każdy kończy się działającą częścią:
1. **Połączenie i synchronizacja:** szyfr, OAuth, Gmail API, push, cron, import, automat statusów, kontakty i organizacje w bazie, kafelek z licznikami.
2. **Panel:** lista, zakładki, widok sprawy, wysyłka z załącznikami, kontakty i organizacje, ustawienia.
3. **Asystent:** sekcja w obrazie projektu, obszar odprawy, „Streść” i „Szkic odpowiedzi”.

Moduł jest niezależny od panelu Strony; oba dodają kafelek w `DeckHub` i sekcję w `zbudujKontekst`, więc wdrażany drugi dopasowuje się do pierwszego.
