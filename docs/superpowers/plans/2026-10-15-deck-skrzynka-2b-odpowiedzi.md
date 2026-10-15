# D.E.C.K. - Skrzynka, część 2b: odpowiedzi, kontakty, organizacje i ustawienia - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** z widoku sprawy idzie odpowiedź z kontakt@ (tekst, załączniki do 4 MB, stopka), panel ma zakładki Kontakty i Organizacje z kartami, a Ustawienia pozwalają edytować stopkę, listy „zawsze pomijaj” i rozłączyć skrzynkę.

**Architektura:** `mime.ts` (czyste) wybiera adresata z wątku i składa mail RFC 2822; `google.ts` wysyła go uploadem multipart Gmaila w tym samym wątku, zatrzymuje obserwację i odwołuje token. `synchronizacja.ts` łączy to w `wyslijOdpowiedz` (po wysyłce od razu automat statusów) i `rozlaczSkrzynke`. Kontakty i organizacje czytane są zapytaniami po jednym polu (bez indeksów złożonych); karta osoby i organizacji to zapytanie równościowe po `kontakt` / `organizacja`. Panel dostaje okno odpowiedzi pod wątkiem, dwie kartoteki i ustawienia.

**Stack:** Next.js 16, React 19, Firestore Admin SDK, Gmail API v1, Vitest 4 + Testing Library.

**Spec:** [docs/superpowers/specs/2026-10-13-deck-skrzynka-crm-design.md](../specs/2026-10-13-deck-skrzynka-crm-design.md) - reszta części 2 z §14. Część 3 (asystent: „Streść”, „Szkic odpowiedzi”, sekcja w odprawie) to osobny plan.

**Szkic sprawdzony przed napisaniem planu:** kod z planu był uruchomiony w całości (833 testy, tsc, lint, build) - przenoś go dokładnie.

## Zasady wspólne

- Po polsku; tylko „-”, nigdy długie myślniki. Commit po `npx vitest run <pliki> > "$TMP/vt.log" 2>&1; echo $?` = 0, stopka `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Gałąź `deck-skrzynka-2b`; użytkownik każe scalać do `main` i wypychać od razu (`ssuew-it/ssuew-analytics`, Vercel `dzial-it-samorzadu` buduje z `main`).
- Trasy: 401 bez sesji, 403 zarząd z „Skrzynka jest tylko dla właściciela” (`TYLKO_WLASCICIEL`).
- Kokpit nigdy nie pyta Gmaila. Treść maili i odpowiedzi nigdzie nie jest kopiowana ani logowana.
- Załączniki odpowiedzi łącznie do 4 MB (`MAKS_ZALACZNIKOW`), sprawdzane w przeglądarce i na serwerze; ponad limit - 413.
- Nadawca odpowiedzi: `Samorząd Studentów UEW <DECK_OWNER_EMAIL>`, temat i nazwy plików w RFC 2047 / RFC 5987.
- **Przenoszenie kodu:** pliki i fragmenty z `\r\n` w treści przenoś narzędziem Write/Edit, nie heredoc-iem w Bash - narzędzie Bash zamienia `\r\n` na prawdziwe znaki końca linii.
- **Vitest 4:** w nowych testach odrzucony mock to `mockRejectedValueOnce` - trwałe `mockRejectedValue` ustawione przed renderem bywa zgłaszane jako nieobsłużone odrzucenie i wywraca test.
- Każda zmiana w istniejącym pliku ma postać „Zamień: … na: …”; fragment „Zamień” występuje w pliku dokładnie raz. Zmiany w jednym pliku stosuj w podanej kolejności.

### Poprawki wobec specu (świadome)

1. **Karta osoby i organizacji po parametrze** (`/api/skrzynka/kontakty?email=`, `/api/skrzynka/organizacje?domena=`), nie w ścieżce - adres e-mail w segmencie ścieżki bywa różnie dekodowany.
2. **Filtr typu tylko w Organizacjach.** Kontakty idą alfabetycznie stronami po 100 bez filtra - filtr z sortowaniem wymagałby indeksu złożonego, do którego konsoli użytkownik nie trafia. Kontaktów się nie edytuje (spec: zmiana nazwy i typu dotyczy organizacji).
3. **Bez pól `watki` i `ostatniKontakt` (§6).** Karta liczy sprawy zapytaniem równościowym po `kontakt` albo `organizacja` (do 200, od najnowszej).
4. **Odpowiedź do Reply-To albo nadawcy ostatniej ich wiadomości, bez DW.** Okno pokazuje adresata, zanim się wyśle. Wątek tylko od nas - do pierwszego odbiorcy.
5. **Wysyłka uploadem multipart** (`/upload/.../messages/send?uploadType=multipart`) zamiast `raw` w JSON - pewniejsze przy załącznikach bliskich 4 MB.
6. **Zgoda bez `gmail.send` odrzucana przy połączeniu** (`?blad=brak-wysylki`); 403 „insufficient scopes” przy wysyłce daje komunikat zamiast ogólnego błędu (uwaga z przeglądu części 1).
7. **„Rozłącz” bez usuwania** zostawia sprawy, kontakty i organizacje, ale stan bez tokenu i bez punktu historii - ponowne połączenie robi import od nowa (zapis jest idempotentny, statusy zostają). „Rozłącz i usuń dane” zostawia ustawienia (stopka, pomijani).
8. **Zakładki Kontakty i Organizacje bez liczb** - liczenie to dodatkowe odczyty przy każdym wejściu.
9. **Ustawienia tylko przy połączonej skrzynce** - przycisk w pasku panelu; zastępuje listy, drugi klik wraca.
10. **Z przeglądu 2a w tym planie:** odpowiedzi błędów w `PATCH` sprawy (zadanie 11), `Referer` z linków w mailu (zadanie 11), lista nie gubi wczytanych spraw po błędzie „Pokaż więcej” (zadanie 7), osoba spoza Składu widoczna w „Przypisz” (zadanie 6). Poza planem zostają: okna wyścigu synchronizacji i uzupełniania kluczy, „Do odpowiedzi” ucinane do 300 bez informacji, metadane w logach Vercela, uwagi z części 1 o synchronizacji (powtórka po 3. rundzie, fałszywy alarm przy partii [nasz, ich], błąd odnowienia obserwacji w cronie).

## Na co uważać w przeglądzie

1. **Nowa linia w temacie wątku albo nazwie pliku** - nie dopisuje nagłówka (Bcc, Cc) do wysyłanego maila (test w zadaniu 1).
2. **Załączniki dokładnie 4 MB i 4 MB + 1 bajt** - pierwsze przechodzą, drugie blokuje okno i odrzuca serwer z 413 (testy w zadaniach 5 i 6).
3. **Błąd wysyłki (limit Gmaila, brak zgody, sieć)** - tekst i załączniki zostają w oknie; brak zgody ma własny komunikat (testy w zadaniach 2, 5 i 6).
4. **Formularz z Reply-To innym niż From** - odpowiedź idzie do Reply-To, a okno pokazuje ten adres (testy w zadaniach 1 i 5).
5. **„Rozłącz” bez usuwania, potem ponowne połączenie** - panel i kafelek pokazują „Połącz skrzynkę”, sprawy zostają, a domena gmail.com nie trafi na listę pomijanych także przez Ustawienia (testy w zadaniach 3 i 5; połączenie ponowne - ręcznie na produkcji).

---

## Mapa plików

| Plik | Odpowiedzialność | Zadanie |
|---|---|---|
| `lib/skrzynka/mime.ts` | adresat i nagłówki odpowiedzi z wątku; składanie maila | 1 |
| `lib/skrzynka/google.ts` | `wyslij`, `watekDoOdpowiedzi`, `zatrzymaj`, `odwolajToken`, zakresy zgody, `brak-zgody` | 2 |
| `lib/skrzynka/typy.ts`, `lib/skrzynka/dane.ts` | ustawienia, kontakty, organizacje, rozłączenie w Firestore | 3 |
| `lib/skrzynka/synchronizacja.ts` | `wyslijOdpowiedz`, `rozlaczSkrzynke`, zgoda bez wysyłki | 4 |
| `lib/skrzynka/zmiana.ts`, `app/api/skrzynka/**` | walidacja; trasy odpowiedzi, rozłączenia, ustawień, kontaktów, organizacji; adresat i stopka w sprawie | 5 |
| `lib/skrzynka/klient.ts`, `components/skrzynka/OknoOdpowiedzi.tsx`, `WidokSprawy.tsx` | okno odpowiedzi w widoku sprawy | 6 |
| `components/skrzynka/WierszSprawy.tsx`, `ListaSpraw.tsx` | wspólny wiersz sprawy; szybkie akcje Do przejrzenia | 7 |
| `components/skrzynka/Kontakty.tsx`, `Organizacje.tsx`, `lib/skrzynka/widok.ts` | kartoteki | 8 |
| `components/skrzynka/UstawieniaSkrzynki.tsx` | stopka, pomijani, „Rozłącz” | 9 |
| `components/skrzynka/PanelSkrzynki.tsx` | zakładki kartotek, przycisk Ustawienia, komunikat zgody | 10 |
| `app/api/skrzynka/sprawy/[id]/route.ts`, `lib/skrzynka/html.ts` | poprawki z przeglądu 2a | 11 |
| `README.md` | opis | 12 |

---

## Zadanie 1: Adresat odpowiedzi i składanie maila

**Pliki:** nowe `lib/skrzynka/mime.ts`, `lib/skrzynka/mime.test.ts`

**Interfejsy:**
- Korzysta z: `dekodujNaglowek`, `odczytajAdresy`, `WatekApi` (`./naglowki`, część 1).
- Daje: `Odpowiedz { do; temat; inReplyTo; references }`, `PlikWysylki { nazwa; typ; dane: Uint8Array }`, `MailWysylany`, `przygotujOdpowiedz(w: WatekApi, nasz): Odpowiedz | null`, `slowoNaglowka(s)`, `zbudujMail(m, granica?): string`.

- [ ] **Krok 1: Testy**

`lib/skrzynka/mime.test.ts` (nowy plik):

```ts
// @vitest-environment node
// Buffer i TextDecoder - jak na serwerze.
import { describe, it, expect } from 'vitest'
import { przygotujOdpowiedz, slowoNaglowka, zbudujMail, type MailWysylany } from '@/lib/skrzynka/mime'
import { dekodujNaglowek, type WatekApi } from '@/lib/skrzynka/naglowki'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'

function watek(wiadomosci: { kiedy: number; naglowki: Record<string, string>; etykiety?: string[] }[]): WatekApi {
  return {
    id: 't1',
    messages: wiadomosci.map((w, i) => ({
      id: `m${i}`,
      internalDate: String(w.kiedy),
      labelIds: w.etykiety ?? ['INBOX'],
      payload: { headers: Object.entries(w.naglowki).map(([name, value]) => ({ name, value })) },
    })),
  }
}

describe('przygotujOdpowiedz', () => {
  it('do nadawcy ostatniej ich wiadomości; Re: raz; References z całym łańcuchem', () => {
    const o = przygotujOdpowiedz(watek([
      { kiedy: 100, naglowki: { From: 'Anna <anna@firma.pl>', To: NASZ, Subject: 'Sponsoring Juwenaliów', 'Message-ID': '<a1@firma.pl>' } },
      { kiedy: 200, naglowki: { From: NASZ, To: 'anna@firma.pl', Subject: 'Re: Sponsoring Juwenaliów', 'Message-ID': '<m2@samorzad>', References: '<a1@firma.pl>' } },
      { kiedy: 300, naglowki: { From: 'Jan <jan@firma.pl>', To: NASZ, Subject: 'Re: Sponsoring Juwenaliów', 'Message-Id': '<j3@firma.pl>', References: '<a1@firma.pl> <m2@samorzad>' } },
    ]), NASZ)
    expect(o).toEqual({
      do: 'jan@firma.pl',
      temat: 'Re: Sponsoring Juwenaliów',
      inReplyTo: '<j3@firma.pl>',
      references: '<a1@firma.pl> <m2@samorzad> <j3@firma.pl>',
    })
  })

  it('Reply-To ma pierwszeństwo przed From', () => {
    const o = przygotujOdpowiedz(watek([
      { kiedy: 1, naglowki: { From: 'formularz@strona.pl', 'Reply-To': 'Ola <ola@gmail.com>', To: NASZ, Subject: 'Pytanie', 'Message-ID': '<f1@strona.pl>' } },
    ]), NASZ)
    expect(o).toMatchObject({ do: 'ola@gmail.com', temat: 'Re: Pytanie', inReplyTo: '<f1@strona.pl>', references: '<f1@strona.pl>' })
  })

  it('wątek tylko od nas - do pierwszego odbiorcy; szkice pominięte; bez Message-ID nagłówki puste', () => {
    const o = przygotujOdpowiedz(watek([
      { kiedy: 1, naglowki: { From: NASZ, To: 'rektor@ue.wroc.pl, kontakt@samorzad.ue.wroc.pl', Subject: 'Re: Spotkanie' } },
      { kiedy: 2, naglowki: { From: 'ktos@x.pl', To: NASZ, Subject: 'szkic' }, etykiety: ['DRAFT'] },
    ]), NASZ)
    expect(o).toEqual({ do: 'rektor@ue.wroc.pl', temat: 'Re: Spotkanie', inReplyTo: null, references: null })
  })

  it('nie ma do kogo - null', () => {
    expect(przygotujOdpowiedz(watek([{ kiedy: 1, naglowki: { From: NASZ, To: NASZ, Subject: 'notatka' } }]), NASZ)).toBeNull()
    expect(przygotujOdpowiedz({ id: 't1' }, NASZ)).toBeNull()
  })
})

const MAIL: MailWysylany = {
  od: NASZ,
  nazwaOd: 'Samorząd Studentów UEW',
  do: 'anna@firma.pl',
  temat: 'Re: Współpraca przy Juwenaliach 2026 - oferta sponsorska dla firmy',
  tekst: 'Dzień dobry,\ndziękujemy za ofertę.',
  stopka: '-- \nSamorząd Studentów UEW',
  inReplyTo: '<a1@firma.pl>',
  references: '<a1@firma.pl>',
  pliki: [],
}

/** Nagłówki do pierwszej pustej linii; zawinięte linie sklejone. */
const naglowki = (raw: string) => raw.split('\r\n\r\n')[0].replace(/\r\n /g, ' ').split('\r\n')
const zBase64 = (s: string) => Buffer.from(s.replace(/\r\n/g, ''), 'base64')

