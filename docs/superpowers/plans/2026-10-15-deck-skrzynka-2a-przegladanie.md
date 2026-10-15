# D.E.C.K. - Skrzynka, część 2a: przeglądanie i porządkowanie spraw - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** w panelu `/skrzynka` widać sprawy w zakładkach statusów, wątek z treścią i załącznikami, a właściciel zmienia status, przypisuje osobę ze Składu, pomija nadawców i przeszukuje skrzynkę.

**Architektura:** lista czyta Firestore po jednym polu `klucz` (`status|czas|id`), więc sortuje się po czasie bez indeksu złożonego; „Do odpowiedzi” sortuje się po `oczekujeOd` (niezmiennik z części 1). Treść wątku i załączniki idą z Gmaila na żywo (`format=full`), parsowane czystymi funkcjami w `tresc.ts`; HTML maila trafia do `<iframe sandbox>` po `bezpiecznyHtml`. Zmiany ręczne idą transakcją z niezmiennikiem statusu i znacznikiem `zmieniono`, który chroni je przed nadpisaniem przez synchronizację.

**Stack:** Next.js 16, React 19, Firestore Admin SDK, Gmail API v1, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-10-13-deck-skrzynka-crm-design.md](../specs/2026-10-13-deck-skrzynka-crm-design.md) - część 2 z §14, bez wysyłki, kontaktów, organizacji i ustawień (to plan 2b).

## Zasady wspólne

- Po polsku; tylko „-”, nigdy długie myślniki. Commit po `npx vitest run <pliki> > "$TMP/vt.log" 2>&1; echo $?` = 0, stopka `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Gałąź `deck-skrzynka-2a`; użytkownik każe scalać do `main` i wypychać od razu (`ssuew-it/ssuew-analytics`, Vercel `dzial-it-samorzadu` buduje z `main`).
- Trasy: 401 bez sesji, 403 zarząd z „Skrzynka jest tylko dla właściciela” (`TYLKO_WLASCICIEL`).
- Kokpit nigdy nie pyta Gmaila; Gmail tylko przy otwarciu sprawy, wyszukiwaniu i pobraniu załącznika.
- Lista: 50 spraw na stronę; „Do odpowiedzi” do 300, najdłużej czekające na górze.
- Treść maili nigdzie nie jest kopiowana ani logowana.
- HTML maila: `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox">` (bez skryptów), CSP `default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:` - zewnętrzne obrazki (piksele śledzące) się nie ładują.
- Załączniki zawsze jako pobranie (`Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`); typ przepuszczany tylko dla PDF, PNG, JPEG, GIF.

### Poprawki wobec specu (świadome)

1. **Część 2 rozbita na 2a i 2b.** 2b: odpowiedź z załącznikami i stopką, kontakty, organizacje, ustawienia, „Rozłącz”, sprawdzenie zakresu `gmail.send`.
2. **Lista po polu `klucz`** zamiast zapytania `status == X` + `orderBy` - to wymagałoby indeksu złożonego w projekcie Firebase, do którego konsoli użytkownik nie trafia. Stare sprawy dostają klucz jednorazowo przy wejściu do panelu (`wersjaDanych` 1 → 2).
3. **Ręczne oznaczenie „Do odpowiedzi” liczy czekanie od chwili oznaczenia,** nie od ostatniej wiadomości - inaczej stara sprawa od razu wpadałaby w alarm.
4. **„Pomiń zawsze domenę” tylko dla spraw z organizacją.** Dla skrzynek prywatnych (gmail.com, wp.pl) i studentów wyciszyłoby to wszystkich.
5. **Załącznik zawsze do pobrania,** bez podglądu w karcie - plik od nadawcy nie może się otworzyć w domenie D.E.C.K.

## Na co uważać w przeglądzie

1. **Złośliwy HTML w mailu** (skrypt, `onerror`, `javascript:`, zewnętrzny obrazek) - nic się nie wykonuje i nic nie ładuje z zewnątrz (testy w zadaniach 2 i 6).
2. **Załącznik HTML albo SVG od nadawcy** - pobiera się, nie otwiera w domenie D.E.C.K. (test w zadaniu 4).
3. **„Pomiń zawsze domenę” dla nadawcy z gmail.com** - niedostępne w widoku i odrzucane przez serwer (testy w zadaniach 4 i 6).
4. **Ręczna zmiana statusu w trakcie synchronizacji** - nie znika: zapis ustawia `zmieniono`, a synchronizacja z części 1 nie nadpisuje zmienionych w międzyczasie spraw (test w zadaniu 3).
5. **Sprawy zapisane przed wdrożeniem 2a** - widoczne na listach po jednorazowym uzupełnieniu klucza (test w zadaniu 1).

---

## Mapa plików

| Plik | Odpowiedzialność | Zadanie |
|---|---|---|
| `lib/skrzynka/typy.ts`, `lib/skrzynka/dane.ts` | `klucz`, `listaSpraw`, `uzupelnijKlucze`, liczniki Załatwionych i Pominiętych | 1 |
| `lib/skrzynka/tresc.ts`, `lib/skrzynka/html.ts`, `lib/skrzynka/google.ts` | treść wątku, bezpieczny HTML, `watekPelny`, `zalacznik` | 2 |
| `lib/skrzynka/dane.ts`, `lib/skrzynka/zmiana.ts`, `lib/skrzynka/synchronizacja.ts` | `czytajSprawe`, `zmienSprawe`, `dodajPomijanie`, `skladZarzadu`, `sprawdzZmiane`, `klientGmaila` | 3 |
| `app/api/skrzynka/{sprawy,szukaj}/**` | lista, wyszukiwanie, sprawa, zmiana, załącznik | 4 |
| `lib/skrzynka/widok.ts`, `lib/skrzynka/klient.ts`, `components/skrzynka/ListaSpraw.tsx` | etykiety, daty, linki; lista spraw | 5 |
| `components/skrzynka/WidokSprawy.tsx`, `TrescWiadomosci.tsx` | wątek i akcje | 6 |
| `components/skrzynka/PanelSkrzynki.tsx`, `app/skrzynka/page.tsx` | zakładki, wyszukiwarka, układ lista + wątek | 7 |
| `README.md` | opis | 8 |

---

## Zadanie 1: Lista spraw w Firestore

**Pliki:** zmiana `lib/skrzynka/typy.ts`, `lib/skrzynka/dane.ts`, `lib/skrzynka/dane.test.ts`, `components/deck/DeckHub.test.tsx`, `components/skrzynka/PanelSkrzynki.test.tsx`

**Interfejsy:**
- Korzysta z: `Sprawa`, `Status`, `naSprawe`, `zapiszWynik`, `zapiszStan`, `czytajStan`, `liczniki` (część 1).
- Daje: `StronaSpraw { sprawy: Sprawa[]; nastepna: string | null }`; `LicznikiSkrzynki` z polami `zalatwione`, `pominiete`; `StanSkrzynki.wersjaDanych: number`; `WERSJA_DANYCH = 2`, `NA_STRONE = 50`, `kluczListy(s): string`, `listaSpraw(status, po, ile?): Promise<StronaSpraw>`, `uzupelnijKlucze(): Promise<number>`.

- [ ] **Krok 1: Baza w pamięci z zapytaniami - zastąp cały blok `vi.hoisted(...)` w `lib/skrzynka/dane.test.ts`**

```ts
/** Firestore w pamięci - dokumenty, partie, transakcje i proste zapytania (where, orderBy, startAfter, limit, count). */
const { baza, admin } = vi.hoisted(() => {
  type Dane = Record<string, unknown>
  type Ref = { sciezka: string }
  const baza = new Map<string, Dane>()
  const snap = (s: string) => ({
    id: s.split('/').pop()!,
    ref: { sciezka: s },
    exists: baza.has(s),
    data: () => baza.get(s),
    get: (pole: string) => baza.get(s)?.[pole],
  })
  type Migawka = ReturnType<typeof snap>
  const zapisz = (s: string, d: Dane, scal?: boolean) => baza.set(s, scal ? { ...baza.get(s), ...d } : { ...d })
  const firestore = {
    getAll: async (...refs: Ref[]) => refs.map((r) => snap(r.sciezka)),
    batch: () => {
      const ops: (() => void)[] = []
      return {
        set: (r: Ref, d: Dane, o?: { merge?: boolean }) => ops.push(() => zapisz(r.sciezka, d, o?.merge)),
        update: (r: Ref, d: Dane) => ops.push(() => zapisz(r.sciezka, d, true)),
        commit: async () => ops.forEach((f) => f()),
      }
    },
    runTransaction: async <T,>(f: (t: unknown) => Promise<T>) =>
      f({
        get: async (r: Ref) => snap(r.sciezka),
        set: (r: Ref, d: Dane, o?: { merge?: boolean }) => zapisz(r.sciezka, d, o?.merge),
        update: (r: Ref, d: Dane) => zapisz(r.sciezka, d, true),
      }),
  }
  const dok = (sciezka: string) => ({
    sciezka,
    firestore,
    get: async () => snap(sciezka),
    set: async (d: Dane, o?: { merge?: boolean }) => zapisz(sciezka, d, o?.merge),
  })
  const por = (a: unknown, b: unknown) => ((a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0)
  const spelnia = (v: unknown, op: string, w: unknown) => {
    if (v === undefined || v === null) return false
    const r = por(v, w)
    return op === '==' ? v === w : op === '<' ? r < 0 : op === '>' ? r > 0 : op === '>=' ? r >= 0 : op === '<=' ? r <= 0 : false
  }
  type Opis = { warunki: [string, string, unknown][]; kolejnosc: [string, string] | null; ile: number; po: unknown }
  interface Zapytanie {
    where(p: string, op: string, w: unknown): Zapytanie
    orderBy(p: string, kier?: string): Zapytanie
    limit(n: number): Zapytanie
    startAfter(w: unknown): Zapytanie
    get(): Promise<{ docs: Migawka[]; empty: boolean; size: number }>
    count(): { get(): Promise<{ data(): { count: number } }> }
  }
  const zapytanie = (nazwa: string, z: Opis): Zapytanie => {
    const wyniki = () => {
      let docs = [...baza.keys()]
        .filter((k) => k.startsWith(`${nazwa}/`))
        .map(snap)
        .filter((d) => z.warunki.every(([p, op, w]) => spelnia(d.get(p), op, w)))
      if (z.kolejnosc) {
        const [p, kier] = z.kolejnosc
        const zn = kier === 'desc' ? -1 : 1
        docs.sort((a, b) => por(a.get(p), b.get(p)) * zn)
        if (z.po !== undefined) docs = docs.filter((d) => por(d.get(p), z.po) * zn > 0)
      }
      return docs.slice(0, z.ile)
    }
    return {
      where: (p, op, w) => zapytanie(nazwa, { ...z, warunki: [...z.warunki, [p, op, w]] }),
      orderBy: (p, kier = 'asc') => zapytanie(nazwa, { ...z, kolejnosc: [p, kier] }),
      limit: (n) => zapytanie(nazwa, { ...z, ile: n }),
      startAfter: (w) => zapytanie(nazwa, { ...z, po: w }),
      get: async () => {
        const docs = wyniki()
        return { docs, empty: !docs.length, size: docs.length }
      },
      count: () => ({ get: async () => ({ data: () => ({ count: wyniki().length }) }) }),
    }
  }
  const kolekcja = (nazwa: string) => ({
    firestore,
    doc: (id: string) => dok(`${nazwa}/${id}`),
    ...zapytanie(nazwa, { warunki: [], kolejnosc: null, ile: Infinity, po: undefined }),
  })
  return {
    baza,
    admin: {
      skrzynkaStanRef: () => dok('skrzynka/stan'),
      skrzynkaUstawieniaRef: () => dok('skrzynka/ustawienia'),
      ustawieniaRef: (nazwa: string) => dok(`ustawienia/${nazwa}`),
      sprawyRef: () => kolekcja('skrzynkaSprawy'),
      kontaktyRef: () => kolekcja('skrzynkaKontakty'),
      organizacjeRef: () => kolekcja('skrzynkaOrganizacje'),
    },
  }
})
```

- [ ] **Krok 2: Testy - w `lib/skrzynka/dane.test.ts`**

Do importu z `@/lib/skrzynka/dane` dopisz `kluczListy, listaSpraw, uzupelnijKlucze`. W teście „bez dokumentu null…” dopisz w oczekiwanym obiekcie `wersjaDanych: 1,` (po `polaczona: true,`). W teście liczników dopisz do oczekiwanego obiektu `zalatwione: 0, pominiete: 0,` (przed `ostatniaSynchronizacja`). Nowy blok na końcu pliku:

```ts
describe('lista spraw', () => {
  const kiedy = (k: number) => ({ ostatnia: { kiedy: k, kierunek: 'oni' as const, fragment: '' } })

  it('klucz: status, czas z zerami do 15 cyfr, id', () => {
    expect(kluczListy({ id: 't1', status: 'zalatwiona', ...kiedy(1792000000000) })).toBe('zalatwiona|001792000000000|t1')
  })

  it('jeden status od najnowszej; strony; inne statusy poza listą', async () => {
    await zapiszWynik({
      sprawy: [
        sprawa('a', { status: 'zalatwiona', oczekujeOd: null, ...kiedy(100) }),
        sprawa('b', { status: 'zalatwiona', oczekujeOd: null, ...kiedy(300) }),
        sprawa('c', { status: 'zalatwiona', oczekujeOd: null, ...kiedy(200) }),
        sprawa('d', { status: 'pominieta', oczekujeOd: null, ...kiedy(400) }),
      ],
      kontakty: [],
      organizacje: [],
    })
    const s1 = await listaSpraw('zalatwiona', null, 2)
    expect(s1.sprawy.map((s) => s.id)).toEqual(['b', 'c'])
    expect(s1.nastepna).toBe('zalatwiona|000000000000200|c')
    const s2 = await listaSpraw('zalatwiona', s1.nastepna, 2)
    expect(s2.sprawy.map((s) => s.id)).toEqual(['a'])
    expect(s2.nastepna).toBeNull()
  })

  it('Do odpowiedzi: najdłużej czekające na górze', async () => {
    await zapiszWynik({
      sprawy: [sprawa('x', { oczekujeOd: 500 }), sprawa('y', { oczekujeOd: 100 }), sprawa('z', { status: 'w-toku', oczekujeOd: null })],
      kontakty: [],
      organizacje: [],
    })
    expect((await listaSpraw('do-odpowiedzi', null)).sprawy.map((s) => s.id)).toEqual(['y', 'x'])
  })

  it('sprawy sprzed wersji 2 dostają klucz raz', async () => {
    await zapiszStan({ token: 'enc', polaczona: true })
    baza.set('skrzynkaSprawy/stara', { temat: 'T', status: 'zalatwiona', oczekujeOd: null, ostatnia: { kiedy: 100, kierunek: 'oni', fragment: '' } })
    expect((await listaSpraw('zalatwiona', null)).sprawy).toEqual([])
    expect(await uzupelnijKlucze()).toBe(1)
    expect((await listaSpraw('zalatwiona', null)).sprawy.map((s) => s.id)).toEqual(['stara'])
    expect((await czytajStan())?.wersjaDanych).toBe(2)
    expect(await uzupelnijKlucze()).toBe(0)
  })
})
```

W `components/deck/DeckHub.test.tsx` w stałej `SKRZYNKA` i w `components/skrzynka/PanelSkrzynki.test.tsx` w stałej `L` dopisz `zalatwione: 0, pominiete: 0,` (przed `ostatniaSynchronizacja`).

- [ ] **Krok 3: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/dane.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 4: `lib/skrzynka/typy.ts`**

W `LicznikiSkrzynki` po `wToku: number` dopisz:

```ts
  zalatwione: number
  pominiete: number
```

Na końcu pliku:

```ts
/** Strona listy spraw; `nastepna` to kursor kolejnej strony albo `null`. */
export interface StronaSpraw {
  sprawy: Sprawa[]
  nastepna: string | null
}
```

- [ ] **Krok 5: `lib/skrzynka/dane.ts`**

Do typów importu z `./typy` dopisz `StronaSpraw`. W `StanSkrzynki` po `import: PostepImportu` dopisz:

```ts
  /** 1 - sprawy bez pola `klucz` (przed częścią 2a); 2 - klucze uzupełnione. */
  wersjaDanych: number
```

W `czytajStan()` po linii `polaczona: d.polaczona === true,` dopisz `wersjaDanych: liczba(d.wersjaDanych) || 1,`.

Pod stałą `PARTIA` dopisz:

```ts
export const WERSJA_DANYCH = 2
export const NA_STRONE = 50
const MAKS_DO_ODPOWIEDZI = 300
/** Znak większy niż każdy w kluczu - górna granica zakresu jednego statusu. */
const KONIEC = '\uf8ff'

/**
 * Klucz listy: status, czas ostatniej wiadomości (15 cyfr) i id w jednym
 * polu. Zakres po tym polu z sortowaniem po nim samym nie wymaga indeksu
 * złożonego - a do konsoli projektu Firebase nie ma dostępu.
 */
export function kluczListy(s: Pick<Sprawa, 'id' | 'status'> & { ostatnia: { kiedy: number } }): string {
  return `${s.status}|${String(Math.max(0, Math.floor(s.ostatnia.kiedy))).padStart(15, '0')}|${s.id}`
}

/** Dokument sprawy do zapisu: bez `id` (to identyfikator dokumentu), z kluczem listy. */
function doZapisu({ id, ...s }: Sprawa): DocumentData {
  return { ...s, klucz: kluczListy({ id, ...s }) }
}
```

W `zapiszWynik` zamień linię spraw na:

```ts
    ...w.sprawy.map((s) => ({ ref: sprawy.doc(s.id), dane: doZapisu(s), scal: false })),
```

Pod `czytajSprawy` dopisz:

```ts
/**
 * Jedna zakładka. „Do odpowiedzi” rośnie od najdłużej czekającej - sprawy po
 * terminie są na górze; pozostałe od najnowszej, stronami po kluczu.
 */
export async function listaSpraw(status: Status, po: string | null, ile = NA_STRONE): Promise<StronaSpraw> {
  const s = sprawyRef()
  if (status === 'do-odpowiedzi') {
    // Niezmiennik: `oczekujeOd` mają tylko sprawy Do odpowiedzi.
    const z = await s.where('oczekujeOd', '>', 0).orderBy('oczekujeOd').limit(MAKS_DO_ODPOWIEDZI).get()
    return { sprawy: z.docs.map((d) => naSprawe(d.id, d.data())), nastepna: null }
  }
  let q = s.where('klucz', '>=', `${status}|`).where('klucz', '<', `${status}|${KONIEC}`).orderBy('klucz', 'desc')
  if (po) q = q.startAfter(po)
  const z = await q.limit(ile + 1).get()
  const docs = z.docs.slice(0, ile)
  return {
    sprawy: docs.map((d) => naSprawe(d.id, d.data())),
    nastepna: z.docs.length > ile ? String(docs[docs.length - 1].get('klucz')) : null,
  }
}

/** Jednorazowo: sprawy zapisane przed częścią 2a dostają klucz listy. Zwraca liczbę poprawionych. */
export async function uzupelnijKlucze(): Promise<number> {
  const s = sprawyRef()
  const z = await s.get()
  const doPoprawy = z.docs.filter((d) => d.get('klucz') !== kluczListy(naSprawe(d.id, d.data())))
  for (let i = 0; i < doPoprawy.length; i += PARTIA) {
    const partia = s.firestore.batch()
    for (const d of doPoprawy.slice(i, i + PARTIA)) partia.update(d.ref, { klucz: kluczListy(naSprawe(d.id, d.data())) })
    await partia.commit()
  }
  await zapiszStan({ wersjaDanych: WERSJA_DANYCH })
  return doPoprawy.length
}
```

W `liczniki`: obiekt `zero` uzupełnij o `zalatwione: 0, pominiete: 0`; w `Promise.all` dopisz na końcu `ile('zalatwiona'), ile('pominieta'),` i rozpakuj `const [doOdpowiedzi, poTerminie, doPrzejrzenia, czekaNaNich, wToku, zalatwione, pominiete] = …`; w zwracanym obiekcie dopisz `zalatwione, pominiete,`.

- [ ] **Krok 6: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka components/deck components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 7: Commit**

```bash
git add lib/skrzynka/typy.ts lib/skrzynka/dane.ts lib/skrzynka/dane.test.ts components/deck/DeckHub.test.tsx components/skrzynka/PanelSkrzynki.test.tsx
git commit -m "$(cat <<'EOF'
feat(skrzynka): lista spraw po kluczu statusu i czasu, uzupelnianie starych spraw

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 2: Treść wątku, bezpieczny HTML i Gmail

**Pliki:** nowe `lib/skrzynka/tresc.ts`, `lib/skrzynka/html.ts`, testy `lib/skrzynka/tresc.test.ts`; zmiana `lib/skrzynka/typy.ts`, `lib/skrzynka/google.ts`, `lib/skrzynka/google.test.ts`

**Interfejsy:**
- Korzysta z: `odczytajAdresy`, `dekodujNaglowek` (część 1).
- Daje: w `typy.ts`: `Zalacznik`, `WiadomoscPelna`, `SzczegolySprawy`; w `tresc.ts`: `CzescApi`, `WatekPelnyApi`, `dekodujBase64Url(dane): Uint8Array`, `odczytajWatekPelny(w): WiadomoscPelna[]`; w `html.ts`: `CSP_MAILA`, `bezpiecznyHtml(html): string`; w `Gmail`: `watekPelny(id): Promise<WatekPelnyApi>`, `zalacznik(wiadomoscId, id): Promise<{ data: string; size: number }>`.

- [ ] **Krok 1: Testy - `lib/skrzynka/tresc.test.ts`**

```ts
// @vitest-environment node
// TextDecoder z ISO-8859-2 i atob - jak na serwerze.
import { describe, it, expect } from 'vitest'
import { odczytajWatekPelny, type CzescApi } from '@/lib/skrzynka/tresc'
import { bezpiecznyHtml } from '@/lib/skrzynka/html'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'
const utf = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
/** „Współpraca” w ISO-8859-2: ó = 0xF3, ł = 0xB3. */
const LATIN2 = Buffer.from([0x57, 0x73, 0x70, 0xf3, 0xb3, 0x70, 0x72, 0x61, 0x63, 0x61]).toString('base64url')

function wiadomosc(id: string, kiedy: number, od: string, payload: CzescApi, etykiety = ['INBOX']) {
  return {
    id,
    internalDate: String(kiedy),
    labelIds: etykiety,
    payload: {
      ...payload,
      headers: [
        { name: 'From', value: od },
        { name: 'To', value: NASZ },
        { name: 'Subject', value: 'Sponsoring' },
        ...(payload.headers ?? []),
      ],
    },
  }
}