describe('zbudujMail', () => {
  it('sam tekst: nadawca i temat w RFC 2047, wątek, treść UTF-8 ze stopką i CRLF', () => {
    const raw = zbudujMail(MAIL)
    const n = naglowki(raw)
    expect(n).toContain('To: anna@firma.pl')
    expect(n).toContain('In-Reply-To: <a1@firma.pl>')
    expect(n).toContain('References: <a1@firma.pl>')
    expect(n).toContain('MIME-Version: 1.0')
    expect(n).toContain('Content-Type: text/plain; charset=UTF-8')
    expect(dekodujNaglowek(n.find((l) => l.startsWith('From: '))!.slice(6))).toBe('Samorząd Studentów UEW <kontakt@samorzad.ue.wroc.pl>')
    expect(dekodujNaglowek(n.find((l) => l.startsWith('Subject: '))!.slice(9))).toBe(MAIL.temat)
    expect(raw.split('\r\n\r\n')[1].split('\r\n').every((l) => l.length <= 76)).toBe(true)
    expect(zBase64(raw.split('\r\n\r\n')[1]).toString('utf8')).toBe('Dzień dobry,\r\ndziękujemy za ofertę.\r\n\r\n-- \r\nSamorząd Studentów UEW')
  })

  it('nowa linia w temacie albo adresie nie dopisze nagłówka', () => {
    const n = naglowki(zbudujMail({ ...MAIL, temat: 'Hej\r\nBcc: wszyscy@x.pl', do: 'anna@firma.pl\nCc: b@x.pl', inReplyTo: null, references: null }))
    expect(n.some((l) => /^(Bcc|Cc):/i.test(l))).toBe(false)
    expect(n).toContain('Subject: Hej Bcc: wszyscy@x.pl')
    expect(n.some((l) => l.startsWith('In-Reply-To'))).toBe(false)
  })

  it('załączniki: multipart/mixed, bajty bez zmian, polska nazwa w filename*, bezpieczny typ', () => {
    const bajty = Uint8Array.from([0, 255, 1, 128, 10, 13])
    const raw = zbudujMail(
      {
        ...MAIL,
        stopka: '',
        pliki: [
          { nazwa: 'Umowa „Sponsor” O\'Neil.pdf', typ: 'application/pdf', dane: bajty },
          { nazwa: 'x.bin', typ: 'zły typ\r\nX: y', dane: Uint8Array.from([1]) },
        ],
      },
      'GRANICA',
    )
    expect(naglowki(raw)).toContain('Content-Type: multipart/mixed; boundary="GRANICA"')
    const czesci = raw.split('--GRANICA')
    expect(czesci).toHaveLength(5)
    expect(czesci[4]).toBe('--\r\n')
    expect(zBase64(czesci[1].split('\r\n\r\n')[1]).toString('utf8')).toBe('Dzień dobry,\r\ndziękujemy za ofertę.')
    const [n1, c1] = czesci[2].split('\r\n\r\n')
    expect(n1).toContain('Content-Type: application/pdf; name="Umowa _Sponsor_ O\'Neil.pdf"')
    expect(n1).toContain(`filename*=UTF-8''Umowa%20%E2%80%9ESponsor%E2%80%9D%20O%27Neil.pdf`)
    expect([...zBase64(c1)]).toEqual([...bajty])
    expect(czesci[3]).toContain('Content-Type: application/octet-stream; name="x.bin"')
  })

  it('czysty ASCII bez kodowania; długi polski temat w kilku słowach po 75 znaków', () => {
    expect(slowoNaglowka('Re: Spotkanie')).toBe('Re: Spotkanie')
    const s = slowoNaglowka('Zażółć gęślą jaźń 🎉 '.repeat(5))
    const slowa = s.split('\r\n ')
    expect(slowa.length).toBeGreaterThan(1)
    expect(slowa.every((w) => w.length <= 75)).toBe(true)
    expect(dekodujNaglowek(s)).toBe('Zażółć gęślą jaźń 🎉 '.repeat(5))
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/mime.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak modułu `mime`).

- [ ] **Krok 3: Implementacja**

`lib/skrzynka/mime.ts` (nowy plik):

```ts
import { dekodujNaglowek, odczytajAdresy, type WatekApi } from './naglowki'

/** Do kogo i z jakimi nagłówkami idzie odpowiedź w wątku. */
export interface Odpowiedz {
  do: string
  temat: string
  inReplyTo: string | null
  references: string | null
}

export interface PlikWysylki {
  nazwa: string
  typ: string
  dane: Uint8Array
}

export interface MailWysylany {
  od: string
  nazwaOd: string
  do: string
  temat: string
  tekst: string
  stopka: string
  inReplyTo: string | null
  references: string | null
  pliki: PlikWysylki[]
}

const POMIJANE_ETYKIETY = ['DRAFT', 'SPAM', 'TRASH']
const CRLF = '\r\n'
const TYP = /^[\w.+-]+\/[\w.+-]+$/

type WiadomoscApi = NonNullable<WatekApi['messages']>[number]

const naglowek = (m: WiadomoscApi, nazwa: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === nazwa.toLowerCase())?.value ?? ''

/**
 * Odpowiedź trafia do Reply-To (formularze i listy mailingowe go ustawiają),
 * a bez niego do nadawcy ostatniej ich wiadomości. Gdy w wątku piszemy tylko
 * my - do pierwszego odbiorcy. `null` - nie ma do kogo odpowiedzieć.
 */
export function przygotujOdpowiedz(w: WatekApi, nasz: string): Odpowiedz | null {
  const n = nasz.toLowerCase()
  const ws = (w.messages ?? [])
    .filter((m) => !(m.labelIds ?? []).some((e) => POMIJANE_ETYKIETY.includes(e)))
    .sort((a, b) => Number(a.internalDate) - Number(b.internalDate))
  if (!ws.length) return null
  const obcy = (naglowekAdresow: string) => odczytajAdresy(naglowekAdresow).find((a) => a.email !== n)?.email ?? null
  const ich = [...ws].reverse().find((m) => odczytajAdresy(naglowek(m, 'From'))[0]?.email !== n)
  const adresat = (ich && (obcy(naglowek(ich, 'Reply-To')) ?? obcy(naglowek(ich, 'From')))) ?? obcy(naglowek(ws[0], 'To'))
  if (!adresat) return null
  const ostatnia = ws[ws.length - 1]
  const id = naglowek(ostatnia, 'Message-ID').trim()
  const temat = dekodujNaglowek(naglowek(ws[0], 'Subject')).trim()
  return {
    do: adresat,
    temat: /^re:/i.test(temat) ? temat : `Re: ${temat}`.trim(),
    inReplyTo: id || null,
    references: [naglowek(ostatnia, 'References').trim(), id].filter(Boolean).join(' ') || null,
  }
}

/** Znak nowej linii w nagłówku dopisałby własny nagłówek (np. Bcc) - zamieniamy go na spację. */
const bezLinii = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()
const utf8 = (s: string) => new TextEncoder().encode(s)
const base64 = (b: Uint8Array) => Buffer.from(b).toString('base64')
const linie76 = (s: string) => s.match(/.{1,76}/g)?.join(CRLF) ?? ''
/** RFC 5987: `encodeURIComponent` zostawia ' ( ) *, a w `filename*` muszą być zakodowane. */
const rfc5987 = (s: string) => encodeURIComponent(s).replace(/['()*]/g, (z) => `%${z.charCodeAt(0).toString(16).toUpperCase()}`)

/** Nagłówek z polskimi znakami jako słowa RFC 2047, każde do 75 znaków; czysty ASCII bez zmian. */
export function slowoNaglowka(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return s
  const kawalki: string[] = []
  let biezacy = ''
  // Po punktach kodowych, nie po jednostkach UTF-16 - emoji nie rozpada się na dwa słowa.
  for (const z of s) {
    if (biezacy && utf8(biezacy + z).length > 45) {
      kawalki.push(biezacy)
      biezacy = ''
    }
    biezacy += z
  }
  if (biezacy) kawalki.push(biezacy)
  return kawalki.map((k) => `=?UTF-8?B?${base64(utf8(k))}?=`).join(`${CRLF} `)
}

/** Mail do `messages.send`: tekst UTF-8 ze stopką, załączniki w `multipart/mixed`, wszystko base64. */
export function zbudujMail(m: MailWysylany, granica = `deck-${crypto.randomUUID()}`): string {
  const tekst = (m.stopka ? `${m.tekst.trimEnd()}\n\n${m.stopka}` : m.tekst).replace(/\r?\n/g, CRLF)
  const czescTekstu = ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', linie76(base64(utf8(tekst)))]
  const naglowki = [
    `From: ${slowoNaglowka(bezLinii(m.nazwaOd))} <${bezLinii(m.od)}>`,
    `To: ${bezLinii(m.do)}`,
    `Subject: ${slowoNaglowka(bezLinii(m.temat))}`,
    ...(m.inReplyTo ? [`In-Reply-To: ${bezLinii(m.inReplyTo)}`] : []),
    ...(m.references ? [`References: ${bezLinii(m.references)}`] : []),
    'MIME-Version: 1.0',
  ]
  if (!m.pliki.length) return [...naglowki, ...czescTekstu].join(CRLF)
  const pliki = m.pliki.flatMap((p) => {
    const nazwa = bezLinii(p.nazwa) || 'zalacznik'
    const ascii = nazwa.replace(/[^\x20-\x7e]|["\\]/g, '_')
    return [
      `--${granica}`,
      `Content-Type: ${TYP.test(p.typ) ? p.typ : 'application/octet-stream'}; name="${ascii}"`,
      `Content-Disposition: attachment; filename="${ascii}"; filename*=UTF-8''${rfc5987(nazwa)}`,
      'Content-Transfer-Encoding: base64',
      '',
      linie76(base64(p.dane)),
    ]
  })
  return [
    ...naglowki,
    `Content-Type: multipart/mixed; boundary="${granica}"`,
    '',
    `--${granica}`,
    ...czescTekstu,
    ...pliki,
    `--${granica}--`,
    '',
  ].join(CRLF)
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka/mime.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/skrzynka/mime.test.ts lib/skrzynka/mime.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): adresat odpowiedzi z watku i skladanie maila MIME

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 2: Gmail: wysyłka, zatrzymanie, odwołanie tokenu, zakresy zgody

**Pliki:** zmiana `lib/skrzynka/google.ts`, `lib/skrzynka/google.test.ts`

**Interfejsy:**
- Korzysta z: `wywolaj`, `token`, `BladSkrzynki` (część 1).
- Daje: `ZAKRES_WYSYLKI`; `RodzajBledu` z `'brak-zgody'` (403) i `'brak-adresata'` (400) w `komunikatBledu`; `wymienKod` zwraca też `zakresy: string[]`; `odwolajToken(refreshToken): Promise<void>`; w `Gmail`: `watekDoOdpowiedzi(id): Promise<WatekApi>`, `wyslij(mime, watekId): Promise<{ id; threadId }>`, `zatrzymaj(): Promise<void>`.

- [ ] **Krok 1: Testy**

`lib/skrzynka/google.test.ts` - 3 zmiany:


1. Zamień:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BladSkrzynki, adresZgody, gmail, komunikatBledu, wymienKod } from '@/lib/skrzynka/google'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const fetchMock = vi.fn()
```

   na:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BladSkrzynki, adresZgody, gmail, komunikatBledu, odwolajToken, wymienKod } from '@/lib/skrzynka/google'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const fetchMock = vi.fn()
```


2. Zamień:

```ts
  })

  it('wymiana kodu zwraca refresh token; bez niego - błąd', async () => {
    fetchMock.mockResolvedValueOnce(odp(200, { access_token: 'a', refresh_token: 'r', expires_in: 3600 }))
    expect(await wymienKod('KOD')).toEqual({ refreshToken: 'r', dostep: 'a' })
    const cialo = new URLSearchParams(fetchMock.mock.calls[0][1].body)
    expect(Object.fromEntries(cialo)).toMatchObject({ grant_type: 'authorization_code', code: 'KOD', redirect_uri: 'https://ssuew-analytics.vercel.app/api/skrzynka/oauth' })
    fetchMock.mockResolvedValueOnce(odp(200, { access_token: 'a', expires_in: 3600 }))
```

   na:

```ts
  })

  it('wymiana kodu zwraca refresh token; bez niego - błąd', async () => {
    fetchMock.mockResolvedValueOnce(odp(200, { access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send' }))
    expect(await wymienKod('KOD')).toEqual({
      refreshToken: 'r', dostep: 'a', zakresy: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    })
    const cialo = new URLSearchParams(fetchMock.mock.calls[0][1].body)
    expect(Object.fromEntries(cialo)).toMatchObject({ grant_type: 'authorization_code', code: 'KOD', redirect_uri: 'https://ssuew-analytics.vercel.app/api/skrzynka/oauth' })
    fetchMock.mockResolvedValueOnce(odp(200, { access_token: 'a', expires_in: 3600 }))
```


3. Zamień:

```ts
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/m1/attachments/A%2FB')
  })

  it('komunikaty błędów dla tras', () => {
    expect(komunikatBledu(new BladSkrzynki('limit', 'x'))).toEqual({ status: 429, error: 'Gmail chwilowo ogranicza tempo - spróbuję ponownie za minutę.' })
    expect(komunikatBledu(new BladSkrzynki('rozlaczona', 'x'))).toEqual({ status: 409, error: 'Skrzynka jest rozłączona - połącz ją ponownie.' })
    expect(komunikatBledu(new BladSkrzynki('konfiguracja', 'x')).status).toBe(500)
    expect(komunikatBledu(new Error('?')).status).toBe(502)
  })
})
```

   na:

```ts
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/m1/attachments/A%2FB')
  })

  it('odpowiedź: nagłówki wątku do odpowiedzi, wysyłka przez upload z wątkiem, zatrzymanie obserwacji', async () => {
    google((url) => (url.includes('/stop') ? new Response(null, { status: 204 }) : odp(200, { id: 'w1', threadId: 't1' })))
    const g = gmail('r', 'd')
    await g.watekDoOdpowiedzi('t1')
    const u = new URL(fetchMock.mock.calls.at(-1)![0])
    expect(u.searchParams.getAll('metadataHeaders')).toEqual(['From', 'To', 'Reply-To', 'Subject', 'Message-ID', 'References'])
    expect(await g.wyslij('From: kontakt@x\r\n\r\nTreść', 't1')).toEqual({ id: 'w1', threadId: 't1' })
    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(url).toBe('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('multipart/related; boundary=deck_wysylka_granica')
    expect(init.body).toBe(
      '--deck_wysylka_granica\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"threadId":"t1"}\r\n' +
        '--deck_wysylka_granica\r\nContent-Type: message/rfc822\r\n\r\nFrom: kontakt@x\r\n\r\nTreść\r\n--deck_wysylka_granica--',
    )
    await g.zatrzymaj()
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/stop')
  })

  it('brak zgody na wysyłkę (403 insufficient scopes) - osobny rodzaj błędu', async () => {
    google(() => odp(403, { error: { message: 'Request had insufficient authentication scopes.' } }))
    await expect(gmail('r', 'd').wyslij('x', 't1')).rejects.toMatchObject({ rodzaj: 'brak-zgody' })
  })

  it('odwołanie tokenu w Google; odmowa - błąd', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }))
    await odwolajToken('refresh-1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/revoke')
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({ token: 'refresh-1' })
    fetchMock.mockResolvedValueOnce(odp(400, { error: 'invalid_token' }))
    await expect(odwolajToken('x')).rejects.toBeInstanceOf(BladSkrzynki)
  })

  it('komunikaty błędów dla tras', () => {
    expect(komunikatBledu(new BladSkrzynki('limit', 'x'))).toEqual({ status: 429, error: 'Gmail chwilowo ogranicza tempo - spróbuję ponownie za minutę.' })
    expect(komunikatBledu(new BladSkrzynki('rozlaczona', 'x'))).toEqual({ status: 409, error: 'Skrzynka jest rozłączona - połącz ją ponownie.' })
    expect(komunikatBledu(new BladSkrzynki('konfiguracja', 'x')).status).toBe(500)
    expect(komunikatBledu(new BladSkrzynki('brak-zgody', 'x')).status).toBe(403)
    expect(komunikatBledu(new BladSkrzynki('brak-adresata', 'x')).status).toBe(400)
    expect(komunikatBledu(new Error('?')).status).toBe(502)
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/google.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak `odwolajToken`, `wyslij`, `zakresy`).

- [ ] **Krok 3: Implementacja**

`lib/skrzynka/google.ts` - 8 zmian:


1. Zamień:

```ts
import type { WatekApi } from './naglowki'
import type { WatekPelnyApi } from './tresc'

const ZAKRESY = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const NAGLOWKI_META = ['From', 'To', 'Cc', 'Subject', 'List-Unsubscribe', 'Precedence']
/** Przerwy przed kolejnymi próbami, gdy Gmail ogranicza tempo (limit liczony na minutę). */
const PRZERWY_MS = [1_000, 2_000, 4_000]
const MAKS_PRZERWA_MS = 10_000
```

   na:

```ts
import type { WatekApi } from './naglowki'
import type { WatekPelnyApi } from './tresc'

export const ZAKRES_WYSYLKI = 'https://www.googleapis.com/auth/gmail.send'
const ZAKRESY = ['https://www.googleapis.com/auth/gmail.readonly', ZAKRES_WYSYLKI]
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const WYSYLKA = 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart'
const ODWOLANIE = 'https://oauth2.googleapis.com/revoke'
const NAGLOWKI_META = ['From', 'To', 'Cc', 'Subject', 'List-Unsubscribe', 'Precedence']
const NAGLOWKI_ODPOWIEDZI = ['From', 'To', 'Reply-To', 'Subject', 'Message-ID', 'References']
/** Granica części żądania wysyłki - znaków `_` nie ma w base64, więc nie trafi się w treści maila. */
const GRANICA_WYSYLKI = 'deck_wysylka_granica'
/** Przerwy przed kolejnymi próbami, gdy Gmail ogranicza tempo (limit liczony na minutę). */
const PRZERWY_MS = [1_000, 2_000, 4_000]
const MAKS_PRZERWA_MS = 10_000
```


2. Zamień:

```ts
  status === 429 || (status === 403 && /rateLimitExceeded|userRateLimitExceeded|Quota exceeded|RESOURCE_EXHAUSTED/i.test(tresc))
const czekaj = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type RodzajBledu = 'rozlaczona' | 'historia-za-stara' | 'brak-watku' | 'limit' | 'konfiguracja' | 'inny'

export class BladSkrzynki extends Error {
  readonly rodzaj: RodzajBledu
```

   na:

```ts
  status === 429 || (status === 403 && /rateLimitExceeded|userRateLimitExceeded|Quota exceeded|RESOURCE_EXHAUSTED/i.test(tresc))
const czekaj = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type RodzajBledu =
  | 'rozlaczona' | 'historia-za-stara' | 'brak-watku' | 'limit' | 'konfiguracja' | 'brak-zgody' | 'brak-adresata' | 'inny'

export class BladSkrzynki extends Error {
  readonly rodzaj: RodzajBledu
```


3. Zamień:

```ts
  if (e instanceof BladSkrzynki && e.rodzaj === 'rozlaczona') return { status: 409, error: 'Skrzynka jest rozłączona - połącz ją ponownie.' }
  if (e instanceof BladSkrzynki && e.rodzaj === 'konfiguracja') return { status: 500, error: 'Skrzynka nie jest skonfigurowana na serwerze.' }
  if (e instanceof BladSkrzynki && e.rodzaj === 'limit') return { status: 429, error: 'Gmail chwilowo ogranicza tempo - spróbuję ponownie za minutę.' }
  console.error('[skrzynka]', e)
  return { status: 502, error: 'Gmail nie odpowiedział - spróbuj ponownie.' }
}
```

   na:

```ts
  if (e instanceof BladSkrzynki && e.rodzaj === 'rozlaczona') return { status: 409, error: 'Skrzynka jest rozłączona - połącz ją ponownie.' }
  if (e instanceof BladSkrzynki && e.rodzaj === 'konfiguracja') return { status: 500, error: 'Skrzynka nie jest skonfigurowana na serwerze.' }
  if (e instanceof BladSkrzynki && e.rodzaj === 'limit') return { status: 429, error: 'Gmail chwilowo ogranicza tempo - spróbuję ponownie za minutę.' }
  if (e instanceof BladSkrzynki && e.rodzaj === 'brak-zgody') {
    return { status: 403, error: 'Skrzynka nie ma zgody na wysyłkę - w Ustawieniach rozłącz ją i połącz ponownie, zaznaczając wszystkie uprawnienia.' }
  }
  if (e instanceof BladSkrzynki && e.rodzaj === 'brak-adresata') return { status: 400, error: 'W tym wątku nie ma do kogo odpowiedzieć - napisz z Gmaila.' }
  console.error('[skrzynka]', e)
  return { status: 502, error: 'Gmail nie odpowiedział - spróbuj ponownie.' }
}
```


4. Zamień:

```ts
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

async function token(cialo: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
```

   na:

```ts
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

async function token(cialo: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
```


5. Zamień:

```ts
  return d
}

export async function wymienKod(kod: string): Promise<{ refreshToken: string; dostep: string }> {
  const k = konfiguracja()
  const d = await token({ grant_type: 'authorization_code', code: kod, client_id: k.id, client_secret: k.sekret, redirect_uri: k.przekierowanie })
  if (!d.refresh_token) throw new BladSkrzynki('inny', 'Google nie zwrócił refresh tokenu')
  return { refreshToken: d.refresh_token, dostep: d.access_token }
}

export interface Gmail {
  profil(): Promise<{ emailAddress: string; historyId: string }>
  watek(id: string): Promise<WatekApi>
  watekPelny(id: string): Promise<WatekPelnyApi>
  zalacznik(wiadomoscId: string, id: string): Promise<{ data: string; size: number }>
  listaWatkow(zapytanie: string, strona: string | null): Promise<{ threads?: { id: string }[]; nextPageToken?: string; resultSizeEstimate?: number }>
  historia(od: string, strona: string | null): Promise<{
```

   na:

```ts
  return d
}

export async function wymienKod(kod: string): Promise<{ refreshToken: string; dostep: string; zakresy: string[] }> {
  const k = konfiguracja()
  const d = await token({ grant_type: 'authorization_code', code: kod, client_id: k.id, client_secret: k.sekret, redirect_uri: k.przekierowanie })
  if (!d.refresh_token) throw new BladSkrzynki('inny', 'Google nie zwrócił refresh tokenu')
  // Ekran zgody pozwala odznaczyć część uprawnień - `scope` mówi, co Google naprawdę dał.
  return { refreshToken: d.refresh_token, dostep: d.access_token, zakresy: String(d.scope ?? '').split(' ').filter(Boolean) }
}

/** „Rozłącz”: unieważnia refresh token w Google - D.E.C.K. traci dostęp do skrzynki. */
export async function odwolajToken(refreshToken: string): Promise<void> {
  const res = await fetch(ODWOLANIE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
    cache: 'no-store',
  })
  if (!res.ok) throw new BladSkrzynki('inny', `Odwołanie tokenu ${res.status}`)
}

export interface Gmail {
  profil(): Promise<{ emailAddress: string; historyId: string }>
  watek(id: string): Promise<WatekApi>
  watekPelny(id: string): Promise<WatekPelnyApi>
  watekDoOdpowiedzi(id: string): Promise<WatekApi>
  wyslij(mime: string, watekId: string): Promise<{ id: string; threadId: string }>
  zatrzymaj(): Promise<void>
  zalacznik(wiadomoscId: string, id: string): Promise<{ data: string; size: number }>
  listaWatkow(zapytanie: string, strona: string | null): Promise<{ threads?: { id: string }[]; nextPageToken?: string; resultSizeEstimate?: number }>
  historia(od: string, strona: string | null): Promise<{
```


6. Zamień:

```ts
    return biezacy.wartosc
  }

  async function wywolaj<T>(sciezka: string, cialo?: unknown): Promise<T> {
    for (let proba = 0; ; proba++) {
      const naglowki: Record<string, string> = { Authorization: `Bearer ${await tokenDostepu()}` }
      if (cialo !== undefined) naglowki['Content-Type'] = 'application/json'
      const res = await fetch(`${GMAIL}${sciezka}`, {
        method: cialo === undefined ? 'GET' : 'POST',
        headers: naglowki,
        body: cialo === undefined ? undefined : JSON.stringify(cialo),
        cache: 'no-store',
      })
      if (res.ok) return res.json() as Promise<T>
      const tresc = await res.text().catch(() => '')
      if (czyLimit(res.status, tresc)) {
        if (proba >= PRZERWY_MS.length) throw new BladSkrzynki('limit', `Gmail ${res.status}: ${tresc.slice(0, 300)}`)
```

   na:

```ts
    return biezacy.wartosc
  }

  /** `surowe` - pełny adres i typ ciała (wysyłka idzie przez adres uploadu, nie JSON). */
  async function wywolaj<T>(sciezka: string, cialo?: unknown, surowe?: { adres: string; typ: string }): Promise<T> {
    for (let proba = 0; ; proba++) {
      const naglowki: Record<string, string> = { Authorization: `Bearer ${await tokenDostepu()}` }
      if (cialo !== undefined) naglowki['Content-Type'] = surowe?.typ ?? 'application/json'
      const res = await fetch(surowe?.adres ?? `${GMAIL}${sciezka}`, {
        method: cialo === undefined ? 'GET' : 'POST',
        headers: naglowki,
        body: cialo === undefined ? undefined : surowe ? String(cialo) : JSON.stringify(cialo),
        cache: 'no-store',
      })
      if (res.ok) {
        // `users.stop` odpowiada pustym ciałem.
        const t = await res.text()
        return (t ? JSON.parse(t) : {}) as T
      }
      const tresc = await res.text().catch(() => '')
      if (czyLimit(res.status, tresc)) {
        if (proba >= PRZERWY_MS.length) throw new BladSkrzynki('limit', `Gmail ${res.status}: ${tresc.slice(0, 300)}`)
```


7. Zamień:

```ts
        continue
      }
      if (res.status === 401) throw new BladSkrzynki('rozlaczona', `Gmail 401: ${tresc.slice(0, 200)}`)
      if (res.status === 404 && sciezka.startsWith('/history')) throw new BladSkrzynki('historia-za-stara', 'Punkt historii Gmaila jest za stary')
      if (res.status === 404) throw new BladSkrzynki('brak-watku', `Gmail 404: ${sciezka}`)
      throw new BladSkrzynki('inny', `Gmail ${res.status}: ${tresc.slice(0, 300)}`)
```

   na:

```ts
        continue
      }
      if (res.status === 401) throw new BladSkrzynki('rozlaczona', `Gmail 401: ${tresc.slice(0, 200)}`)
      if (res.status === 403 && /insufficient/i.test(tresc)) throw new BladSkrzynki('brak-zgody', `Gmail 403: ${tresc.slice(0, 200)}`)
      if (res.status === 404 && sciezka.startsWith('/history')) throw new BladSkrzynki('historia-za-stara', 'Punkt historii Gmaila jest za stary')
      if (res.status === 404) throw new BladSkrzynki('brak-watku', `Gmail 404: ${sciezka}`)
      throw new BladSkrzynki('inny', `Gmail ${res.status}: ${tresc.slice(0, 300)}`)
```


8. Zamień:

```ts
    profil: () => wywolaj('/profile'),
    watek: (id) => wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'metadata', metadataHeaders: NAGLOWKI_META })}`),
    watekPelny: (id) => wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'full' })}`),
    zalacznik: (wiadomoscId, id) =>
      wywolaj(`/messages/${encodeURIComponent(wiadomoscId)}/attachments/${encodeURIComponent(id)}`),
    listaWatkow: (zapytanie, strona) => wywolaj(`/threads?${parametry({ q: zapytanie, maxResults: '100', pageToken: strona })}`),
```

   na:

```ts
    profil: () => wywolaj('/profile'),
    watek: (id) => wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'metadata', metadataHeaders: NAGLOWKI_META })}`),
    watekPelny: (id) => wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'full' })}`),
    watekDoOdpowiedzi: (id) =>
      wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'metadata', metadataHeaders: NAGLOWKI_ODPOWIEDZI })}`),
    // Upload multipart: JSON z wątkiem i surowy mail - zwykłe `raw` w JSON ma niższy limit rozmiaru.
    wyslij: (mime, watekId) =>
      wywolaj(
        '/messages/send',
        [
          `--${GRANICA_WYSYLKI}`,
          'Content-Type: application/json; charset=UTF-8',
          '',
          JSON.stringify({ threadId: watekId }),
          `--${GRANICA_WYSYLKI}`,
          'Content-Type: message/rfc822',
          '',
          mime,
          `--${GRANICA_WYSYLKI}--`,
        ].join('\r\n'),
        { adres: WYSYLKA, typ: `multipart/related; boundary=${GRANICA_WYSYLKI}` },
      ),
    zatrzymaj: async () => {
      await wywolaj('/stop', {})
    },
    zalacznik: (wiadomoscId, id) =>
      wywolaj(`/messages/${encodeURIComponent(wiadomoscId)}/attachments/${encodeURIComponent(id)}`),
    listaWatkow: (zapytanie, strona) => wywolaj(`/threads?${parametry({ q: zapytanie, maxResults: '100', pageToken: strona })}`),
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/skrzynka/google.test.ts lib/skrzynka/google.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): wysylka przez Gmaila, odwolanie tokenu i sprawdzenie zgody na wysylke

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 3: Firestore: ustawienia, kontakty, organizacje, rozłączenie

**Pliki:** zmiana `lib/skrzynka/typy.ts`, `lib/skrzynka/dane.ts`, `lib/skrzynka/dane.test.ts`

**Interfejsy:**
- Korzysta z: `naSprawe`, `PARTIA`, `WERSJA_DANYCH`, `skrzynkaUstawieniaRef`, `kontaktyRef`, `organizacjeRef`, `sprawyRef`, `skrzynkaStanRef` (części 1 i 2a).
- Daje: w `typy.ts`: `MAKS_ZALACZNIKOW`, `UstawieniaSkrzynki`, `StronaKontaktow`, `KartaKontaktu`, `KartaOrganizacji`; w `dane.ts`: `DOMYSLNA_STOPKA`, `KONTAKTY_NA_STRONE`, `czytajUstawienia()`, `zapiszUstawienia(z)`, `listaKontaktow(po, ile?)`, `kartaKontaktu(email)`, `listaOrganizacji()`, `kartaOrganizacji(domena)`, `zmienOrganizacje(domena, z)`, `rozlaczStan()`, `usunDaneSkrzynki(): Promise<number>`.

- [ ] **Krok 1: Testy**

Baza w pamięci dostaje `delete` w partii i w dokumencie; nowe bloki testów na końcu pliku.

`lib/skrzynka/dane.test.ts` - 4 zmiany:


1. Zamień:

```ts
      return {
        set: (r: Ref, d: Dane, o?: { merge?: boolean }) => ops.push(() => zapisz(r.sciezka, d, o?.merge)),
        update: (r: Ref, d: Dane) => ops.push(() => zapisz(r.sciezka, d, true)),
        commit: async () => ops.forEach((f) => f()),
      }
    },
```

   na:

```ts
      return {
        set: (r: Ref, d: Dane, o?: { merge?: boolean }) => ops.push(() => zapisz(r.sciezka, d, o?.merge)),
        update: (r: Ref, d: Dane) => ops.push(() => zapisz(r.sciezka, d, true)),
        delete: (r: Ref) => ops.push(() => baza.delete(r.sciezka)),
        commit: async () => ops.forEach((f) => f()),
      }
    },
```


2. Zamień:

```ts
    firestore,
    get: async () => snap(sciezka),
    set: async (d: Dane, o?: { merge?: boolean }) => zapisz(sciezka, d, o?.merge),
  })
  const por = (a: unknown, b: unknown) => ((a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0)
  const spelnia = (v: unknown, op: string, w: unknown) => {
```

   na:

```ts
    firestore,
    get: async () => snap(sciezka),
    set: async (d: Dane, o?: { merge?: boolean }) => zapisz(sciezka, d, o?.merge),
    delete: async () => {
      baza.delete(sciezka)
    },
  })
  const por = (a: unknown, b: unknown) => ((a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0)
  const spelnia = (v: unknown, op: string, w: unknown) => {
```


3. Zamień:

```ts
vi.mock('@/lib/firebase/admin', () => admin)

import {
  czytajSprawe, czytajSprawy, czytajStan, dodajPomijanie, kluczListy, liczniki, listaSpraw, pomijane, skladZarzadu, uzupelnijKlucze, wezDzierzawe, zapiszStan, zapiszWynik, zmienSprawe, zwolnijDzierzawe,
} from '@/lib/skrzynka/dane'

const sprawa = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
```

   na:

```ts
vi.mock('@/lib/firebase/admin', () => admin)

import {
  DOMYSLNA_STOPKA, czytajSprawe, czytajSprawy, czytajStan, czytajUstawienia, dodajPomijanie, kartaKontaktu, kartaOrganizacji, kluczListy,
  liczniki, listaKontaktow, listaOrganizacji, listaSpraw, pomijane, rozlaczStan, skladZarzadu, usunDaneSkrzynki, uzupelnijKlucze,
  wezDzierzawe, zapiszStan, zapiszUstawienia, zapiszWynik, zmienOrganizacje, zmienSprawe, zwolnijDzierzawe,
} from '@/lib/skrzynka/dane'

const sprawa = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
```


4. Zamień:

```ts
    expect(baza.get('skrzynkaKontakty/anna@firma.pl')).toMatchObject({ imie: 'Anna' })
  })
})
```

   na:

```ts
    expect(baza.get('skrzynkaKontakty/anna@firma.pl')).toMatchObject({ imie: 'Anna' })
  })
})

describe('ustawienia', () => {
  it('bez dokumentu - domyślna stopka i puste listy; zapis scala z resztą', async () => {
    expect(await czytajUstawienia()).toEqual({ stopka: DOMYSLNA_STOPKA, pomijaneAdresy: [], pomijaneDomeny: [] })
    await dodajPomijanie('adres', 'a@x.pl')
    expect(await zapiszUstawienia({ stopka: 'Pozdrawiamy' })).toEqual({ stopka: 'Pozdrawiamy', pomijaneAdresy: ['a@x.pl'], pomijaneDomeny: [] })
    expect(await zapiszUstawienia({ pomijaneAdresy: [] })).toEqual({ stopka: 'Pozdrawiamy', pomijaneAdresy: [], pomijaneDomeny: [] })
  })
})

describe('kontakty i organizacje', () => {
  const kiedy = (k: number) => ({ ostatnia: { kiedy: k, kierunek: 'oni' as const, fragment: '' } })
  const wypelnij = () =>
    zapiszWynik({
      sprawy: [
        sprawa('t1', { kontakt: 'anna@firma.pl', ...kiedy(100) }),
        sprawa('t2', { kontakt: 'anna@firma.pl', ...kiedy(300) }),
        sprawa('t3', { kontakt: 'jan@firma.pl', ...kiedy(200) }),
        sprawa('t4', { kontakt: 'ola@gmail.com', organizacja: null, ...kiedy(400) }),
      ],
      kontakty: [
        { email: 'jan@firma.pl', imie: 'Jan', organizacja: 'firma.pl', typ: null },
        { email: 'anna@firma.pl', imie: 'Anna', organizacja: 'firma.pl', typ: null },
        { email: 'ola@gmail.com', imie: '', organizacja: null, typ: null },
      ],
      organizacje: [
        { domena: 'ue.wroc.pl', nazwa: 'Uniwersytet Ekonomiczny', typ: 'uczelnia' },
        { domena: 'firma.pl', nazwa: 'firma.pl', typ: 'inne' },
      ],
    })

  it('kontakty alfabetycznie po adresie, stronami', async () => {
    await wypelnij()
    const s1 = await listaKontaktow(null, 2)
    expect(s1.kontakty.map((k) => k.email)).toEqual(['anna@firma.pl', 'jan@firma.pl'])
    expect(s1.nastepna).toBe('jan@firma.pl')
    expect(await listaKontaktow(s1.nastepna, 2)).toEqual({ kontakty: [{ email: 'ola@gmail.com', imie: '', organizacja: null, typ: null }], nastepna: null })
  })

  it('karta osoby: sprawy od najnowszej; nieznana osoba - null', async () => {
    await wypelnij()
    const k = await kartaKontaktu('anna@firma.pl')
    expect(k?.kontakt).toEqual({ email: 'anna@firma.pl', imie: 'Anna', organizacja: 'firma.pl', typ: null })
    expect(k?.sprawy.map((s) => s.id)).toEqual(['t2', 't1'])
    expect(await kartaKontaktu('brak@x.pl')).toBeNull()
  })

  it('organizacje po polsku alfabetycznie; karta z osobami i sprawami; zmiana nazwy i typu', async () => {
    await wypelnij()
    expect((await listaOrganizacji()).map((o) => o.nazwa)).toEqual(['firma.pl', 'Uniwersytet Ekonomiczny'])
    const k = await kartaOrganizacji('firma.pl')
    expect(k?.kontakty.map((x) => x.email)).toEqual(['anna@firma.pl', 'jan@firma.pl'])
    expect(k?.sprawy.map((s) => s.id)).toEqual(['t2', 't3', 't1'])
    expect(await kartaOrganizacji('brak.pl')).toBeNull()
    expect(await zmienOrganizacje('firma.pl', { nazwa: 'Firma S.A.', typ: 'sponsor' })).toEqual({ domena: 'firma.pl', nazwa: 'Firma S.A.', typ: 'sponsor' })
    expect(baza.get('skrzynkaOrganizacje/firma.pl')).toEqual({ domena: 'firma.pl', nazwa: 'Firma S.A.', typ: 'sponsor' })
    expect(await zmienOrganizacje('brak.pl', { typ: 'media' })).toBeNull()
  })
})

describe('rozłączenie', () => {
  const polacz = async () => {
    await zapiszStan({ email: 'kontakt@x', token: 'enc', polaczona: true, historyId: '7' })
    await zapiszWynik({
      sprawy: [sprawa('t1'), sprawa('t2')],
      kontakty: [{ email: 'anna@firma.pl', imie: 'Anna', organizacja: 'firma.pl', typ: null }],
      organizacje: [{ domena: 'firma.pl', nazwa: 'firma.pl', typ: 'inne' }],
    })
    baza.set('skrzynka/ustawienia', { stopka: 'S' })
  }

  it('bez usuwania: stan bez tokenu (panel pokaże „Połącz skrzynkę”), dane zostają', async () => {
    await polacz()
    await rozlaczStan()
    expect(await czytajStan()).toBeNull()
    expect(baza.get('skrzynka/stan')).toEqual({ polaczona: false, wersjaDanych: 2 })
    expect(baza.has('skrzynkaSprawy/t1')).toBe(true)
    expect((await liczniki(0)).stan).toBe('brak')
  })

  it('z usuwaniem: sprawy, kontakty, organizacje i stan znikają; ustawienia zostają', async () => {
    await polacz()
    expect(await usunDaneSkrzynki()).toBe(4)
    expect([...baza.keys()]).toEqual(['skrzynka/ustawienia'])
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/dane.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak nowych funkcji `dane.ts`).

- [ ] **Krok 3: Implementacja**

`lib/skrzynka/typy.ts` - 1 zmiana:


1. Zamień:

```ts
  przypisana?: string | null
  pomin?: 'adres' | 'domena'
}
```

   na:

```ts
  przypisana?: string | null
  pomin?: 'adres' | 'domena'
}

/** Spec §2: załączniki odpowiedzi łącznie do 4 MB - żądanie do funkcji Vercela ma limit 4,5 MB. */
export const MAKS_ZALACZNIKOW = 4 * 1024 * 1024

export interface UstawieniaSkrzynki {
  stopka: string
  pomijaneAdresy: string[]
  pomijaneDomeny: string[]
}

export interface StronaKontaktow {
  kontakty: Kontakt[]
  nastepna: string | null
}

export interface KartaKontaktu {
  kontakt: Kontakt
  sprawy: Sprawa[]
}

export interface KartaOrganizacji {
  organizacja: Organizacja
  kontakty: Kontakt[]
  sprawy: Sprawa[]
}
```

`lib/skrzynka/dane.ts` - 2 zmiany:


1. Zamień:

```ts
import { kontaktyRef, organizacjeRef, skrzynkaStanRef, skrzynkaUstawieniaRef, sprawyRef, ustawieniaRef } from '@/lib/firebase/admin'
import { naSklad } from '@/lib/planer/stan'
import { progAlarmu } from './statusy'
import { STATUSY, type Kontakt, type LicznikiSkrzynki, type Organizacja, type PostepImportu, type Sprawa, type Status, type StronaSpraw } from './typy'

export const DZIERZAWA_MS = 60_000
/** Limit partii Firestore to 500 zapisów - zostawiamy zapas. */
```

   na:

```ts
import { kontaktyRef, organizacjeRef, skrzynkaStanRef, skrzynkaUstawieniaRef, sprawyRef, ustawieniaRef } from '@/lib/firebase/admin'
import { naSklad } from '@/lib/planer/stan'
import { progAlarmu } from './statusy'
import {
  STATUSY, TYPY_ORGANIZACJI, type KartaKontaktu, type KartaOrganizacji, type Kontakt, type LicznikiSkrzynki, type Organizacja,
  type PostepImportu, type Sprawa, type Status, type StronaKontaktow, type StronaSpraw, type TypOrganizacji, type UstawieniaSkrzynki,
} from './typy'

export const DZIERZAWA_MS = 60_000
/** Limit partii Firestore to 500 zapisów - zostawiamy zapas. */
```


2. Zamień:

```ts
  }
}

export async function pomijane(): Promise<{ adresy: string[]; domeny: string[] }> {
  const d = (await skrzynkaUstawieniaRef().get()).data()
  const lista = (x: unknown) =>
```

   na:

```ts
  }
}

/** Stopka dopisywana do odpowiedzi, dopóki właściciel nie ustawi własnej („-- ” to znacznik podpisu w poczcie). */
export const DOMYSLNA_STOPKA = '-- \nSamorząd Studentów Uniwersytetu Ekonomicznego we Wrocławiu\nkontakt@samorzad.ue.wroc.pl'
export const KONTAKTY_NA_STRONE = 100
/** Karta osoby albo organizacji - tyle spraw wystarczy; więcej ma tylko poczta masowa. */
const MAKS_NA_KARCIE = 200

const listaTekstow = (x: unknown) =>
  Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string').map((y) => y.toLowerCase()) : []

export async function czytajUstawienia(): Promise<UstawieniaSkrzynki> {
  const d = (await skrzynkaUstawieniaRef().get()).data()
  return {
    stopka: typeof d?.stopka === 'string' ? d.stopka : DOMYSLNA_STOPKA,
    pomijaneAdresy: listaTekstow(d?.pomijaneAdresy),
    pomijaneDomeny: listaTekstow(d?.pomijaneDomeny),
  }
}

export async function zapiszUstawienia(z: Partial<UstawieniaSkrzynki>): Promise<UstawieniaSkrzynki> {
  await skrzynkaUstawieniaRef().set(z, { merge: true })
  return czytajUstawienia()
}

const naKontakt = (email: string, x: DocumentData): Kontakt => ({
  email,
  imie: String(x.imie ?? ''),
  organizacja: typeof x.organizacja === 'string' ? x.organizacja : null,
  typ: x.typ === 'student' ? 'student' : null,
})

const naOrganizacje = (domena: string, x: DocumentData): Organizacja => ({
  domena,
  nazwa: String(x.nazwa ?? '') || domena,
  typ: TYPY_ORGANIZACJI.includes(x.typ as TypOrganizacji) ? (x.typ as TypOrganizacji) : 'inne',
})

const odNajnowszej = (a: Sprawa, b: Sprawa) => b.ostatnia.kiedy - a.ostatnia.kiedy

/** Kontakty alfabetycznie po adresie, stronami - sortowanie po jednym polu nie wymaga indeksu złożonego. */
export async function listaKontaktow(po: string | null, ile = KONTAKTY_NA_STRONE): Promise<StronaKontaktow> {
  let q = kontaktyRef().orderBy('email')
  if (po) q = q.startAfter(po)
  const z = await q.limit(ile + 1).get()
  const docs = z.docs.slice(0, ile)
  return {
    kontakty: docs.map((d) => naKontakt(d.id, d.data())),
    nastepna: z.docs.length > ile ? docs[docs.length - 1].id : null,
  }
}

/** Osoba ze swoimi sprawami od najnowszej. Równość na jednym polu - też bez indeksu złożonego. */
export async function kartaKontaktu(email: string): Promise<KartaKontaktu | null> {
  const [k, s] = await Promise.all([
    kontaktyRef().doc(email).get(),
    sprawyRef().where('kontakt', '==', email).limit(MAKS_NA_KARCIE).get(),
  ])
  const d = k.data()
  if (!d) return null
  return { kontakt: naKontakt(email, d), sprawy: s.docs.map((x) => naSprawe(x.id, x.data())).sort(odNajnowszej) }
}

/** Organizacji jest najwyżej kilkaset - całość, po polsku alfabetycznie (Firestore sortowałby wielkie litery przed małymi). */
export async function listaOrganizacji(): Promise<Organizacja[]> {
  const z = await organizacjeRef().limit(1000).get()
  return z.docs.map((d) => naOrganizacje(d.id, d.data())).sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'))
}

export async function kartaOrganizacji(domena: string): Promise<KartaOrganizacji | null> {
  const [o, k, s] = await Promise.all([
    organizacjeRef().doc(domena).get(),
    kontaktyRef().where('organizacja', '==', domena).limit(MAKS_NA_KARCIE).get(),
    sprawyRef().where('organizacja', '==', domena).limit(MAKS_NA_KARCIE).get(),
  ])
  const d = o.data()
  if (!d) return null
  return {
    organizacja: naOrganizacje(domena, d),
    kontakty: k.docs.map((x) => naKontakt(x.id, x.data())).sort((a, b) => a.email.localeCompare(b.email)),
    sprawy: s.docs.map((x) => naSprawe(x.id, x.data())).sort(odNajnowszej),
  }
}

/** Nazwę i typ zmienia tylko właściciel - synchronizacja zapisuje organizacje wyłącznie nowe. */
export async function zmienOrganizacje(domena: string, z: { nazwa?: string; typ?: TypOrganizacji }): Promise<Organizacja | null> {
  const ref = organizacjeRef().doc(domena)
  return ref.firestore.runTransaction(async (t) => {
    const d = (await t.get(ref)).data()
    if (!d) return null
    const nowa = { ...naOrganizacje(domena, d), ...z }
    t.set(ref, nowa)
    return nowa
  })
}

/**
 * „Rozłącz” bez usuwania: stan bez tokenu (panel i kafelek pokażą „Połącz
 * skrzynkę”), sprawy, kontakty i organizacje zostają. `wersjaDanych` zostaje,
 * żeby nie przeliczać kluczy jeszcze raz.
 */
export async function rozlaczStan(): Promise<void> {
  await skrzynkaStanRef().set({ polaczona: false, wersjaDanych: WERSJA_DANYCH })
}

/** „Rozłącz i usuń dane”: sprawy, kontakty, organizacje i stan; ustawienia (stopka, pomijani) zostają. Zwraca liczbę usuniętych dokumentów. */
export async function usunDaneSkrzynki(): Promise<number> {
  let n = 0
  for (const k of [sprawyRef(), kontaktyRef(), organizacjeRef()]) {
    for (;;) {
      const z = await k.limit(PARTIA).get()
      if (z.empty) break
      const partia = k.firestore.batch()
      for (const d of z.docs) partia.delete(d.ref)
      await partia.commit()
      n += z.size
    }
  }
  await skrzynkaStanRef().delete()
  return n
}

export async function pomijane(): Promise<{ adresy: string[]; domeny: string[] }> {
  const d = (await skrzynkaUstawieniaRef().get()).data()
  const lista = (x: unknown) =>
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/skrzynka/dane.test.ts lib/skrzynka/dane.ts lib/skrzynka/typy.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): ustawienia, kontakty, organizacje i rozlaczenie w Firestore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 4: Wysyłka odpowiedzi i rozłączenie skrzynki

**Pliki:** zmiana `lib/skrzynka/synchronizacja.ts`, `lib/skrzynka/synchronizacja.test.ts`

**Interfejsy:**
- Korzysta z: `przygotujOdpowiedz`, `zbudujMail`, `PlikWysylki` (zadanie 1); `ZAKRES_WYSYLKI`, `odwolajToken`, `Gmail.wyslij/watekDoOdpowiedzi/zatrzymaj` (zadanie 2); `czytajSprawe` (2a), `czytajUstawienia`, `rozlaczStan`, `usunDaneSkrzynki` (zadanie 3); `klientGmaila`, `zRozlaczeniem`, `przetworzWatki` (2a, część 1).
- Daje: eksport `nasz()`; `NADAWCA`; `wyslijOdpowiedz(id, tekst, pliki, teraz?): Promise<Sprawa | null>`; `rozlaczSkrzynke(usunDane): Promise<void>`; `polaczSkrzynke` zwraca też `'brak-wysylki'`.

- [ ] **Krok 1: Testy**

`lib/skrzynka/synchronizacja.test.ts` - 6 zmian:


1. Zamień:

```ts
import type { Sprawa } from '@/lib/skrzynka/typy'

// vi.mock jest wynoszony nad importy - zaślepki muszą powstać w vi.hoisted, inaczej fabryka trafi na niezainicjowane stałe.
const { dane, g, wymienKod, utworzonyZ } = vi.hoisted(() => ({
  dane: {
    czytajStan: vi.fn(), zapiszStan: vi.fn(), wezDzierzawe: vi.fn(), zwolnijDzierzawe: vi.fn(),
    czytajSprawy: vi.fn(), zapiszWynik: vi.fn(), pomijane: vi.fn(),
  },
  g: { profil: vi.fn(), watek: vi.fn(), listaWatkow: vi.fn(), historia: vi.fn(), obserwuj: vi.fn() },
  wymienKod: vi.fn(),
  utworzonyZ: vi.fn(),
}))

vi.mock('@/lib/skrzynka/dane', () => dane)
```

   na:

```ts
import type { Sprawa } from '@/lib/skrzynka/typy'

// vi.mock jest wynoszony nad importy - zaślepki muszą powstać w vi.hoisted, inaczej fabryka trafi na niezainicjowane stałe.
const { dane, g, wymienKod, utworzonyZ, odwolajToken } = vi.hoisted(() => ({
  dane: {
    czytajStan: vi.fn(), zapiszStan: vi.fn(), wezDzierzawe: vi.fn(), zwolnijDzierzawe: vi.fn(),
    czytajSprawy: vi.fn(), zapiszWynik: vi.fn(), pomijane: vi.fn(),
    czytajSprawe: vi.fn(), czytajUstawienia: vi.fn(), rozlaczStan: vi.fn(), usunDaneSkrzynki: vi.fn(),
  },
  g: {
    profil: vi.fn(), watek: vi.fn(), listaWatkow: vi.fn(), historia: vi.fn(), obserwuj: vi.fn(),
    watekDoOdpowiedzi: vi.fn(), wyslij: vi.fn(), zatrzymaj: vi.fn(),
  },
  wymienKod: vi.fn(),
  utworzonyZ: vi.fn(),
  odwolajToken: vi.fn(),
}))

vi.mock('@/lib/skrzynka/dane', () => dane)
```


2. Zamień:

```ts
    return g
  },
  wymienKod: (...a: unknown[]) => wymienKod(...a),
}))

import { importujStrone, klientGmaila, polaczSkrzynke, przetworzWatki, synchronizuj, odnowObserwacje } from '@/lib/skrzynka/synchronizacja'
import { BladSkrzynki } from '@/lib/skrzynka/google'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'
```

   na:

```ts
    return g
  },
  wymienKod: (...a: unknown[]) => wymienKod(...a),
  odwolajToken: (...a: unknown[]) => odwolajToken(...a),
}))

import {
  importujStrone, klientGmaila, odnowObserwacje, polaczSkrzynke, przetworzWatki, rozlaczSkrzynke, synchronizuj, wyslijOdpowiedz,
} from '@/lib/skrzynka/synchronizacja'
import { BladSkrzynki } from '@/lib/skrzynka/google'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'
```


3. Zamień:

```ts
  Object.values(g).forEach((f) => f.mockReset())
  wymienKod.mockReset()
  utworzonyZ.mockReset()
  dane.czytajSprawy.mockResolvedValue(new Map())
  dane.pomijane.mockResolvedValue({ adresy: [], domeny: [] })
  dane.czytajStan.mockResolvedValue(stan())
```

   na:

```ts
  Object.values(g).forEach((f) => f.mockReset())
  wymienKod.mockReset()
  utworzonyZ.mockReset()
  odwolajToken.mockReset()
  dane.czytajSprawy.mockResolvedValue(new Map())
  dane.pomijane.mockResolvedValue({ adresy: [], domeny: [] })
  dane.czytajStan.mockResolvedValue(stan())
```


4. Zamień:

```ts

describe('polaczSkrzynke', () => {
  beforeEach(() => {
    wymienKod.mockResolvedValue({ refreshToken: 'refresh-2', dostep: 'dostep' })
    g.obserwuj.mockResolvedValue({ historyId: '500', expiration: '1792000000000' })
  })
```

   na:

```ts

describe('polaczSkrzynke', () => {
  beforeEach(() => {
    wymienKod.mockResolvedValue({ refreshToken: 'refresh-2', dostep: 'dostep', zakresy: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'] })
    g.obserwuj.mockResolvedValue({ historyId: '500', expiration: '1792000000000' })
  })
```


5. Zamień:

```ts
    expect(g.obserwuj).not.toHaveBeenCalled()
  })

  it('pierwsze połączenie: zaszyfrowany token, obserwacja, punkt historii z obserwacji, import do zrobienia', async () => {
    dane.czytajStan.mockResolvedValue(null)
    g.profil.mockResolvedValue({ emailAddress: 'Kontakt@samorzad.ue.wroc.pl', historyId: '1' })
```

   na:

```ts
    expect(g.obserwuj).not.toHaveBeenCalled()
  })

  it('zgoda bez wysyłki - nic nie zapisuje, prosi o pełną zgodę', async () => {
    wymienKod.mockResolvedValue({ refreshToken: 'r', dostep: 'd', zakresy: ['https://www.googleapis.com/auth/gmail.readonly'] })
    g.profil.mockResolvedValue({ emailAddress: NASZ, historyId: '1' })
    expect(await polaczSkrzynke('KOD')).toBe('brak-wysylki')
    expect(dane.zapiszStan).not.toHaveBeenCalled()
  })

  it('pierwsze połączenie: zaszyfrowany token, obserwacja, punkt historii z obserwacji, import do zrobienia', async () => {
    dane.czytajStan.mockResolvedValue(null)
    g.profil.mockResolvedValue({ emailAddress: 'Kontakt@samorzad.ue.wroc.pl', historyId: '1' })
```


6. Zamień:

```ts
    expect(utworzonyZ).toHaveBeenLastCalledWith('refresh')
  })
})
```

   na:

```ts
    expect(utworzonyZ).toHaveBeenLastCalledWith('refresh')
  })
})

describe('wyslijOdpowiedz', () => {
  const S = { id: 't1', status: 'do-odpowiedzi' } as Sprawa
  const doOdpowiedzi = {
    id: 't1',
    messages: [{
      id: 'm1', internalDate: '1', labelIds: ['INBOX'],
      payload: { headers: [
        { name: 'From', value: 'Anna <anna@firma.pl>' }, { name: 'To', value: NASZ },
        { name: 'Subject', value: 'Oferta' }, { name: 'Message-ID', value: '<a1@firma.pl>' },
      ] },
    }],
  }
  beforeEach(() => {
    dane.czytajUstawienia.mockResolvedValue({ stopka: 'Stopka', pomijaneAdresy: [], pomijaneDomeny: [] })
    g.watekDoOdpowiedzi.mockResolvedValue(doOdpowiedzi)
    g.wyslij.mockResolvedValue({ id: 'w1', threadId: 't1' })
  })

  it('mail do adresata w tym samym wątku, ze stopką; potem automat i świeża sprawa', async () => {
    dane.czytajSprawe.mockResolvedValueOnce(S).mockResolvedValueOnce({ ...S, status: 'czeka-na-nich' })
    g.watek.mockResolvedValue(watek('t1', [['anna@firma.pl', 1], [NASZ, 2]]))
    expect(await wyslijOdpowiedz('t1', 'Dziękujemy', [], TERAZ)).toMatchObject({ status: 'czeka-na-nich' })
    const [mime, watekId] = g.wyslij.mock.calls[0]
    expect(watekId).toBe('t1')
    expect(mime).toContain('<kontakt@samorzad.ue.wroc.pl>')
    expect(mime).toContain('To: anna@firma.pl\r\n')
    expect(mime).toContain('Subject: Re: Oferta\r\n')
    expect(mime).toContain('In-Reply-To: <a1@firma.pl>\r\n')
    expect(Buffer.from(mime.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe('Dziękujemy\r\n\r\nStopka')
    expect(zapisane().sprawy[0]).toMatchObject({ id: 't1', status: 'czeka-na-nich' })
  })

  it('nie ma sprawy - null; nie ma do kogo - błąd; nic nie wysłane', async () => {
    dane.czytajSprawe.mockResolvedValueOnce(null)
    expect(await wyslijOdpowiedz('brak', 'x', [])).toBeNull()
    dane.czytajSprawe.mockResolvedValue(S)
    g.watekDoOdpowiedzi.mockResolvedValue({ id: 't1', messages: [] })
    await expect(wyslijOdpowiedz('t1', 'x', [])).rejects.toMatchObject({ rodzaj: 'brak-adresata' })
    expect(g.wyslij).not.toHaveBeenCalled()
  })

  it('rozłączona skrzynka - błąd rozłączenia', async () => {
    dane.czytajSprawe.mockResolvedValue(S)
    dane.czytajStan.mockResolvedValue(stan({ polaczona: false }))
    await expect(wyslijOdpowiedz('t1', 'x', [])).rejects.toMatchObject({ rodzaj: 'rozlaczona' })
  })
})

describe('rozlaczSkrzynke', () => {
  beforeEach(() => {
    g.zatrzymaj.mockResolvedValue(undefined)
    odwolajToken.mockResolvedValue(undefined)
  })

  it('zatrzymuje obserwację, odwołuje token i zostawia dane', async () => {
    await rozlaczSkrzynke(false)
    expect(utworzonyZ).toHaveBeenCalledWith('refresh')
    expect(g.zatrzymaj).toHaveBeenCalled()
    expect(odwolajToken).toHaveBeenCalledWith('refresh')
    expect(dane.rozlaczStan).toHaveBeenCalled()
    expect(dane.usunDaneSkrzynki).not.toHaveBeenCalled()
  })

  it('Google nie odpowiada - i tak usuwa dane po naszej stronie', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    g.zatrzymaj.mockRejectedValue(new Error('500'))
    odwolajToken.mockRejectedValue(new Error('400'))
    await rozlaczSkrzynke(true)
    expect(dane.usunDaneSkrzynki).toHaveBeenCalled()
    expect(dane.rozlaczStan).not.toHaveBeenCalled()
  })

  it('bez stanu - bez Google, tylko po naszej stronie', async () => {
    dane.czytajStan.mockResolvedValue(null)
    await rozlaczSkrzynke(false)
    expect(g.zatrzymaj).not.toHaveBeenCalled()
    expect(dane.rozlaczStan).toHaveBeenCalled()
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/synchronizacja.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak `wyslijOdpowiedz`, `rozlaczSkrzynke`, sprawdzenia zgody).

- [ ] **Krok 3: Implementacja**

`lib/skrzynka/synchronizacja.ts` - 4 zmiany:


1. Zamień:

```ts
import { BladSkrzynki, gmail as utworzGmail, wymienKod, type Gmail } from './google'
import { odszyfruj, zaszyfruj } from './szyfr'
import {
  czytajSprawy, czytajStan, pomijane, wezDzierzawe, zapiszStan, zapiszWynik, zwolnijDzierzawe, type StanSkrzynki,
} from './dane'
import { odczytajWatek } from './naglowki'
import { domena, drugaStrona, kontaktZAdresu, organizacjaZEmaila } from './kontakty'
import { kierunek, ocenSprawe } from './statusy'
```

   na:

```ts
import { BladSkrzynki, ZAKRES_WYSYLKI, gmail as utworzGmail, odwolajToken, wymienKod, type Gmail } from './google'
import { odszyfruj, zaszyfruj } from './szyfr'
import {
  czytajSprawe, czytajSprawy, czytajStan, czytajUstawienia, pomijane, rozlaczStan, usunDaneSkrzynki, wezDzierzawe, zapiszStan, zapiszWynik,
  zwolnijDzierzawe, type StanSkrzynki,
} from './dane'
import { przygotujOdpowiedz, zbudujMail, type PlikWysylki } from './mime'
import { odczytajWatek } from './naglowki'
import { domena, drugaStrona, kontaktZAdresu, organizacjaZEmaila } from './kontakty'
import { kierunek, ocenSprawe } from './statusy'
```


2. Zamień:

```ts
const ROWNOLEGLE = 10
const MAKS_PRZEGLADU = 500