describe('odczytajWatekPelny', () => {
  it('multipart: tekst, HTML i załącznik z identyfikatorem', () => {
    const w = odczytajWatekPelny({
      id: 't1',
      messages: [
        wiadomosc('m1', 100, 'Anna <anna@firma.pl>', {
          mimeType: 'multipart/mixed',
          parts: [
            {
              mimeType: 'multipart/alternative',
              parts: [
                { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset="UTF-8"' }], body: { data: utf('Dzień dobry 👋') } },
                { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset=UTF-8' }], body: { data: utf('<p>Dzień dobry</p>') } },
              ],
            },
            { mimeType: 'application/pdf', filename: 'Oferta sponsorska.pdf', body: { attachmentId: 'ATT1', size: 120000 } },
          ],
        }),
      ],
    })
    expect(w).toEqual([{
      id: 'm1',
      kiedy: 100,
      od: { email: 'anna@firma.pl', imie: 'Anna' },
      do: [{ email: NASZ, imie: '' }],
      temat: 'Sponsoring',
      tekst: 'Dzień dobry 👋',
      html: '<p>Dzień dobry</p>',
      zalaczniki: [{ id: 'ATT1', wiadomoscId: 'm1', nazwa: 'Oferta sponsorska.pdf', typ: 'application/pdf', rozmiar: 120000 }],
    }])
  })

  it('sam tekst w ISO-8859-2', () => {
    const [m] = odczytajWatekPelny({
      id: 't1',
      messages: [wiadomosc('m1', 1, 'jan@x.pl', { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=iso-8859-2' }], body: { data: LATIN2 } })],
    })
    expect(m.tekst).toBe('Współpraca')
    expect(m.html).toBeNull()
    expect(m.zalaczniki).toEqual([])
  })

  it('pomija szkice, spam i kosz; od najstarszej', () => {
    const w = odczytajWatekPelny({
      id: 't1',
      messages: [
        wiadomosc('m3', 300, NASZ, { mimeType: 'text/plain', body: { data: utf('c') } }, ['SENT']),
        wiadomosc('m1', 100, 'a@x.pl', { mimeType: 'text/plain', body: { data: utf('a') } }),
        wiadomosc('m2', 200, NASZ, { mimeType: 'text/plain', body: { data: utf('b') } }, ['DRAFT']),
      ],
    })
    expect(w.map((m) => m.id)).toEqual(['m1', 'm3'])
  })

  it('wiadomość bez treści i bez części', () => {
    const [m] = odczytajWatekPelny({ id: 't1', messages: [wiadomosc('m1', 1, 'a@x.pl', { mimeType: 'text/plain' })] })
    expect(m.tekst).toBeNull()
    expect(m.html).toBeNull()
  })
})

describe('bezpiecznyHtml', () => {
  it('usuwa skrypty, obsługę zdarzeń, javascript:, ramki i formularze; dokłada CSP i otwieranie linków w nowej karcie', () => {
    const h = bezpiecznyHtml(
      '<p onclick="x()">Hej</p><script>alert(1)</script><img src="https://tracker.pl/p.gif" onerror="alert(2)">' +
        '<a href="javascript:alert(3)">x</a><iframe src="https://zly.pl"></iframe><form action="https://zly.pl"><input></form>',
    )
    expect(h).toContain('<p>Hej</p>')
    expect(h).not.toMatch(/script|onclick|onerror|javascript:|<iframe|<form/i)
    expect(h).toContain(`content="default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:"`)
    expect(h).toContain('<base target="_blank">')
  })
})
```

Do `lib/skrzynka/google.test.ts` przed testem „komunikaty błędów dla tras” dopisz:

```ts
  it('pełny wątek i pobranie załącznika (identyfikator kodowany w ścieżce)', async () => {
    google(() => odp(200, { data: 'YWJj', size: 3 }))
    const g = gmail('r', 'd')
    await g.watekPelny('t1')
    const u = new URL(fetchMock.mock.calls.at(-1)![0])
    expect(u.pathname).toBe('/gmail/v1/users/me/threads/t1')
    expect(u.searchParams.get('format')).toBe('full')
    expect(await g.zalacznik('m1', 'A/B')).toEqual({ data: 'YWJj', size: 3 })
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/m1/attachments/A%2FB')
  })
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/tresc.test.ts lib/skrzynka/google.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `lib/skrzynka/typy.ts` - na końcu**

```ts
export interface Zalacznik {
  /** `attachmentId` Gmaila. */
  id: string
  wiadomoscId: string
  nazwa: string
  typ: string
  rozmiar: number
}

/** Wiadomość z treścią - tylko w odpowiedzi trasy, nigdy w bazie. */
export interface WiadomoscPelna {
  id: string
  kiedy: number
  od: Adres | null
  do: Adres[]
  temat: string
  tekst: string | null
  html: string | null
  zalaczniki: Zalacznik[]
}

export interface SzczegolySprawy {
  sprawa: Sprawa
  wiadomosci: WiadomoscPelna[]
}
```

- [ ] **Krok 4: `lib/skrzynka/tresc.ts`**

```ts
import { dekodujNaglowek, odczytajAdresy } from './naglowki'
import type { WiadomoscPelna, Zalacznik } from './typy'

/** Część wiadomości z `threads.get` przy `format=full`. */
export interface CzescApi {
  mimeType?: string
  filename?: string
  headers?: { name: string; value: string }[]
  body?: { size?: number; data?: string; attachmentId?: string }
  parts?: CzescApi[]
}

export interface WatekPelnyApi {
  id: string
  messages?: { id: string; internalDate?: string; labelIds?: string[]; payload?: CzescApi }[]
}

const POMIJANE_ETYKIETY = ['DRAFT', 'SPAM', 'TRASH']

/** Gmail podaje treść w base64url bez wypełnienia. */
export function dekodujBase64Url(dane: string): Uint8Array {
  const b64 = dane.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

const naglowek = (c: CzescApi, nazwa: string) =>
  c.headers?.find((h) => h.name.toLowerCase() === nazwa.toLowerCase())?.value ?? ''

/** Bajty części w jej własnym kodowaniu (`charset`); nieznane kodowanie - UTF-8. */
function tekstCzesci(c: CzescApi): string {
  const bajty = dekodujBase64Url(c.body?.data ?? '')
  const zestaw = naglowek(c, 'Content-Type').match(/charset="?([^";\s]+)"?/i)?.[1]?.toLowerCase() ?? 'utf-8'
  try {
    return new TextDecoder(zestaw).decode(bajty)
  } catch {
    return new TextDecoder('utf-8').decode(bajty)
  }
}

type Zebrane = { tekst: string | null; html: string | null; zalaczniki: Zalacznik[] }

/** Pierwszy tekst, pierwszy HTML i wszystkie załączniki - przez całe drzewo części. */
function zbierz(c: CzescApi, wiadomoscId: string, w: Zebrane): void {
  const typ = (c.mimeType ?? '').toLowerCase()
  if (c.filename && c.body?.attachmentId) {
    w.zalaczniki.push({
      id: c.body.attachmentId,
      wiadomoscId,
      nazwa: dekodujNaglowek(c.filename),
      typ: typ || 'application/octet-stream',
      rozmiar: c.body.size ?? 0,
    })
    return
  }
  if (c.parts?.length) {
    for (const p of c.parts) zbierz(p, wiadomoscId, w)
    return
  }
  if (!c.body?.data) return
  if (typ === 'text/plain' && w.tekst === null) w.tekst = tekstCzesci(c)
  else if (typ === 'text/html' && w.html === null) w.html = tekstCzesci(c)
}

export function odczytajWatekPelny(w: WatekPelnyApi): WiadomoscPelna[] {
  return (w.messages ?? [])
    .filter((m) => !(m.labelIds ?? []).some((e) => POMIJANE_ETYKIETY.includes(e)))
    .map((m) => {
      const p = m.payload ?? {}
      const z: Zebrane = { tekst: null, html: null, zalaczniki: [] }
      zbierz(p, m.id, z)
      return {
        id: m.id,
        kiedy: Number(m.internalDate) || 0,
        od: odczytajAdresy(naglowek(p, 'From'))[0] ?? null,
        do: [...odczytajAdresy(naglowek(p, 'To')), ...odczytajAdresy(naglowek(p, 'Cc'))],
        temat: dekodujNaglowek(naglowek(p, 'Subject')).trim(),
        ...z,
      }
    })
    .sort((a, b) => a.kiedy - b.kiedy)
}
```

- [ ] **Krok 5: `lib/skrzynka/html.ts`**

```ts
export const CSP_MAILA = "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:"

/**
 * HTML maila do `<iframe sandbox srcdoc>`. Sandbox bez `allow-scripts` i tak
 * nie wykona skryptu, a CSP blokuje zewnętrzne obrazki (piksele śledzące) i
 * czcionki. Czyszczenie to druga warstwa - na wypadek błędu w pierwszej.
 */
export function bezpiecznyHtml(html: string): string {
  const czysty = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2')
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${CSP_MAILA}">` +
    '<base target="_blank">' +
    '<style>body{font:14px/1.5 system-ui,sans-serif;margin:12px;color:#111;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>' +
    `</head><body>${czysty}</body></html>`
  )
}
```

- [ ] **Krok 6: `lib/skrzynka/google.ts`**

Import: `import type { WatekPelnyApi } from './tresc'`. W `interface Gmail` po `watek(...)` dopisz:

```ts
  watekPelny(id: string): Promise<WatekPelnyApi>
  zalacznik(wiadomoscId: string, id: string): Promise<{ data: string; size: number }>
```

W zwracanym obiekcie `gmail(...)` po `watek: …` dopisz:

```ts
    watekPelny: (id) => wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'full' })}`),
    zalacznik: (wiadomoscId, id) =>
      wywolaj(`/messages/${encodeURIComponent(wiadomoscId)}/attachments/${encodeURIComponent(id)}`),
```

- [ ] **Krok 7: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 8: Commit**

```bash
git add lib/skrzynka/typy.ts lib/skrzynka/tresc.ts lib/skrzynka/tresc.test.ts lib/skrzynka/html.ts lib/skrzynka/google.ts lib/skrzynka/google.test.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): tresc watku z zalacznikami, bezpieczny HTML maila i pobieranie z Gmaila

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 3: Zmiany spraw w bazie

**Pliki:** nowe `lib/skrzynka/zmiana.ts`, `lib/skrzynka/zmiana.test.ts`; zmiana `lib/skrzynka/typy.ts`, `lib/skrzynka/dane.ts`, `lib/skrzynka/dane.test.ts`, `lib/skrzynka/synchronizacja.ts`, `lib/skrzynka/synchronizacja.test.ts`

**Interfejsy:**
- Korzysta z: `kluczListy`, `naSprawe`, `doZapisu` (zadanie 1), `naSklad` (`@/lib/planer/stan`), `ustawieniaRef` (`@/lib/firebase/admin`), `gmailZeStanu`, `zRozlaczeniem` (część 1).
- Daje: `ZmianaSprawy = { status?: Status; przypisana?: string | null; pomin?: 'adres' | 'domena' }`; `sprawdzZmiane(body, sklad): ZmianaSprawy | null`; `czytajSprawe(id): Promise<Sprawa | null>`; `zmienSprawe(id, z: { status?; przypisana?; nowa? }, teraz?): Promise<Sprawa | null>`; `dodajPomijanie(rodzaj, wartosc): Promise<void>`; `skladZarzadu(): Promise<string[]>`; `klientGmaila(): Promise<Gmail>`; eksport `zRozlaczeniem`.

- [ ] **Krok 1: Testy**

`lib/skrzynka/zmiana.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sprawdzZmiane } from '@/lib/skrzynka/zmiana'

const SKLAD = ['Jula', 'Kuba']