function nasz(): string {
  const e = process.env.DECK_OWNER_EMAIL
  if (!e) throw new BladSkrzynki('konfiguracja', 'Brak DECK_OWNER_EMAIL')
  return e.toLowerCase()
```

   na:

```ts
const ROWNOLEGLE = 10
const MAKS_PRZEGLADU = 500

export function nasz(): string {
  const e = process.env.DECK_OWNER_EMAIL
  if (!e) throw new BladSkrzynki('konfiguracja', 'Brak DECK_OWNER_EMAIL')
  return e.toLowerCase()
```


3. Zamień:

```ts
 * włączona. Ponowne połączenie zachowuje punkt historii i stan importu -
 * synchronizacja dociągnie zmiany z czasu rozłączenia.
 */
export async function polaczSkrzynke(kod: string): Promise<'ok' | 'inne-konto'> {
  const { refreshToken, dostep } = await wymienKod(kod)
  const g = utworzGmail(refreshToken, dostep)
  const profil = await g.profil()
  if (profil.emailAddress.toLowerCase() !== nasz()) return 'inne-konto'
  const w = await g.obserwuj(temat())
  const poprzedni = await czytajStan()
  await zapiszStan({
```

   na:

```ts
 * włączona. Ponowne połączenie zachowuje punkt historii i stan importu -
 * synchronizacja dociągnie zmiany z czasu rozłączenia.
 */
export async function polaczSkrzynke(kod: string): Promise<'ok' | 'inne-konto' | 'brak-wysylki'> {
  const { refreshToken, dostep, zakresy } = await wymienKod(kod)
  const g = utworzGmail(refreshToken, dostep)
  const profil = await g.profil()
  if (profil.emailAddress.toLowerCase() !== nasz()) return 'inne-konto'
  // Bez wysyłki panel nie odpowie na żadną sprawę - lepiej od razu poprosić o pełną zgodę.
  if (!zakresy.includes(ZAKRES_WYSYLKI)) return 'brak-wysylki'
  const w = await g.obserwuj(temat())
  const poprzedni = await czytajStan()
  await zapiszStan({
```


4. Zamień:

```ts
    await zapiszStan({ watchWygasa: Number(w.expiration) })
  })
}
```

   na:

```ts
    await zapiszStan({ watchWygasa: Number(w.expiration) })
  })
}

/** Nadawca odpowiedzi z D.E.C.K. (spec §7). */
export const NADAWCA = 'Samorząd Studentów UEW'

/**
 * Odpowiedź w wątku z kontakt@: adresat i nagłówki z wątku, stopka z
 * ustawień. Po wysyłce sprawa od razu przechodzi przez automat statusów -
 * bez czekania na push. `null` - nie ma takiej sprawy.
 */
export async function wyslijOdpowiedz(id: string, tekst: string, pliki: PlikWysylki[], teraz = Date.now()): Promise<Sprawa | null> {
  if (!(await czytajSprawe(id))) return null
  const g = await klientGmaila()
  return zRozlaczeniem(async () => {
    const odp = przygotujOdpowiedz(await g.watekDoOdpowiedzi(id), nasz())
    if (!odp) throw new BladSkrzynki('brak-adresata', `Wątek ${id} bez adresata`)
    const { stopka } = await czytajUstawienia()
    await g.wyslij(zbudujMail({ od: nasz(), nazwaOd: NADAWCA, ...odp, tekst, stopka, pliki }), id)
    await przetworzWatki(g, [id], { teraz, import: false })
    return czytajSprawe(id)
  })
}

/**
 * „Rozłącz”: zatrzymanie obserwacji i odwołanie tokenu w Google - starannie,
 * ale bez blokowania: gdy Google nie odpowie, i tak rozłączamy po naszej
 * stronie (obserwacja wygaśnie sama po 7 dniach). Potem stan bez tokenu albo
 * usunięcie spraw, kontaktów i organizacji.
 */
export async function rozlaczSkrzynke(usunDane: boolean): Promise<void> {
  const stan = await czytajStan()
  if (stan) {
    try {
      const token = odszyfruj(stan.token)
      await utworzGmail(token).zatrzymaj().catch((e) => console.error('[skrzynka] stop:', e))
      await odwolajToken(token).catch((e) => console.error('[skrzynka] odwołanie:', e))
    } catch (e) {
      console.error('[skrzynka] rozłączenie:', e)
    }
  }
  if (usunDane) await usunDaneSkrzynki()
  else await rozlaczStan()
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/skrzynka/synchronizacja.test.ts lib/skrzynka/synchronizacja.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): wysylka odpowiedzi z automatem statusow i rozlaczenie skrzynki

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 5: Trasy: odpowiedź, rozłączenie, ustawienia, kontakty, organizacje

**Pliki:** zmiana `lib/skrzynka/zmiana.ts`, `lib/skrzynka/zmiana.test.ts`, `lib/skrzynka/typy.ts`, `app/api/skrzynka/sprawy/[id]/route.ts`, `app/api/skrzynka/oauth/route.ts`, `app/api/skrzynka/sprawy/route.test.ts`, `app/api/skrzynka/route.test.ts`, `components/skrzynka/WidokSprawy.test.tsx`; nowe `app/api/skrzynka/sprawy/[id]/odpowiedz/route.ts`, `app/api/skrzynka/rozlacz/route.ts`, `app/api/skrzynka/ustawienia/route.ts`, `app/api/skrzynka/kontakty/route.ts`, `app/api/skrzynka/organizacje/route.ts`, `app/api/skrzynka/ustawienia/route.test.ts`

**Interfejsy:**
- Korzysta z: zadań 1-4; `organizacjaZEmaila` (część 1).
- Daje: `sprawdzUstawienia(body): { zmiana } | { blad }`, `sprawdzOrganizacje(body): { domena; zmiana } | null`, `MAKS_STOPKI`; `SzczegolySprawy` z `adresat: string | null` i `stopka: string`; trasy `POST /api/skrzynka/sprawy/{id}/odpowiedz` (`multipart/form-data`: `tekst`, `pliki`) → `Sprawa`, `POST /api/skrzynka/rozlacz` `{ usunDane }`, `GET/PATCH /api/skrzynka/ustawienia`, `GET /api/skrzynka/kontakty?po|email`, `GET /api/skrzynka/organizacje?domena`, `PATCH /api/skrzynka/organizacje` `{ domena, nazwa?, typ? }`; oauth przekazuje `blad=brak-wysylki`.

- [ ] **Krok 1: Testy**

W `WidokSprawy.test.tsx` w tym zadaniu tylko dane wzorcowe dostają `adresat` i `stopka` (nowy kształt `SzczegolySprawy`); testy okna przychodzą w zadaniu 6.

`lib/skrzynka/zmiana.test.ts` - 2 zmiany:


1. Zamień:

```ts
import { describe, it, expect } from 'vitest'
import { sprawdzZmiane } from '@/lib/skrzynka/zmiana'

const SKLAD = ['Jula', 'Kuba']
```

   na:

```ts
import { describe, it, expect } from 'vitest'
import { sprawdzOrganizacje, sprawdzUstawienia, sprawdzZmiane } from '@/lib/skrzynka/zmiana'

const SKLAD = ['Jula', 'Kuba']
```


2. Zamień:

```ts
    expect(sprawdzZmiane(null, SKLAD)).toBeNull()
  })
})
```

   na:

```ts
    expect(sprawdzZmiane(null, SKLAD)).toBeNull()
  })
})

describe('sprawdzUstawienia', () => {
  it('stopka i listy: małymi literami, bez spacji i powtórzeń', () => {
    expect(sprawdzUstawienia({ stopka: 'Pozdrawiamy\nSamorząd', pomijaneAdresy: [' News@Sklep.pl', 'news@sklep.pl', ''], pomijaneDomeny: ['Reklama.pl'] })).toEqual({
      zmiana: { stopka: 'Pozdrawiamy\nSamorząd', pomijaneAdresy: ['news@sklep.pl'], pomijaneDomeny: ['reklama.pl'] },
    })
    expect(sprawdzUstawienia({ pomijaneDomeny: [] })).toEqual({ zmiana: { pomijaneDomeny: [] } })
  })

  it('odrzuca złe adresy i domeny, domeny prywatne i studentów, za długą stopkę, pustą zmianę', () => {
    expect(sprawdzUstawienia({ pomijaneAdresy: ['nie-adres'] })).toEqual({ blad: 'To nie wygląda na adres e-mail: nie-adres' })
    expect(sprawdzUstawienia({ pomijaneDomeny: ['http://x.pl'] })).toEqual({ blad: 'To nie wygląda na domenę: http://x.pl' })
    expect(sprawdzUstawienia({ pomijaneDomeny: ['Gmail.com'] })).toEqual({ blad: 'Domeny gmail.com nie można pominąć w całości - dodaj pojedyncze adresy.' })
    expect(sprawdzUstawienia({ pomijaneDomeny: ['student.ue.wroc.pl'] })).toMatchObject({ blad: expect.stringContaining('student.ue.wroc.pl') })
    expect(sprawdzUstawienia({ stopka: 'x'.repeat(1001) })).toEqual({ blad: 'Stopka może mieć najwyżej 1000 znaków.' })
    expect(sprawdzUstawienia({ pomijaneAdresy: 'a@b.pl' })).toEqual({ blad: 'Niepoprawna lista adresów' })
    expect(sprawdzUstawienia({})).toEqual({ blad: 'Brak zmian' })
    expect(sprawdzUstawienia(null)).toEqual({ blad: 'Niepoprawne ustawienia' })
  })
})

describe('sprawdzOrganizacje', () => {
  it('nazwa bez spacji na brzegach i typ z listy', () => {
    expect(sprawdzOrganizacje({ domena: 'firma.pl', nazwa: '  Firma S.A. ', typ: 'sponsor' })).toEqual({ domena: 'firma.pl', zmiana: { nazwa: 'Firma S.A.', typ: 'sponsor' } })
  })

  it('odrzuca pustą nazwę, nieznany typ, brak domeny i pustą zmianę', () => {
    expect(sprawdzOrganizacje({ domena: 'firma.pl', nazwa: '   ' })).toBeNull()
    expect(sprawdzOrganizacje({ domena: 'firma.pl', typ: 'wrog' })).toBeNull()
    expect(sprawdzOrganizacje({ nazwa: 'X' })).toBeNull()
    expect(sprawdzOrganizacje({ domena: 'firma.pl' })).toBeNull()
  })
})
```

`app/api/skrzynka/sprawy/route.test.ts` - 6 zmian:


1. Zamień:

```ts
import { GET as szukaj } from '@/app/api/skrzynka/szukaj/route'
import { GET as sprawa, PATCH as zmien } from '@/app/api/skrzynka/sprawy/[id]/route'
import { GET as zalacznik } from '@/app/api/skrzynka/sprawy/[id]/zalacznik/[zid]/route'
import { BladSkrzynki } from '@/lib/skrzynka/google'
import { MAKS_POBRANIA, type Sprawa } from '@/lib/skrzynka/typy'

const { ktoPyta, dane, g } = vi.hoisted(() => ({
  ktoPyta: vi.fn(),
  dane: {
    listaSpraw: vi.fn(), czytajSprawy: vi.fn(), czytajSprawe: vi.fn(), zmienSprawe: vi.fn(),
    dodajPomijanie: vi.fn(), skladZarzadu: vi.fn(),
  },
  g: { listaWatkow: vi.fn(), watekPelny: vi.fn(), zalacznik: vi.fn() },
}))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/skrzynka/dane', () => dane)
vi.mock('@/lib/skrzynka/synchronizacja', () => ({
  klientGmaila: async () => g,
  zRozlaczeniem: <T,>(f: () => Promise<T>) => f(),
}))

const BAZA = 'https://ssuew-analytics.vercel.app'
const zadanie = (sciezka: string, body?: unknown) =>
  ({ url: `${BAZA}${sciezka}`, nextUrl: new URL(`${BAZA}${sciezka}`), json: async () => body }) as never
const p = (id: string, zid?: string) => ({ params: Promise.resolve(zid ? { id, zid } : { id }) }) as never

const S = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
```

   na:

```ts
import { GET as szukaj } from '@/app/api/skrzynka/szukaj/route'
import { GET as sprawa, PATCH as zmien } from '@/app/api/skrzynka/sprawy/[id]/route'
import { GET as zalacznik } from '@/app/api/skrzynka/sprawy/[id]/zalacznik/[zid]/route'
import { POST as odpowiedz } from '@/app/api/skrzynka/sprawy/[id]/odpowiedz/route'
import { BladSkrzynki } from '@/lib/skrzynka/google'
import { MAKS_POBRANIA, MAKS_ZALACZNIKOW, type Sprawa } from '@/lib/skrzynka/typy'

const { ktoPyta, dane, g, wyslijOdpowiedz } = vi.hoisted(() => ({
  ktoPyta: vi.fn(),
  dane: {
    listaSpraw: vi.fn(), czytajSprawy: vi.fn(), czytajSprawe: vi.fn(), zmienSprawe: vi.fn(),
    dodajPomijanie: vi.fn(), skladZarzadu: vi.fn(), czytajUstawienia: vi.fn(),
  },
  g: { listaWatkow: vi.fn(), watekPelny: vi.fn(), zalacznik: vi.fn() },
  wyslijOdpowiedz: vi.fn(),
}))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/skrzynka/dane', () => dane)
vi.mock('@/lib/skrzynka/synchronizacja', () => ({
  klientGmaila: async () => g,
  zRozlaczeniem: <T,>(f: () => Promise<T>) => f(),
  nasz: () => 'kontakt@samorzad.ue.wroc.pl',
  wyslijOdpowiedz: (...a: unknown[]) => wyslijOdpowiedz(...a),
}))

const BAZA = 'https://ssuew-analytics.vercel.app'
const zadanie = (sciezka: string, body?: unknown) =>
  ({ url: `${BAZA}${sciezka}`, nextUrl: new URL(`${BAZA}${sciezka}`), json: async () => body, formData: async () => body }) as never
const p = (id: string, zid?: string) => ({ params: Promise.resolve(zid ? { id, zid } : { id }) }) as never

const S = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
```


2. Zamień:

```ts
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  Object.values(dane).forEach((f) => f.mockReset())
  Object.values(g).forEach((f) => f.mockReset())
  dane.skladZarzadu.mockResolvedValue(['Jula'])
})

describe('dostęp', () => {
```

   na:

```ts
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  Object.values(dane).forEach((f) => f.mockReset())
  Object.values(g).forEach((f) => f.mockReset())
  wyslijOdpowiedz.mockReset()
  dane.skladZarzadu.mockResolvedValue(['Jula'])
  dane.czytajUstawienia.mockResolvedValue({ stopka: 'Stopka', pomijaneAdresy: [], pomijaneDomeny: [] })
})

describe('dostęp', () => {
```


3. Zamień:

```ts
      await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1')),
      await zmien(zadanie('/api/skrzynka/sprawy/t1', { status: 'w-toku' }), p('t1')),
      await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A?w=m1'), p('t1', 'A')),
    ]) expect(r.status).toBe(403)
    expect(dane.zmienSprawe).not.toHaveBeenCalled()
  })
})
```

   na:

```ts
      await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1')),
      await zmien(zadanie('/api/skrzynka/sprawy/t1', { status: 'w-toku' }), p('t1')),
      await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A?w=m1'), p('t1', 'A')),
      await odpowiedz(zadanie('/api/skrzynka/sprawy/t1/odpowiedz', new FormData()), p('t1')),
    ]) expect(r.status).toBe(403)
    expect(dane.zmienSprawe).not.toHaveBeenCalled()
    expect(wyslijOdpowiedz).not.toHaveBeenCalled()
  })
})
```


4. Zamień:

```ts
    g.watekPelny.mockRejectedValue(new BladSkrzynki('brak-watku', 'Gmail 404'))
    const r = await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1'))
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ sprawa: { id: 't1' }, wiadomosci: [] })
  })

  it('brak - 404; jest - treść z Gmaila i zdjęty znacznik nowej', async () => {
    dane.czytajSprawe.mockResolvedValueOnce(null)
    expect((await sprawa(zadanie('/api/skrzynka/sprawy/brak'), p('brak'))).status).toBe(404)
    dane.czytajSprawe.mockResolvedValueOnce(S('t1', { nowa: true }))
```

   na:

```ts
    g.watekPelny.mockRejectedValue(new BladSkrzynki('brak-watku', 'Gmail 404'))
    const r = await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1'))
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ sprawa: { id: 't1' }, wiadomosci: [], adresat: null, stopka: 'Stopka' })
  })

  it('brak - 404; jest - treść z Gmaila, adresat i stopka odpowiedzi, zdjęty znacznik nowej', async () => {
    dane.czytajSprawe.mockResolvedValueOnce(null)
    expect((await sprawa(zadanie('/api/skrzynka/sprawy/brak'), p('brak'))).status).toBe(404)
    dane.czytajSprawe.mockResolvedValueOnce(S('t1', { nowa: true }))
```


5. Zamień:

```ts
    const d = await (await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1'))).json()
    expect(d.sprawa.nowa).toBe(false)
    expect(d.wiadomosci[0]).toMatchObject({ id: 'm1', tekst: 'Treść' })
    expect(dane.zmienSprawe).toHaveBeenCalledWith('t1', { nowa: false })
  })
```

   na:

```ts
    const d = await (await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1'))).json()
    expect(d.sprawa.nowa).toBe(false)
    expect(d.wiadomosci[0]).toMatchObject({ id: 'm1', tekst: 'Treść' })
    expect(d.adresat).toBe('anna@firma.pl')
    expect(d.stopka).toBe('Stopka')
    expect(dane.zmienSprawe).toHaveBeenCalledWith('t1', { nowa: false })
  })
```


6. Zamień:

```ts
    expect((await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A'), p('t1', 'A'))).status).toBe(400)
  })
})
```

   na:

```ts
    expect((await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A'), p('t1', 'A'))).status).toBe(400)
  })
})

describe('odpowiedź', () => {
  const formularz = (tekst: string, pliki: File[] = []) => {
    const fd = new FormData()
    fd.append('tekst', tekst)
    for (const plik of pliki) fd.append('pliki', plik)
    return fd
  }
  const wyslij = (fd: FormData) => odpowiedz(zadanie('/api/skrzynka/sprawy/t1/odpowiedz', fd), p('t1'))

  it('tekst bez spacji na brzegach i załączniki do wysyłki; wynik - sprawa po automacie', async () => {
    wyslijOdpowiedz.mockResolvedValue(S('t1', { status: 'czeka-na-nich', oczekujeOd: null }))
    const r = await wyslij(formularz('  Dziękujemy  ', [new File([Uint8Array.from([1, 2, 3])], 'Umowa.pdf', { type: 'application/pdf' })]))
    expect((await r.json()).status).toBe('czeka-na-nich')
    expect(wyslijOdpowiedz).toHaveBeenCalledWith('t1', 'Dziękujemy', [{ nazwa: 'Umowa.pdf', typ: 'application/pdf', dane: Uint8Array.from([1, 2, 3]) }])
  })

  it('pusta treść 400; załączniki ponad 4 MB 413 - nic nie wysłane; dokładnie 4 MB przechodzi', async () => {
    expect((await wyslij(formularz('   '))).status).toBe(400)
    const zaDuzo = await wyslij(formularz('x', [new File([new Uint8Array(MAKS_ZALACZNIKOW)], 'a.bin'), new File([Uint8Array.from([1])], 'b.bin')]))
    expect(zaDuzo.status).toBe(413)
    expect((await zaDuzo.json()).error).toBe('Załączniki mogą mieć łącznie najwyżej 4 MB.')
    expect(wyslijOdpowiedz).not.toHaveBeenCalled()
    wyslijOdpowiedz.mockResolvedValue(S('t1'))
    expect((await wyslij(formularz('x', [new File([new Uint8Array(MAKS_ZALACZNIKOW)], 'a.bin')]))).status).toBe(200)
  })

  it('brak sprawy 404; brak zgody na wysyłkę 403 z komunikatem', async () => {
    wyslijOdpowiedz.mockResolvedValueOnce(null)
    expect((await wyslij(formularz('x'))).status).toBe(404)
    wyslijOdpowiedz.mockRejectedValueOnce(new BladSkrzynki('brak-zgody', 'Gmail 403'))
    const r = await wyslij(formularz('x'))
    expect(r.status).toBe(403)
    expect((await r.json()).error).toMatch(/zgody na wysyłkę/)
  })
})
```

`app/api/skrzynka/ustawienia/route.test.ts` (nowy plik):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as ustawienia, PATCH as zmienUstawienia } from '@/app/api/skrzynka/ustawienia/route'
import { POST as rozlacz } from '@/app/api/skrzynka/rozlacz/route'
import { GET as kontakty } from '@/app/api/skrzynka/kontakty/route'
import { GET as organizacje, PATCH as zmienOrganizacje } from '@/app/api/skrzynka/organizacje/route'

const { ktoPyta, dane, rozlaczSkrzynke } = vi.hoisted(() => ({
  ktoPyta: vi.fn(),
  dane: {
    czytajUstawienia: vi.fn(), zapiszUstawienia: vi.fn(), listaKontaktow: vi.fn(), kartaKontaktu: vi.fn(),
    listaOrganizacji: vi.fn(), kartaOrganizacji: vi.fn(), zmienOrganizacje: vi.fn(),
  },
  rozlaczSkrzynke: vi.fn(),
}))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/skrzynka/dane', () => dane)
vi.mock('@/lib/skrzynka/synchronizacja', () => ({ rozlaczSkrzynke: (...a: unknown[]) => rozlaczSkrzynke(...a) }))

const BAZA = 'https://ssuew-analytics.vercel.app'
const zadanie = (sciezka: string, body?: unknown) =>
  ({ url: `${BAZA}${sciezka}`, nextUrl: new URL(`${BAZA}${sciezka}`), json: async () => body }) as never
const U = { stopka: 'S', pomijaneAdresy: [], pomijaneDomeny: [] }

beforeEach(() => {
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  Object.values(dane).forEach((f) => f.mockReset())
  rozlaczSkrzynke.mockReset()
})

describe('dostęp', () => {
  it('bez sesji 401, zarząd 403 - każda trasa', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await ustawienia(zadanie('/api/skrzynka/ustawienia'))).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    for (const r of [
      await ustawienia(zadanie('/api/skrzynka/ustawienia')),
      await zmienUstawienia(zadanie('/api/skrzynka/ustawienia', { stopka: 'x' })),
      await rozlacz(zadanie('/api/skrzynka/rozlacz', { usunDane: true })),
      await kontakty(zadanie('/api/skrzynka/kontakty')),
      await organizacje(zadanie('/api/skrzynka/organizacje')),
      await zmienOrganizacje(zadanie('/api/skrzynka/organizacje', { domena: 'firma.pl', typ: 'sponsor' })),
    ]) expect(r.status).toBe(403)
    expect(rozlaczSkrzynke).not.toHaveBeenCalled()
    expect(dane.zapiszUstawienia).not.toHaveBeenCalled()
  })
})

describe('ustawienia', () => {
  it('odczyt; zapis po walidacji; zła domena 400 z komunikatem', async () => {
    dane.czytajUstawienia.mockResolvedValue(U)
    expect(await (await ustawienia(zadanie('/api/skrzynka/ustawienia'))).json()).toEqual(U)
    dane.zapiszUstawienia.mockResolvedValue({ ...U, pomijaneAdresy: ['news@sklep.pl'] })
    const r = await zmienUstawienia(zadanie('/api/skrzynka/ustawienia', { pomijaneAdresy: ['News@Sklep.pl'] }))
    expect((await r.json()).pomijaneAdresy).toEqual(['news@sklep.pl'])
    expect(dane.zapiszUstawienia).toHaveBeenCalledWith({ pomijaneAdresy: ['news@sklep.pl'] })
    const zla = await zmienUstawienia(zadanie('/api/skrzynka/ustawienia', { pomijaneDomeny: ['gmail.com'] }))
    expect(zla.status).toBe(400)
    expect((await zla.json()).error).toMatch(/gmail\.com/)
  })
})

describe('rozłączenie', () => {
  it('z usuwaniem danych tylko przy jawnym true', async () => {
    expect(await (await rozlacz(zadanie('/api/skrzynka/rozlacz', { usunDane: true }))).json()).toEqual({ ok: true })
    expect(rozlaczSkrzynke).toHaveBeenLastCalledWith(true)
    await rozlacz(zadanie('/api/skrzynka/rozlacz', { usunDane: 'tak' }))
    expect(rozlaczSkrzynke).toHaveBeenLastCalledWith(false)
  })

  it('błąd - 500 z komunikatem', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    rozlaczSkrzynke.mockRejectedValue(new Error('firestore'))
    const r = await rozlacz(zadanie('/api/skrzynka/rozlacz', {}))
    expect(r.status).toBe(500)
    expect((await r.json()).error).toMatch(/Nie udało się rozłączyć/)
  })
})

describe('kontakty i organizacje', () => {
  it('lista kontaktów z kursorem; karta po adresie małymi literami; brak - 404', async () => {
    dane.listaKontaktow.mockResolvedValue({ kontakty: [], nastepna: null })
    await kontakty(zadanie('/api/skrzynka/kontakty?po=jan%40firma.pl'))
    expect(dane.listaKontaktow).toHaveBeenCalledWith('jan@firma.pl')
    dane.kartaKontaktu.mockResolvedValueOnce({ kontakt: { email: 'anna@firma.pl' }, sprawy: [] })
    expect((await kontakty(zadanie('/api/skrzynka/kontakty?email=Anna%40Firma.pl'))).status).toBe(200)
    expect(dane.kartaKontaktu).toHaveBeenCalledWith('anna@firma.pl')
    dane.kartaKontaktu.mockResolvedValueOnce(null)
    expect((await kontakty(zadanie('/api/skrzynka/kontakty?email=brak%40x.pl'))).status).toBe(404)
  })

  it('organizacje: lista, karta, zmiana po walidacji; zła zmiana 400, brak 404', async () => {
    dane.listaOrganizacji.mockResolvedValue([{ domena: 'firma.pl', nazwa: 'Firma', typ: 'inne' }])
    expect(await (await organizacje(zadanie('/api/skrzynka/organizacje'))).json()).toEqual({ organizacje: [{ domena: 'firma.pl', nazwa: 'Firma', typ: 'inne' }] })
    dane.kartaOrganizacji.mockResolvedValueOnce(null)
    expect((await organizacje(zadanie('/api/skrzynka/organizacje?domena=brak.pl'))).status).toBe(404)
    dane.zmienOrganizacje.mockResolvedValueOnce({ domena: 'firma.pl', nazwa: 'Firma S.A.', typ: 'sponsor' })
    const r = await zmienOrganizacje(zadanie('/api/skrzynka/organizacje', { domena: 'firma.pl', nazwa: ' Firma S.A. ', typ: 'sponsor' }))
    expect((await r.json()).nazwa).toBe('Firma S.A.')
    expect(dane.zmienOrganizacje).toHaveBeenCalledWith('firma.pl', { nazwa: 'Firma S.A.', typ: 'sponsor' })
    expect((await zmienOrganizacje(zadanie('/api/skrzynka/organizacje', { domena: 'firma.pl', typ: 'wrog' }))).status).toBe(400)
    dane.zmienOrganizacje.mockResolvedValueOnce(null)
    expect((await zmienOrganizacje(zadanie('/api/skrzynka/organizacje', { domena: 'brak.pl', typ: 'media' }))).status).toBe(404)
  })
})
```

`app/api/skrzynka/route.test.ts` - 2 zmiany:


1. Zamień:

```ts
    expect(r.headers.get('location')).toBe(`${BAZA}/skrzynka?blad=konfiguracja`)
  })

  it('powrót: odmowa, zły state, inne konto, błąd, sukces', async () => {
    const gdzie = async (q: string) => (await oauth(zadanie(`/api/skrzynka/oauth${q}`))).headers.get('location')
    expect(await gdzie('?error=access_denied')).toBe(`${BAZA}/skrzynka?blad=odmowa`)
    sprawdzStan.mockResolvedValueOnce(false)
```

   na:

```ts
    expect(r.headers.get('location')).toBe(`${BAZA}/skrzynka?blad=konfiguracja`)
  })

  it('powrót: odmowa, zły state, inne konto, zgoda bez wysyłki, błąd, sukces', async () => {
    const gdzie = async (q: string) => (await oauth(zadanie(`/api/skrzynka/oauth${q}`))).headers.get('location')
    expect(await gdzie('?error=access_denied')).toBe(`${BAZA}/skrzynka?blad=odmowa`)
    sprawdzStan.mockResolvedValueOnce(false)
```


2. Zamień:

```ts
    expect(await gdzie('?state=s')).toBe(`${BAZA}/skrzynka?blad=stan`)
    s.polaczSkrzynke.mockResolvedValueOnce('inne-konto')
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka?blad=inne-konto`)
    s.polaczSkrzynke.mockRejectedValueOnce(new Error('sieć'))
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka?blad=polaczenie`)
    s.polaczSkrzynke.mockResolvedValueOnce('ok')
```

   na:

```ts
    expect(await gdzie('?state=s')).toBe(`${BAZA}/skrzynka?blad=stan`)
    s.polaczSkrzynke.mockResolvedValueOnce('inne-konto')
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka?blad=inne-konto`)
    s.polaczSkrzynke.mockResolvedValueOnce('brak-wysylki')
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka?blad=brak-wysylki`)
    s.polaczSkrzynke.mockRejectedValueOnce(new Error('sieć'))
    expect(await gdzie('?code=k&state=s')).toBe(`${BAZA}/skrzynka?blad=polaczenie`)
    s.polaczSkrzynke.mockResolvedValueOnce('ok')
```

`components/skrzynka/WidokSprawy.test.tsx` - 1 zmiana:


1. Zamień:

```tsx
    },
    { id: 'm2', kiedy: Date.UTC(2026, 9, 2, 8), od: { email: EMAIL, imie: '' }, do: [], temat: 'Re: Sponsoring', tekst: 'Dziękujemy, wrócimy z odpowiedzią.', html: null, zalaczniki: [] },
  ],
})

async function widok(d: SzczegolySprawy = D()) {
```

   na:

```tsx
    },
    { id: 'm2', kiedy: Date.UTC(2026, 9, 2, 8), od: { email: EMAIL, imie: '' }, do: [], temat: 'Re: Sponsoring', tekst: 'Dziękujemy, wrócimy z odpowiedzią.', html: null, zalaczniki: [] },
  ],
  adresat: 'anna@firma.pl',
  stopka: '-- \nSamorząd Studentów UEW',
})

async function widok(d: SzczegolySprawy = D()) {
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/zmiana.test.ts app/api/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak tras i walidacji).

- [ ] **Krok 3: Implementacja**

`lib/skrzynka/zmiana.ts` - 2 zmiany:


1. Zamień:

```ts
import { STATUSY, type Status, type ZmianaSprawy } from './typy'

/** Walidacja ciała PATCH sprawy. Przypisać można tylko osobę ze Składu zarządu albo nikogo. */
export function sprawdzZmiane(body: unknown, sklad: string[]): ZmianaSprawy | null {
```

   na:

```ts
import { organizacjaZEmaila } from './kontakty'
import { STATUSY, TYPY_ORGANIZACJI, type Status, type TypOrganizacji, type UstawieniaSkrzynki, type ZmianaSprawy } from './typy'

/** Walidacja ciała PATCH sprawy. Przypisać można tylko osobę ze Składu zarządu albo nikogo. */
export function sprawdzZmiane(body: unknown, sklad: string[]): ZmianaSprawy | null {
```


2. Zamień:

```ts
  }
  return Object.keys(z).length ? z : null
}
```

   na:

```ts
  }
  return Object.keys(z).length ? z : null
}

const EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/
const DOMENA = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/
export const MAKS_STOPKI = 1000
const MAKS_LISTY = 1000
const MAKS_NAZWY = 120

/** Lista z formularza: małymi literami, bez spacji na brzegach i bez powtórzeń; `null` - to nie lista tekstów. */
function lista(x: unknown): string[] | null {
  if (!Array.isArray(x) || x.length > MAKS_LISTY || !x.every((y) => typeof y === 'string')) return null
  return [...new Set(x.map((y: string) => y.trim().toLowerCase()).filter(Boolean))]
}

/**
 * Walidacja PATCH ustawień skrzynki. Domeny skrzynek prywatnych (gmail.com)
 * i studentów nie da się pominąć w całości - jak przy „Pomiń zawsze” w sprawie.
 */
export function sprawdzUstawienia(body: unknown): { zmiana: Partial<UstawieniaSkrzynki> } | { blad: string } {
  if (!body || typeof body !== 'object') return { blad: 'Niepoprawne ustawienia' }
  const x = body as Record<string, unknown>
  const z: Partial<UstawieniaSkrzynki> = {}
  if (x.stopka !== undefined) {
    if (typeof x.stopka !== 'string' || x.stopka.length > MAKS_STOPKI) return { blad: `Stopka może mieć najwyżej ${MAKS_STOPKI} znaków.` }
    z.stopka = x.stopka
  }
  if (x.pomijaneAdresy !== undefined) {
    const l = lista(x.pomijaneAdresy)
    if (!l) return { blad: 'Niepoprawna lista adresów' }
    const zly = l.find((a) => !EMAIL.test(a))
    if (zly !== undefined) return { blad: `To nie wygląda na adres e-mail: ${zly}` }
    z.pomijaneAdresy = l
  }
  if (x.pomijaneDomeny !== undefined) {
    const l = lista(x.pomijaneDomeny)
    if (!l) return { blad: 'Niepoprawna lista domen' }
    const zla = l.find((d) => !DOMENA.test(d))
    if (zla !== undefined) return { blad: `To nie wygląda na domenę: ${zla}` }
    const prywatna = l.find((d) => !organizacjaZEmaila(`x@${d}`))
    if (prywatna !== undefined) return { blad: `Domeny ${prywatna} nie można pominąć w całości - dodaj pojedyncze adresy.` }
    z.pomijaneDomeny = l
  }
  return Object.keys(z).length ? { zmiana: z } : { blad: 'Brak zmian' }
}

/** Walidacja PATCH organizacji: nazwa (1-120 znaków) albo typ z listy. */
export function sprawdzOrganizacje(body: unknown): { domena: string; zmiana: { nazwa?: string; typ?: TypOrganizacji } } | null {
  if (!body || typeof body !== 'object') return null
  const x = body as Record<string, unknown>
  if (typeof x.domena !== 'string' || !x.domena) return null
  const zmiana: { nazwa?: string; typ?: TypOrganizacji } = {}
  if (x.nazwa !== undefined) {
    const n = typeof x.nazwa === 'string' ? x.nazwa.trim() : ''
    if (!n || n.length > MAKS_NAZWY) return null
    zmiana.nazwa = n
  }
  if (x.typ !== undefined) {
    if (!TYPY_ORGANIZACJI.includes(x.typ as TypOrganizacji)) return null
    zmiana.typ = x.typ as TypOrganizacji
  }
  return Object.keys(zmiana).length ? { domena: x.domena, zmiana } : null
}
```

`lib/skrzynka/typy.ts` - 1 zmiana:


1. Zamień:

```ts
export interface SzczegolySprawy {
  sprawa: Sprawa
  wiadomosci: WiadomoscPelna[]
}

/** Ręczna zmiana sprawy z panelu. `pomin` = Pominięta + nadawca (adres albo domena) na listę „zawsze pomijaj”. */
```

   na:

```ts
export interface SzczegolySprawy {
  sprawa: Sprawa
  wiadomosci: WiadomoscPelna[]
  /** Dokąd pójdzie odpowiedź (Reply-To albo nadawca); `null` - nie ma do kogo odpowiedzieć. */
  adresat: string | null
  stopka: string
}

/** Ręczna zmiana sprawy z panelu. `pomin` = Pominięta + nadawca (adres albo domena) na listę „zawsze pomijaj”. */
```

`app/api/skrzynka/sprawy/[id]/odpowiedz/route.ts` (nowy plik):

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { wyslijOdpowiedz } from '@/lib/skrzynka/synchronizacja'
import { MAKS_ZALACZNIKOW, TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60
const MAKS_TEKSTU = 50_000

type Kontekst = { params: Promise<{ id: string }> }

/** Odpowiedź z D.E.C.K.: `multipart/form-data` z polem `tekst` i plikami `pliki` (łącznie do 4 MB). */
export async function POST(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const { id } = await params
  const fd = await req.formData().catch(() => null)
  if (!fd) return NextResponse.json({ error: 'Niepoprawne żądanie' }, { status: 400 })
  const tekst = String(fd.get('tekst') ?? '').trim()
  if (!tekst) return NextResponse.json({ error: 'Wpisz treść odpowiedzi.' }, { status: 400 })
  if (tekst.length > MAKS_TEKSTU) return NextResponse.json({ error: 'Odpowiedź jest za długa.' }, { status: 400 })
  const pliki = fd.getAll('pliki').filter((p): p is File => typeof p !== 'string' && p.size > 0)
  if (pliki.reduce((s, p) => s + p.size, 0) > MAKS_ZALACZNIKOW) {
    return NextResponse.json({ error: 'Załączniki mogą mieć łącznie najwyżej 4 MB.' }, { status: 413 })
  }
  try {
    const dane = await Promise.all(pliki.map(async (p) => ({ nazwa: p.name, typ: p.type, dane: new Uint8Array(await p.arrayBuffer()) })))
    const s = await wyslijOdpowiedz(id, tekst, dane)
    if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
    return NextResponse.json(s)
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
```

`app/api/skrzynka/rozlacz/route.ts` (nowy plik):

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { rozlaczSkrzynke } from '@/lib/skrzynka/synchronizacja'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

/** „Rozłącz”: `{ usunDane: true }` usuwa też sprawy, kontakty i organizacje (koniec kadencji). */
export async function POST(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const body = await req.json().catch(() => null)
  try {
    await rozlaczSkrzynke(body?.usunDane === true)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[skrzynka] rozłączenie:', e)
    return NextResponse.json({ error: 'Nie udało się rozłączyć skrzynki - spróbuj ponownie.' }, { status: 500 })
  }
}
```

`app/api/skrzynka/ustawienia/route.ts` (nowy plik):

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { czytajUstawienia, zapiszUstawienia } from '@/lib/skrzynka/dane'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'
import { sprawdzUstawienia } from '@/lib/skrzynka/zmiana'

export const runtime = 'nodejs'

const blad = (e: unknown) => {
  console.error('[skrzynka] ustawienia:', e)
  return NextResponse.json({ error: 'Nie udało się wczytać albo zapisać ustawień - spróbuj ponownie.' }, { status: 500 })
}

/** Stopka odpowiedzi i listy „zawsze pomijaj”. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  try {
    return NextResponse.json(await czytajUstawienia())
  } catch (e) {
    return blad(e)
  }
}

export async function PATCH(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const w = sprawdzUstawienia(await req.json().catch(() => null))
  if ('blad' in w) return NextResponse.json({ error: w.blad }, { status: 400 })
  try {
    return NextResponse.json(await zapiszUstawienia(w.zmiana))
  } catch (e) {
    return blad(e)
  }
}
```

`app/api/skrzynka/kontakty/route.ts` (nowy plik):

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { kartaKontaktu, listaKontaktow } from '@/lib/skrzynka/dane'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'

/** Bez `email` - lista stronami (`po`); z `email` - karta osoby z jej sprawami. Adres w parametrze, nie w ścieżce. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const sp = req.nextUrl.searchParams
  const email = sp.get('email')?.trim().toLowerCase()
  try {
    if (!email) return NextResponse.json(await listaKontaktow(sp.get('po')))
    const k = await kartaKontaktu(email)
    return k ? NextResponse.json(k) : NextResponse.json({ error: 'Nie ma takiej osoby' }, { status: 404 })
  } catch (e) {
    console.error('[skrzynka] kontakty:', e)
    return NextResponse.json({ error: 'Nie udało się wczytać kontaktów - spróbuj ponownie.' }, { status: 500 })
  }
}
```

`app/api/skrzynka/organizacje/route.ts` (nowy plik):

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { kartaOrganizacji, listaOrganizacji, zmienOrganizacje } from '@/lib/skrzynka/dane'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'
import { sprawdzOrganizacje } from '@/lib/skrzynka/zmiana'

export const runtime = 'nodejs'

const blad = (e: unknown) => {
  console.error('[skrzynka] organizacje:', e)
  return NextResponse.json({ error: 'Nie udało się wczytać albo zapisać organizacji - spróbuj ponownie.' }, { status: 500 })
}

/** Bez `domena` - wszystkie organizacje; z `domena` - karta z osobami i sprawami. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const domena = req.nextUrl.searchParams.get('domena')?.trim().toLowerCase()
  try {
    if (!domena) return NextResponse.json({ organizacje: await listaOrganizacji() })
    const k = await kartaOrganizacji(domena)
    return k ? NextResponse.json(k) : NextResponse.json({ error: 'Nie ma takiej organizacji' }, { status: 404 })
  } catch (e) {
    return blad(e)
  }
}

/** Zmiana nazwy albo typu - `{ domena, nazwa?, typ? }`. */
export async function PATCH(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const z = sprawdzOrganizacje(await req.json().catch(() => null))
  if (!z) return NextResponse.json({ error: 'Niepoprawna zmiana' }, { status: 400 })
  try {
    const o = await zmienOrganizacje(z.domena, z.zmiana)
    return o ? NextResponse.json(o) : NextResponse.json({ error: 'Nie ma takiej organizacji' }, { status: 404 })
  } catch (e) {
    return blad(e)
  }
}
```

`app/api/skrzynka/sprawy/[id]/route.ts` - 3 zmiany:


1. Zamień:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { czytajSprawe, dodajPomijanie, skladZarzadu, zmienSprawe } from '@/lib/skrzynka/dane'
import { BladSkrzynki, komunikatBledu } from '@/lib/skrzynka/google'
import { domena } from '@/lib/skrzynka/kontakty'
import { klientGmaila, zRozlaczeniem } from '@/lib/skrzynka/synchronizacja'
import { odczytajWatekPelny } from '@/lib/skrzynka/tresc'
import { TYLKO_WLASCICIEL, type SzczegolySprawy } from '@/lib/skrzynka/typy'
import { sprawdzZmiane } from '@/lib/skrzynka/zmiana'
```

   na:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { czytajSprawe, czytajUstawienia, dodajPomijanie, skladZarzadu, zmienSprawe } from '@/lib/skrzynka/dane'
import { BladSkrzynki, komunikatBledu } from '@/lib/skrzynka/google'
import { domena } from '@/lib/skrzynka/kontakty'
import { przygotujOdpowiedz } from '@/lib/skrzynka/mime'
import { klientGmaila, nasz, zRozlaczeniem } from '@/lib/skrzynka/synchronizacja'
import { odczytajWatekPelny } from '@/lib/skrzynka/tresc'
import { TYLKO_WLASCICIEL, type SzczegolySprawy } from '@/lib/skrzynka/typy'
import { sprawdzZmiane } from '@/lib/skrzynka/zmiana'
```


2. Zamień:

```ts

type Kontekst = { params: Promise<{ id: string }> }

/** Sprawa z bazy i wątek z Gmaila na żywo. Otwarcie zdejmuje znacznik „nowa wiadomość”. */
export async function GET(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
```

   na:

```ts

type Kontekst = { params: Promise<{ id: string }> }

/** Sprawa z bazy, wątek z Gmaila na żywo, adresat i stopka okna odpowiedzi. Otwarcie zdejmuje znacznik „nowa wiadomość”. */
export async function GET(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
```


3. Zamień:

```ts
  try {
    const s = await czytajSprawe(id)
    if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
    const wiadomosci = await zRozlaczeniem(async () => odczytajWatekPelny(await (await klientGmaila()).watekPelny(id))).catch((e) => {
      // Wątek usunięty w Gmailu - sprawa zostaje widoczna, żeby dało się ją zamknąć albo pominąć.
      if (e instanceof BladSkrzynki && e.rodzaj === 'brak-watku') return []
      throw e
    })
    const sprawa = s.nowa ? ((await zmienSprawe(id, { nowa: false })) ?? s) : s
    return NextResponse.json({ sprawa, wiadomosci } satisfies SzczegolySprawy)
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
```

   na:

```ts
  try {
    const s = await czytajSprawe(id)
    if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
    const watek = await zRozlaczeniem(async () => (await klientGmaila()).watekPelny(id)).catch((e) => {
      // Wątek usunięty w Gmailu - sprawa zostaje widoczna, żeby dało się ją zamknąć albo pominąć.
      if (e instanceof BladSkrzynki && e.rodzaj === 'brak-watku') return null
      throw e
    })
    const { stopka } = await czytajUstawienia()
    const sprawa = s.nowa ? ((await zmienSprawe(id, { nowa: false })) ?? s) : s
    return NextResponse.json({
      sprawa,
      wiadomosci: watek ? odczytajWatekPelny(watek) : [],
      adresat: watek ? (przygotujOdpowiedz(watek, nasz())?.do ?? null) : null,
      stopka,
    } satisfies SzczegolySprawy)
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
```

`app/api/skrzynka/oauth/route.ts` - 1 zmiana:


1. Zamień:

```ts
  const stan = p.get('state')
  if (!kod || !stan || !(await sprawdzStan(stan, kto.uid))) return wroc('stan')
  try {
    return wroc((await polaczSkrzynke(kod)) === 'ok' ? undefined : 'inne-konto')
  } catch (e) {
    console.error('[skrzynka] połączenie:', e)
    return wroc('polaczenie')
```

   na:

```ts
  const stan = p.get('state')
  if (!kod || !stan || !(await sprawdzStan(stan, kto.uid))) return wroc('stan')
  try {
    const wynik = await polaczSkrzynke(kod)
    return wroc(wynik === 'ok' ? undefined : wynik)
  } catch (e) {
    console.error('[skrzynka] połączenie:', e)
    return wroc('polaczenie')
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka app/api/skrzynka components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add app/api/skrzynka/kontakty/route.ts app/api/skrzynka/oauth/route.ts app/api/skrzynka/organizacje/route.ts app/api/skrzynka/route.test.ts app/api/skrzynka/rozlacz/route.ts 'app/api/skrzynka/sprawy/[id]/odpowiedz/route.ts' 'app/api/skrzynka/sprawy/[id]/route.ts' app/api/skrzynka/sprawy/route.test.ts app/api/skrzynka/ustawienia/route.test.ts app/api/skrzynka/ustawienia/route.ts components/skrzynka/WidokSprawy.test.tsx lib/skrzynka/typy.ts lib/skrzynka/zmiana.test.ts lib/skrzynka/zmiana.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): trasy odpowiedzi, rozlaczenia, ustawien, kontaktow i organizacji

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 6: Okno odpowiedzi w widoku sprawy

**Pliki:** zmiana `lib/skrzynka/klient.ts`, `components/skrzynka/WidokSprawy.tsx`, `components/skrzynka/WidokSprawy.test.tsx`; nowe `components/skrzynka/OknoOdpowiedzi.tsx`, `components/skrzynka/OknoOdpowiedzi.test.tsx`

**Interfejsy:**
- Korzysta z: tras z zadania 5; `rozmiar` (2a); `MAKS_ZALACZNIKOW` (zadanie 3).
- Daje: `klientSkrzynki.odpowiedz/ustawienia/zapiszUstawienia/rozlacz/kontakty/kontakt/organizacje/organizacja/zmienOrganizacje`; `OknoOdpowiedzi({ sprawaId, adresat, stopka, onWyslano })`.

- [ ] **Krok 1: Testy**

`components/skrzynka/OknoOdpowiedzi.test.tsx` (nowy plik):

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OknoOdpowiedzi } from '@/components/skrzynka/OknoOdpowiedzi'
import { MAKS_ZALACZNIKOW } from '@/lib/skrzynka/typy'

const klient = { odpowiedz: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: { odpowiedz: (...a: unknown[]) => klient.odpowiedz(...a) },
}))

const plik = (nazwa: string, bajty: number) => new File([new Uint8Array(bajty)], nazwa, { type: 'application/pdf' })
const okno = (adresat: string | null = 'anna@firma.pl') => {
  const onWyslano = vi.fn()
  render(<OknoOdpowiedzi sprawaId="t1" adresat={adresat} stopka={'-- \nSamorząd Studentów UEW'} onWyslano={onWyslano} />)
  return onWyslano
}
const wpisz = (t: string) => fireEvent.change(screen.getByLabelText('Treść odpowiedzi'), { target: { value: t } })
const dodaj = (...p: File[]) => fireEvent.change(screen.getByLabelText('Wybierz pliki'), { target: { files: p } })
const wyslij = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }))
  })

beforeEach(() => klient.odpowiedz.mockReset())