describe('sprawdzZmiane', () => {
  it('przepuszcza status, przypisanie ze Składu (albo nikogo) i pominięcie', () => {
    expect(sprawdzZmiane({ status: 'w-toku' }, SKLAD)).toEqual({ status: 'w-toku' })
    expect(sprawdzZmiane({ przypisana: 'Jula' }, SKLAD)).toEqual({ przypisana: 'Jula' })
    expect(sprawdzZmiane({ przypisana: null }, SKLAD)).toEqual({ przypisana: null })
    expect(sprawdzZmiane({ pomin: 'domena' }, SKLAD)).toEqual({ pomin: 'domena' })
  })

  it('odrzuca nieznany status, osobę spoza Składu, złe pominięcie i pustą zmianę', () => {
    expect(sprawdzZmiane({ status: 'archiwum' }, SKLAD)).toBeNull()
    expect(sprawdzZmiane({ przypisana: 'Obcy' }, SKLAD)).toBeNull()
    expect(sprawdzZmiane({ pomin: 'wszystko' }, SKLAD)).toBeNull()
    expect(sprawdzZmiane({}, SKLAD)).toBeNull()
    expect(sprawdzZmiane(null, SKLAD)).toBeNull()
  })
})
```

Do `lib/skrzynka/dane.test.ts` - import dopisz `czytajSprawe, zmienSprawe, dodajPomijanie, skladZarzadu`; nowy blok:

```ts
describe('zmiany ręczne', () => {
  it('status: niezmiennik czekania, ręczne Do odpowiedzi liczy od teraz, klucz i zmieniono', async () => {
    await zapiszWynik({ sprawy: [sprawa('t1')], kontakty: [], organizacje: [] })
    const a = await zmienSprawe('t1', { status: 'w-toku' }, 5_000)
    expect(a).toMatchObject({ status: 'w-toku', oczekujeOd: null, zmieniono: 5_000 })
    expect(baza.get('skrzynkaSprawy/t1')).toMatchObject({ klucz: 'w-toku|000000000000100|t1', zmieniono: 5_000 })
    expect((await listaSpraw('w-toku', null)).sprawy.map((s) => s.id)).toEqual(['t1'])
    const b = await zmienSprawe('t1', { status: 'do-odpowiedzi' }, 9_000)
    expect(b).toMatchObject({ status: 'do-odpowiedzi', oczekujeOd: 9_000 })
  })

  it('przypisanie i znacznik nowej wiadomości bez zmiany statusu; brak sprawy - null', async () => {
    await zapiszWynik({ sprawy: [sprawa('t1')], kontakty: [], organizacje: [] })
    expect(await zmienSprawe('t1', { przypisana: 'Jula', nowa: false }, 1)).toMatchObject({ status: 'do-odpowiedzi', oczekujeOd: 100, przypisana: 'Jula', nowa: false })
    expect(await zmienSprawe('t1', { przypisana: null }, 2)).toMatchObject({ przypisana: null })
    expect(await zmienSprawe('brak', { status: 'w-toku' })).toBeNull()
    expect(await czytajSprawe('t1')).toMatchObject({ id: 't1', przypisana: null })
    expect(await czytajSprawe('brak')).toBeNull()
  })

  it('pomijanie: małymi literami i bez powtórzeń', async () => {
    await dodajPomijanie('adres', 'News@Sklep.pl')
    await dodajPomijanie('adres', 'news@sklep.pl')
    await dodajPomijanie('domena', 'Reklama.pl')
    expect(await pomijane()).toEqual({ adresy: ['news@sklep.pl'], domeny: ['reklama.pl'] })
  })

  it('Skład zarządu z ustawień Planera', async () => {
    expect(await skladZarzadu()).toEqual([])
    baza.set('ustawienia/sklad', { osoby: ['Jula', 'Kuba'] })
    expect(await skladZarzadu()).toEqual(['Jula', 'Kuba'])
  })

  it('kontakty w partii bez powtórzeń - wygrywa wersja z imieniem', async () => {
    await zapiszWynik({
      sprawy: [],
      kontakty: [
        { email: 'anna@firma.pl', imie: 'Anna', organizacja: 'firma.pl', typ: null },
        { email: 'anna@firma.pl', imie: '', organizacja: 'firma.pl', typ: null },
      ],
      organizacje: [],
    })
    expect(baza.get('skrzynkaKontakty/anna@firma.pl')).toMatchObject({ imie: 'Anna' })
  })
})
```

Do `lib/skrzynka/synchronizacja.test.ts` - import dopisz `klientGmaila`; blok na końcu:

```ts
describe('klientGmaila', () => {
  it('niepołączona - rozłączona; połączona - klient na odszyfrowanym tokenie', async () => {
    dane.czytajStan.mockResolvedValueOnce(stan({ polaczona: false }))
    await expect(klientGmaila()).rejects.toMatchObject({ rodzaj: 'rozlaczona' })
    expect(await klientGmaila()).toBe(g)
    expect(utworzonyZ).toHaveBeenLastCalledWith('refresh')
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `lib/skrzynka/typy.ts` - na końcu**

```ts
/** Ręczna zmiana sprawy z panelu. `pomin` = Pominięta + nadawca (adres albo domena) na listę „zawsze pomijaj”. */
export interface ZmianaSprawy {
  status?: Status
  przypisana?: string | null
  pomin?: 'adres' | 'domena'
}
```

- [ ] **Krok 4: `lib/skrzynka/zmiana.ts`**

```ts
import { STATUSY, type Status, type ZmianaSprawy } from './typy'

/** Walidacja ciała PATCH sprawy. Przypisać można tylko osobę ze Składu zarządu albo nikogo. */
export function sprawdzZmiane(body: unknown, sklad: string[]): ZmianaSprawy | null {
  if (!body || typeof body !== 'object') return null
  const x = body as Record<string, unknown>
  const z: ZmianaSprawy = {}
  if (x.status !== undefined) {
    if (!STATUSY.includes(x.status as Status)) return null
    z.status = x.status as Status
  }
  if (x.przypisana !== undefined) {
    if (x.przypisana !== null && !(typeof x.przypisana === 'string' && sklad.includes(x.przypisana))) return null
    z.przypisana = x.przypisana as string | null
  }
  if (x.pomin !== undefined) {
    if (x.pomin !== 'adres' && x.pomin !== 'domena') return null
    z.pomin = x.pomin
  }
  return Object.keys(z).length ? z : null
}
```

- [ ] **Krok 5: `lib/skrzynka/dane.ts`**

Importy: dopisz `ustawieniaRef` do importu z `@/lib/firebase/admin` i `import { naSklad } from '@/lib/planer/stan'`.

W `zapiszWynik` zamień tworzenie listy kontaktów: przed `const zapisy = [` dopisz

```ts
  // Jedna osoba z kilkoma wątkami w partii to jeden zapis; wersja z imieniem wygrywa.
  const kontaktyUnikalne = [...w.kontakty.reduce((m, k) => (m.get(k.email)?.imie && !k.imie ? m : m.set(k.email, k)), new Map<string, Kontakt>()).values()]
```

i w `zapisy` zamień `...w.kontakty.map((k) => ({` na `...kontaktyUnikalne.map((k) => ({`.

Pod `uzupelnijKlucze` dopisz:

```ts
export async function czytajSprawe(id: string): Promise<Sprawa | null> {
  const d = (await sprawyRef().doc(id).get()).data()
  return d ? naSprawe(id, d) : null
}

/**
 * Ręczna zmiana z panelu, w transakcji. Niezmiennik: czas czekania ma tylko
 * „Do odpowiedzi”, a ręczne oznaczenie liczy go od teraz. `zmieniono` = teraz
 * - synchronizacja nie nadpisze sprawy zmienionej w trakcie jej pracy.
 */
export async function zmienSprawe(
  id: string,
  z: { status?: Status; przypisana?: string | null; nowa?: boolean },
  teraz = Date.now(),
): Promise<Sprawa | null> {
  const ref = sprawyRef().doc(id)
  return ref.firestore.runTransaction(async (t) => {
    const d = (await t.get(ref)).data()
    if (!d) return null
    const s = naSprawe(id, d)
    const nowa: Sprawa = {
      ...s,
      ...(z.przypisana !== undefined ? { przypisana: z.przypisana } : {}),
      ...(z.nowa !== undefined ? { nowa: z.nowa } : {}),
      zmieniono: teraz,
    }
    if (z.status && z.status !== s.status) {
      nowa.status = z.status
      nowa.oczekujeOd = z.status === 'do-odpowiedzi' ? teraz : null
    }
    t.set(ref, doZapisu(nowa))
    return nowa
  })
}

/** Lista „zawsze pomijaj” - małymi literami, bez powtórzeń. */
export async function dodajPomijanie(rodzaj: 'adres' | 'domena', wartosc: string): Promise<void> {
  const ref = skrzynkaUstawieniaRef()
  const pole = rodzaj === 'adres' ? 'pomijaneAdresy' : 'pomijaneDomeny'
  const v = wartosc.toLowerCase()
  await ref.firestore.runTransaction(async (t) => {
    const d = (await t.get(ref)).data()
    const lista = Array.isArray(d?.[pole]) ? (d[pole] as unknown[]).filter((x): x is string => typeof x === 'string') : []
    if (!lista.includes(v)) t.set(ref, { [pole]: [...lista, v] }, { merge: true })
  })
}

/** Skład zarządu z ustawień Planera - lista do przypisywania spraw. */
export async function skladZarzadu(): Promise<string[]> {
  return naSklad((await ustawieniaRef('sklad').get()).data())
}
```

- [ ] **Krok 6: `lib/skrzynka/synchronizacja.ts`**

Zamień `async function zRozlaczeniem` na `export async function zRozlaczeniem`. Pod nią dopisz:

```ts
/** Klient Gmaila połączonej skrzynki - do tras panelu (treść, załącznik, wyszukiwanie). */
export async function klientGmaila(): Promise<Gmail> {
  const stan = await czytajStan()
  if (!stan?.polaczona) throw new BladSkrzynki('rozlaczona', 'Skrzynka nie jest połączona')
  return gmailZeStanu(stan)
}
```

- [ ] **Krok 7: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 8: Commit**

```bash
git add lib/skrzynka
git commit -m "$(cat <<'EOF'
feat(skrzynka): reczne zmiany spraw, pomijanie nadawcow i sklad do przypisan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 4: Trasy spraw

**Pliki:** nowe `app/api/skrzynka/sprawy/route.ts`, `app/api/skrzynka/szukaj/route.ts`, `app/api/skrzynka/sprawy/[id]/route.ts`, `app/api/skrzynka/sprawy/[id]/zalacznik/[zid]/route.ts`, test `app/api/skrzynka/sprawy/route.test.ts`

**Interfejsy:**
- Korzysta z: `listaSpraw`, `czytajSprawy`, `czytajSprawe`, `zmienSprawe`, `dodajPomijanie`, `skladZarzadu` (zadania 1, 3); `klientGmaila`, `zRozlaczeniem` (zadanie 3); `odczytajWatekPelny`, `dekodujBase64Url` (zadanie 2); `sprawdzZmiane` (zadanie 3); `domena` (część 1); `komunikatBledu` (część 1).
- Daje: `GET /api/skrzynka/sprawy?status&po` → `StronaSpraw`; `GET /api/skrzynka/szukaj?q` → `StronaSpraw`; `GET /api/skrzynka/sprawy/{id}` → `SzczegolySprawy` (zdejmuje `nowa`); `PATCH /api/skrzynka/sprawy/{id}` `ZmianaSprawy` → `Sprawa`; `GET /api/skrzynka/sprawy/{id}/zalacznik/{zid}?w&nazwa&typ` → plik.

- [ ] **Krok 1: Test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as lista } from '@/app/api/skrzynka/sprawy/route'
import { GET as szukaj } from '@/app/api/skrzynka/szukaj/route'
import { GET as sprawa, PATCH as zmien } from '@/app/api/skrzynka/sprawy/[id]/route'
import { GET as zalacznik } from '@/app/api/skrzynka/sprawy/[id]/zalacznik/[zid]/route'
import type { Sprawa } from '@/lib/skrzynka/typy'

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
  id, temat: 'Sponsoring', status: 'do-odpowiedzi', oczekujeOd: 100, nowa: false, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
  ostatnia: { kiedy: 100, kierunek: 'oni', fragment: '' }, wiadomosci: 1, przypisana: null, kategoriaGmail: null, zmieniono: 1, ...n,
})

beforeEach(() => {
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  Object.values(dane).forEach((f) => f.mockReset())
  Object.values(g).forEach((f) => f.mockReset())
  dane.skladZarzadu.mockResolvedValue(['Jula'])
})

describe('dostęp', () => {
  it('bez sesji 401, zarząd 403 - każda trasa', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await lista(zadanie('/api/skrzynka/sprawy?status=zalatwiona'))).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    for (const r of [
      await lista(zadanie('/api/skrzynka/sprawy?status=zalatwiona')),
      await szukaj(zadanie('/api/skrzynka/szukaj?q=oferta')),
      await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1')),
      await zmien(zadanie('/api/skrzynka/sprawy/t1', { status: 'w-toku' }), p('t1')),
      await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A?w=m1'), p('t1', 'A')),
    ]) expect(r.status).toBe(403)
    expect(dane.zmienSprawe).not.toHaveBeenCalled()
  })
})

describe('lista i wyszukiwanie', () => {
  it('lista: nieznany status 400; strona z kursorem', async () => {
    expect((await lista(zadanie('/api/skrzynka/sprawy?status=archiwum'))).status).toBe(400)
    dane.listaSpraw.mockResolvedValue({ sprawy: [S('t1')], nastepna: 'k' })
    const r = await lista(zadanie('/api/skrzynka/sprawy?status=zalatwiona&po=zalatwiona%7C1%7Ct0'))
    expect(await r.json()).toMatchObject({ nastepna: 'k' })
    expect(dane.listaSpraw).toHaveBeenCalledWith('zalatwiona', 'zalatwiona|1|t0')
  })

  it('wyszukiwanie: za krótkie 400; wyniki z bazy od najnowszej, wątki spoza bazy pominięte', async () => {
    expect((await szukaj(zadanie('/api/skrzynka/szukaj?q=a'))).status).toBe(400)
    g.listaWatkow.mockResolvedValue({ threads: [{ id: 'stary' }, { id: 't1' }, { id: 'spoza' }, { id: 't2' }] })
    dane.czytajSprawy.mockResolvedValue(new Map([
      ['t1', S('t1', { ostatnia: { kiedy: 100, kierunek: 'oni', fragment: '' } })],
      ['t2', S('t2', { ostatnia: { kiedy: 300, kierunek: 'oni', fragment: '' } })],
      ['stary', S('stary', { ostatnia: { kiedy: 50, kierunek: 'oni', fragment: '' } })],
    ]))
    const r = await szukaj(zadanie(`/api/skrzynka/szukaj?q=${encodeURIComponent('oferta sponsorska')}`))
    expect((await r.json()).sprawy.map((s: Sprawa) => s.id)).toEqual(['t2', 't1', 'stary'])
    expect(g.listaWatkow).toHaveBeenCalledWith('oferta sponsorska', null)
  })
})

describe('sprawa', () => {
  const utf = (s: string) => Buffer.from(s, 'utf8').toString('base64url')

  it('brak - 404; jest - treść z Gmaila i zdjęty znacznik nowej', async () => {
    dane.czytajSprawe.mockResolvedValueOnce(null)
    expect((await sprawa(zadanie('/api/skrzynka/sprawy/brak'), p('brak'))).status).toBe(404)
    dane.czytajSprawe.mockResolvedValueOnce(S('t1', { nowa: true }))
    dane.zmienSprawe.mockResolvedValueOnce(S('t1', { nowa: false }))
    g.watekPelny.mockResolvedValue({
      id: 't1',
      messages: [{ id: 'm1', internalDate: '100', labelIds: ['INBOX'], payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'anna@firma.pl' }], body: { data: utf('Treść') } } }],
    })
    const d = await (await sprawa(zadanie('/api/skrzynka/sprawy/t1'), p('t1'))).json()
    expect(d.sprawa.nowa).toBe(false)
    expect(d.wiadomosci[0]).toMatchObject({ id: 'm1', tekst: 'Treść' })
    expect(dane.zmienSprawe).toHaveBeenCalledWith('t1', { nowa: false })
  })

  it('zmiana: niepoprawna 400, brak 404, status, przypisanie', async () => {
    expect((await zmien(zadanie('/api/skrzynka/sprawy/t1', { przypisana: 'Obcy' }), p('t1'))).status).toBe(400)
    dane.czytajSprawe.mockResolvedValueOnce(null)
    expect((await zmien(zadanie('/api/skrzynka/sprawy/t1', { status: 'w-toku' }), p('t1'))).status).toBe(404)
    dane.czytajSprawe.mockResolvedValue(S('t1'))
    dane.zmienSprawe.mockResolvedValue(S('t1', { status: 'w-toku', oczekujeOd: null }))
    const r = await zmien(zadanie('/api/skrzynka/sprawy/t1', { status: 'w-toku', przypisana: 'Jula' }), p('t1'))
    expect((await r.json()).status).toBe('w-toku')
    expect(dane.zmienSprawe).toHaveBeenLastCalledWith('t1', { status: 'w-toku', przypisana: 'Jula' })
  })

  it('pomiń zawsze: adres albo domena organizacji; domena skrzynki prywatnej - 400', async () => {
    dane.czytajSprawe.mockResolvedValue(S('t1'))
    dane.zmienSprawe.mockResolvedValue(S('t1', { status: 'pominieta', oczekujeOd: null }))
    await zmien(zadanie('/api/skrzynka/sprawy/t1', { pomin: 'domena' }), p('t1'))
    expect(dane.dodajPomijanie).toHaveBeenLastCalledWith('domena', 'firma.pl')
    expect(dane.zmienSprawe).toHaveBeenLastCalledWith('t1', { status: 'pominieta' })
    await zmien(zadanie('/api/skrzynka/sprawy/t1', { pomin: 'adres' }), p('t1'))
    expect(dane.dodajPomijanie).toHaveBeenLastCalledWith('adres', 'anna@firma.pl')
    dane.czytajSprawe.mockResolvedValue(S('t2', { kontakt: 'ktos@gmail.com', organizacja: null }))
    const r = await zmien(zadanie('/api/skrzynka/sprawy/t2', { pomin: 'domena' }), p('t2'))
    expect(r.status).toBe(400)
    dane.czytajSprawe.mockResolvedValue(S('t3', { kontakt: null, organizacja: null }))
    expect((await zmien(zadanie('/api/skrzynka/sprawy/t3', { pomin: 'adres' }), p('t3'))).status).toBe(400)
  })
})

describe('załącznik', () => {
  it('zawsze do pobrania; typ spoza listy bezpiecznych jako octet-stream; polska nazwa', async () => {
    g.zalacznik.mockResolvedValue({ data: Buffer.from('<svg onload=alert(1)>').toString('base64url'), size: 21 })
    const r = await zalacznik(zadanie(`/api/skrzynka/sprawy/t1/zalacznik/A?w=m1&nazwa=${encodeURIComponent('Ofert\u0105 2026.svg')}&typ=image%2Fsvg%2Bxml`), p('t1', 'A'))
    expect(r.headers.get('content-type')).toBe('application/octet-stream')
    expect(r.headers.get('content-disposition')).toBe(`attachment; filename="Ofert_ 2026.svg"; filename*=UTF-8''${encodeURIComponent('Ofert\u0105 2026.svg')}`)
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await r.text()).toBe('<svg onload=alert(1)>')
    expect(g.zalacznik).toHaveBeenCalledWith('m1', 'A')
  })

  it('PDF z typem; bez identyfikatora wiadomości - 400', async () => {
    g.zalacznik.mockResolvedValue({ data: 'JVBERi0', size: 5 })
    const r = await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A?w=m1&nazwa=o.pdf&typ=application%2Fpdf'), p('t1', 'A'))
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect((await zalacznik(zadanie('/api/skrzynka/sprawy/t1/zalacznik/A'), p('t1', 'A'))).status).toBe(400)
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run app/api/skrzynka/sprawy > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `app/api/skrzynka/sprawy/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { listaSpraw } from '@/lib/skrzynka/dane'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { STATUSY, TYLKO_WLASCICIEL, type Status } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'

/** Jedna zakładka listy spraw - tylko Firestore, bez Gmaila. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const status = req.nextUrl.searchParams.get('status') as Status
  if (!STATUSY.includes(status)) return NextResponse.json({ error: 'Nieznany status' }, { status: 400 })
  try {
    return NextResponse.json(await listaSpraw(status, req.nextUrl.searchParams.get('po')))
  } catch (e) {
    const { status: kod, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status: kod })
  }
}
```

- [ ] **Krok 4: `app/api/skrzynka/szukaj/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { czytajSprawy } from '@/lib/skrzynka/dane'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { klientGmaila, zRozlaczeniem } from '@/lib/skrzynka/synchronizacja'
import { TYLKO_WLASCICIEL, type StronaSpraw } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
const WYNIKI = 50

/**
 * Wyszukiwanie Gmaila (znajdzie też treść), wyniki jako sprawy z bazy. Wątki
 * spoza importu (starsze niż 12 miesięcy) nie mają sprawy - pomijamy je.
 */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ error: 'Wpisz co najmniej 2 znaki.' }, { status: 400 })
  try {
    const sprawy = await zRozlaczeniem(async () => {
      const l = await (await klientGmaila()).listaWatkow(q, null)
      const ids = (l.threads ?? []).slice(0, WYNIKI).map((t) => t.id)
      const m = await czytajSprawy(ids)
      return ids.flatMap((id) => m.get(id) ?? []).sort((a, b) => b.ostatnia.kiedy - a.ostatnia.kiedy)
    })
    return NextResponse.json({ sprawy, nastepna: null } satisfies StronaSpraw)
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
```

- [ ] **Krok 5: `app/api/skrzynka/sprawy/[id]/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { czytajSprawe, dodajPomijanie, skladZarzadu, zmienSprawe } from '@/lib/skrzynka/dane'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { domena } from '@/lib/skrzynka/kontakty'
import { klientGmaila, zRozlaczeniem } from '@/lib/skrzynka/synchronizacja'
import { odczytajWatekPelny } from '@/lib/skrzynka/tresc'
import { TYLKO_WLASCICIEL, type SzczegolySprawy } from '@/lib/skrzynka/typy'
import { sprawdzZmiane } from '@/lib/skrzynka/zmiana'

export const runtime = 'nodejs'

type Kontekst = { params: Promise<{ id: string }> }

/** Sprawa z bazy i wątek z Gmaila na żywo. Otwarcie zdejmuje znacznik „nowa wiadomość”. */
export async function GET(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const { id } = await params
  try {
    const s = await czytajSprawe(id)
    if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
    const wiadomosci = await zRozlaczeniem(async () => odczytajWatekPelny(await (await klientGmaila()).watekPelny(id)))
    const sprawa = s.nowa ? ((await zmienSprawe(id, { nowa: false })) ?? s) : s
    return NextResponse.json({ sprawa, wiadomosci } satisfies SzczegolySprawy)
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function PATCH(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
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

- [ ] **Krok 6: `app/api/skrzynka/sprawy/[id]/zalacznik/[zid]/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { klientGmaila, zRozlaczeniem } from '@/lib/skrzynka/synchronizacja'
import { dekodujBase64Url } from '@/lib/skrzynka/tresc'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Tylko te typy podajemy wprost; reszta jako octet-stream. Plik od nadawcy nigdy nie renderuje się w domenie D.E.C.K. */
const BEZPIECZNE_TYPY = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif']

type Kontekst = { params: Promise<{ id: string; zid: string }> }

export async function GET(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const { zid } = await params
  const sp = req.nextUrl.searchParams
  const wiadomoscId = sp.get('w')
  if (!wiadomoscId) return NextResponse.json({ error: 'Brak wiadomości' }, { status: 400 })
  const nazwa = (sp.get('nazwa') || 'zalacznik').replace(/[\r\n"\\]/g, '_')
  const typ = BEZPIECZNE_TYPY.includes(sp.get('typ') ?? '') ? sp.get('typ')! : 'application/octet-stream'
  try {
    const z = await zRozlaczeniem(async () => (await klientGmaila()).zalacznik(wiadomoscId, zid))
    return new NextResponse(dekodujBase64Url(z.data), {
      headers: {
        'Content-Type': typ,
        'Content-Disposition': `attachment; filename="${nazwa.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nazwa)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
```

- [ ] **Krok 7: Uruchom - ma przejść**

Run: `npx vitest run app/api/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 8: Commit**

```bash
git add app/api/skrzynka/sprawy app/api/skrzynka/szukaj
git commit -m "$(cat <<'EOF'
feat(skrzynka): trasy listy, wyszukiwania, sprawy, zmian i zalacznikow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 5: Lista spraw w przeglądarce

**Pliki:** nowe `lib/skrzynka/widok.ts`, `lib/skrzynka/widok.test.ts`, `components/skrzynka/ListaSpraw.tsx`, `components/skrzynka/ListaSpraw.test.tsx`; zmiana `lib/skrzynka/klient.ts`

**Interfejsy:**
- Korzysta z: trasy z zadania 4; `poTerminie` (część 1); `useTeraz` (`@/lib/useTeraz`); `dzisWarszawa` (`@/lib/czas`).
- Daje: `ETYKIETY_STATUSOW`, `ZAKLADKI`, `kiedyKrotko(ms, teraz)`, `pelnaData(ms)`, `linkGmail(email, id)`, `adresZalacznika(sprawaId, z)`, `rozmiar(bajty)`; `klientSkrzynki.sprawy/szukaj/sprawa/zmien`; `ListaSpraw({ status, szukane, wybrana, onWybierz, wersja })`.

- [ ] **Krok 1: Testy**

`lib/skrzynka/widok.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { adresZalacznika, kiedyKrotko, linkGmail, rozmiar } from '@/lib/skrzynka/widok'

// Środa 14.10.2026, 12:00 w Warszawie.
const TERAZ = Date.UTC(2026, 9, 14, 10)

describe('widok', () => {
  it('kiedyKrotko: dziś godzina, wczoraj, ten rok, inny rok', () => {
    expect(kiedyKrotko(Date.UTC(2026, 9, 14, 7, 5), TERAZ)).toBe('09:05')
    expect(kiedyKrotko(Date.UTC(2026, 9, 13, 20), TERAZ)).toBe('wczoraj')
    expect(kiedyKrotko(Date.UTC(2026, 8, 2, 10), TERAZ)).toBe('02.09')
    expect(kiedyKrotko(Date.UTC(2025, 11, 30, 10), TERAZ)).toBe('30.12.2025')
  })

  it('link do Gmaila na koncie kontakt@', () => {
    expect(linkGmail('kontakt@samorzad.ue.wroc.pl', '18f2a')).toBe('https://mail.google.com/mail/?authuser=kontakt%40samorzad.ue.wroc.pl#all/18f2a')
  })

  it('adres załącznika koduje identyfikatory i nazwę', () => {
    expect(adresZalacznika('t1', { id: 'A/B', wiadomoscId: 'm1', nazwa: 'Oferta 2026.pdf', typ: 'application/pdf', rozmiar: 1 }))
      .toBe('/api/skrzynka/sprawy/t1/zalacznik/A%2FB?w=m1&nazwa=Oferta+2026.pdf&typ=application%2Fpdf')
  })

  it('rozmiar pliku', () => {
    expect(rozmiar(300)).toBe('1 KB')
    expect(rozmiar(120_000)).toBe('117 KB')
    expect(rozmiar(3_400_000)).toBe('3,2 MB')
  })
})
```

`components/skrzynka/ListaSpraw.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListaSpraw } from '@/components/skrzynka/ListaSpraw'
import type { Sprawa } from '@/lib/skrzynka/typy'

const klient = { sprawy: vi.fn(), szukaj: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: { sprawy: (...a: unknown[]) => klient.sprawy(...a), szukaj: (...a: unknown[]) => klient.szukaj(...a) },
}))

const S = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
  id, temat: `Temat ${id}`, status: 'zalatwiona', oczekujeOd: null, nowa: false, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
  ostatnia: { kiedy: Date.UTC(2026, 8, 2), kierunek: 'oni', fragment: 'Dzień dobry' }, wiadomosci: 1, przypisana: null, kategoriaGmail: null, zmieniono: 1, ...n,
})

async function lista(p: Partial<Parameters<typeof ListaSpraw>[0]> = {}) {
  const onWybierz = vi.fn()
  await act(async () => {
    render(<ListaSpraw status="zalatwiona" szukane="" wybrana={null} onWybierz={onWybierz} wersja={0} {...p} />)
  })
  return onWybierz
}

beforeEach(() => Object.values(klient).forEach((f) => f.mockReset()))

describe('ListaSpraw', () => {
  it('wiersze: nadawca, organizacja, temat, fragment i znaczniki', async () => {
    klient.sprawy.mockResolvedValue({
      sprawy: [S('t1', { status: 'do-odpowiedzi', oczekujeOd: Date.UTC(2020, 0, 1), nowa: true, przypisana: 'Jula' })],
      nastepna: null,
    })
    await lista({ status: 'do-odpowiedzi' })
    expect(klient.sprawy).toHaveBeenCalledWith('do-odpowiedzi', null)
    const wiersz = screen.getByRole('button', { name: /Temat t1/ })
    expect(wiersz).toHaveTextContent('anna@firma.pl · firma.pl')
    expect(wiersz).toHaveTextContent('Dzień dobry')
    expect(wiersz).toHaveTextContent(/po terminie/i)
    expect(wiersz).toHaveTextContent(/nowa/i)
    expect(wiersz).toHaveTextContent('Jula')
  })

  it('wybór sprawy zdejmuje znacznik nowej od razu', async () => {
    klient.sprawy.mockResolvedValue({ sprawy: [S('t1', { nowa: true })], nastepna: null })
    const onWybierz = await lista()
    fireEvent.click(screen.getByRole('button', { name: /Temat t1/ }))
    expect(onWybierz).toHaveBeenCalledWith('t1')
    expect(screen.getByRole('button', { name: /Temat t1/ })).not.toHaveTextContent(/nowa/i)
  })

  it('kolejna strona po kursorze', async () => {
    klient.sprawy.mockResolvedValueOnce({ sprawy: [S('t1')], nastepna: 'k1' }).mockResolvedValueOnce({ sprawy: [S('t2')], nastepna: null })
    await lista()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }))
    })
    expect(klient.sprawy).toHaveBeenLastCalledWith('zalatwiona', 'k1')
    expect(screen.getByRole('button', { name: /Temat t2/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pokaż więcej' })).toBeNull()
  })

  it('wyszukiwanie, pusta lista i błąd', async () => {
    klient.szukaj.mockResolvedValue({ sprawy: [], nastepna: null })
    await lista({ szukane: 'oferta' })
    expect(klient.szukaj).toHaveBeenCalledWith('oferta')
    expect(screen.getByText('Nic nie znaleziono.')).toBeInTheDocument()
    klient.sprawy.mockRejectedValue(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    await lista()
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/widok.test.ts components/skrzynka/ListaSpraw.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `lib/skrzynka/widok.ts`**

```ts
import { dzisWarszawa } from '@/lib/czas'
import type { Status, Zalacznik } from './typy'

export const ETYKIETY_STATUSOW: Record<Status, string> = {
  'do-odpowiedzi': 'Do odpowiedzi',
  'w-toku': 'W toku',
  'czeka-na-nich': 'Czeka na nich',
  'do-przejrzenia': 'Do przejrzenia',
  zalatwiona: 'Załatwione',
  pominieta: 'Pominięte',
}

/** Kolejność zakładek: od tego, co wymaga ruchu, do archiwum. */
export const ZAKLADKI: Status[] = ['do-odpowiedzi', 'w-toku', 'czeka-na-nich', 'do-przejrzenia', 'zalatwiona', 'pominieta']

const STREFA = 'Europe/Warsaw'
const dwie = (n: number) => String(n).padStart(2, '0')
const tenSamDzien = (a: { rok: number; miesiac: number; dzien: number }, b: typeof a) =>
  a.rok === b.rok && a.miesiac === b.miesiac && a.dzien === b.dzien

/** Na listę: dziś - godzina, wczoraj, w tym roku DD.MM, starsze DD.MM.RRRR. */
export function kiedyKrotko(ms: number, teraz: number): string {
  const d = dzisWarszawa(new Date(ms))
  const dzis = dzisWarszawa(new Date(teraz))
  if (tenSamDzien(d, dzis)) {
    return new Intl.DateTimeFormat('pl-PL', { timeZone: STREFA, hour: '2-digit', minute: '2-digit' }).format(ms)
  }
  if (tenSamDzien(d, dzisWarszawa(new Date(teraz - 86_400_000)))) return 'wczoraj'
  return d.rok === dzis.rok ? `${dwie(d.dzien)}.${dwie(d.miesiac)}` : `${dwie(d.dzien)}.${dwie(d.miesiac)}.${d.rok}`
}

export function pelnaData(ms: number): string {
  return new Intl.DateTimeFormat('pl-PL', { timeZone: STREFA, dateStyle: 'medium', timeStyle: 'short' }).format(ms)
}

/** Wątek w Gmailu na koncie kontakt@ - `authuser` wybiera właściwe konto, gdy w przeglądarce jest ich kilka. */
export function linkGmail(email: string, id: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#all/${id}`
}

export function adresZalacznika(sprawaId: string, z: Zalacznik): string {
  const p = new URLSearchParams({ w: z.wiadomoscId, nazwa: z.nazwa, typ: z.typ })
  return `/api/skrzynka/sprawy/${encodeURIComponent(sprawaId)}/zalacznik/${encodeURIComponent(z.id)}?${p}`
}

export function rozmiar(bajty: number): string {
  if (bajty < 1024 * 1024) return `${Math.max(1, Math.round(bajty / 1024))} KB`
  return `${(bajty / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
```

- [ ] **Krok 4: `lib/skrzynka/klient.ts`**

Zamień import typów na `import type { Sprawa, Status, StronaSpraw, SzczegolySprawy, WynikSynchronizacji, ZmianaSprawy } from './typy'` i dopisz do `klientSkrzynki`:

```ts
  sprawy: (status: Status, po: string | null) =>
    wywolaj<StronaSpraw>(`/api/skrzynka/sprawy?${new URLSearchParams(po ? { status, po } : { status })}`),
  szukaj: (q: string) => wywolaj<StronaSpraw>(`/api/skrzynka/szukaj?${new URLSearchParams({ q })}`),
  sprawa: (id: string) => wywolaj<SzczegolySprawy>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}`),
  zmien: (id: string, z: ZmianaSprawy) => wywolaj<Sprawa>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}`, json('PATCH', z)),
```

- [ ] **Krok 5: `components/skrzynka/ListaSpraw.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { poTerminie } from '@/lib/skrzynka/statusy'
import { kiedyKrotko } from '@/lib/skrzynka/widok'
import type { Status, StronaSpraw } from '@/lib/skrzynka/typy'
import { useTeraz } from '@/lib/useTeraz'

/**
 * Jedna zakładka albo wyniki wyszukiwania. Stan zaczyna się od zera przy
 * zmianie zakładki, bo rodzic podaje `key` - tu tylko wczytujemy.
 * `wersja` rośnie po zmianie sprawy i wymusza ponowne wczytanie.
 */
export function ListaSpraw({ status, szukane, wybrana, onWybierz, wersja }: {
  status: Status
  szukane: string
  wybrana: string | null
  onWybierz: (id: string) => void
  wersja: number
}) {
  const teraz = useTeraz(60_000)
  const [strona, setStrona] = useState<StronaSpraw | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [laduje, setLaduje] = useState(false)

  useEffect(() => {
    let aktywny = true
    ;(szukane ? klientSkrzynki.szukaj(szukane) : klientSkrzynki.sprawy(status, null))
      .then((s) => {
        if (aktywny) setStrona(s)
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

  if (blad) return <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p>
  if (!strona) return <p className="font-mono text-[11px] text-deck-muted">Wczytuję sprawy…</p>
  if (!strona.sprawy.length) {
    return <p className="text-[12.5px] text-deck-muted">{szukane ? 'Nic nie znaleziono.' : 'Brak spraw w tej zakładce.'}</p>
  }

  return (
    <div className="space-y-2">
      <ul aria-label="Sprawy" className="space-y-1.5">
        {strona.sprawy.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => wybierz(s.id)}
              aria-pressed={s.id === wybrana}
              className={`w-full rounded-md border px-3 py-2 text-left transition ${
                s.id === wybrana ? 'border-deck-accent/50 bg-deck-accent/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
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
              {(poTerminie(s.oczekujeOd, teraz) || s.nowa || s.przypisana) && (
                <div className="mt-1 flex flex-wrap gap-2 font-mono text-[9.5px] uppercase tracking-[0.12em]">
                  {poTerminie(s.oczekujeOd, teraz) && <span className="text-deck-danger">po terminie</span>}
                  {s.nowa && <span className="text-deck-accent">nowa</span>}
                  {s.przypisana && <span className="text-deck-muted">{s.przypisana}</span>}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
      {strona.nastepna && (
        <button type="button" onClick={wiecej} disabled={laduje} className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
          Pokaż więcej
        </button>
      )}
    </div>
  )
}
```

- [ ] **Krok 6: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka/widok.test.ts components/skrzynka/ListaSpraw.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 7: Commit**

```bash
git add lib/skrzynka/widok.ts lib/skrzynka/widok.test.ts lib/skrzynka/klient.ts components/skrzynka/ListaSpraw.tsx components/skrzynka/ListaSpraw.test.tsx
git commit -m "$(cat <<'EOF'
feat(skrzynka): lista spraw w panelu ze znacznikami i stronami

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 6: Widok sprawy

**Pliki:** nowe `components/skrzynka/TrescWiadomosci.tsx`, `components/skrzynka/WidokSprawy.tsx`, test `components/skrzynka/WidokSprawy.test.tsx`

**Interfejsy:**
- Korzysta z: `klientSkrzynki.sprawa/zmien` (zadanie 5); `bezpiecznyHtml` (zadanie 2); `ETYKIETY_STATUSOW`, `pelnaData`, `linkGmail`, `adresZalacznika`, `rozmiar` (zadanie 5).
- Daje: `TrescWiadomosci({ w })`, `WidokSprawy({ id, sklad, email, onZmiana, onZamknij })`.

- [ ] **Krok 1: Test**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WidokSprawy } from '@/components/skrzynka/WidokSprawy'
import type { Sprawa, SzczegolySprawy } from '@/lib/skrzynka/typy'

const klient = { sprawa: vi.fn(), zmien: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: { sprawa: (...a: unknown[]) => klient.sprawa(...a), zmien: (...a: unknown[]) => klient.zmien(...a) },
}))