describe('OknoOdpowiedzi', () => {
  it('adresat i podgląd stopki; pusta treść nie wysyła', () => {
    okno()
    expect(screen.getByText('anna@firma.pl')).toBeInTheDocument()
    expect(screen.getByLabelText('Stopka')).toHaveTextContent('Samorząd Studentów UEW')
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
  })

  it('wysyłka z załącznikiem; po sukcesie okno puste, rodzic dostaje sprawę', async () => {
    klient.odpowiedz.mockResolvedValue({ id: 't1', status: 'czeka-na-nich' })
    const onWyslano = okno()
    wpisz('Dziękujemy za ofertę.')
    const umowa = plik('Umowa.pdf', 2048)
    dodaj(umowa)
    expect(screen.getByRole('list', { name: 'Załączniki odpowiedzi' })).toHaveTextContent('Umowa.pdf · 2 KB')
    await wyslij()
    expect(klient.odpowiedz).toHaveBeenCalledWith('t1', 'Dziękujemy za ofertę.', [umowa])
    expect(onWyslano).toHaveBeenCalledWith({ id: 't1', status: 'czeka-na-nich' })
    expect(screen.getByLabelText('Treść odpowiedzi')).toHaveValue('')
    expect(screen.queryByRole('list', { name: 'Załączniki odpowiedzi' })).toBeNull()
  })

  it('błąd wysyłki zostawia tekst i załączniki', async () => {
    klient.odpowiedz.mockRejectedValueOnce(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    const onWyslano = okno()
    wpisz('Treść, której szkoda')
    dodaj(plik('Skan.pdf', 10))
    await wyslij()
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
    expect(screen.getByLabelText('Treść odpowiedzi')).toHaveValue('Treść, której szkoda')
    expect(screen.getByRole('list', { name: 'Załączniki odpowiedzi' })).toHaveTextContent('Skan.pdf')
    expect(onWyslano).not.toHaveBeenCalled()
  })

  it('ponad 4 MB łącznie - ostrzeżenie i blokada; usunięcie pliku odblokowuje', () => {
    okno()
    wpisz('x')
    dodaj(plik('a.pdf', MAKS_ZALACZNIKOW - 10), plik('b.pdf', 11))
    expect(screen.getByText(/za dużo, usuń część plików/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Usuń b.pdf' }))
    expect(screen.queryByText(/za dużo/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled()
  })

  it('bez adresata - komunikat zamiast okna', () => {
    okno(null)
    expect(screen.getByText(/nie ma do kogo odpowiedzieć/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Treść odpowiedzi')).toBeNull()
  })
})
```

`components/skrzynka/WidokSprawy.test.tsx` - 2 zmiany:


1. Zamień:

```tsx
import { WidokSprawy } from '@/components/skrzynka/WidokSprawy'
import type { Sprawa, SzczegolySprawy } from '@/lib/skrzynka/typy'

const klient = { sprawa: vi.fn(), zmien: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: { sprawa: (...a: unknown[]) => klient.sprawa(...a), zmien: (...a: unknown[]) => klient.zmien(...a) },
}))

const EMAIL = 'kontakt@samorzad.ue.wroc.pl'
```

   na:

```tsx
import { WidokSprawy } from '@/components/skrzynka/WidokSprawy'
import type { Sprawa, SzczegolySprawy } from '@/lib/skrzynka/typy'

const klient = { sprawa: vi.fn(), zmien: vi.fn(), odpowiedz: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: {
    sprawa: (...a: unknown[]) => klient.sprawa(...a),
    zmien: (...a: unknown[]) => klient.zmien(...a),
    odpowiedz: (...a: unknown[]) => klient.odpowiedz(...a),
  },
}))

const EMAIL = 'kontakt@samorzad.ue.wroc.pl'
```


2. Zamień:

```tsx
    expect(screen.queryByRole('button', { name: /Pomiń zawsze domenę/ })).toBeNull()
  })

  it('błąd wczytania i powrót do listy', async () => {
    klient.sprawa.mockRejectedValue(new Error('Skrzynka jest rozłączona - połącz ją ponownie.'))
    const onZamknij = vi.fn()
```

   na:

```tsx
    expect(screen.queryByRole('button', { name: /Pomiń zawsze domenę/ })).toBeNull()
  })

  it('odpowiedź: okno pod wątkiem; po wysyłce rodzic dostaje sprawę, a wątek wczytuje się jeszcze raz', async () => {
    const { onZmiana } = await widok()
    expect(screen.getByRole('region', { name: 'Odpowiedź' })).toHaveTextContent('Do: anna@firma.pl')
    expect(screen.getByLabelText('Stopka')).toHaveTextContent('Samorząd Studentów UEW')
    klient.odpowiedz.mockResolvedValueOnce(S({ status: 'czeka-na-nich', oczekujeOd: null }))
    fireEvent.change(screen.getByLabelText('Treść odpowiedzi'), { target: { value: 'Dziękujemy' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }))
    })
    expect(klient.odpowiedz).toHaveBeenCalledWith('t1', 'Dziękujemy', [])
    expect(onZmiana).toHaveBeenCalledWith(expect.objectContaining({ status: 'czeka-na-nich' }))
    expect(klient.sprawa).toHaveBeenCalledTimes(2)
  })

  it('wątek usunięty w Gmailu - bez okna odpowiedzi', async () => {
    await widok({ ...D(), wiadomosci: [], adresat: null })
    expect(screen.queryByRole('region', { name: 'Odpowiedź' })).toBeNull()
  })

  it('przypisana osoba spoza Składu dalej widoczna w wyborze', async () => {
    await widok(D({ przypisana: 'Ola' }))
    expect(screen.getByLabelText('Przypisz')).toHaveValue('Ola')
    expect(screen.getByRole('option', { name: 'Ola (poza Składem)' })).toBeInTheDocument()
  })

  it('błąd wczytania i powrót do listy', async () => {
    klient.sprawa.mockRejectedValue(new Error('Skrzynka jest rozłączona - połącz ją ponownie.'))
    const onZamknij = vi.fn()
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/skrzynka/OknoOdpowiedzi.test.tsx components/skrzynka/WidokSprawy.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak okna i nowych metod klienta).

- [ ] **Krok 3: Implementacja**

`lib/skrzynka/klient.ts` zastąp w całości.

`lib/skrzynka/klient.ts` (cała nowa treść pliku):

```ts
'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type {
  KartaKontaktu, KartaOrganizacji, Organizacja, Sprawa, Status, StronaKontaktow, StronaSpraw, SzczegolySprawy, TypOrganizacji,
  UstawieniaSkrzynki, WynikSynchronizacji, ZmianaSprawy,
} from './typy'

export const klientSkrzynki = {
  importuj: (strona: string | null) =>
    wywolaj<{ nastepnaStrona: string | null; zrobione: number; razem: number }>('/api/skrzynka/import', json('POST', { strona })),
  synchronizuj: () => wywolaj<WynikSynchronizacji>('/api/skrzynka/synchronizuj', { method: 'POST' }),
  sprawy: (status: Status, po: string | null) =>
    wywolaj<StronaSpraw>(`/api/skrzynka/sprawy?${new URLSearchParams(po ? { status, po } : { status })}`),
  szukaj: (q: string) => wywolaj<StronaSpraw>(`/api/skrzynka/szukaj?${new URLSearchParams({ q })}`),
  sprawa: (id: string) => wywolaj<SzczegolySprawy>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}`),
  zmien: (id: string, z: ZmianaSprawy) => wywolaj<Sprawa>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}`, json('PATCH', z)),
  odpowiedz: (id: string, tekst: string, pliki: File[]) => {
    const fd = new FormData()
    fd.append('tekst', tekst)
    for (const p of pliki) fd.append('pliki', p)
    return wywolaj<Sprawa>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}/odpowiedz`, { method: 'POST', body: fd })
  },
  ustawienia: () => wywolaj<UstawieniaSkrzynki>('/api/skrzynka/ustawienia'),
  zapiszUstawienia: (z: Partial<UstawieniaSkrzynki>) => wywolaj<UstawieniaSkrzynki>('/api/skrzynka/ustawienia', json('PATCH', z)),
  rozlacz: (usunDane: boolean) => wywolaj<{ ok: true }>('/api/skrzynka/rozlacz', json('POST', { usunDane })),
  kontakty: (po: string | null) =>
    wywolaj<StronaKontaktow>(`/api/skrzynka/kontakty${po ? `?${new URLSearchParams({ po })}` : ''}`),
  kontakt: (email: string) => wywolaj<KartaKontaktu>(`/api/skrzynka/kontakty?${new URLSearchParams({ email })}`),
  organizacje: () => wywolaj<{ organizacje: Organizacja[] }>('/api/skrzynka/organizacje'),
  organizacja: (domena: string) => wywolaj<KartaOrganizacji>(`/api/skrzynka/organizacje?${new URLSearchParams({ domena })}`),
  zmienOrganizacje: (domena: string, z: { nazwa?: string; typ?: TypOrganizacji }) =>
    wywolaj<Organizacja>('/api/skrzynka/organizacje', json('PATCH', { domena, ...z })),
}
```

`components/skrzynka/OknoOdpowiedzi.tsx` (nowy plik):

```tsx
'use client'
import { useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { rozmiar } from '@/lib/skrzynka/widok'
import { MAKS_ZALACZNIKOW, type Sprawa } from '@/lib/skrzynka/typy'

/**
 * Odpowiedź w wątku z kontakt@. Błąd wysyłki zostawia tekst i załączniki -
 * nic nie trzeba pisać od nowa. Limit 4 MB sprawdzany tu i na serwerze.
 */
export function OknoOdpowiedzi({ sprawaId, adresat, stopka, onWyslano }: {
  sprawaId: string
  adresat: string | null
  stopka: string
  onWyslano: (s: Sprawa) => void
}) {
  const [tekst, setTekst] = useState('')
  const [pliki, setPliki] = useState<File[]>([])
  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const wybor = useRef<HTMLInputElement>(null)
  const razem = pliki.reduce((s, p) => s + p.size, 0)
  const zaDuzo = razem > MAKS_ZALACZNIKOW

  if (!adresat) return <p className="text-[12px] text-deck-muted">W tym wątku nie ma do kogo odpowiedzieć - napisz z Gmaila.</p>

  async function wyslij() {
    setTrwa(true)
    setBlad(null)
    try {
      const s = await klientSkrzynki.odpowiedz(sprawaId, tekst, pliki)
      setTekst('')
      setPliki([])
      onWyslano(s)
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  const przycisk = 'deck-chip inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] transition hover:text-deck-text disabled:opacity-50'

  return (
    <section aria-label="Odpowiedź" className="space-y-2 rounded-md border border-white/10 p-3 text-[12px]">
      <p className="text-deck-muted">
        Do: <span className="text-deck-text">{adresat}</span>
      </p>
      <textarea
        aria-label="Treść odpowiedzi"
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={6}
        className="deck-input w-full rounded-md px-2.5 py-2 text-[12.5px] leading-relaxed"
      />
      <input
        ref={wybor}
        type="file"
        multiple
        hidden
        aria-label="Wybierz pliki"
        onChange={(e) => {
          const nowe = [...(e.target.files ?? [])]
          setPliki((l) => [...l, ...nowe])
          // Ten sam plik wybrany drugi raz też ma wywołać zmianę.
          e.target.value = ''
        }}
      />
      {pliki.length > 0 && (
        <>
          <ul aria-label="Załączniki odpowiedzi" className="flex flex-wrap gap-1.5">
            {pliki.map((p, i) => (
              <li key={`${p.name}-${i}`} className="deck-chip inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]">
                {p.name} · {rozmiar(p.size)}
                <button type="button" aria-label={`Usuń ${p.name}`} onClick={() => setPliki((l) => l.filter((_, j) => j !== i))}>
                  <X size={11} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <p className={zaDuzo ? 'text-deck-danger' : 'text-deck-muted'}>
            Załączniki: {rozmiar(razem)} z 4 MB{zaDuzo ? ' - za dużo, usuń część plików' : ''}
          </p>
        </>
      )}
      {stopka && (
        <pre aria-label="Stopka" className="whitespace-pre-wrap font-sans text-[11.5px] text-deck-muted">
          {stopka}
        </pre>
      )}
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => wybor.current?.click()} disabled={trwa} className={przycisk}>
          <Paperclip size={12} aria-hidden="true" />
          Dodaj załączniki
        </button>
        <button type="button" onClick={wyslij} disabled={trwa || !tekst.trim() || zaDuzo} className={przycisk}>
          <Send size={12} aria-hidden="true" />
          {trwa ? 'Wysyłam…' : 'Wyślij'}
        </button>
      </div>
    </section>
  )
}
```

`components/skrzynka/WidokSprawy.tsx` - 4 zmiany:


1. Zamień:

```tsx
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_STATUSOW, adresZalacznika, linkGmail, pelnaData, rozmiar } from '@/lib/skrzynka/widok'
import { MAKS_POBRANIA, type Sprawa, type Status, type SzczegolySprawy, type ZmianaSprawy } from '@/lib/skrzynka/typy'
import { TrescWiadomosci } from './TrescWiadomosci'

/** Statusy do ustawienia jednym kliknięciem; Do przejrzenia ustawia tylko automat. */
```

   na:

```tsx
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_STATUSOW, adresZalacznika, linkGmail, pelnaData, rozmiar } from '@/lib/skrzynka/widok'
import { MAKS_POBRANIA, type Sprawa, type Status, type SzczegolySprawy, type ZmianaSprawy } from '@/lib/skrzynka/typy'
import { OknoOdpowiedzi } from './OknoOdpowiedzi'
import { TrescWiadomosci } from './TrescWiadomosci'

/** Statusy do ustawienia jednym kliknięciem; Do przejrzenia ustawia tylko automat. */
```


2. Zamień:

```tsx
    void zmien({ pomin: rodzaj })
  }

  const powrot = (
    <button type="button" onClick={onZamknij} className="text-[11.5px] text-deck-muted hover:underline lg:hidden">
      ← Lista
```

   na:

```tsx
    void zmien({ pomin: rodzaj })
  }

  async function poWyslaniu(s: Sprawa) {
    setDane((d) => d && { ...d, sprawa: s })
    onZmiana(s)
    // Wysłana wiadomość ma się pojawić w wątku - wczytujemy go jeszcze raz.
    try {
      setDane(await klientSkrzynki.sprawa(id))
    } catch {
      // Zostaje poprzedni widok - odpowiedź i tak poszła.
    }
  }

  const powrot = (
    <button type="button" onClick={onZamknij} className="text-[11.5px] text-deck-muted hover:underline lg:hidden">
      ← Lista
```


3. Zamień:

```tsx
            className="deck-input rounded-md px-2 py-1"
          >
            <option value="">nikt</option>
            {sklad.map((o) => (
              <option key={o} value={o}>
                {o}
```

   na:

```tsx
            className="deck-input rounded-md px-2 py-1"
          >
            <option value="">nikt</option>
            {/* Osoba, która wypadła ze Składu, dalej widnieje przy sprawie - inaczej lista pokazałaby „nikt”. */}
            {s.przypisana && !sklad.includes(s.przypisana) && <option value={s.przypisana}>{s.przypisana} (poza Składem)</option>}
            {sklad.map((o) => (
              <option key={o} value={o}>
                {o}
```


4. Zamień:

```tsx
          </li>
        ))}
      </ol>
    </section>
  )
}
```

   na:

```tsx
          </li>
        ))}
      </ol>
      {dane.wiadomosci.length > 0 && (
        <OknoOdpowiedzi key={s.id} sprawaId={s.id} adresat={dane.adresat} stopka={dane.stopka} onWyslano={poWyslaniu} />
      )}
    </section>
  )
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add components/skrzynka/OknoOdpowiedzi.test.tsx components/skrzynka/OknoOdpowiedzi.tsx components/skrzynka/WidokSprawy.test.tsx components/skrzynka/WidokSprawy.tsx lib/skrzynka/klient.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): okno odpowiedzi z zalacznikami i stopka w widoku sprawy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 7: Wspólny wiersz sprawy i szybkie akcje Do przejrzenia

**Pliki:** nowy `components/skrzynka/WierszSprawy.tsx`; zmiana `components/skrzynka/ListaSpraw.tsx`, `components/skrzynka/ListaSpraw.test.tsx`

**Interfejsy:**
- Korzysta z: `klientSkrzynki.zmien` (2a), `poTerminie`, `kiedyKrotko`, `ETYKIETY_STATUSOW`.
- Daje: `WierszSprawy({ s, teraz, wybrana, onWybierz, zStatusem?, akcje? })`; `ListaSpraw` z `onZmiana?: () => void`.

- [ ] **Krok 1: Testy**

`components/skrzynka/ListaSpraw.test.tsx` - 2 zmiany:


1. Zamień:

```tsx
import { ListaSpraw } from '@/components/skrzynka/ListaSpraw'
import type { Sprawa } from '@/lib/skrzynka/typy'

const klient = { sprawy: vi.fn(), szukaj: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: { sprawy: (...a: unknown[]) => klient.sprawy(...a), szukaj: (...a: unknown[]) => klient.szukaj(...a) },
}))

const S = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
```

   na:

```tsx
import { ListaSpraw } from '@/components/skrzynka/ListaSpraw'
import type { Sprawa } from '@/lib/skrzynka/typy'

const klient = { sprawy: vi.fn(), szukaj: vi.fn(), zmien: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: {
    sprawy: (...a: unknown[]) => klient.sprawy(...a),
    szukaj: (...a: unknown[]) => klient.szukaj(...a),
    zmien: (...a: unknown[]) => klient.zmien(...a),
  },
}))

const S = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
```


2. Zamień:

```tsx
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
  })
})
```

   na:

```tsx
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
  })
})

describe('ListaSpraw - Do przejrzenia i błędy', () => {
  it('Do przejrzenia: jednym kliknięciem do odpowiedzi albo do pominiętych; sprawa znika, rodzic odświeża liczby', async () => {
    klient.sprawy.mockResolvedValue({ sprawy: [S('t1', { status: 'do-przejrzenia' }), S('t2', { status: 'do-przejrzenia' })], nastepna: null })
    klient.zmien.mockResolvedValue({})
    const onZmiana = vi.fn()
    await lista({ status: 'do-przejrzenia', onZmiana })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Do odpowiedzi: Temat t1' }))
    })
    expect(klient.zmien).toHaveBeenCalledWith('t1', { status: 'do-odpowiedzi' })
    expect(screen.queryByRole('button', { name: /Temat t1/ })).toBeNull()
    expect(onZmiana).toHaveBeenCalledTimes(1)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pomiń: Temat t2' }))
    })
    expect(klient.zmien).toHaveBeenLastCalledWith('t2', { status: 'pominieta' })
  })

  it('inne zakładki bez szybkich akcji', async () => {
    klient.sprawy.mockResolvedValue({ sprawy: [S('t1')], nastepna: null })
    await lista()
    expect(screen.queryByRole('button', { name: /^Pomiń:/ })).toBeNull()
  })

  it('błąd przy „Pokaż więcej” zostawia wczytaną listę', async () => {
    klient.sprawy
      .mockResolvedValueOnce({ sprawy: [S('t1')], nastepna: 'k1' })
      .mockRejectedValueOnce(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    await lista()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
    expect(screen.getByRole('button', { name: /Temat t1/ })).toBeInTheDocument()
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/skrzynka/ListaSpraw.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak szybkich akcji; błąd „Pokaż więcej” zastępuje listę).

- [ ] **Krok 3: Implementacja**

`components/skrzynka/ListaSpraw.tsx` zastąp w całości.

`components/skrzynka/WierszSprawy.tsx` (nowy plik):

```tsx
'use client'
import type { ReactNode } from 'react'
import { poTerminie } from '@/lib/skrzynka/statusy'
import { ETYKIETY_STATUSOW, kiedyKrotko } from '@/lib/skrzynka/widok'
import type { Sprawa } from '@/lib/skrzynka/typy'

/**
 * Jedna sprawa na liście: kto, temat, fragment, wiek i znaczniki. `zStatusem`
 * - na karcie osoby albo organizacji, gdzie sprawy mają różne statusy.
 * `akcje` stoją obok przycisku, nie w nim - przycisk w przycisku jest niepoprawny.
 */
export function WierszSprawy({ s, teraz, wybrana, onWybierz, zStatusem = false, akcje }: {
  s: Sprawa
  teraz: number
  wybrana: boolean
  onWybierz: (id: string) => void
  zStatusem?: boolean
  akcje?: ReactNode
}) {
  const poCzasie = poTerminie(s.oczekujeOd, teraz)
  return (
    <li className="flex items-stretch gap-1.5">
      <button
        type="button"
        onClick={() => onWybierz(s.id)}
        aria-pressed={wybrana}
        className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-left transition ${
          wybrana ? 'border-deck-accent/50 bg-deck-accent/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2 text-[12px]">
          <span className={`truncate ${s.nowa ? 'font-semibold text-deck-text' : 'text-deck-text'}`}>
            {s.kontakt ?? '(bez nadawcy)'}
            {s.organizacja && <span className="font-normal text-deck-muted"> · {s.organizacja}</span>}
          </span>
          <span className="flex-none font-mono text-[10.5px] text-deck-muted">{kiedyKrotko(s.ostatnia.kiedy, teraz)}</span>
        </div>
        <div className="truncate text-[12.5px] text-deck-text">{s.temat}</div>
        <div className="truncate text-[11.5px] text-deck-muted">{s.ostatnia.fragment}</div>
        {(zStatusem || poCzasie || s.nowa || s.przypisana) && (
          <div className="mt-1 flex flex-wrap gap-2 font-mono text-[9.5px] uppercase tracking-[0.12em]">
            {zStatusem && <span className="text-deck-muted">{ETYKIETY_STATUSOW[s.status]}</span>}
            {poCzasie && <span className="text-deck-danger">po terminie</span>}
            {s.nowa && <span className="text-deck-accent">nowa</span>}
            {s.przypisana && <span className="text-deck-muted">{s.przypisana}</span>}
          </div>
        )}
      </button>
      {akcje && <div className="flex flex-none flex-col justify-center gap-1">{akcje}</div>}
    </li>
  )
}
```

`components/skrzynka/ListaSpraw.tsx` (cała nowa treść pliku):

```tsx
'use client'
import { useEffect, useState } from 'react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import type { Status, StronaSpraw } from '@/lib/skrzynka/typy'
import { useTeraz } from '@/lib/useTeraz'
import { WierszSprawy } from './WierszSprawy'

/**
 * Jedna zakładka albo wyniki wyszukiwania. Stan zaczyna się od zera przy
 * zmianie zakładki, bo rodzic podaje `key` - tu tylko wczytujemy.
 * `wersja` rośnie po zmianie sprawy i wymusza ponowne wczytanie.
 */
export function ListaSpraw({ status, szukane, wybrana, onWybierz, wersja, onZmiana }: {
  status: Status
  szukane: string
  wybrana: string | null
  onWybierz: (id: string) => void
  wersja: number
  /** Po szybkiej zmianie statusu z listy - rodzic odświeża liczby. */
  onZmiana?: () => void
}) {
  const teraz = useTeraz(60_000)
  const [strona, setStrona] = useState<StronaSpraw | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [laduje, setLaduje] = useState(false)

  useEffect(() => {
    let aktywny = true
    ;(szukane ? klientSkrzynki.szukaj(szukane) : klientSkrzynki.sprawy(status, null))
      .then((s) => {
        if (!aktywny) return
        setStrona(s)
        setBlad(null)
      })
      .catch((e: Error) => {
        if (aktywny) setBlad(e.message)
      })
    return () => {
      aktywny = false
    }
  }, [status, szukane, wersja])

  async function wiecej() {
    if (!strona?.nastepna) return
    setLaduje(true)
    try {
      const s = await klientSkrzynki.sprawy(status, strona.nastepna)
      setStrona({ sprawy: [...strona.sprawy, ...s.sprawy], nastepna: s.nastepna })
      setBlad(null)
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setLaduje(false)
    }
  }

  function wybierz(id: string) {
    // Znacznik „nowa” znika od razu - serwer zdejmie go przy otwarciu.
    setStrona((s) => s && { ...s, sprawy: s.sprawy.map((x) => (x.id === id ? { ...x, nowa: false } : x)) })
    onWybierz(id)
  }

  /** Do przejrzenia: jednym kliknięciem do odpowiedzi albo do pominiętych - sprawa znika z tej zakładki. */
  async function przenies(id: string, s: Status) {
    try {
      await klientSkrzynki.zmien(id, { status: s })
      setStrona((st) => st && { ...st, sprawy: st.sprawy.filter((x) => x.id !== id) })
      onZmiana?.()
    } catch (e) {
      setBlad((e as Error).message)
    }
  }

  const alert = blad && <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p>
  if (!strona) return alert || <p className="font-mono text-[11px] text-deck-muted">Wczytuję sprawy…</p>
  if (!strona.sprawy.length) {
    return <p className="text-[12.5px] text-deck-muted">{szukane ? 'Nic nie znaleziono.' : 'Brak spraw w tej zakładce.'}</p>
  }

  const szybkie = status === 'do-przejrzenia' && !szukane
  const maly = 'deck-chip rounded-md px-2 py-0.5 text-[10.5px] transition hover:text-deck-text'

  return (
    <div className="space-y-2">
      <ul aria-label="Sprawy" className="space-y-1.5">
        {strona.sprawy.map((s) => (
          <WierszSprawy
            key={s.id}
            s={s}
            teraz={teraz}
            wybrana={s.id === wybrana}
            onWybierz={wybierz}
            akcje={
              szybkie && (
                <>
                  <button type="button" aria-label={`Do odpowiedzi: ${s.temat}`} onClick={() => przenies(s.id, 'do-odpowiedzi')} className={maly}>
                    Do odpowiedzi
                  </button>
                  <button type="button" aria-label={`Pomiń: ${s.temat}`} onClick={() => przenies(s.id, 'pominieta')} className={maly}>
                    Pomiń
                  </button>
                </>
              )
            }
          />
        ))}
      </ul>
      {alert}
      {strona.nastepna && (
        <button type="button" onClick={wiecej} disabled={laduje} className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
          Pokaż więcej
        </button>
      )}
    </div>
  )
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add components/skrzynka/ListaSpraw.test.tsx components/skrzynka/ListaSpraw.tsx components/skrzynka/WierszSprawy.tsx
git commit -m "$(cat <<'EOF'
feat(skrzynka): wspolny wiersz sprawy i szybkie akcje w Do przejrzenia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 8: Kontakty i Organizacje

**Pliki:** zmiana `lib/skrzynka/widok.ts`; nowe `components/skrzynka/Kontakty.tsx`, `components/skrzynka/Organizacje.tsx`, `components/skrzynka/Kontakty.test.tsx`

**Interfejsy:**
- Korzysta z: `klientSkrzynki.kontakty/kontakt/organizacje/organizacja/zmienOrganizacje` (zadanie 6), `WierszSprawy` (zadanie 7), `TYPY_ORGANIZACJI`.
- Daje: `ETYKIETY_TYPOW`; `Kontakty({ wybrana, onWybierz })`, `Organizacje({ wybrana, onWybierz })`.

- [ ] **Krok 1: Testy**

`components/skrzynka/Kontakty.test.tsx` (nowy plik):

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Kontakty } from '@/components/skrzynka/Kontakty'
import { Organizacje } from '@/components/skrzynka/Organizacje'
import type { Sprawa } from '@/lib/skrzynka/typy'

const klient = { kontakty: vi.fn(), kontakt: vi.fn(), organizacje: vi.fn(), organizacja: vi.fn(), zmienOrganizacje: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: {
    kontakty: (...a: unknown[]) => klient.kontakty(...a),
    kontakt: (...a: unknown[]) => klient.kontakt(...a),
    organizacje: (...a: unknown[]) => klient.organizacje(...a),
    organizacja: (...a: unknown[]) => klient.organizacja(...a),
    zmienOrganizacje: (...a: unknown[]) => klient.zmienOrganizacje(...a),
  },
}))

const S = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
  id, temat: `Temat ${id}`, status: 'w-toku', oczekujeOd: null, nowa: false, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
  ostatnia: { kiedy: Date.UTC(2026, 8, 2), kierunek: 'oni', fragment: '' }, wiadomosci: 1, przypisana: null, kategoriaGmail: null, zmieniono: 1, ...n,
})
const ANNA = { email: 'anna@firma.pl', imie: 'Anna Kowalska', organizacja: 'firma.pl', typ: null }
const klik = (nazwa: string | RegExp) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nazwa }))
  })

beforeEach(() => Object.values(klient).forEach((f) => f.mockReset()))

describe('Kontakty', () => {
  it('lista z imieniem i organizacją; kolejna strona po kursorze', async () => {
    klient.kontakty
      .mockResolvedValueOnce({ kontakty: [ANNA], nastepna: 'anna@firma.pl' })
      .mockResolvedValueOnce({ kontakty: [{ email: 'jan@x.pl', imie: '', organizacja: null, typ: 'student' }], nastepna: null })
    await act(async () => {
      render(<Kontakty wybrana={null} onWybierz={vi.fn()} />)
    })
    expect(screen.getByRole('button', { name: /Anna Kowalska/ })).toHaveTextContent('Anna Kowalska · anna@firma.pl · firma.pl')
    await klik('Pokaż więcej')
    expect(klient.kontakty).toHaveBeenLastCalledWith('anna@firma.pl')
    expect(screen.getByRole('button', { name: 'jan@x.pl' })).toBeInTheDocument()
  })

  it('karta osoby ze sprawami i statusami; wybór sprawy; powrót do listy', async () => {
    klient.kontakty.mockResolvedValue({ kontakty: [ANNA], nastepna: null })
    klient.kontakt.mockResolvedValue({ kontakt: ANNA, sprawy: [S('t1'), S('t2', { status: 'zalatwiona' })] })
    const onWybierz = vi.fn()
    await act(async () => {
      render(<Kontakty wybrana={null} onWybierz={onWybierz} />)
    })
    await klik(/Anna Kowalska/)
    expect(klient.kontakt).toHaveBeenCalledWith('anna@firma.pl')
    expect(screen.getByRole('heading', { name: 'Anna Kowalska' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Temat t2/ })).toHaveTextContent('Załatwione')
    fireEvent.click(screen.getByRole('button', { name: /Temat t1/ }))
    expect(onWybierz).toHaveBeenCalledWith('t1')
    fireEvent.click(screen.getByRole('button', { name: '← Kontakty' }))
    expect(screen.getByRole('list', { name: 'Kontakty' })).toBeInTheDocument()
  })
})

describe('Organizacje', () => {
  const ORG = [
    { domena: 'firma.pl', nazwa: 'firma.pl', typ: 'inne' as const },
    { domena: 'ue.wroc.pl', nazwa: 'Uniwersytet Ekonomiczny', typ: 'uczelnia' as const },
  ]

  it('filtr typu', async () => {
    klient.organizacje.mockResolvedValue({ organizacje: ORG })
    await act(async () => {
      render(<Organizacje wybrana={null} onWybierz={vi.fn()} />)
    })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    fireEvent.change(screen.getByLabelText('Filtr typu'), { target: { value: 'uczelnia' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Uniwersytet Ekonomiczny/ })).toHaveTextContent('Uczelnia')
  })

  it('karta: osoby i sprawy; zmiana nazwy i typu zapisuje i aktualizuje listę', async () => {
    klient.organizacje.mockResolvedValue({ organizacje: ORG })
    klient.organizacja.mockResolvedValue({ organizacja: ORG[0], kontakty: [ANNA], sprawy: [S('t1')] })
    klient.zmienOrganizacje.mockResolvedValue({ domena: 'firma.pl', nazwa: 'Firma S.A.', typ: 'sponsor' })
    await act(async () => {
      render(<Organizacje wybrana={null} onWybierz={vi.fn()} />)
    })
    await klik(/^firma\.pl/)
    expect(screen.getByRole('list', { name: 'Osoby organizacji' })).toHaveTextContent('Anna Kowalska · anna@firma.pl')
    expect(screen.getByRole('button', { name: /Temat t1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Nazwa organizacji'), { target: { value: ' Firma S.A. ' } })
    fireEvent.change(screen.getByLabelText('Typ organizacji'), { target: { value: 'sponsor' } })
    await klik('Zapisz')
    expect(klient.zmienOrganizacje).toHaveBeenCalledWith('firma.pl', { nazwa: 'Firma S.A.', typ: 'sponsor' })
    expect(screen.getByRole('heading', { name: 'Firma S.A.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Organizacje' }))
    expect(screen.getByRole('button', { name: /Firma S\.A\./ })).toHaveTextContent('Sponsor')
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/skrzynka/Kontakty.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak komponentów).

- [ ] **Krok 3: Implementacja**

`lib/skrzynka/widok.ts` - 2 zmiany:


1. Zamień:

```ts
import { dzisWarszawa } from '@/lib/czas'
import type { Status, Zalacznik } from './typy'

export const ETYKIETY_STATUSOW: Record<Status, string> = {
  'do-odpowiedzi': 'Do odpowiedzi',
```

   na:

```ts
import { dzisWarszawa } from '@/lib/czas'
import type { Status, TypOrganizacji, Zalacznik } from './typy'

export const ETYKIETY_STATUSOW: Record<Status, string> = {
  'do-odpowiedzi': 'Do odpowiedzi',
```


2. Zamień:

```ts
  pominieta: 'Pominięte',
}

/** Kolejność zakładek: od tego, co wymaga ruchu, do archiwum. */
export const ZAKLADKI: Status[] = ['do-odpowiedzi', 'w-toku', 'czeka-na-nich', 'do-przejrzenia', 'zalatwiona', 'pominieta']
```

   na:

```ts
  pominieta: 'Pominięte',
}

export const ETYKIETY_TYPOW: Record<TypOrganizacji, string> = {
  partner: 'Partner',
  sponsor: 'Sponsor',
  uczelnia: 'Uczelnia',
  'organizacja-studencka': 'Organizacja studencka',
  media: 'Media',
  inne: 'Inne',
}

/** Kolejność zakładek: od tego, co wymaga ruchu, do archiwum. */
export const ZAKLADKI: Status[] = ['do-odpowiedzi', 'w-toku', 'czeka-na-nich', 'do-przejrzenia', 'zalatwiona', 'pominieta']
```

`components/skrzynka/Kontakty.tsx` (nowy plik):

```tsx
'use client'
import { useEffect, useState } from 'react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import type { KartaKontaktu, StronaKontaktow } from '@/lib/skrzynka/typy'
import { useTeraz } from '@/lib/useTeraz'
import { WierszSprawy } from './WierszSprawy'

/** Zakładka Kontakty: lista osób stronami, a po kliknięciu karta osoby z jej sprawami. Sprawa otwiera się obok. */
export function Kontakty({ wybrana, onWybierz }: { wybrana: string | null; onWybierz: (id: string) => void }) {
  const teraz = useTeraz(60_000)
  const [strona, setStrona] = useState<StronaKontaktow | null>(null)
  const [karta, setKarta] = useState<KartaKontaktu | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [laduje, setLaduje] = useState(false)

  useEffect(() => {
    let aktywny = true
    klientSkrzynki
      .kontakty(null)
      .then((s) => {
        if (aktywny) setStrona(s)
      })
      .catch((e: Error) => {
        if (aktywny) setBlad(e.message)
      })
    return () => {
      aktywny = false
    }
  }, [])

  async function wczytaj<T>(f: () => Promise<T>, po: (x: T) => void) {
    setLaduje(true)
    setBlad(null)
    try {
      po(await f())
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setLaduje(false)
    }
  }

  const alert = blad && <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p>

  if (karta) {
    const k = karta.kontakt
    return (
      <section aria-label={`Kontakt: ${k.email}`} className="space-y-2 text-[12.5px]">
        <button type="button" onClick={() => setKarta(null)} className="text-[11.5px] text-deck-muted hover:underline">
          ← Kontakty
        </button>
        <h3 className="text-[14px] font-semibold text-deck-text">{k.imie || k.email}</h3>
        <p className="text-deck-muted">
          {k.email}
          {k.organizacja && ` · ${k.organizacja}`}
          {k.typ === 'student' && ' · student'}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-deck-muted">Sprawy: {karta.sprawy.length}</p>
        <ul aria-label="Sprawy osoby" className="space-y-1.5">
          {karta.sprawy.map((s) => (
            <WierszSprawy key={s.id} s={s} teraz={teraz} wybrana={s.id === wybrana} onWybierz={onWybierz} zStatusem />
          ))}
        </ul>
        {alert}
      </section>
    )
  }

  if (!strona) return alert || <p className="font-mono text-[11px] text-deck-muted">Wczytuję kontakty…</p>
  if (!strona.kontakty.length) return <p className="text-[12.5px] text-deck-muted">Brak kontaktów - pojawią się po imporcie skrzynki.</p>

  return (
    <div className="space-y-2">
      <ul aria-label="Kontakty" className="space-y-1">
        {strona.kontakty.map((k) => (
          <li key={k.email}>
            <button
              type="button"
              disabled={laduje}
              onClick={() => wczytaj(() => klientSkrzynki.kontakt(k.email), setKarta)}
              className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-[12px] transition hover:bg-white/[0.06]"
            >
              <span className="text-deck-text">{k.imie || k.email}</span>
              <span className="text-deck-muted">
                {k.imie && ` · ${k.email}`}
                {k.organizacja && ` · ${k.organizacja}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {alert}
      {strona.nastepna && (
        <button
          type="button"
          disabled={laduje}
          onClick={() =>
            wczytaj(
              () => klientSkrzynki.kontakty(strona.nastepna),
              (s) => setStrona({ kontakty: [...strona.kontakty, ...s.kontakty], nastepna: s.nastepna }),
            )
          }
          className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50"
        >
          Pokaż więcej
        </button>
      )}
    </div>
  )
}
```

`components/skrzynka/Organizacje.tsx` (nowy plik):

```tsx
'use client'
import { useEffect, useState } from 'react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_TYPOW } from '@/lib/skrzynka/widok'
import { TYPY_ORGANIZACJI, type KartaOrganizacji, type Organizacja, type TypOrganizacji } from '@/lib/skrzynka/typy'
import { useTeraz } from '@/lib/useTeraz'
import { WierszSprawy } from './WierszSprawy'

/**
 * Zakładka Organizacje: lista z filtrem typu, karta z osobami i sprawami,
 * zmiana nazwy i typu. Synchronizacja nie nadpisuje tego, co tu ustawisz.
 */
export function Organizacje({ wybrana, onWybierz }: { wybrana: string | null; onWybierz: (id: string) => void }) {
  const teraz = useTeraz(60_000)
  const [lista, setLista] = useState<Organizacja[] | null>(null)
  const [filtr, setFiltr] = useState<TypOrganizacji | ''>('')
  const [karta, setKarta] = useState<KartaOrganizacji | null>(null)
  const [nazwa, setNazwa] = useState('')
  const [typ, setTyp] = useState<TypOrganizacji>('inne')
  const [blad, setBlad] = useState<string | null>(null)
  const [trwa, setTrwa] = useState(false)

  useEffect(() => {
    let aktywny = true
    klientSkrzynki
      .organizacje()
      .then((o) => {
        if (aktywny) setLista(o.organizacje)
      })
      .catch((e: Error) => {
        if (aktywny) setBlad(e.message)
      })
    return () => {
      aktywny = false
    }
  }, [])

  async function otworz(domena: string) {
    setTrwa(true)
    setBlad(null)
    try {
      const k = await klientSkrzynki.organizacja(domena)
      setKarta(k)
      setNazwa(k.organizacja.nazwa)
      setTyp(k.organizacja.typ)
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  async function zapisz() {
    if (!karta) return
    setTrwa(true)
    setBlad(null)
    try {
      const o = await klientSkrzynki.zmienOrganizacje(karta.organizacja.domena, { nazwa: nazwa.trim(), typ })
      setKarta({ ...karta, organizacja: o })
      setLista((l) => l && l.map((x) => (x.domena === o.domena ? o : x)))
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  const alert = blad && <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p>

  if (karta) {
    const o = karta.organizacja
    const zmieniona = nazwa.trim() !== o.nazwa || typ !== o.typ
    return (
      <section aria-label={`Organizacja: ${o.domena}`} className="space-y-3 text-[12.5px]">
        <button type="button" onClick={() => setKarta(null)} className="text-[11.5px] text-deck-muted hover:underline">
          ← Organizacje
        </button>
        <div className="space-y-1.5">
          <h3 className="text-[14px] font-semibold text-deck-text">{o.nazwa}</h3>
          <p className="text-deck-muted">{o.domena}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              aria-label="Nazwa organizacji"
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              maxLength={120}
              className="deck-input min-w-0 flex-1 rounded-md px-2 py-1"
            />
            <select aria-label="Typ organizacji" value={typ} onChange={(e) => setTyp(e.target.value as TypOrganizacji)} className="deck-input rounded-md px-2 py-1">
              {TYPY_ORGANIZACJI.map((t) => (
                <option key={t} value={t}>
                  {ETYKIETY_TYPOW[t]}
                </option>
              ))}
            </select>
            <button type="button" onClick={zapisz} disabled={trwa || !zmieniona || !nazwa.trim()} className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
              Zapisz
            </button>
          </div>
        </div>
        {alert}
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-deck-muted">Osoby: {karta.kontakty.length}</p>
        <ul aria-label="Osoby organizacji" className="flex flex-wrap gap-1.5">
          {karta.kontakty.map((k) => (
            <li key={k.email} className="deck-chip rounded-md px-2 py-0.5 text-[11.5px]">
              {k.imie ? `${k.imie} · ${k.email}` : k.email}
            </li>
          ))}
        </ul>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-deck-muted">Sprawy: {karta.sprawy.length}</p>
        <ul aria-label="Sprawy organizacji" className="space-y-1.5">
          {karta.sprawy.map((s) => (
            <WierszSprawy key={s.id} s={s} teraz={teraz} wybrana={s.id === wybrana} onWybierz={onWybierz} zStatusem />
          ))}
        </ul>
      </section>
    )
  }

  if (!lista) return alert || <p className="font-mono text-[11px] text-deck-muted">Wczytuję organizacje…</p>
  const widoczne = filtr ? lista.filter((o) => o.typ === filtr) : lista

  return (
    <div className="space-y-2">
      <select aria-label="Filtr typu" value={filtr} onChange={(e) => setFiltr(e.target.value as TypOrganizacji | '')} className="deck-input rounded-md px-2 py-1 text-[12px]">
        <option value="">Wszystkie typy</option>
        {TYPY_ORGANIZACJI.map((t) => (
          <option key={t} value={t}>
            {ETYKIETY_TYPOW[t]}
          </option>
        ))}
      </select>
      {alert}
      {widoczne.length ? (
        <ul aria-label="Organizacje" className="space-y-1">
          {widoczne.map((o) => (
            <li key={o.domena}>
              <button
                type="button"
                disabled={trwa}
                onClick={() => otworz(o.domena)}
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-[12px] transition hover:bg-white/[0.06]"
              >
                <span className="text-deck-text">{o.nazwa}</span>
                <span className="text-deck-muted">
                  {o.nazwa !== o.domena && ` · ${o.domena}`} · {ETYKIETY_TYPOW[o.typ]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-deck-muted">Brak organizacji tego typu.</p>
      )}
    </div>
  )
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run components/skrzynka lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add components/skrzynka/Kontakty.test.tsx components/skrzynka/Kontakty.tsx components/skrzynka/Organizacje.tsx lib/skrzynka/widok.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): kartoteki kontaktow i organizacji z kartami spraw

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 9: Ustawienia skrzynki

**Pliki:** nowe `components/skrzynka/UstawieniaSkrzynki.tsx`, `components/skrzynka/UstawieniaSkrzynki.test.tsx`

**Interfejsy:**
- Korzysta z: `klientSkrzynki.ustawienia/zapiszUstawienia/rozlacz` (zadanie 6).
- Daje: `UstawieniaSkrzynki()`.

- [ ] **Krok 1: Testy**

`components/skrzynka/UstawieniaSkrzynki.test.tsx` (nowy plik):

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UstawieniaSkrzynki } from '@/components/skrzynka/UstawieniaSkrzynki'

const refresh = vi.fn()
const klient = { ustawienia: vi.fn(), zapiszUstawienia: vi.fn(), rozlacz: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: {
    ustawienia: (...a: unknown[]) => klient.ustawienia(...a),
    zapiszUstawienia: (...a: unknown[]) => klient.zapiszUstawienia(...a),
    rozlacz: (...a: unknown[]) => klient.rozlacz(...a),
  },
}))

const U = { stopka: '-- \nSamorząd', pomijaneAdresy: ['news@sklep.pl'], pomijaneDomeny: ['reklama.pl'] }
const pokaz = () =>
  act(async () => {
    render(<UstawieniaSkrzynki />)
  })
const klik = (nazwa: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nazwa }))
  })

beforeEach(() => {
  refresh.mockReset()
  Object.values(klient).forEach((f) => f.mockReset())
  klient.ustawienia.mockResolvedValue(U)
})
afterEach(() => vi.restoreAllMocks())

describe('UstawieniaSkrzynki', () => {
  it('stopka: zapis po zmianie', async () => {
    await pokaz()
    expect(screen.getByLabelText('Stopka')).toHaveValue('-- \nSamorząd')
    expect(screen.getByRole('button', { name: 'Zapisz stopkę' })).toBeDisabled()
    klient.zapiszUstawienia.mockResolvedValue({ ...U, stopka: 'Pozdrawiamy' })
    fireEvent.change(screen.getByLabelText('Stopka'), { target: { value: 'Pozdrawiamy' } })
    await klik('Zapisz stopkę')
    expect(klient.zapiszUstawienia).toHaveBeenCalledWith({ stopka: 'Pozdrawiamy' })
    expect(screen.getByRole('status')).toHaveTextContent('Zapisano.')
  })

  it('pomijani: usunięcie i dodanie zapisują całą listę; odmowa serwera widoczna, wpis zostaje', async () => {
    await pokaz()
    klient.zapiszUstawienia.mockResolvedValueOnce({ ...U, pomijaneAdresy: [] })
    await klik('Usuń news@sklep.pl')
    expect(klient.zapiszUstawienia).toHaveBeenLastCalledWith({ pomijaneAdresy: [] })
    expect(screen.queryByRole('list', { name: 'Pomijane adresy' })).toBeNull()
    klient.zapiszUstawienia.mockRejectedValueOnce(new Error('Domeny gmail.com nie można pominąć w całości - dodaj pojedyncze adresy.'))
    fireEvent.change(screen.getByLabelText('Domena do pomijania'), { target: { value: 'gmail.com' } })
    await klik('Dodaj domenę')
    expect(klient.zapiszUstawienia).toHaveBeenLastCalledWith({ pomijaneDomeny: ['reklama.pl', 'gmail.com'] })
    expect(screen.getByRole('alert')).toHaveTextContent('gmail.com')
    expect(screen.getByLabelText('Domena do pomijania')).toHaveValue('gmail.com')
  })

  it('rozłączenie: tylko po potwierdzeniu; z usuwaniem danych, gdy zaznaczone; potem odświeżenie strony', async () => {
    await pokaz()
    const potwierdz = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await klik('Rozłącz skrzynkę')
    expect(klient.rozlacz).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Usuń też sprawy, kontakty i organizacje z D.E.C.K.'))
    potwierdz.mockReturnValueOnce(true)
    klient.rozlacz.mockResolvedValue({ ok: true })
    await klik('Rozłącz skrzynkę')
    expect(potwierdz).toHaveBeenLastCalledWith(expect.stringContaining('Tego nie da się cofnąć'))
    expect(klient.rozlacz).toHaveBeenCalledWith(true)
    expect(refresh).toHaveBeenCalled()
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/skrzynka/UstawieniaSkrzynki.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak komponentu).

- [ ] **Krok 3: Implementacja**

`components/skrzynka/UstawieniaSkrzynki.tsx` (nowy plik):

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import type { UstawieniaSkrzynki as Ustawienia } from '@/lib/skrzynka/typy'

/**
 * Stopka odpowiedzi, listy „zawsze pomijaj” i „Rozłącz”. Każda zmiana listy
 * zapisuje się od razu - serwer sprawdza adresy i nie przyjmie domeny gmail.com.
 */
export function UstawieniaSkrzynki() {
  const router = useRouter()
  const [u, setU] = useState<Ustawienia | null>(null)
  const [stopka, setStopka] = useState('')
  const [adres, setAdres] = useState('')
  const [domena, setDomena] = useState('')
  const [usunDane, setUsunDane] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [trwa, setTrwa] = useState(false)

  useEffect(() => {
    let aktywny = true
    klientSkrzynki
      .ustawienia()
      .then((x) => {
        if (!aktywny) return
        setU(x)
        setStopka(x.stopka)
      })
      .catch((e: Error) => {
        if (aktywny) setBlad(e.message)
      })
    return () => {
      aktywny = false
    }
  }, [])

  async function zapisz(z: Partial<Ustawienia>, potem?: () => void) {
    setTrwa(true)
    setBlad(null)
    setInfo(null)
    try {
      const n = await klientSkrzynki.zapiszUstawienia(z)
      setU(n)
      setStopka(n.stopka)
      setInfo('Zapisano.')
      potem?.()
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  async function rozlacz() {
    const pytanie = usunDane
      ? 'Rozłączyć skrzynkę i usunąć z D.E.C.K. wszystkie sprawy, kontakty i organizacje? Tego nie da się cofnąć.'
      : 'Rozłączyć skrzynkę? Sprawy zostaną w D.E.C.K., a po ponownym połączeniu import ruszy od nowa.'
    if (!window.confirm(pytanie)) return
    setTrwa(true)
    setBlad(null)
    try {
      await klientSkrzynki.rozlacz(usunDane)
      router.refresh()
    } catch (e) {
      setBlad((e as Error).message)
      setTrwa(false)
    }
  }

  if (!u) {
    return blad ? <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p> : <p className="font-mono text-[11px] text-deck-muted">Wczytuję ustawienia…</p>
  }

  const naglowek = 'font-mono text-[10px] uppercase tracking-[0.16em] text-deck-muted'
  const przycisk = 'deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50'

  const lista = (nazwa: string, pole: 'pomijaneAdresy' | 'pomijaneDomeny', wartosci: string[]) => {
    if (!wartosci.length) return <p className="text-deck-muted">Pusto.</p>
    return (
      <ul aria-label={nazwa} className="flex flex-wrap gap-1.5">
        {wartosci.map((w) => (
          <li key={w} className="deck-chip inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px]">
            {w}
            <button type="button" aria-label={`Usuń ${w}`} disabled={trwa} onClick={() => zapisz({ [pole]: wartosci.filter((x) => x !== w) })}>
              <X size={11} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section aria-label="Ustawienia skrzynki" className="deck-card max-w-[720px] space-y-5 rounded-lg p-5 text-[12.5px]">
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}
      {info && <p role="status" className="text-deck-muted">{info}</p>}

      <div className="space-y-2">
        <h3 className={naglowek}>Stopka odpowiedzi</h3>
        <textarea aria-label="Stopka" value={stopka} onChange={(e) => setStopka(e.target.value)} rows={4} maxLength={1000} className="deck-input w-full rounded-md px-2.5 py-2" />
        <button type="button" disabled={trwa || stopka === u.stopka} onClick={() => zapisz({ stopka })} className={przycisk}>
          Zapisz stopkę
        </button>
      </div>

      <div className="space-y-2">
        <h3 className={naglowek}>Zawsze pomijaj</h3>
        <p className="text-deck-muted">Nowe wątki od tych nadawców trafiają od razu do Pominiętych. Usunięcie z listy nie przywraca spraw już pominiętych.</p>
        {lista('Pomijane adresy', 'pomijaneAdresy', u.pomijaneAdresy)}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void zapisz({ pomijaneAdresy: [...u.pomijaneAdresy, adres] }, () => setAdres(''))
          }}
          className="flex gap-1.5"
        >
          <input aria-label="Adres do pomijania" value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="np. newsletter@sklep.pl" className="deck-input min-w-0 flex-1 rounded-md px-2 py-1" />
          <button type="submit" disabled={trwa || !adres.trim()} className={przycisk}>
            Dodaj adres
          </button>
        </form>
        {lista('Pomijane domeny', 'pomijaneDomeny', u.pomijaneDomeny)}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void zapisz({ pomijaneDomeny: [...u.pomijaneDomeny, domena] }, () => setDomena(''))
          }}
          className="flex gap-1.5"
        >
          <input aria-label="Domena do pomijania" value={domena} onChange={(e) => setDomena(e.target.value)} placeholder="np. reklama.pl" className="deck-input min-w-0 flex-1 rounded-md px-2 py-1" />
          <button type="submit" disabled={trwa || !domena.trim()} className={przycisk}>
            Dodaj domenę
          </button>
        </form>
      </div>

      <div className="space-y-2">
        <h3 className={naglowek}>Rozłączenie</h3>
        <p className="text-deck-muted">Odwołuje dostęp D.E.C.K. do skrzynki kontakt@ w Google. Na koniec kadencji zaznacz też usunięcie danych.</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={usunDane} onChange={(e) => setUsunDane(e.target.checked)} />
          Usuń też sprawy, kontakty i organizacje z D.E.C.K.
        </label>
        <button type="button" disabled={trwa} onClick={rozlacz} className="rounded-md border border-deck-danger-border bg-deck-danger-bg px-3 py-1 text-[11.5px] text-deck-danger disabled:opacity-50">
          Rozłącz skrzynkę
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add components/skrzynka/UstawieniaSkrzynki.test.tsx components/skrzynka/UstawieniaSkrzynki.tsx
git commit -m "$(cat <<'EOF'
feat(skrzynka): ustawienia - stopka, pomijani i rozlaczenie

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 10: Panel: kartoteki, Ustawienia, komunikat zgody

**Pliki:** zmiana `components/skrzynka/PanelSkrzynki.tsx`, `components/skrzynka/PanelSkrzynki.test.tsx`

**Interfejsy:**
- Korzysta z: `Kontakty`, `Organizacje` (zadanie 8), `UstawieniaSkrzynki` (zadanie 9), `ListaSpraw.onZmiana` (zadanie 7).
- Daje: panel z zakładkami `Kontakty` i `Organizacje`, przyciskiem `Ustawienia` i komunikatem `blad=brak-wysylki`.

- [ ] **Krok 1: Testy**

`components/skrzynka/PanelSkrzynki.test.tsx` - 4 zmiany:


1. Zamień:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PanelSkrzynki } from '@/components/skrzynka/PanelSkrzynki'
import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'
```

   na:

```tsx
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PanelSkrzynki } from '@/components/skrzynka/PanelSkrzynki'
import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'
```


2. Zamień:

```tsx
    return <button type="button" onClick={() => p.onWybierz('t1')}>sprawa t1</button>
  },
}))
vi.mock('@/components/skrzynka/WidokSprawy', () => ({
  WidokSprawy: (p: { id: string; onZmiana: (s: object) => void; onZamknij: () => void }) => (
    <div>
```

   na:

```tsx
    return <button type="button" onClick={() => p.onWybierz('t1')}>sprawa t1</button>
  },
}))
vi.mock('@/components/skrzynka/Kontakty', () => ({
  Kontakty: (p: { onWybierz: (id: string) => void }) => <button type="button" onClick={() => p.onWybierz('t9')}>kartoteka kontaktów</button>,
}))
vi.mock('@/components/skrzynka/Organizacje', () => ({ Organizacje: () => <p>kartoteka organizacji</p> }))
vi.mock('@/components/skrzynka/UstawieniaSkrzynki', () => ({ UstawieniaSkrzynki: () => <p>ustawienia skrzynki</p> }))
vi.mock('@/components/skrzynka/WidokSprawy', () => ({
  WidokSprawy: (p: { id: string; onZmiana: (s: object) => void; onZamknij: () => void }) => (
    <div>
```


3. Zamień:

```tsx
  it('błąd z powrotu zgody i nieczytelny stan', () => {
    panel({ liczniki: { ...L, stan: 'brak' }, blad: 'inne-konto' })
    expect(screen.getByRole('alert')).toHaveTextContent(/kontakt@samorzad\.ue\.wroc\.pl/)
    panel({ liczniki: null })
    expect(screen.getAllByRole('alert').at(-1)).toHaveTextContent(/Nie udało się odczytać stanu skrzynki/)
  })
```

   na:

```tsx
  it('błąd z powrotu zgody i nieczytelny stan', () => {
    panel({ liczniki: { ...L, stan: 'brak' }, blad: 'inne-konto' })
    expect(screen.getByRole('alert')).toHaveTextContent(/kontakt@samorzad\.ue\.wroc\.pl/)
    cleanup()
    panel({ liczniki: { ...L, stan: 'brak' }, blad: 'brak-wysylki' })
    expect(screen.getByRole('alert')).toHaveTextContent(/zaznacz wszystkie uprawnienia/)
    panel({ liczniki: null })
    expect(screen.getAllByRole('alert').at(-1)).toHaveTextContent(/Nie udało się odczytać stanu skrzynki/)
  })
```


4. Zamień:

```tsx
    expect(listaProps).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'zalatwiona' }))
  })

  it('wyszukiwanie i powrót do zakładek', () => {
    panel()
    fireEvent.change(screen.getByLabelText('Szukaj w skrzynce'), { target: { value: 'oferta' } })
```

   na:

```tsx
    expect(listaProps).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'zalatwiona' }))
  })

  it('Kontakty i Organizacje: zakładki bez liczb; sprawa z karty otwiera się obok', () => {
    panel()
    fireEvent.click(screen.getByRole('tab', { name: 'Kontakty' }))
    expect(screen.queryByRole('button', { name: 'sprawa t1' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'kartoteka kontaktów' }))
    expect(screen.getByText('widok t9')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Organizacje' }))
    expect(screen.getByText('kartoteka organizacji')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Organizacje' })).toHaveTextContent(/^Organizacje$/)
  })

  it('Ustawienia zamiast list; drugi klik wraca', () => {
    panel()
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }))
    expect(screen.getByText('ustawienia skrzynki')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }))
    expect(screen.getByRole('tablist', { name: 'Statusy spraw' })).toBeInTheDocument()
  })

  it('wyszukiwanie i powrót do zakładek', () => {
    panel()
    fireEvent.change(screen.getByLabelText('Szukaj w skrzynce'), { target: { value: 'oferta' } })
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/skrzynka/PanelSkrzynki.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak zakładek kartotek i Ustawień).

- [ ] **Krok 3: Implementacja**

`components/skrzynka/PanelSkrzynki.tsx` - 5 zmian:


1. Zamień:

```tsx
'use client'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Search } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_STATUSOW, ZAKLADKI } from '@/lib/skrzynka/widok'
import type { LicznikiSkrzynki, PostepImportu, Status } from '@/lib/skrzynka/typy'
import { ImportSkrzynki } from './ImportSkrzynki'
import { ListaSpraw } from './ListaSpraw'
import { WidokSprawy } from './WidokSprawy'

const BLEDY: Record<string, string> = {
```

   na:

```tsx
'use client'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Search, Settings } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_STATUSOW, ZAKLADKI } from '@/lib/skrzynka/widok'
import type { LicznikiSkrzynki, PostepImportu, Status } from '@/lib/skrzynka/typy'
import { ImportSkrzynki } from './ImportSkrzynki'
import { Kontakty } from './Kontakty'
import { ListaSpraw } from './ListaSpraw'
import { Organizacje } from './Organizacje'
import { UstawieniaSkrzynki } from './UstawieniaSkrzynki'
import { WidokSprawy } from './WidokSprawy'

const BLEDY: Record<string, string> = {
```


2. Zamień:

```tsx
  stan: 'Link połączenia wygasł albo jest nieprawidłowy - spróbuj jeszcze raz.',
  polaczenie: 'Nie udało się połączyć ze skrzynką - spróbuj ponownie.',
  konfiguracja: 'Skrzynka nie jest skonfigurowana na serwerze (zmienne SKRZYNKA_* na Vercelu).',
}

const LICZBA: Record<Status, (l: LicznikiSkrzynki) => number> = {
  'do-odpowiedzi': (l) => l.doOdpowiedzi,
  'w-toku': (l) => l.wToku,
```

   na:

```tsx
  stan: 'Link połączenia wygasł albo jest nieprawidłowy - spróbuj jeszcze raz.',
  polaczenie: 'Nie udało się połączyć ze skrzynką - spróbuj ponownie.',
  konfiguracja: 'Skrzynka nie jest skonfigurowana na serwerze (zmienne SKRZYNKA_* na Vercelu).',
  'brak-wysylki': 'Zgoda Google nie obejmuje wysyłki maili - połącz skrzynkę jeszcze raz i zaznacz wszystkie uprawnienia.',
}

/** Zakładki statusów i dwie kartoteki - bez liczb, bo liczenie osób i organizacji to dodatkowe odczyty przy każdym wejściu. */
type Zakladka = Status | 'kontakty' | 'organizacje'
const KARTOTEKI: { z: Zakladka; nazwa: string }[] = [
  { z: 'kontakty', nazwa: 'Kontakty' },
  { z: 'organizacje', nazwa: 'Organizacje' },
]
const czyStatus = (z: Zakladka): z is Status => z !== 'kontakty' && z !== 'organizacje'

const LICZBA: Record<Status, (l: LicznikiSkrzynki) => number> = {
  'do-odpowiedzi': (l) => l.doOdpowiedzi,
  'w-toku': (l) => l.wToku,
```


3. Zamień:

```tsx
  email: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('do-odpowiedzi')
  const [wpisane, setWpisane] = useState('')
  const [szukane, setSzukane] = useState('')
  const [wybrana, setWybrana] = useState<string | null>(null)
```

   na:

```tsx
  email: string
}) {
  const router = useRouter()
  const [zakladka, setZakladka] = useState<Zakladka>('do-odpowiedzi')
  const [ustawienia, setUstawienia] = useState(false)
  const [wpisane, setWpisane] = useState('')
  const [szukane, setSzukane] = useState('')
  const [wybrana, setWybrana] = useState<string | null>(null)
```


4. Zamień:

```tsx
    }
  }

  function zakladka(s: Status) {
    setStatus(s)
    setSzukane('')
    setWpisane('')
    setWybrana(null)
```

   na:

```tsx
    }
  }

  function wybierzZakladke(s: Zakladka) {
    setZakladka(s)
    setSzukane('')
    setWpisane('')
    setWybrana(null)
```


5. Zamień:

```tsx
              <RefreshCw size={12} aria-hidden="true" className={trwa ? 'animate-spin' : ''} />
              Dociągnij
            </button>
            {bladDociagania && <span role="alert" className="text-deck-danger">{bladDociagania}</span>}
          </div>

          {szukane ? (
            <div className="flex items-center gap-3 text-[12.5px]">
              <span className="text-deck-text">Wyniki dla „{szukane}”</span>
              <button
                type="button"
                onClick={() => {
                  setSzukane('')
                  setWpisane('')
                }}
                className="text-deck-muted hover:underline"
              >
                Wyczyść
              </button>
            </div>
          ) : (
            <div role="tablist" aria-label="Statusy spraw" className="flex flex-wrap gap-1.5">
              {ZAKLADKI.map((z) => (
                <button
                  key={z}
                  type="button"
                  role="tab"
                  aria-selected={z === status}
                  onClick={() => zakladka(z)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition ${
                    z === status ? 'border-deck-accent/50 bg-deck-accent/10 text-deck-text' : 'border-white/10 text-deck-muted hover:text-deck-text'
                  }`}
                >
                  {ETYKIETY_STATUSOW[z]}
                  <span className={`font-mono text-[11px] ${z === 'do-odpowiedzi' && liczniki.poTerminie > 0 ? 'text-deck-danger' : ''}`}>
                    {LICZBA[z](liczniki)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
            <div className={wybrana ? 'hidden lg:block' : ''}>
              <ListaSpraw key={`${status}|${szukane}`} status={status} szukane={szukane} wybrana={wybrana} onWybierz={setWybrana} wersja={wersja} />
            </div>
            {wybrana ? (
              <WidokSprawy key={wybrana} id={wybrana} sklad={sklad} email={email} onZmiana={poZmianie} onZamknij={() => setWybrana(null)} />
            ) : (
              <p className="hidden text-[12.5px] text-deck-muted lg:block">Wybierz sprawę z listy.</p>
            )}
          </div>
        </>
      )}
    </div>