const EMAIL = 'kontakt@samorzad.ue.wroc.pl'
const S = (n: Partial<Sprawa> = {}): Sprawa => ({
  id: 't1', temat: 'Sponsoring Juwenaliów', status: 'do-odpowiedzi', oczekujeOd: 100, nowa: false, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
  ostatnia: { kiedy: 100, kierunek: 'oni', fragment: '' }, wiadomosci: 2, przypisana: null, kategoriaGmail: null, zmieniono: 1, ...n,
})
const D = (n: Partial<Sprawa> = {}): SzczegolySprawy => ({
  sprawa: S(n),
  wiadomosci: [
    {
      id: 'm1', kiedy: Date.UTC(2026, 9, 1, 8), od: { email: 'anna@firma.pl', imie: 'Anna' }, do: [], temat: 'Sponsoring Juwenaliów',
      tekst: 'tekst', html: '<p>Oferta</p><script>alert(1)</script>',
      zalaczniki: [{ id: 'A1', wiadomoscId: 'm1', nazwa: 'Oferta.pdf', typ: 'application/pdf', rozmiar: 120_000 }],
    },
    { id: 'm2', kiedy: Date.UTC(2026, 9, 2, 8), od: { email: EMAIL, imie: '' }, do: [], temat: 'Re: Sponsoring', tekst: 'Dziękujemy, wrócimy z odpowiedzią.', html: null, zalaczniki: [] },
  ],
})