```

   na:

```tsx
              <RefreshCw size={12} aria-hidden="true" className={trwa ? 'animate-spin' : ''} />
              Dociągnij
            </button>
            <button
              type="button"
              aria-pressed={ustawienia}
              onClick={() => setUstawienia((u) => !u)}
              className="deck-button inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px]"
            >
              <Settings size={12} aria-hidden="true" />
              Ustawienia
            </button>
            {bladDociagania && <span role="alert" className="text-deck-danger">{bladDociagania}</span>}
          </div>

          {ustawienia ? (
            <UstawieniaSkrzynki />
          ) : (
            <>
              {szukane ? (
                <div className="flex items-center gap-3 text-[12.5px]">
                  <span className="text-deck-text">Wyniki dla „{szukane}”</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSzukane('')
                      setWpisane('')
                    }}
                    className="text-deck-muted hover:underline"
                  >
                    Wyczyść
                  </button>
                </div>
              ) : (
                <div role="tablist" aria-label="Statusy spraw" className="flex flex-wrap gap-1.5">
                  {[...ZAKLADKI.map((z) => ({ z: z as Zakladka, nazwa: ETYKIETY_STATUSOW[z] })), ...KARTOTEKI].map(({ z, nazwa }) => (
                    <button
                      key={z}
                      type="button"
                      role="tab"
                      aria-selected={z === zakladka}
                      onClick={() => wybierzZakladke(z)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition ${
                        z === zakladka ? 'border-deck-accent/50 bg-deck-accent/10 text-deck-text' : 'border-white/10 text-deck-muted hover:text-deck-text'
                      }`}
                    >
                      {nazwa}
                      {czyStatus(z) && (
                        <span className={`font-mono text-[11px] ${z === 'do-odpowiedzi' && liczniki.poTerminie > 0 ? 'text-deck-danger' : ''}`}>
                          {LICZBA[z](liczniki)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
                <div className={wybrana ? 'hidden lg:block' : ''}>
                  {szukane || czyStatus(zakladka) ? (
                    <ListaSpraw
                      key={`${zakladka}|${szukane}`}
                      status={czyStatus(zakladka) ? zakladka : 'do-odpowiedzi'}
                      szukane={szukane}
                      wybrana={wybrana}
                      onWybierz={setWybrana}
                      wersja={wersja}
                      onZmiana={poZmianie}
                    />
                  ) : zakladka === 'kontakty' ? (
                    <Kontakty wybrana={wybrana} onWybierz={setWybrana} />
                  ) : (
                    <Organizacje wybrana={wybrana} onWybierz={setWybrana} />
                  )}
                </div>
                {wybrana ? (
                  <WidokSprawy key={wybrana} id={wybrana} sklad={sklad} email={email} onZmiana={poZmianie} onZamknij={() => setWybrana(null)} />
                ) : (
                  <p className="hidden text-[12.5px] text-deck-muted lg:block">Wybierz sprawę z listy.</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.
Run: `npm run lint > "$TMP/lint.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add components/skrzynka/PanelSkrzynki.test.tsx components/skrzynka/PanelSkrzynki.tsx
git commit -m "$(cat <<'EOF'
feat(skrzynka): panel z kartotekami, ustawieniami i komunikatem zgody

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 11: Poprawki z przeglądu 2a: błędy zmiany sprawy i Referer

**Pliki:** zmiana `app/api/skrzynka/sprawy/[id]/route.ts`, `app/api/skrzynka/sprawy/route.test.ts`, `lib/skrzynka/html.ts`, `lib/skrzynka/tresc.test.ts`

**Interfejsy:**
- Korzysta z: `zmienSprawe` (2a), `bezpiecznyHtml` (2a).
- Daje: `PATCH` sprawy - 404, gdy sprawa zniknęła w trakcie, 500 z komunikatem przy błędzie bazy; ramka maila z `referrer=no-referrer`.

- [ ] **Krok 1: Testy**

`app/api/skrzynka/sprawy/route.test.ts` - 1 zmiana:


1. Zamień:

```ts
    expect(dane.zmienSprawe).toHaveBeenLastCalledWith('t1', { status: 'w-toku', przypisana: 'Jula' })
  })

  it('pomiń zawsze: adres albo domena organizacji; domena skrzynki prywatnej - 400', async () => {
    dane.czytajSprawe.mockResolvedValue(S('t1'))
    dane.zmienSprawe.mockResolvedValue(S('t1', { status: 'pominieta', oczekujeOd: null }))
```

   na:

```ts
    expect(dane.zmienSprawe).toHaveBeenLastCalledWith('t1', { status: 'w-toku', przypisana: 'Jula' })
  })

  it('zmiana: sprawa znika w trakcie - 404; błąd bazy - 500 z komunikatem', async () => {
    dane.czytajSprawe.mockResolvedValue(S('t1'))
    dane.zmienSprawe.mockResolvedValueOnce(null)
    expect((await zmien(zadanie('/api/skrzynka/sprawy/t1', { status: 'w-toku' }), p('t1'))).status).toBe(404)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    dane.zmienSprawe.mockRejectedValueOnce(new Error('firestore'))
    const r = await zmien(zadanie('/api/skrzynka/sprawy/t1', { status: 'w-toku' }), p('t1'))
    expect(r.status).toBe(500)
    expect((await r.json()).error).toBe('Nie udało się zapisać zmiany - spróbuj ponownie.')
  })

  it('pomiń zawsze: adres albo domena organizacji; domena skrzynki prywatnej - 400', async () => {
    dane.czytajSprawe.mockResolvedValue(S('t1'))
    dane.zmienSprawe.mockResolvedValue(S('t1', { status: 'pominieta', oczekujeOd: null }))
```

`lib/skrzynka/tresc.test.ts` - 1 zmiana:


1. Zamień:

```ts
    expect(h).not.toMatch(/script|onclick|onerror|javascript:|<iframe|<form/i)
    expect(h).toContain(`content="default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:"`)
    expect(h).toContain('<base target="_blank">')
  })
})
```

   na:

```ts
    expect(h).not.toMatch(/script|onclick|onerror|javascript:|<iframe|<form/i)
    expect(h).toContain(`content="default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:"`)
    expect(h).toContain('<base target="_blank">')
    expect(h).toContain('<meta name="referrer" content="no-referrer">')
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run app/api/skrzynka/sprawy lib/skrzynka/tresc.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1` (`PATCH` oddaje 200 z `null` i rzuca przy błędzie; brak meta referrer).

- [ ] **Krok 3: Implementacja**

`app/api/skrzynka/sprawy/[id]/route.ts` - 1 zmiana:


1. Zamień:

```ts
  const { id } = await params
  const z = sprawdzZmiane(await req.json().catch(() => null), await skladZarzadu().catch(() => []))
  if (!z) return NextResponse.json({ error: 'Niepoprawna zmiana' }, { status: 400 })
  const s = await czytajSprawe(id)
  if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
  if (z.pomin) {
    if (!s.kontakt) return NextResponse.json({ error: 'Ta sprawa nie ma nadawcy do pominięcia.' }, { status: 400 })
    // Domena skrzynki prywatnej (gmail.com) albo studentów wyciszyłaby wszystkich - tylko organizacje.
    if (z.pomin === 'domena' && !s.organizacja) {
      return NextResponse.json({ error: 'Tej domeny nie można pominąć w całości - pomiń sam adres.' }, { status: 400 })
    }
    await dodajPomijanie(z.pomin, z.pomin === 'adres' ? s.kontakt : domena(s.kontakt))
  }
  const zmiana = {
    ...(z.pomin ? { status: 'pominieta' as const } : z.status ? { status: z.status } : {}),
    ...(z.przypisana !== undefined ? { przypisana: z.przypisana } : {}),
  }
  return NextResponse.json(await zmienSprawe(id, zmiana))
}
```

   na:

```ts
  const { id } = await params
  const z = sprawdzZmiane(await req.json().catch(() => null), await skladZarzadu().catch(() => []))
  if (!z) return NextResponse.json({ error: 'Niepoprawna zmiana' }, { status: 400 })
  try {
    const s = await czytajSprawe(id)
    if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
    if (z.pomin) {
      if (!s.kontakt) return NextResponse.json({ error: 'Ta sprawa nie ma nadawcy do pominięcia.' }, { status: 400 })
      // Domena skrzynki prywatnej (gmail.com) albo studentów wyciszyłaby wszystkich - tylko organizacje.
      if (z.pomin === 'domena' && !s.organizacja) {
        return NextResponse.json({ error: 'Tej domeny nie można pominąć w całości - pomiń sam adres.' }, { status: 400 })
      }
      await dodajPomijanie(z.pomin, z.pomin === 'adres' ? s.kontakt : domena(s.kontakt))
    }
    const zmiana = {
      ...(z.pomin ? { status: 'pominieta' as const } : z.status ? { status: z.status } : {}),
      ...(z.przypisana !== undefined ? { przypisana: z.przypisana } : {}),
    }
    // Sprawa mogła zniknąć między odczytem a transakcją (Rozłącz z usuwaniem danych).
    const nowa = await zmienSprawe(id, zmiana)
    return nowa ? NextResponse.json(nowa) : NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
  } catch (e) {
    console.error('[skrzynka] zmiana sprawy:', e)
    return NextResponse.json({ error: 'Nie udało się zapisać zmiany - spróbuj ponownie.' }, { status: 500 })
  }
}
```

`lib/skrzynka/html.ts` - 1 zmiana:


1. Zamień:

```ts
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${CSP_MAILA}">` +
    '<base target="_blank">' +
    '<style>body{font:14px/1.5 system-ui,sans-serif;margin:12px;color:#111;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>' +
    `</head><body>${czysty}</body></html>`
  )
```

   na:

```ts
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${CSP_MAILA}">` +
    '<base target="_blank">' +
    // Klik w link z maila nie zdradza nadawcy adresu D.E.C.K.
    '<meta name="referrer" content="no-referrer">' +
    '<style>body{font:14px/1.5 system-ui,sans-serif;margin:12px;color:#111;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>' +
    `</head><body>${czysty}</body></html>`
  )
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run app/api/skrzynka lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add 'app/api/skrzynka/sprawy/[id]/route.ts' app/api/skrzynka/sprawy/route.test.ts lib/skrzynka/html.ts lib/skrzynka/tresc.test.ts
git commit -m "$(cat <<'EOF'
fix(skrzynka): bledy zmiany sprawy z komunikatem i linki z maila bez Referer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 12: README, sprawdzenie i wdrożenie

**Pliki:** zmiana `README.md`

- [ ] **Krok 1: README** - w sekcji „Skrzynka kontakt@ (Gmail)” po akapicie „Panel `/skrzynka`: …” dopisz:

```markdown
Odpowiedź z widoku sprawy idzie z kontakt@ jako „Samorząd Studentów UEW” w tym samym wątku - do Reply-To albo nadawcy ostatniej ich wiadomości (okno pokazuje adresata) - ze stopką z Ustawień; załączniki łącznie do 4 MB (limit żądania funkcji Vercela to 4,5 MB). Zgoda Google bez uprawnienia do wysyłki jest odrzucana przy połączeniu. Zakładki Kontakty i Organizacje: karta osoby albo organizacji z jej sprawami; nazwę i typ organizacji zmienia się na karcie, synchronizacja tego nie nadpisuje. Ustawienia: stopka, listy „zawsze pomijaj” (domeny skrzynek prywatnych i studentów odrzucane) i „Rozłącz” - odwołuje dostęp w Google, opcjonalnie usuwa sprawy, kontakty i organizacje (koniec kadencji). Po „Rozłącz” bez usuwania ponowne połączenie robi import od nowa.
```

- [ ] **Krok 2: Pełne sprawdzenie**

Run: `npx vitest run > "$TMP/vt.log" 2>&1; echo $?` → `0` (przy pojedynczym przekroczeniu czasu w niezwiązanym pliku, np. `app/api/session/route.test.ts`, uruchom go osobno i cały zestaw ponownie)
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`
Run: `npm run lint > "$TMP/lint.log" 2>&1; echo $?` → `0`
Run: `npm run build > "$TMP/build.log" 2>&1; echo $?` → `0`; w logu `ƒ /api/skrzynka/sprawy/[id]/odpowiedz`, `ƒ /api/skrzynka/rozlacz`, `ƒ /api/skrzynka/ustawienia`, `ƒ /api/skrzynka/kontakty`, `ƒ /api/skrzynka/organizacje`.
Run: `git diff --name-only main | PYTHONIOENCODING=utf-8 python -c "import sys,io; print([p for p in sys.stdin.read().split() if any(z in io.open(p,encoding='utf-8').read() for z in ('\u2014','\u2013'))])"` → `[]`.

- [ ] **Krok 3: Commit, przegląd końcowy, scalenie i wypchnięcie (zgoda użytkownika: „na maina od razu”)**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(skrzynka): opis odpowiedzi, kartotek i ustawien w README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Po przeglądzie końcowym i poprawkach:

```bash
git checkout main && git pull origin main && git merge --ff-only deck-skrzynka-2b && npx vitest run && git push origin main && git branch -d deck-skrzynka-2b
```

- [ ] **Krok 4: Produkcja**

- Wdrożenie z GitHuba w zespole `dzial-it-samorzadu` w stanie Ready.
- Bez sesji: `POST /api/skrzynka/sprawy/x/odpowiedz`, `POST /api/skrzynka/rozlacz`, `GET /api/skrzynka/ustawienia`, `GET /api/skrzynka/kontakty`, `GET /api/skrzynka/organizacje` → 401.
- Właściciel (test użytkownika): odpowiedź na własny testowy mail z załącznikiem (przychodzi w tym samym wątku, ze stopką, sprawa przechodzi do „Czeka na nich”); karta organizacji i zmiana typu; dodanie i usunięcie adresu w Ustawieniach. „Rozłącz” tylko świadomie - wymaga ponownego połączenia i importu.

- [ ] **Krok 5: Pamięć projektu** - 2b na produkcji; następny krok plan części 3 (asystent: sekcja `skrzynka` w obrazie projektu, obszar odprawy, „Streść” i „Szkic odpowiedzi”).