async function widok(d: SzczegolySprawy = D()) {
  klient.sprawa.mockResolvedValue(d)
  const onZmiana = vi.fn()
  const onZamknij = vi.fn()
  await act(async () => {
    render(<WidokSprawy id="t1" sklad={['Jula', 'Kuba']} email={EMAIL} onZmiana={onZmiana} onZamknij={onZamknij} />)
  })
  return { onZmiana, onZamknij }
}

beforeEach(() => Object.values(klient).forEach((f) => f.mockReset()))

describe('WidokSprawy', () => {
  it('nagłówek, link do Gmaila, wiadomości: HTML w izolowanej ramce, tekst jako tekst, załącznik do pobrania', async () => {
    await widok()
    expect(klient.sprawa).toHaveBeenCalledWith('t1')
    expect(screen.getByRole('heading', { name: 'Sponsoring Juwenaliów' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Otwórz w Gmailu' })).toHaveAttribute('href', 'https://mail.google.com/mail/?authuser=kontakt%40samorzad.ue.wroc.pl#all/t1')
    const ramka = screen.getByTitle(/Treść/)
    expect(ramka.getAttribute('sandbox')).toBe('allow-popups allow-popups-to-escape-sandbox')
    expect(ramka.getAttribute('srcdoc')).toContain("default-src 'none'")
    expect(ramka.getAttribute('srcdoc')).not.toContain('<script')
    expect(screen.getByText('Dziękujemy, wrócimy z odpowiedzią.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Oferta\.pdf · 117 KB/ })).toHaveAttribute('href', '/api/skrzynka/sprawy/t1/zalacznik/A1?w=m1&nazwa=Oferta.pdf&typ=application%2Fpdf')
  })

  it('zmiana statusu i przypisanie - zapis i powiadomienie rodzica', async () => {
    const { onZmiana } = await widok()
    klient.zmien.mockResolvedValueOnce(S({ status: 'w-toku', oczekujeOd: null }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'W toku' }))
    })
    expect(klient.zmien).toHaveBeenLastCalledWith('t1', { status: 'w-toku' })
    expect(onZmiana).toHaveBeenCalledWith(expect.objectContaining({ status: 'w-toku' }))
    expect(screen.queryByRole('button', { name: 'W toku' })).toBeNull()
    klient.zmien.mockResolvedValueOnce(S({ status: 'w-toku', oczekujeOd: null, przypisana: 'Jula' }))
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Przypisz'), { target: { value: 'Jula' } })
    })
    expect(klient.zmien).toHaveBeenLastCalledWith('t1', { przypisana: 'Jula' })
  })

  it('pomiń zawsze: adres; domena tylko dla organizacji', async () => {
    await widok()
    klient.zmien.mockResolvedValueOnce(S({ status: 'pominieta', oczekujeOd: null }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pomiń zawsze domenę firma.pl' }))
    })
    expect(klient.zmien).toHaveBeenLastCalledWith('t1', { pomin: 'domena' })
  })

  it('nadawca z gmail.com - bez pomijania domeny', async () => {
    await widok(D({ kontakt: 'ktos@gmail.com', organizacja: null }))
    expect(screen.getByRole('button', { name: 'Pomiń zawsze ten adres' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pomiń zawsze domenę/ })).toBeNull()
  })

  it('błąd wczytania i powrót do listy', async () => {
    klient.sprawa.mockRejectedValue(new Error('Skrzynka jest rozłączona - połącz ją ponownie.'))
    const onZamknij = vi.fn()
    await act(async () => {
      render(<WidokSprawy id="t1" sklad={[]} email={EMAIL} onZmiana={vi.fn()} onZamknij={onZamknij} />)
    })
    expect(screen.getByRole('alert')).toHaveTextContent('rozłączona')
    fireEvent.click(screen.getByRole('button', { name: '← Lista' }))
    expect(onZamknij).toHaveBeenCalled()
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/skrzynka/WidokSprawy.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `components/skrzynka/TrescWiadomosci.tsx`**

```tsx
import { bezpiecznyHtml } from '@/lib/skrzynka/html'
import type { WiadomoscPelna } from '@/lib/skrzynka/typy'

/**
 * HTML maila w ramce bez skryptów i bez dostępu do strony D.E.C.K. Linki
 * otwierają się w nowej karcie (`allow-popups`), zewnętrzne obrazki blokuje
 * CSP. Wysokość stała z możliwością rozciągnięcia - ramka bez skryptów nie
 * zmierzy sama swojej treści.
 */
export function TrescWiadomosci({ w }: { w: WiadomoscPelna }) {
  if (w.html) {
    return (
      <iframe
        title={`Treść: ${w.temat || 'wiadomość'}`}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={bezpiecznyHtml(w.html)}
        className="h-[420px] w-full resize-y rounded-md border border-white/10 bg-white"
      />
    )
  }
  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-deck-text">
      {w.tekst ?? '(brak treści)'}
    </pre>
  )
}
```

- [ ] **Krok 4: `components/skrzynka/WidokSprawy.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { ExternalLink, Paperclip } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_STATUSOW, adresZalacznika, linkGmail, pelnaData, rozmiar } from '@/lib/skrzynka/widok'
import type { Sprawa, Status, SzczegolySprawy, ZmianaSprawy } from '@/lib/skrzynka/typy'
import { TrescWiadomosci } from './TrescWiadomosci'

/** Statusy do ustawienia jednym kliknięciem; Do przejrzenia ustawia tylko automat. */
const AKCJE: Status[] = ['do-odpowiedzi', 'w-toku', 'czeka-na-nich', 'zalatwiona']

export function WidokSprawy({ id, sklad, email, onZmiana, onZamknij }: {
  id: string
  sklad: string[]
  email: string
  onZmiana: (s: Sprawa) => void
  onZamknij: () => void
}) {
  const [dane, setDane] = useState<SzczegolySprawy | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [trwa, setTrwa] = useState(false)

  useEffect(() => {
    let aktywny = true
    klientSkrzynki
      .sprawa(id)
      .then((d) => {
        if (aktywny) setDane(d)
      })
      .catch((e: Error) => {
        if (aktywny) setBlad(e.message)
      })
    return () => {
      aktywny = false
    }
  }, [id])

  async function zmien(z: ZmianaSprawy) {
    setTrwa(true)
    setBlad(null)
    try {
      const s = await klientSkrzynki.zmien(id, z)
      setDane((d) => d && { ...d, sprawa: s })
      onZmiana(s)
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  const powrot = (
    <button type="button" onClick={onZamknij} className="text-[11.5px] text-deck-muted hover:underline lg:hidden">
      ← Lista
    </button>
  )

  if (!dane) {
    return (
      <section className="deck-card space-y-2 rounded-lg p-4 text-[12.5px]">
        {powrot}
        {blad ? <p role="alert" className="text-deck-danger">{blad}</p> : <p className="font-mono text-[11px] text-deck-muted">Wczytuję wątek…</p>}
      </section>
    )
  }

  const s = dane.sprawa
  const przycisk = 'deck-chip rounded-md px-2.5 py-1 text-[11.5px] transition hover:text-deck-text disabled:opacity-50'

  return (
    <section aria-label={`Sprawa: ${s.temat}`} className="deck-card space-y-4 rounded-lg p-4 text-[12.5px]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {powrot}
          <h2 className="text-[15px] font-semibold text-deck-text">{s.temat}</h2>
          <p className="text-deck-muted">
            {s.kontakt ?? '(bez nadawcy)'}
            {s.organizacja ? ` · ${s.organizacja}` : ''} · {ETYKIETY_STATUSOW[s.status]}
          </p>
        </div>
        <a href={linkGmail(email, s.id)} target="_blank" rel="noopener noreferrer" className={`${przycisk} inline-flex items-center gap-1`}>
          <ExternalLink size={12} aria-hidden="true" />
          Otwórz w Gmailu
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        {AKCJE.filter((a) => a !== s.status).map((a) => (
          <button key={a} type="button" disabled={trwa} onClick={() => zmien({ status: a })} className={przycisk}>
            {ETYKIETY_STATUSOW[a]}
          </button>
        ))}
        {s.status !== 'pominieta' && (
          <button type="button" disabled={trwa} onClick={() => zmien({ status: 'pominieta' })} className={przycisk}>
            Pomiń
          </button>
        )}
        {s.kontakt && (
          <button type="button" disabled={trwa} onClick={() => zmien({ pomin: 'adres' })} className={przycisk}>
            Pomiń zawsze ten adres
          </button>
        )}
        {/* Domena tylko dla organizacji - gmail.com czy wp.pl wyciszyłyby wszystkich. */}
        {s.kontakt && s.organizacja && (
          <button type="button" disabled={trwa} onClick={() => zmien({ pomin: 'domena' })} className={przycisk}>
            Pomiń zawsze domenę {s.organizacja}
          </button>
        )}
        {/* aria-label zamiast obejmującego <label> - tekst etykiety nie wchłania nazw z listy. */}
        <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-deck-muted">
          <span aria-hidden="true">Przypisz</span>
          <select
            aria-label="Przypisz"
            value={s.przypisana ?? ''}
            disabled={trwa}
            onChange={(e) => zmien({ przypisana: e.target.value || null })}
            className="deck-input rounded-md px-2 py-1"
          >
            <option value="">nikt</option>
            {sklad.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </span>
      </div>
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}

      <ol className="space-y-3">
        {dane.wiadomosci.map((w) => (
          <li key={w.id} className="rounded-md border border-white/10 p-3">
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-[11.5px]">
              <span className="text-deck-text">{w.od ? (w.od.imie ? `${w.od.imie} <${w.od.email}>` : w.od.email) : '(nieznany nadawca)'}</span>
              <span className="font-mono text-deck-muted">{pelnaData(w.kiedy)}</span>
            </div>
            <TrescWiadomosci w={w} />
            {w.zalaczniki.length > 0 && (
              <ul aria-label="Załączniki" className="mt-2 flex flex-wrap gap-2">
                {w.zalaczniki.map((z) => (
                  <li key={z.id}>
                    <a href={adresZalacznika(s.id, z)} className={`${przycisk} inline-flex items-center gap-1`}>
                      <Paperclip size={12} aria-hidden="true" />
                      {z.nazwa} · {rozmiar(z.rozmiar)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Krok 5: Uruchom - ma przejść**

Run: `npx vitest run components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 6: Commit**

```bash
git add components/skrzynka/TrescWiadomosci.tsx components/skrzynka/WidokSprawy.tsx components/skrzynka/WidokSprawy.test.tsx
git commit -m "$(cat <<'EOF'
feat(skrzynka): widok watku z izolowanym HTML, zalacznikami i akcjami sprawy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 7: Panel z zakładkami, wyszukiwarką i wątkiem

**Pliki:** zmiana `components/skrzynka/PanelSkrzynki.tsx`, `components/skrzynka/PanelSkrzynki.test.tsx`, `app/skrzynka/page.tsx`

**Interfejsy:**
- Korzysta z: `ListaSpraw` (zadanie 5), `WidokSprawy` (zadanie 6), `ZAKLADKI`, `ETYKIETY_STATUSOW` (zadanie 5), `skladZarzadu`, `uzupelnijKlucze`, `WERSJA_DANYCH` (zadania 1, 3).
- Daje: `PanelSkrzynki({ liczniki, postep, blad, sklad, email })`.

- [ ] **Krok 1: Test - zastąp cały `components/skrzynka/PanelSkrzynki.test.tsx`**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PanelSkrzynki } from '@/components/skrzynka/PanelSkrzynki'
import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'

const refresh = vi.fn()
const klient = { importuj: vi.fn(), synchronizuj: vi.fn() }
const listaProps = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: { importuj: (...a: unknown[]) => klient.importuj(...a), synchronizuj: (...a: unknown[]) => klient.synchronizuj(...a) },
}))
vi.mock('@/components/skrzynka/ListaSpraw', () => ({
  ListaSpraw: (p: { status: string; szukane: string; onWybierz: (id: string) => void }) => {
    listaProps(p)
    return <button type="button" onClick={() => p.onWybierz('t1')}>sprawa t1</button>
  },
}))
vi.mock('@/components/skrzynka/WidokSprawy', () => ({
  WidokSprawy: (p: { id: string; onZmiana: (s: object) => void; onZamknij: () => void }) => (
    <div>
      widok {p.id}
      <button type="button" onClick={() => p.onZmiana({})}>zmień</button>
      <button type="button" onClick={p.onZamknij}>zamknij</button>
    </div>
  ),
}))

const L: LicznikiSkrzynki = {
  stan: 'polaczona', doOdpowiedzi: 7, poTerminie: 2, doPrzejrzenia: 15, czekaNaNich: 4, wToku: 1, zalatwione: 180, pominiete: 3,
  ostatniaSynchronizacja: Date.UTC(2026, 9, 14, 8, 5),
}
const EMAIL = 'kontakt@samorzad.ue.wroc.pl'
const panel = (n: Partial<Parameters<typeof PanelSkrzynki>[0]> = {}) =>
  render(<PanelSkrzynki liczniki={L} postep={null} blad={null} sklad={['Jula']} email={EMAIL} {...n} />)

beforeEach(() => {
  refresh.mockReset()
  listaProps.mockReset()
  Object.values(klient).forEach((f) => f.mockReset())
})

describe('PanelSkrzynki', () => {
  it('bez połączenia - przycisk zgody Google', () => {
    panel({ liczniki: { ...L, stan: 'brak' } })
    expect(screen.getByRole('link', { name: 'Połącz skrzynkę' })).toHaveAttribute('href', '/api/skrzynka/polacz')
  })

  it('rozłączona - ostrzeżenie i ponowne połączenie', () => {
    panel({ liczniki: { ...L, stan: 'rozlaczona' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/rozłączona/)
    expect(screen.getByRole('link', { name: 'Połącz ponownie' })).toHaveAttribute('href', '/api/skrzynka/polacz')
  })

  it('błąd z powrotu zgody i nieczytelny stan', () => {
    panel({ liczniki: { ...L, stan: 'brak' }, blad: 'inne-konto' })
    expect(screen.getByRole('alert')).toHaveTextContent(/kontakt@samorzad\.ue\.wroc\.pl/)
    panel({ liczniki: null })
    expect(screen.getAllByRole('alert').at(-1)).toHaveTextContent(/Nie udało się odczytać stanu skrzynki/)
  })

  it('zakładki z liczbami; domyślnie Do odpowiedzi; zmiana zakładki', () => {
    panel()
    const zakladki = screen.getByRole('tablist', { name: 'Statusy spraw' })
    expect(zakladki).toHaveTextContent('Do odpowiedzi7')
    expect(zakladki).toHaveTextContent('Załatwione180')
    expect(screen.getByRole('tab', { name: /Do odpowiedzi/ })).toHaveAttribute('aria-selected', 'true')
    expect(listaProps).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'do-odpowiedzi', szukane: '' }))
    fireEvent.click(screen.getByRole('tab', { name: /Załatwione/ }))
    expect(listaProps).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'zalatwiona' }))
  })

  it('wyszukiwanie i powrót do zakładek', () => {
    panel()
    fireEvent.change(screen.getByLabelText('Szukaj w skrzynce'), { target: { value: 'oferta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Szukaj' }))
    expect(listaProps).toHaveBeenLastCalledWith(expect.objectContaining({ szukane: 'oferta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść' }))
    expect(listaProps).toHaveBeenLastCalledWith(expect.objectContaining({ szukane: '' }))
  })

  it('wybór sprawy otwiera wątek; zmiana odświeża liczby; zamknięcie wraca do listy', () => {
    panel()
    fireEvent.click(screen.getByRole('button', { name: 'sprawa t1' }))
    expect(screen.getByText('widok t1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'zmień' }))
    expect(refresh).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'zamknij' }))
    expect(screen.queryByText('widok t1')).toBeNull()
  })

  it('Dociągnij - synchronizacja i odświeżenie; błąd widać', async () => {
    klient.synchronizuj.mockResolvedValueOnce({ stan: 'zrobione', watki: 2 })
    panel()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dociągnij' }))
    })
    expect(refresh).toHaveBeenCalled()
    klient.synchronizuj.mockRejectedValueOnce(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dociągnij' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
  })
})

describe('import skrzynki', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const start = (postep: { trwa: boolean; zrobione: number; razem: number; strona: string | null }) =>
    act(async () => {
      panel({ postep })
    })
  const uplyw = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })

  it('strona po stronie, nie częściej niż co 6 s; na koniec odświeżenie', async () => {
    klient.importuj
      .mockResolvedValueOnce({ nastepnaStrona: 'p2', zrobione: 100, razem: 230 })
      .mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 230, razem: 230 })
    await start({ trwa: true, zrobione: 0, razem: 0, strona: null })
    expect(klient.importuj.mock.calls).toEqual([[null]])
    await uplyw(5_999)
    expect(klient.importuj).toHaveBeenCalledTimes(1)
    await uplyw(1)
    expect(klient.importuj.mock.calls).toEqual([[null], ['p2']])
    expect(screen.getByText('Importuję 230 z ok. 230 wątków')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('przerwany wcześniej - rusza od zapisanej strony', async () => {
    klient.importuj.mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 300, razem: 300 })
    await start({ trwa: true, zrobione: 200, razem: 300, strona: 'p3' })
    expect(klient.importuj.mock.calls).toEqual([['p3']])
    expect(refresh).toHaveBeenCalled()
  })

  it('limit Gmaila - komunikat i samo wznawia po minucie od tej samej strony', async () => {
    klient.importuj
      .mockRejectedValueOnce(Object.assign(new Error('Gmail chwilowo ogranicza tempo.'), { status: 429 }))
      .mockResolvedValueOnce({ nastepnaStrona: null, zrobione: 5, razem: 5 })
    await start({ trwa: true, zrobione: 0, razem: 0, strona: 'p4' })
    expect(screen.getByRole('status')).toHaveTextContent(/wznowię import za minutę/)
    await uplyw(60_000)
    expect(klient.importuj.mock.calls).toEqual([['p4'], ['p4']])
    expect(refresh).toHaveBeenCalled()
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/skrzynka/PanelSkrzynki.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `1`.

- [ ] **Krok 3: `components/skrzynka/PanelSkrzynki.tsx` - zastąp całość**

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
  'inne-konto': 'Zgoda przyszła z innego konta niż kontakt@samorzad.ue.wroc.pl - zaloguj się w Google jako kontakt@ i spróbuj ponownie.',
  odmowa: 'Zgoda w Google nie została udzielona.',
  stan: 'Link połączenia wygasł albo jest nieprawidłowy - spróbuj jeszcze raz.',
  polaczenie: 'Nie udało się połączyć ze skrzynką - spróbuj ponownie.',
  konfiguracja: 'Skrzynka nie jest skonfigurowana na serwerze (zmienne SKRZYNKA_* na Vercelu).',
}

const LICZBA: Record<Status, (l: LicznikiSkrzynki) => number> = {
  'do-odpowiedzi': (l) => l.doOdpowiedzi,
  'w-toku': (l) => l.wToku,
  'czeka-na-nich': (l) => l.czekaNaNich,
  'do-przejrzenia': (l) => l.doPrzejrzenia,
  zalatwiona: (l) => l.zalatwione,
  pominieta: (l) => l.pominiete,
}

const kiedy = (ms: number) =>
  new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' }).format(ms)

export function PanelSkrzynki({ liczniki, postep, blad, sklad, email }: {
  liczniki: LicznikiSkrzynki | null
  postep: PostepImportu | null
  blad: string | null
  sklad: string[]
  email: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('do-odpowiedzi')
  const [wpisane, setWpisane] = useState('')
  const [szukane, setSzukane] = useState('')
  const [wybrana, setWybrana] = useState<string | null>(null)
  const [wersja, setWersja] = useState(0)
  const [trwa, setTrwa] = useState(false)
  const [bladDociagania, setBladDociagania] = useState<string | null>(null)

  // Zmiana sprawy przesuwa ją między zakładkami: lista wczytuje się ponownie, liczby odświeża serwer.
  const poZmianie = useCallback(() => {
    setWersja((v) => v + 1)
    router.refresh()
  }, [router])

  async function dociagnij() {
    setTrwa(true)
    setBladDociagania(null)
    try {
      await klientSkrzynki.synchronizuj()
      poZmianie()
    } catch (e) {
      setBladDociagania((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  function zakladka(s: Status) {
    setStatus(s)
    setSzukane('')
    setWpisane('')
    setWybrana(null)
  }

  const komunikat = blad ? (BLEDY[blad] ?? BLEDY.polaczenie) : null
  const alert = 'rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger'

  return (
    <div className="space-y-4">
      {komunikat && <p role="alert" className={alert}>{komunikat}</p>}

      {liczniki === null ? (
        <p role="alert" className={alert}>Nie udało się odczytać stanu skrzynki - odśwież stronę za chwilę.</p>
      ) : liczniki.stan !== 'polaczona' ? (
        <section className="deck-card max-w-[640px] space-y-3 rounded-lg p-5 text-[12.5px]">
          {liczniki.stan === 'rozlaczona' ? (
            <p role="alert" className="text-deck-danger">Skrzynka jest rozłączona - Google odwołał dostęp. Sprawy w D.E.C.K. zostają; po połączeniu dociągnę zmiany.</p>
          ) : (
            <p className="text-deck-muted">
              D.E.C.K. będzie czytać skrzynkę kontakt@, nadawać mailom statusy i wysyłać odpowiedzi z tego adresu. Zgodę daje się raz, zalogowanym w Google jako kontakt@samorzad.ue.wroc.pl.
            </p>
          )}
          <a href="/api/skrzynka/polacz" className="deck-button inline-flex rounded-md px-3 py-1.5 text-[12px]">
            {liczniki.stan === 'rozlaczona' ? 'Połącz ponownie' : 'Połącz skrzynkę'}
          </a>
        </section>
      ) : (
        <>
          {postep?.trwa && <ImportSkrzynki start={postep} />}

          <div className="flex flex-wrap items-center gap-3 text-[12px] text-deck-muted">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSzukane(wpisane.trim())
                setWybrana(null)
              }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                value={wpisane}
                onChange={(e) => setWpisane(e.target.value)}
                aria-label="Szukaj w skrzynce"
                placeholder="Szukaj w skrzynce (jak w Gmailu: from:, has:attachment…)"
                className="deck-input min-w-0 flex-1 rounded-md px-2.5 py-1.5"
              />
              <button type="submit" disabled={wpisane.trim().length < 2} className="deck-button inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
                <Search size={12} aria-hidden="true" />
                Szukaj
              </button>
            </form>
            <span>Synchronizacja: {liczniki.ostatniaSynchronizacja ? kiedy(liczniki.ostatniaSynchronizacja) : 'jeszcze nie było'}</span>
            <button type="button" onClick={dociagnij} disabled={trwa} className="deck-button inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
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
  )
}
```

- [ ] **Krok 4: `app/skrzynka/page.tsx`**

Import z `@/lib/skrzynka/dane` zamień na `import { WERSJA_DANYCH, czytajStan, liczniki, skladZarzadu, uzupelnijKlucze } from '@/lib/skrzynka/dane'`. Zamień linię `const [stan, l] = await Promise.all([...])` na:

```tsx
  const [stan, sklad] = await Promise.all([czytajStan().catch(() => null), skladZarzadu().catch(() => [] as string[])])
  // Raz po wdrożeniu 2a: sprawy zapisane wcześniej nie mają klucza listy i nie pojawiłyby się w zakładkach.
  if (stan && stan.wersjaDanych < WERSJA_DANYCH) await uzupelnijKlucze().catch((e) => console.error('[skrzynka] klucze:', e))
  const l = await liczniki(teraz).catch(() => null)
```

a wywołanie panelu na:

```tsx
      <PanelSkrzynki liczniki={l} postep={stan?.import ?? null} blad={blad ?? null} sklad={sklad} email={stan?.email ?? ''} />
```

- [ ] **Krok 5: Uruchom - ma przejść**

Run: `npx vitest run components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.
Run: `npm run lint > "$TMP/lint.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 6: Commit**

```bash
git add components/skrzynka/PanelSkrzynki.tsx components/skrzynka/PanelSkrzynki.test.tsx app/skrzynka/page.tsx
git commit -m "$(cat <<'EOF'
feat(skrzynka): panel z zakladkami statusow, wyszukiwarka i widokiem watku

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 8: README, sprawdzenie i wdrożenie

**Pliki:** zmiana `README.md`

- [ ] **Krok 1: README** - w sekcji „Skrzynka kontakt@ (Gmail)” na końcu dopisz akapit:

```markdown
Panel `/skrzynka`: zakładki statusów z liczbami, wyszukiwarka (składnia Gmaila, wyniki tylko z zaimportowanych 12 miesięcy), lista spraw i wątek z treścią pobieraną z Gmaila na żywo. HTML maila wyświetla się w ramce bez skryptów i bez zewnętrznych obrazków; załączniki zawsze się pobierają. Ze sprawy: zmiana statusu, przypisanie osoby ze Składu zarządu (Planer → Skład), „Pomiń” i „Pomiń zawsze” (adres; domena tylko dla organizacji). Lista czyta pole `klucz` (`status|czas|id`) - bez indeksu złożonego w Firestore.
```

- [ ] **Krok 2: Pełne sprawdzenie**

Run: `npx vitest run > "$TMP/vt.log" 2>&1; echo $?` → `0` (przy pojedynczym przekroczeniu czasu w niezwiązanym pliku uruchom go osobno i cały zestaw ponownie)
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`
Run: `npm run lint > "$TMP/lint.log" 2>&1; echo $?` → `0`
Run: `npm run build > "$TMP/build.log" 2>&1; echo $?` → `0`; w logu `ƒ /api/skrzynka/sprawy`, `ƒ /api/skrzynka/szukaj`, `ƒ /api/skrzynka/sprawy/[id]`, `ƒ /api/skrzynka/sprawy/[id]/zalacznik/[zid]`.
Run: `git diff --name-only main | xargs -r grep -l $'\u2014\|\u2013'; echo $?` → bez plików.

- [ ] **Krok 3: Commit, scalenie i wypchnięcie (zgoda użytkownika: „na maina od razu”)**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(skrzynka): opis panelu spraw w README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git checkout main && git pull origin main && git merge --ff-only deck-skrzynka-2a && npx vitest run && git push origin main && git branch -d deck-skrzynka-2a
```

- [ ] **Krok 4: Produkcja**

- Wdrożenie z GitHuba w zespole `dzial-it-samorzadu` w stanie Ready.
- Bez sesji: `GET /api/skrzynka/sprawy?status=zalatwiona`, `GET /api/skrzynka/szukaj?q=ab`, `GET /api/skrzynka/sprawy/x`, `GET /api/skrzynka/sprawy/x/zalacznik/y?w=z` → 401.
- Właściciel (test użytkownika): zakładki z liczbami, Załatwione pokazują zaimportowane sprawy, otwarcie wątku z treścią, pobranie załącznika, zmiana statusu przesuwa sprawę między zakładkami.

- [ ] **Krok 5: Pamięć projektu** - 2a na produkcji, następny krok plan 2b (odpowiedź z załącznikami i stopką, kontakty, organizacje, ustawienia, „Rozłącz”, sprawdzenie zakresu `gmail.send`).
