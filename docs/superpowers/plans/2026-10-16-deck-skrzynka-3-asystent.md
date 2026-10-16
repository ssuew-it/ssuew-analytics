# D.E.C.K. - Skrzynka, część 3: asystent - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** odprawa i czat D.E.C.K. widzą skrzynkę (liczby, sprawy po terminie, aktywne organizacje - bez treści maili), odprawa ma obszar „Skrzynka” z odnośnikiem do `/skrzynka`, a w widoku sprawy „Streść” i „Szkic odpowiedzi” wysyłają jeden wątek do Gemini dopiero po kliknięciu.

**Architektura:** `obrazSkrzynki` w `lib/skrzynka/dane.ts` liczy sekcję z Firestore (liczniki kafelka, 10 najdłużej czekających po terminie, organizacje z 100 najświeższych spraw z 7 dni) i wraca `null`, gdy skrzynka nie jest połączona; `pobierzObrazSkrzynki` w `lib/asystent/dane.ts` nigdy nie rzuca. Obraz idzie przez `daneProjektu` do `zbudujKontekst` - kokpit w tle, czat i odprawa. Czyste `lib/skrzynka/asystent.ts` zamienia wątek w tekst (bez cytatów, do 20 000 znaków od końca) i trzyma instrukcje; trasa `/api/skrzynka/sprawy/{id}/asystent` pyta Gemini bez zapisu treści.

**Stack:** Next.js 16, React 19, Firestore Admin SDK, Gmail API v1, Gemini API (`zapytajGemini`), Vitest 4 + Testing Library.

**Spec:** [docs/superpowers/specs/2026-10-13-deck-skrzynka-crm-design.md](../specs/2026-10-13-deck-skrzynka-crm-design.md) - część 3 z §14 (§9 Asystent, §12 „kontekst: sekcja `skrzynka` bez treści”).

**Szkic sprawdzony przed napisaniem planu:** kod z planu był uruchomiony w całości (855 testów, tsc, lint, build), a plan wygenerowany ze szkicu i sprawdzony symulacją - przenoś go dokładnie.

## Zasady wspólne

- Po polsku; tylko „-”, nigdy długie myślniki. Commit po `npx vitest run <pliki> > "$TMP/vt.log" 2>&1; echo $?` = 0 i `npx tsc --noEmit` = 0, stopka `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Gałąź `deck-skrzynka-3`; użytkownik każe scalać do `main` i wypychać od razu (`ssuew-it/ssuew-analytics`, Vercel `dzial-it-samorzadu` buduje z `main`).
- Trasy skrzynki: 401 bez sesji, 403 zarząd z „Skrzynka jest tylko dla właściciela” (`TYLKO_WLASCICIEL`).
- Kokpit nigdy nie pyta Gmaila. Treść maili idzie do Gemini wyłącznie po kliknięciu „Streść” albo „Szkic odpowiedzi”, jeden wątek naraz; nigdzie nie jest zapisywana ani logowana. Obraz projektu i odprawa nie zawierają treści, fragmentów ani adresów osób.
- Szkic nigdy nie wysyła się sam - tylko wpisuje się do okna odpowiedzi.
- **Przenoszenie kodu:** fragmenty z `\n` lub `\r\n` w treści przenoś narzędziem Write/Edit, nie heredoc-iem w Bash - narzędzie Bash zamienia te sekwencje na prawdziwe znaki.
- **Vitest 4:** w nowych testach odrzucony mock to `mockRejectedValueOnce`. Gdy start workera przekroczy czas („Failed to start forks worker”), uruchom polecenie jeszcze raz - to nie błąd kodu.
- **Po buildzie:** `rm -rf .next/types` - wygenerowane typy tras potrafią zepsuć `tsc` na innej gałęzi.
- Każda zmiana w istniejącym pliku ma postać „Zamień: … na: …”; fragment „Zamień” występuje w pliku dokładnie raz. Zmiany w jednym pliku stosuj w podanej kolejności.

### Poprawki wobec specu (świadome)

1. **Organizacje „z mailami z ostatnich 7 dni”** liczone po `ostatnia.kiedy` (ruch w dowolną stronę) ze 100 najświeższych spraw - 10 najaktywniejszych, z nazwą z kartoteki. Pełne liczenie wymagałoby czytania wszystkich spraw przy każdym wejściu do kokpitu.
2. **Dni czekania kalendarzowe.** Alarm liczy dni robocze, ale to, że sprawa jest po terminie, już niesie sama lista.
3. **Koszt:** obraz skrzynki to ok. 120 odczytów Firestore na zbudowanie obrazu projektu; kokpit używa liczników, które i tak pobiera dla kafelka. Nowy mail zmienia ślad obrazu, ale odprawa i tak odświeża się najwyżej raz na godzinę (bez zmian w `czyOdswiezyc`).
4. **Szkic z miejscami `[do uzupełnienia]`** zamiast zmyślonych terminów i kwot; okno nie wyśle odpowiedzi, dopóki takie miejsca zostały. Szkic zastępuje wpisany tekst tylko po potwierdzeniu.
5. **Streszczenie nie jest zapisywane** - pokazuje się nad wątkiem do zamknięcia sprawy.
6. **Wątek dla modelu bez cytatów** (linie „> …”); wiadomość tylko w HTML zamieniana na tekst.

## Na co uważać w przeglądzie

1. **Treść maila w obrazie projektu albo odprawie** - fragmenty i adresy nie trafiają do sekcji `skrzynka` (test w zadaniu 1).
2. **Skrzynka niepołączona albo Firestore zawodzi** - odprawa i czat działają, sekcja jest `null` (testy w zadaniach 1 i 2).
3. **Wątek dłuższy niż 20 000 znaków** - przycięty od początku, najnowsze wiadomości zostają (test w zadaniu 3).
4. **Szkic z miejscami do uzupełnienia albo nadpisujący wpisany tekst** - wysyłka zablokowana do uzupełnienia, nadpisanie tylko po potwierdzeniu (testy w zadaniu 5).
5. **Gemini bez klucza, limit, wątek usunięty w Gmailu, skrzynka rozłączona** - jasny komunikat, nic nie wysłane, treść nie trafia do logów (testy w zadaniach 4 i 5).

---

## Mapa plików

| Plik | Odpowiedzialność | Zadanie |
|---|---|---|
| `lib/skrzynka/typy.ts`, `lib/skrzynka/dane.ts` | `ObrazSkrzynki`, `obrazSkrzynki` | 1 |
| `lib/asystent/kontekst.ts`, `dane.ts`, `odprawa.ts`, `czat.ts`, `components/deck/PanelOdprawy.tsx`, `app/page.tsx`, `app/api/asystent/{czat,odprawa}/route.ts` | sekcja `skrzynka` w obrazie projektu, obszar odprawy | 2 |
| `lib/skrzynka/asystent.ts` | wątek jako tekst, instrukcje, tryby | 3 |
| `app/api/skrzynka/sprawy/[id]/asystent/route.ts` | „Streść” i „Szkic odpowiedzi” na serwerze | 4 |
| `lib/skrzynka/klient.ts`, `components/skrzynka/WidokSprawy.tsx`, `OknoOdpowiedzi.tsx` | przyciski, streszczenie, szkic w oknie, blokada luk | 5 |
| `README.md` | opis | 6 |

---

## Zadanie 1: Obraz skrzynki dla asystenta

**Pliki:** zmiana `lib/skrzynka/typy.ts`, `lib/skrzynka/dane.ts`, `lib/skrzynka/dane.test.ts`

**Interfejsy:**
- Korzysta z: `liczniki`, `progAlarmu`, `naSprawe`, `sprawyRef`, `organizacjeRef` (części 1-2b).
- Daje: `ObrazSkrzynki { liczby; poTerminie: { temat; organizacja; dniCzekania }[]; aktywneOrganizacje: { nazwa; domena; sprawy }[] }`; `obrazSkrzynki(teraz, l: LicznikiSkrzynki | null): Promise<ObrazSkrzynki | null>`.

- [ ] **Krok 1: Testy**

Baza w pamięci dostaje odczyt pól ze ścieżką z kropką (`ostatnia.kiedy`), jak w Firestore.

`lib/skrzynka/dane.test.ts` - 3 zmiany:


1. Zamień:

```ts
    ref: { sciezka: s },
    exists: baza.has(s),
    data: () => baza.get(s),
    get: (pole: string) => baza.get(s)?.[pole],
  })
  type Migawka = ReturnType<typeof snap>
  const zapisz = (s: string, d: Dane, scal?: boolean) => baza.set(s, scal ? { ...baza.get(s), ...d } : { ...d })
```

   na:

```ts
    ref: { sciezka: s },
    exists: baza.has(s),
    data: () => baza.get(s),
    // Pole może być ścieżką z kropką (`ostatnia.kiedy`) - jak w Firestore.
    get: (pole: string) => pole.split('.').reduce<unknown>((o, k) => (o as Dane | undefined)?.[k], baza.get(s)),
  })
  type Migawka = ReturnType<typeof snap>
  const zapisz = (s: string, d: Dane, scal?: boolean) => baza.set(s, scal ? { ...baza.get(s), ...d } : { ...d })
```


2. Zamień:

```ts

import {
  DOMYSLNA_STOPKA, czytajSprawe, czytajSprawy, czytajStan, czytajUstawienia, dodajPomijanie, kartaKontaktu, kartaOrganizacji, kluczListy,
  liczniki, listaKontaktow, listaOrganizacji, listaSpraw, pomijane, rozlaczStan, skladZarzadu, usunDaneSkrzynki, uzupelnijKlucze,
  wezDzierzawe, zapiszStan, zapiszUstawienia, zapiszWynik, zmienOrganizacje, zmienSprawe, zwolnijDzierzawe,
} from '@/lib/skrzynka/dane'
```

   na:

```ts

import {
  DOMYSLNA_STOPKA, czytajSprawe, czytajSprawy, czytajStan, czytajUstawienia, dodajPomijanie, kartaKontaktu, kartaOrganizacji, kluczListy,
  liczniki, listaKontaktow, listaOrganizacji, listaSpraw, obrazSkrzynki, pomijane, rozlaczStan, skladZarzadu, usunDaneSkrzynki, uzupelnijKlucze,
  wezDzierzawe, zapiszStan, zapiszUstawienia, zapiszWynik, zmienOrganizacje, zmienSprawe, zwolnijDzierzawe,
} from '@/lib/skrzynka/dane'
```


3. Zamień:

```ts
    expect([...baza.keys()]).toEqual(['skrzynka/ustawienia'])
  })
})
```

   na:

```ts
    expect([...baza.keys()]).toEqual(['skrzynka/ustawienia'])
  })
})

describe('obraz skrzynki dla asystenta', () => {
  const TERAZ = Date.UTC(2026, 9, 20, 8)
  const DZIEN = 86_400_000
  const L = { stan: 'polaczona' as const, doOdpowiedzi: 3, poTerminie: 2, doPrzejrzenia: 1, czekaNaNich: 0, wToku: 4, zalatwione: 9, pominiete: 1, ostatniaSynchronizacja: 1 }
  const kiedy = (k: number) => ({ ostatnia: { kiedy: k, kierunek: 'oni' as const, fragment: 'TAJNA TREŚĆ' } })

  it('niepołączona albo bez liczników - null', async () => {
    expect(await obrazSkrzynki(TERAZ, null)).toBeNull()
    expect(await obrazSkrzynki(TERAZ, { ...L, stan: 'rozlaczona' })).toBeNull()
  })

  it('liczby, po terminie od najdłużej czekającej, organizacje z ruchem w 7 dni - bez fragmentów i adresów', async () => {
    await zapiszWynik({
      sprawy: [
        sprawa('a', { temat: 'Sponsoring', organizacja: 'firma.pl', oczekujeOd: TERAZ - 10 * DZIEN, ...kiedy(TERAZ - 10 * DZIEN) }),
        sprawa('b', { temat: 'Sala', organizacja: null, kontakt: 'ola@gmail.com', oczekujeOd: TERAZ - 6 * DZIEN, ...kiedy(TERAZ - 6 * DZIEN) }),
        sprawa('c', { temat: 'Świeża', oczekujeOd: TERAZ - DZIEN, ...kiedy(TERAZ - DZIEN) }),
        sprawa('d', { status: 'w-toku', oczekujeOd: null, organizacja: 'ue.wroc.pl', ...kiedy(TERAZ - 2 * DZIEN) }),
        sprawa('e', { status: 'zalatwiona', oczekujeOd: null, organizacja: 'ue.wroc.pl', ...kiedy(TERAZ - 3 * DZIEN) }),
        sprawa('f', { status: 'zalatwiona', oczekujeOd: null, organizacja: 'stara.pl', ...kiedy(TERAZ - 30 * DZIEN) }),
      ],
      kontakty: [],
      organizacje: [{ domena: 'ue.wroc.pl', nazwa: 'Uniwersytet Ekonomiczny', typ: 'uczelnia' }],
    })
    const o = await obrazSkrzynki(TERAZ, L)
    expect(o).toEqual({
      liczby: { doOdpowiedzi: 3, poTerminie: 2, doPrzejrzenia: 1, czekaNaNich: 0, wToku: 4 },
      poTerminie: [
        { temat: 'Sponsoring', organizacja: 'firma.pl', dniCzekania: 10 },
        { temat: 'Sala', organizacja: null, dniCzekania: 6 },
      ],
      aktywneOrganizacje: [
        { nazwa: 'Uniwersytet Ekonomiczny', domena: 'ue.wroc.pl', sprawy: 2 },
        { nazwa: 'firma.pl', domena: 'firma.pl', sprawy: 1 },
      ],
    })
    expect(JSON.stringify(o)).not.toMatch(/TAJNA|@/)
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/dane.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak `obrazSkrzynki`).

- [ ] **Krok 3: Implementacja**

`lib/skrzynka/typy.ts` - 1 zmiana:


1. Zamień:

```ts
  kontakty: Kontakt[]
  sprawy: Sprawa[]
}
```

   na:

```ts
  kontakty: Kontakt[]
  sprawy: Sprawa[]
}

/**
 * Skrzynka w obrazie projektu dla asystenta - same liczby, tematy i domeny.
 * Bez treści, fragmentów i adresów osób (spec §9).
 */
export interface ObrazSkrzynki {
  liczby: { doOdpowiedzi: number; poTerminie: number; doPrzejrzenia: number; czekaNaNich: number; wToku: number }
  poTerminie: { temat: string; organizacja: string | null; dniCzekania: number }[]
  aktywneOrganizacje: { nazwa: string; domena: string; sprawy: number }[]
}
```

`lib/skrzynka/dane.ts` - 2 zmiany:


1. Zamień:

```ts
import { progAlarmu } from './statusy'
import {
  STATUSY, TYPY_ORGANIZACJI, type KartaKontaktu, type KartaOrganizacji, type Kontakt, type LicznikiSkrzynki, type Organizacja,
  type PostepImportu, type Sprawa, type Status, type StronaKontaktow, type StronaSpraw, type TypOrganizacji, type UstawieniaSkrzynki,
} from './typy'

export const DZIERZAWA_MS = 60_000
```

   na:

```ts
import { progAlarmu } from './statusy'
import {
  STATUSY, TYPY_ORGANIZACJI, type KartaKontaktu, type KartaOrganizacji, type Kontakt, type LicznikiSkrzynki, type Organizacja,
  type ObrazSkrzynki, type PostepImportu, type Sprawa, type Status, type StronaKontaktow, type StronaSpraw, type TypOrganizacji,
  type UstawieniaSkrzynki,
} from './typy'

export const DZIERZAWA_MS = 60_000
```


2. Zamień:

```ts
    ostatniaSynchronizacja: stan.ostatniaSynchronizacja,
  }
}
```

   na:

```ts
    ostatniaSynchronizacja: stan.ostatniaSynchronizacja,
  }
}

const MAKS_PO_TERMINIE = 10
const MAKS_ORGANIZACJI = 10
/** Ruch z ostatnich 7 dni - wystarczy 100 najświeższych spraw, żeby wskazać aktywne organizacje. */
const OKNO_RUCHU_MS = 7 * 86_400_000
const MAKS_RUCHU = 100
const DZIEN_MS = 86_400_000

/**
 * Obraz skrzynki dla asystenta: liczby (te same co na kafelku), najdłużej
 * czekające sprawy po terminie i organizacje z ruchem w 7 dni. `null` -
 * skrzynka niepołączona albo liczniki zawiodły: sekcja jest wtedy pusta.
 */
export async function obrazSkrzynki(teraz: number, l: LicznikiSkrzynki | null): Promise<ObrazSkrzynki | null> {
  if (!l || l.stan !== 'polaczona') return null
  const s = sprawyRef()
  const [poTerminie, ruch] = await Promise.all([
    // Niezmiennik: `oczekujeOd` mają tylko sprawy Do odpowiedzi.
    s.where('oczekujeOd', '<', progAlarmu(teraz)).orderBy('oczekujeOd').limit(MAKS_PO_TERMINIE).get(),
    s.where('ostatnia.kiedy', '>=', teraz - OKNO_RUCHU_MS).orderBy('ostatnia.kiedy', 'desc').limit(MAKS_RUCHU).get(),
  ])
  const ile = new Map<string, number>()
  for (const d of ruch.docs) {
    const o = d.get('organizacja')
    if (typeof o === 'string') ile.set(o, (ile.get(o) ?? 0) + 1)
  }
  const domeny = [...ile].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, MAKS_ORGANIZACJI).map(([d]) => d)
  const org = organizacjeRef()
  const nazwy = domeny.length ? await s.firestore.getAll(...domeny.map((d) => org.doc(d))) : []
  return {
    liczby: { doOdpowiedzi: l.doOdpowiedzi, poTerminie: l.poTerminie, doPrzejrzenia: l.doPrzejrzenia, czekaNaNich: l.czekaNaNich, wToku: l.wToku },
    poTerminie: poTerminie.docs.map((d) => {
      const x = naSprawe(d.id, d.data())
      return { temat: x.temat, organizacja: x.organizacja, dniCzekania: Math.floor((teraz - (x.oczekujeOd ?? teraz)) / DZIEN_MS) }
    }),
    aktywneOrganizacje: domeny.map((d, i) => ({ nazwa: String(nazwy[i]?.data()?.nazwa ?? '') || d, domena: d, sprawy: ile.get(d) ?? 0 })),
  }
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/skrzynka/dane.test.ts lib/skrzynka/dane.ts lib/skrzynka/typy.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): obraz skrzynki dla asystenta bez tresci maili

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 2: Skrzynka w obrazie projektu i obszar odprawy

**Pliki:** zmiana `lib/asystent/kontekst.ts`, `lib/asystent/dane.ts`, `lib/asystent/odprawa.ts`, `lib/asystent/czat.ts`, `components/deck/PanelOdprawy.tsx`, `app/page.tsx`, `app/api/asystent/czat/route.ts`, `app/api/asystent/odprawa/route.ts` i ich testy

**Interfejsy:**
- Korzysta z: `obrazSkrzynki`, `ObrazSkrzynki` (zadanie 1), `liczniki` (część 1).
- Daje: `DaneProjektu.skrzynka`, `daneProjektu(..., strony, skrzynka)`, `pobierzObrazSkrzynki(teraz, l?): Promise<ObrazSkrzynki | null>` (nigdy nie rzuca), `odswiezOdpraweWTle({ ..., skrzynka })`; obszar odprawy `'skrzynka'` → `/skrzynka`, etykieta „Skrzynka”.

- [ ] **Krok 1: Testy**

`lib/asystent/kontekst.test.ts` - 2 zmiany:


1. Zamień:

```ts
  return {
    rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [],
    semestr: { id: '2026Z', nazwa: 'Zimowy 2026/2027' },
    wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, notatki: [], strony: [],
    ...nadpisz,
  }
}
```

   na:

```ts
  return {
    rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [],
    semestr: { id: '2026Z', nazwa: 'Zimowy 2026/2027' },
    wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, notatki: [], strony: [], skrzynka: null,
    ...nadpisz,
  }
}
```


2. Zamień:

```ts
    expect(k.kpi[0]).toMatchObject({ nazwa: 'Listopad', wartosc: 30, rokDoRoku: 0.6, kierunek: 'spadek' })
  })

  it('notatki trafiają do obrazu jako pewne ustalenia', () => {
    const k = zbudujKontekst(dane({ notatki: ['Zebrania zarządu w środy'] }), DZIS)
    expect(k.notatki).toEqual(['Zebrania zarządu w środy'])
```

   na:

```ts
    expect(k.kpi[0]).toMatchObject({ nazwa: 'Listopad', wartosc: 30, rokDoRoku: 0.6, kierunek: 'spadek' })
  })

  it('skrzynka: obraz bez zmian; niepołączona - null', () => {
    const skrzynka = {
      liczby: { doOdpowiedzi: 3, poTerminie: 1, doPrzejrzenia: 0, czekaNaNich: 2, wToku: 1 },
      poTerminie: [{ temat: 'Sponsoring', organizacja: 'firma.pl', dniCzekania: 6 }],
      aktywneOrganizacje: [{ nazwa: 'Uniwersytet Ekonomiczny', domena: 'ue.wroc.pl', sprawy: 2 }],
    }
    expect(zbudujKontekst(dane({ skrzynka }), DZIS).skrzynka).toEqual(skrzynka)
    expect(zbudujKontekst(dane(), DZIS).skrzynka).toBeNull()
  })

  it('notatki trafiają do obrazu jako pewne ustalenia', () => {
    const k = zbudujKontekst(dane({ notatki: ['Zebrania zarządu w środy'] }), DZIS)
    expect(k.notatki).toEqual(['Zebrania zarządu w środy'])
```

`lib/asystent/dane.test.ts` - 2 zmiany:


1. Zamień:

```ts
vi.mock('@/lib/firebase/admin', () => ({
  odprawaRef: vi.fn(), propozycjeRef: vi.fn(), semestrRef: vi.fn(), wydarzeniaRef: vi.fn(), ustawieniaRef: vi.fn(),
}))

import { daneProjektu } from '@/lib/asystent/dane'

describe('daneProjektu', () => {
  it('do obrazu idą tylko strony, które odpowiedziały', () => {
```

   na:

```ts
vi.mock('@/lib/firebase/admin', () => ({
  odprawaRef: vi.fn(), propozycjeRef: vi.fn(), semestrRef: vi.fn(), wydarzeniaRef: vi.fn(), ustawieniaRef: vi.fn(),
}))
const skrzynka = vi.hoisted(() => ({ liczniki: vi.fn(), obrazSkrzynki: vi.fn() }))
vi.mock('@/lib/skrzynka/dane', () => skrzynka)

import { daneProjektu, pobierzObrazSkrzynki } from '@/lib/asystent/dane'

describe('daneProjektu', () => {
  it('do obrazu idą tylko strony, które odpowiedziały', () => {
```


2. Zamień:

```ts
      { id: '2026Z', nazwa: 'Z' },
      [],
      [{ ok: true, dane: strona }, { ok: false, witryna: 'x', nazwa: 'x', blad: 'inny', komunikat: '' }],
    )
    expect(d.strony).toEqual([strona])
  })
})
```

   na:

```ts
      { id: '2026Z', nazwa: 'Z' },
      [],
      [{ ok: true, dane: strona }, { ok: false, witryna: 'x', nazwa: 'x', blad: 'inny', komunikat: '' }],
      null,
    )
    expect(d.strony).toEqual([strona])
    expect(d.skrzynka).toBeNull()
  })
})

describe('pobierzObrazSkrzynki', () => {
  const OBRAZ = { liczby: { doOdpowiedzi: 1, poTerminie: 0, doPrzejrzenia: 0, czekaNaNich: 0, wToku: 0 }, poTerminie: [], aktywneOrganizacje: [] }

  it('liczniki z kokpitu albo pobrane na miejscu', async () => {
    skrzynka.obrazSkrzynki.mockResolvedValue(OBRAZ)
    const l = { stan: 'polaczona' }
    expect(await pobierzObrazSkrzynki(5, Promise.resolve(l as never))).toEqual(OBRAZ)
    expect(skrzynka.obrazSkrzynki).toHaveBeenLastCalledWith(5, l)
    expect(skrzynka.liczniki).not.toHaveBeenCalled()
    skrzynka.liczniki.mockResolvedValue(l)
    await pobierzObrazSkrzynki(6)
    expect(skrzynka.liczniki).toHaveBeenCalledWith(6)
  })

  it('błąd skrzynki nie wywraca odprawy ani czatu - pusta sekcja', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    skrzynka.liczniki.mockRejectedValueOnce(new Error('firestore'))
    expect(await pobierzObrazSkrzynki(7)).toBeNull()
  })
})
```

`lib/asystent/odprawa.test.ts` - 1 zmiana:


1. Zamień:

```ts
    expect(ODNOSNIK_OBSZARU.retencja).toBe('/analytics/retencja')
    expect(ODNOSNIK_OBSZARU.planer).toBe('/planer')
    expect(ODNOSNIK_OBSZARU.strony).toBe('/strony')
  })

  it('wiadomość niesie dane jako JSON, instrukcja zakazuje długich myślników', () => {
```

   na:

```ts
    expect(ODNOSNIK_OBSZARU.retencja).toBe('/analytics/retencja')
    expect(ODNOSNIK_OBSZARU.planer).toBe('/planer')
    expect(ODNOSNIK_OBSZARU.strony).toBe('/strony')
    expect(ODNOSNIK_OBSZARU.skrzynka).toBe('/skrzynka')
  })

  it('zagrożenie w obszarze skrzynki przechodzi sprawdzenie', () => {
    const z = { obszar: 'skrzynka', waga: 'wysoka', tytul: 'Sprawy po terminie', uzasadnienie: '3 sprawy czekają ponad 3 dni robocze.' }
    expect(sprawdzOdprawe({ podsumowanie: 'x', zagrozenia: [z], dzis: [] })?.zagrozenia).toEqual([z])
  })

  it('wiadomość niesie dane jako JSON, instrukcja zakazuje długich myślników', () => {
```

`app/api/asystent/czat/route.test.ts` - 2 zmiany:


1. Zamień:

```ts
vi.mock('@/lib/asystent/dane', () => ({
  pobierzArkusz: async () => ({ rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [], czasMs: 1 }),
  pobierzPlaner: async () => ({ wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, ok: true }),
  daneProjektu: (_a: object, _p: object, _s: object, notatki: string[]) => ({ notatki }),
  zbudujKontekst: (d: { notatki: string[] }) => ({ meta: { data: '02.10.2026', dzienTygodnia: 'piątek' }, notatki: d.notatki }),
  czytajOdprawe: async () => ({ odprawa: { podsumowanie: 'Retencja słabnie.', zagrozenia: [], dzis: [] } }),
}))
vi.mock('@/lib/asystent/pamiecDane', () => ({
```

   na:

```ts
vi.mock('@/lib/asystent/dane', () => ({
  pobierzArkusz: async () => ({ rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [], czasMs: 1 }),
  pobierzPlaner: async () => ({ wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, ok: true }),
  daneProjektu: (_a: object, _p: object, _s: object, notatki: string[], _st: object, skrzynka: object) => ({ notatki, skrzynka }),
  zbudujKontekst: (d: { notatki: string[]; skrzynka: object }) => ({
    meta: { data: '02.10.2026', dzienTygodnia: 'piątek' }, notatki: d.notatki, skrzynka: d.skrzynka,
  }),
  pobierzObrazSkrzynki: async () => ({ liczby: { doOdpowiedzi: 7 }, poTerminie: [{ temat: 'Sponsoring', organizacja: 'firma.pl', dniCzekania: 5 }], aktywneOrganizacje: [] }),
  czytajOdprawe: async () => ({ odprawa: { podsumowanie: 'Retencja słabnie.', zagrozenia: [], dzis: [] } }),
}))
vi.mock('@/lib/asystent/pamiecDane', () => ({
```


2. Zamień:

```ts
    expect(schemat).toBeDefined()
    expect(wiadomosci[0].tekst).toContain('Zebrania w środy')
    expect(wiadomosci[0].tekst).toContain('Retencja słabnie.')
  })

  it('kolejne pytanie dopisuje się do istniejącego wątku', async () => {
```

   na:

```ts
    expect(schemat).toBeDefined()
    expect(wiadomosci[0].tekst).toContain('Zebrania w środy')
    expect(wiadomosci[0].tekst).toContain('Retencja słabnie.')
    expect(wiadomosci[0].tekst).toContain('"dniCzekania":5')
  })

  it('kolejne pytanie dopisuje się do istniejącego wątku', async () => {
```

`app/api/asystent/odprawa/route.test.ts` - 2 zmiany:


1. Zamień:

```ts
vi.mock('@/lib/asystent/dane', () => ({
  pobierzArkusz: async () => ({ rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [], czasMs: 1 }),
  pobierzPlaner: async () => ({ wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, ok: true }),
  daneProjektu: (a: object, p: object) => ({ ...a, ...p, semestr: { id: '2026Z', nazwa: 'Z' } }),
  zbudujKontekst: () => ({ meta: { data: '02.10.2026', dzienTygodnia: 'piątek' } }),
  generujOdprawe: (...a: unknown[]) => generujOdprawe(...a),
}))
```

   na:

```ts
vi.mock('@/lib/asystent/dane', () => ({
  pobierzArkusz: async () => ({ rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [], czasMs: 1 }),
  pobierzPlaner: async () => ({ wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, ok: true }),
  daneProjektu: (a: object, p: object, _s: object, _n: object, _st: object, skrzynka: object) => ({ ...a, ...p, skrzynka, semestr: { id: '2026Z', nazwa: 'Z' } }),
  zbudujKontekst: (d: { skrzynka: object }) => ({ meta: { data: '02.10.2026', dzienTygodnia: 'piątek' }, skrzynka: d.skrzynka }),
  pobierzObrazSkrzynki: async () => ({ liczby: { doOdpowiedzi: 2 }, poTerminie: [], aktywneOrganizacje: [] }),
  generujOdprawe: (...a: unknown[]) => generujOdprawe(...a),
}))
```


2. Zamień:

```ts
    const res = await POST(zada)
    expect(res.status).toBe(200)
    expect((await res.json()).slad).toBe('s')
  })

  it('limit Gemini to 429 z ludzkim komunikatem', async () => {
```

   na:

```ts
    const res = await POST(zada)
    expect(res.status).toBe(200)
    expect((await res.json()).slad).toBe('s')
    expect(generujOdprawe.mock.calls[0][0].skrzynka).toEqual({ liczby: { doOdpowiedzi: 2 }, poTerminie: [], aktywneOrganizacje: [] })
  })

  it('limit Gemini to 429 z ludzkim komunikatem', async () => {
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/asystent app/api/asystent > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak sekcji `skrzynka`, `pobierzObrazSkrzynki` i obszaru).

- [ ] **Krok 3: Implementacja**

`lib/asystent/kontekst.ts` - 3 zmiany:


1. Zamień:

```ts
import { KATEGORIE, type Miesiac, type Wydarzenie } from '@/lib/planer/typy'
import type { StanSesjiWspolnej } from '@/lib/planer/stan'
import type { StatystykiStrony } from '@/lib/strony/model'
import type { Czlonek, Kohorta, KpiMetric, Projekt, Rekrutacja } from '@/types'

/** Surowe dane całego projektu - to, co serwer i tak umie pobrać. */
```

   na:

```ts
import { KATEGORIE, type Miesiac, type Wydarzenie } from '@/lib/planer/typy'
import type { StanSesjiWspolnej } from '@/lib/planer/stan'
import type { StatystykiStrony } from '@/lib/strony/model'
import type { ObrazSkrzynki } from '@/lib/skrzynka/typy'
import type { Czlonek, Kohorta, KpiMetric, Projekt, Rekrutacja } from '@/types'

/** Surowe dane całego projektu - to, co serwer i tak umie pobrać. */
```


2. Zamień:

```ts
  notatki: string[]
  /** Strony z Search Console, które odpowiedziały - błędne pomijamy, asystent nie zgaduje. */
  strony: StatystykiStrony[]
}

/** Ile dni Planera widzi asystent. */
```

   na:

```ts
  notatki: string[]
  /** Strony z Search Console, które odpowiedziały - błędne pomijamy, asystent nie zgaduje. */
  strony: StatystykiStrony[]
  /** Skrzynka kontakt@ bez treści maili; `null` - niepołączona albo zawiodła. */
  skrzynka: ObrazSkrzynki | null
}

/** Ile dni Planera widzi asystent. */
```


3. Zamień:

```ts
      alertSpadku: s.alert,
      topZapytania: s.zapytania.slice(0, 3).map((z) => z.tekst),
    })),
    notatki: d.notatki,
  }
}
```

   na:

```ts
      alertSpadku: s.alert,
      topZapytania: s.zapytania.slice(0, 3).map((z) => z.tekst),
    })),
    skrzynka: d.skrzynka,
    notatki: d.notatki,
  }
}
```

`lib/asystent/dane.ts` - 3 zmiany:


1. Zamień:

```ts
import type { Czlonek, Kohorta, KpiMetric, Projekt, Rekrutacja } from '@/types'
import type { Rola } from '@/lib/auth/role'
import type { WynikStrony } from '@/lib/strony/model'
import { zbudujKontekst, type DaneProjektu, type KontekstProjektu } from './kontekst'
import { INSTRUKCJA_ODPRAWY, SCHEMAT_ODPRAWY, sprawdzOdprawe, wiadomoscOdprawy, type ZapisanaOdprawa } from './odprawa'
import { BladAsystenta, zapytajGemini } from './gemini'
```

   na:

```ts
import type { Czlonek, Kohorta, KpiMetric, Projekt, Rekrutacja } from '@/types'
import type { Rola } from '@/lib/auth/role'
import type { WynikStrony } from '@/lib/strony/model'
import { liczniki, obrazSkrzynki } from '@/lib/skrzynka/dane'
import type { LicznikiSkrzynki, ObrazSkrzynki } from '@/lib/skrzynka/typy'
import { zbudujKontekst, type DaneProjektu, type KontekstProjektu } from './kontekst'
import { INSTRUKCJA_ODPRAWY, SCHEMAT_ODPRAWY, sprawdzOdprawe, wiadomoscOdprawy, type ZapisanaOdprawa } from './odprawa'
import { BladAsystenta, zapytajGemini } from './gemini'
```


2. Zamień:

```ts
  semestr: { id: string; nazwa: string },
  notatki: string[],
  strony: WynikStrony[],
): DaneProjektu {
  return {
    rekrutacje: a.rekrutacje, kohorty: a.kohorty, punkty: a.punkty, projekty: a.projekty, czlonkowie: a.czlonkowie,
    semestr, wydarzenia: p.wydarzenia, sesja: p.sesja, sklad: p.sklad, propozycje: p.propozycje, notatki,
    strony: strony.flatMap((w) => (w.ok ? [w.dane] : [])),
  }
}

export async function czytajOdprawe(): Promise<ZapisanaOdprawa | null> {
  const d = (await odprawaRef().get()).data()
  if (!d) return null
```

   na:

```ts
  semestr: { id: string; nazwa: string },
  notatki: string[],
  strony: WynikStrony[],
  skrzynka: ObrazSkrzynki | null,
): DaneProjektu {
  return {
    rekrutacje: a.rekrutacje, kohorty: a.kohorty, punkty: a.punkty, projekty: a.projekty, czlonkowie: a.czlonkowie,
    semestr, wydarzenia: p.wydarzenia, sesja: p.sesja, sklad: p.sklad, propozycje: p.propozycje, notatki,
    strony: strony.flatMap((w) => (w.ok ? [w.dane] : [])),
    skrzynka,
  }
}

/**
 * Skrzynka do obrazu projektu - nigdy nie rzuca: bez połączenia albo przy
 * błędzie sekcja jest pusta, a odprawa i czat działają dalej. Kokpit podaje
 * liczniki, które i tak pobrał dla kafelka.
 */
export function pobierzObrazSkrzynki(teraz: number, l?: Promise<LicznikiSkrzynki | null>): Promise<ObrazSkrzynki | null> {
  return (l ?? liczniki(teraz))
    .then((x) => obrazSkrzynki(teraz, x))
    .catch((e) => {
      console.error('[asystent] skrzynka:', e)
      return null
    })
}

export async function czytajOdprawe(): Promise<ZapisanaOdprawa | null> {
  const d = (await odprawaRef().get()).data()
  if (!d) return null
```


3. Zamień:

```ts
  zapisana: Promise<ZapisanaOdprawa | null>
  notatki: Promise<string[]>
  strony: Promise<WynikStrony[]>
  semestr: { id: string; nazwa: string }
  teraz: Date
}): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return
  try {
    const [a, p, zapisana, notatki, strony] = await Promise.all([w.arkusz, w.planer, w.zapisana, w.notatki, w.strony])
    // Odprawa z pustego arkusza albo bez Planera byłaby o niczym - poczekamy.
    if (a.czasMs === null || !p.ok) return
    const k = zbudujKontekst(daneProjektu(a, p, w.semestr, notatki, strony), dzisWarszawa(w.teraz))
    if (!czyOdswiezyc(zapisana, sladKontekstu(k), k.meta.data, w.teraz.getTime())) return
    await generujOdprawe(k, w.teraz.getTime())
  } catch (e) {
```

   na:

```ts
  zapisana: Promise<ZapisanaOdprawa | null>
  notatki: Promise<string[]>
  strony: Promise<WynikStrony[]>
  skrzynka: Promise<ObrazSkrzynki | null>
  semestr: { id: string; nazwa: string }
  teraz: Date
}): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return
  try {
    const [a, p, zapisana, notatki, strony, skrzynka] = await Promise.all([w.arkusz, w.planer, w.zapisana, w.notatki, w.strony, w.skrzynka])
    // Odprawa z pustego arkusza albo bez Planera byłaby o niczym - poczekamy.
    if (a.czasMs === null || !p.ok) return
    const k = zbudujKontekst(daneProjektu(a, p, w.semestr, notatki, strony, skrzynka), dzisWarszawa(w.teraz))
    if (!czyOdswiezyc(zapisana, sladKontekstu(k), k.meta.data, w.teraz.getTime())) return
    await generujOdprawe(k, w.teraz.getTime())
  } catch (e) {
```

`lib/asystent/odprawa.ts` - 2 zmiany:


1. Zamień:

```ts
import type { KontekstProjektu } from './kontekst'

export const OBSZARY = ['kpi', 'rekrutacja', 'retencja', 'projekty', 'planer', 'zespol', 'strony'] as const
export const WAGI = ['wysoka', 'srednia', 'niska'] as const
export type Obszar = (typeof OBSZARY)[number]
export type Waga = (typeof WAGI)[number]
```

   na:

```ts
import type { KontekstProjektu } from './kontekst'

export const OBSZARY = ['kpi', 'rekrutacja', 'retencja', 'projekty', 'planer', 'zespol', 'strony', 'skrzynka'] as const
export const WAGI = ['wysoka', 'srednia', 'niska'] as const
export type Obszar = (typeof OBSZARY)[number]
export type Waga = (typeof WAGI)[number]
```


2. Zamień:

```ts
  planer: '/planer',
  zespol: '/analytics/czlonkowie',
  strony: '/strony',
}

export const INSTRUKCJA_ODPRAWY = `Jesteś D.E.C.K. (Diagnostic Evaluation of Change & KPIs) - asystentem analitycznym Wiceprzewodniczącego ds. Strategii i Działań Operacyjnych Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu.
Dostajesz obraz projektu w JSON: KPI, rekrutacje, retencję kohort, alerty, kondycję projektów, Planer najbliższych 21 dni (wydarzenia, kolizje, Sesja Operacyjna, propozycje), członków i ruch z Google na stronach (Search Console, 28 dni do 3 dni temu).
Przygotuj odprawę:
- podsumowanie: 2-4 zdania, co z danych wynika teraz;
- zagrozenia: do 5 obszarów wzbudzających niepokój, od najpoważniejszego, każde z uzasadnieniem opartym na konkretnych liczbach z danych;
```

   na:

```ts
  planer: '/planer',
  zespol: '/analytics/czlonkowie',
  strony: '/strony',
  skrzynka: '/skrzynka',
}

export const INSTRUKCJA_ODPRAWY = `Jesteś D.E.C.K. (Diagnostic Evaluation of Change & KPIs) - asystentem analitycznym Wiceprzewodniczącego ds. Strategii i Działań Operacyjnych Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu.
Dostajesz obraz projektu w JSON: KPI, rekrutacje, retencję kohort, alerty, kondycję projektów, Planer najbliższych 21 dni (wydarzenia, kolizje, Sesja Operacyjna, propozycje), członków, ruch z Google na stronach (Search Console, 28 dni do 3 dni temu) i skrzynkę kontakt@ (liczby spraw, sprawy po terminie z dniami czekania, organizacje z ruchem w 7 dni; bez treści maili; null - skrzynka niepołączona).
Przygotuj odprawę:
- podsumowanie: 2-4 zdania, co z danych wynika teraz;
- zagrozenia: do 5 obszarów wzbudzających niepokój, od najpoważniejszego, każde z uzasadnieniem opartym na konkretnych liczbach z danych;
```

`lib/asystent/czat.ts` - 1 zmiana:


1. Zamień:

```ts
export const LIMIT_ZNAKOW = 4000

export const INSTRUKCJA_CZATU = `Jesteś D.E.C.K. (Diagnostic Evaluation of Change & KPIs) - asystentem analitycznym Wiceprzewodniczącego ds. Strategii i Działań Operacyjnych Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu.
Pierwsza wiadomość zawiera obraz projektu w JSON: KPI, rekrutacje, retencję kohort, alerty, kondycję projektów, Planer najbliższych 21 dni, członków, ruch z Google na stronach (Search Console), notatki i ostatnią odprawę.
Pole „notatki” to ustalenia zatwierdzone przez użytkownika - traktuj je jak pewne fakty.
Rozmawiasz z nim o tych danych: interpretujesz wskaźniki, porównujesz, wskazujesz ryzyka i proponujesz działania. Pomagasz też pisać teksty: ogłoszenia, maile, podsumowania.
Zasady: opieraj się na danych i podawaj liczby; gdy czegoś w danych nie ma, powiedz to wprost i nie zgaduj; odpowiadaj po polsku, zwięźle i konkretnie.
```

   na:

```ts
export const LIMIT_ZNAKOW = 4000

export const INSTRUKCJA_CZATU = `Jesteś D.E.C.K. (Diagnostic Evaluation of Change & KPIs) - asystentem analitycznym Wiceprzewodniczącego ds. Strategii i Działań Operacyjnych Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu.
Pierwsza wiadomość zawiera obraz projektu w JSON: KPI, rekrutacje, retencję kohort, alerty, kondycję projektów, Planer najbliższych 21 dni, członków, ruch z Google na stronach (Search Console), skrzynkę kontakt@ (liczby spraw, sprawy po terminie, aktywne organizacje - bez treści maili), notatki i ostatnią odprawę.
Pole „notatki” to ustalenia zatwierdzone przez użytkownika - traktuj je jak pewne fakty.
Rozmawiasz z nim o tych danych: interpretujesz wskaźniki, porównujesz, wskazujesz ryzyka i proponujesz działania. Pomagasz też pisać teksty: ogłoszenia, maile, podsumowania.
Zasady: opieraj się na danych i podawaj liczby; gdy czegoś w danych nie ma, powiedz to wprost i nie zgaduj; odpowiadaj po polsku, zwięźle i konkretnie.
```

`components/deck/PanelOdprawy.tsx` - 1 zmiana:


1. Zamień:

```tsx

const ETYKIETA_OBSZARU: Record<Obszar, string> = {
  kpi: 'KPI', rekrutacja: 'Rekrutacja', retencja: 'Retencja', projekty: 'Projekty', planer: 'Sesja Operacyjna', zespol: 'Zespół', strony: 'Strony',
}

const STYL_WAGI: Record<Waga, string> = {
```

   na:

```tsx

const ETYKIETA_OBSZARU: Record<Obszar, string> = {
  kpi: 'KPI', rekrutacja: 'Rekrutacja', retencja: 'Retencja', projekty: 'Projekty', planer: 'Sesja Operacyjna', zespol: 'Zespół', strony: 'Strony',
  skrzynka: 'Skrzynka',
}

const STYL_WAGI: Record<Waga, string> = {
```

`app/page.tsx` - 2 zmiany:


1. Zamień:

```tsx
  czytajOdprawe,
  odswiezOdpraweWTle,
  pobierzArkusz,
  pobierzPlaner,
  type DaneArkusza,
} from '@/lib/asystent/dane'
```

   na:

```tsx
  czytajOdprawe,
  odswiezOdpraweWTle,
  pobierzArkusz,
  pobierzObrazSkrzynki,
  pobierzPlaner,
  type DaneArkusza,
} from '@/lib/asystent/dane'
```


2. Zamień:

```tsx
    })
    after(() => odswiezOdpraweWTle({
      arkusz, planer, zapisana, notatki: tresciNotatek().catch(() => []), strony: wynikiStron.then((w) => w ?? []),
      semestr: { id: semestr.id, nazwa: semestr.nazwa }, teraz,
    }))
  }
```

   na:

```tsx
    })
    after(() => odswiezOdpraweWTle({
      arkusz, planer, zapisana, notatki: tresciNotatek().catch(() => []), strony: wynikiStron.then((w) => w ?? []),
      skrzynka: pobierzObrazSkrzynki(teraz.getTime(), skrzynka ?? undefined),
      semestr: { id: semestr.id, nazwa: semestr.nazwa }, teraz,
    }))
  }
```

`app/api/asystent/czat/route.ts` - 2 zmiany:


1. Zamień:

```ts
import { dzisWarszawa } from '@/lib/czas'
import { BladAsystenta, komunikatBledu, zapytajGemini } from '@/lib/asystent/gemini'
import { INSTRUKCJA_CZATU, rozmowaDlaGemini, sprawdzZapytanie } from '@/lib/asystent/czat'
import { czytajOdprawe, daneProjektu, pobierzArkusz, pobierzPlaner, zbudujKontekst } from '@/lib/asystent/dane'
import { czytajRozmowe, tresciNotatek, zapiszRozmowe } from '@/lib/asystent/pamiecDane'
import { dopiszPytanie, odczytajOdpowiedzCzatu, SCHEMAT_CZATU, tytulRozmowy } from '@/lib/asystent/pamiec'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
```

   na:

```ts
import { dzisWarszawa } from '@/lib/czas'
import { BladAsystenta, komunikatBledu, zapytajGemini } from '@/lib/asystent/gemini'
import { INSTRUKCJA_CZATU, rozmowaDlaGemini, sprawdzZapytanie } from '@/lib/asystent/czat'
import { czytajOdprawe, daneProjektu, pobierzArkusz, pobierzObrazSkrzynki, pobierzPlaner, zbudujKontekst } from '@/lib/asystent/dane'
import { czytajRozmowe, tresciNotatek, zapiszRozmowe } from '@/lib/asystent/pamiecDane'
import { dopiszPytanie, odczytajOdpowiedzCzatu, SCHEMAT_CZATU, tytulRozmowy } from '@/lib/asystent/pamiec'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
```


2. Zamień:

```ts

  const semestr = biezacySemestr(new Date(teraz))
  try {
    const [a, p, notatki, zapisana, strony] = await Promise.all([
      pobierzArkusz(),
      pobierzPlaner(semestr.id, kto.rola),
      tresciNotatek().catch(() => []),
      czytajOdprawe().catch(() => null),
      statystykiStron().catch(() => []),
    ])
    const k = zbudujKontekst(daneProjektu(a, p, { id: semestr.id, nazwa: semestr.nazwa }, notatki, strony), dzisWarszawa(new Date(teraz)))
    const { tekst } = await zapytajGemini({
      instrukcja: INSTRUKCJA_CZATU,
      wiadomosci: rozmowaDlaGemini(k, wiadomosci, zapisana?.odprawa ?? null),
```

   na:

```ts

  const semestr = biezacySemestr(new Date(teraz))
  try {
    const [a, p, notatki, zapisana, strony, skrzynka] = await Promise.all([
      pobierzArkusz(),
      pobierzPlaner(semestr.id, kto.rola),
      tresciNotatek().catch(() => []),
      czytajOdprawe().catch(() => null),
      statystykiStron().catch(() => []),
      pobierzObrazSkrzynki(teraz),
    ])
    const k = zbudujKontekst(
      daneProjektu(a, p, { id: semestr.id, nazwa: semestr.nazwa }, notatki, strony, skrzynka),
      dzisWarszawa(new Date(teraz)),
    )
    const { tekst } = await zapytajGemini({
      instrukcja: INSTRUKCJA_CZATU,
      wiadomosci: rozmowaDlaGemini(k, wiadomosci, zapisana?.odprawa ?? null),
```

`app/api/asystent/odprawa/route.ts` - 2 zmiany:


1. Zamień:

```ts
import { biezacySemestr } from '@/lib/planer/semestry'
import { dzisWarszawa } from '@/lib/czas'
import { komunikatBledu } from '@/lib/asystent/gemini'
import { daneProjektu, generujOdprawe, pobierzArkusz, pobierzPlaner, zbudujKontekst } from '@/lib/asystent/dane'
import { tresciNotatek } from '@/lib/asystent/pamiecDane'
import { statystykiStron } from '@/lib/strony/dane'
```

   na:

```ts
import { biezacySemestr } from '@/lib/planer/semestry'
import { dzisWarszawa } from '@/lib/czas'
import { komunikatBledu } from '@/lib/asystent/gemini'
import { daneProjektu, generujOdprawe, pobierzArkusz, pobierzObrazSkrzynki, pobierzPlaner, zbudujKontekst } from '@/lib/asystent/dane'
import { tresciNotatek } from '@/lib/asystent/pamiecDane'
import { statystykiStron } from '@/lib/strony/dane'
```


2. Zamień:

```ts
  const teraz = new Date()
  const semestr = biezacySemestr(teraz)
  try {
    const [a, p, notatki, strony] = await Promise.all([
      pobierzArkusz(), pobierzPlaner(semestr.id, kto.rola), tresciNotatek().catch(() => []), statystykiStron().catch(() => []),
    ])
    const k = zbudujKontekst(daneProjektu(a, p, { id: semestr.id, nazwa: semestr.nazwa }, notatki, strony), dzisWarszawa(teraz))
    return NextResponse.json(await generujOdprawe(k, teraz.getTime()))
  } catch (e) {
    const { status, error } = komunikatBledu(e)
```

   na:

```ts
  const teraz = new Date()
  const semestr = biezacySemestr(teraz)
  try {
    const [a, p, notatki, strony, skrzynka] = await Promise.all([
      pobierzArkusz(), pobierzPlaner(semestr.id, kto.rola), tresciNotatek().catch(() => []), statystykiStron().catch(() => []),
      pobierzObrazSkrzynki(teraz.getTime()),
    ])
    const k = zbudujKontekst(daneProjektu(a, p, { id: semestr.id, nazwa: semestr.nazwa }, notatki, strony, skrzynka), dzisWarszawa(teraz))
    return NextResponse.json(await generujOdprawe(k, teraz.getTime()))
  } catch (e) {
    const { status, error } = komunikatBledu(e)
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/asystent app/api/asystent components/deck lib/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add app/api/asystent/czat/route.test.ts app/api/asystent/czat/route.ts app/api/asystent/odprawa/route.test.ts app/api/asystent/odprawa/route.ts app/page.tsx components/deck/PanelOdprawy.tsx lib/asystent/czat.ts lib/asystent/dane.test.ts lib/asystent/dane.ts lib/asystent/kontekst.test.ts lib/asystent/kontekst.ts lib/asystent/odprawa.test.ts lib/asystent/odprawa.ts
git commit -m "$(cat <<'EOF'
feat(asystent): skrzynka w obrazie projektu i obszar odprawy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 3: Wątek dla modelu i instrukcje

**Pliki:** nowe `lib/skrzynka/asystent.ts`, `lib/skrzynka/asystent.test.ts`

**Interfejsy:**
- Korzysta z: `WiadomoscPelna` (2a).
- Daje: `TRYBY`, `TrybAsystenta = 'strescz' | 'szkic'`, `MAKS_ZNAKOW_WATKU`, `LUKA = '[do uzupełnienia]'`, `INSTRUKCJE`, `sprawdzTryb(body)`, `htmlNaTekst(html)`, `tekstWatku(ws, nasz)`, `wiadomoscAsystenta(temat, watek, notatki)`.

- [ ] **Krok 1: Testy**

`lib/skrzynka/asystent.test.ts` (nowy plik):

```ts
import { describe, it, expect } from 'vitest'
import {
  INSTRUKCJE, LUKA, MAKS_ZNAKOW_WATKU, htmlNaTekst, sprawdzTryb, tekstWatku, wiadomoscAsystenta,
} from '@/lib/skrzynka/asystent'
import type { WiadomoscPelna } from '@/lib/skrzynka/typy'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'
const W = (n: Partial<WiadomoscPelna>): WiadomoscPelna => ({
  id: 'm', kiedy: Date.UTC(2026, 9, 1, 8), od: { email: 'anna@firma.pl', imie: 'Anna' }, do: [], temat: 'Sponsoring',
  tekst: null, html: null, zalaczniki: [], ...n,
})

describe('tekstWatku', () => {
  it('kto i kiedy, treść bez cytatów; HTML jako tekst, gdy nie ma tekstu; nasze wiadomości podpisane', () => {
    const t = tekstWatku([
      W({ tekst: 'Dzień dobry,\nproponujemy sponsoring.' }),
      W({ kiedy: Date.UTC(2026, 9, 2, 8), od: { email: NASZ, imie: '' }, tekst: 'Dziękujemy.\n\n> Dzień dobry,\n> proponujemy sponsoring.' }),
      W({ kiedy: Date.UTC(2026, 9, 3, 8), od: { email: 'jan@firma.pl', imie: '' }, html: '<p>Kwota&nbsp;to <b>5000 zł</b></p><script>x()</script>' }),
    ], NASZ)
    expect(t).toBe(
      '[1.10.2026, 10:00] Anna <anna@firma.pl>:\nDzień dobry,\nproponujemy sponsoring.\n\n---\n\n' +
        '[2.10.2026, 10:00] Samorząd (my):\nDziękujemy.\n\n---\n\n' +
        '[3.10.2026, 10:00] jan@firma.pl:\nKwota to 5000 zł',
    )
  })

  it('długi wątek przycięty od początku do 20 000 znaków - najnowsze zostają', () => {
    const t = tekstWatku([W({ tekst: 'a'.repeat(15_000) }), W({ tekst: `${'b'.repeat(14_999)}KONIEC` })], NASZ)
    expect(t.startsWith('(początek wątku pominięty)\n')).toBe(true)
    expect(t.length).toBe('(początek wątku pominięty)\n'.length + MAKS_ZNAKOW_WATKU)
    expect(t.endsWith('KONIEC')).toBe(true)
  })

  it('wiadomość bez treści', () => {
    expect(tekstWatku([W({ od: null })], NASZ)).toBe('[1.10.2026, 10:00] nieznany nadawca:\n(bez treści)')
  })
})

describe('htmlNaTekst', () => {
  it('akapity i podziały jako nowe linie, encje, bez stylów', () => {
    expect(htmlNaTekst('<style>p{}</style><div>A &amp; B</div><p>C<br>D</p>&lt;x&gt;')).toBe('A & B\nC\nD\n<x>')
  })
})

describe('instrukcje i wiadomość', () => {
  it('szkic bez stopki i z lukami zamiast obietnic; streszczenie w punktach; bez długich myślników', () => {
    expect(INSTRUKCJE.szkic).toContain('bez stopki')
    expect(INSTRUKCJE.szkic).toContain(LUKA)
    expect(INSTRUKCJE.strescz).toContain('3-6 punktach')
    expect(Object.values(INSTRUKCJE).join('')).not.toMatch(new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`))
  })

  it('temat, notatki i wątek w jednej wiadomości', () => {
    expect(wiadomoscAsystenta('Sponsoring', 'WĄTEK', ['Juwenalia 15-17 maja'])).toBe(
      'Temat: Sponsoring\n\nNotatki (pewne ustalenia):\n- Juwenalia 15-17 maja\n\nWątek (od najstarszej wiadomości):\nWĄTEK',
    )
    expect(wiadomoscAsystenta('', 'W', [])).toContain('Temat: (bez tematu)\n\nNotatki (pewne ustalenia):\n(brak)')
  })

  it('tryb tylko z listy', () => {
    expect(sprawdzTryb({ tryb: 'szkic' })).toBe('szkic')
    expect(sprawdzTryb({ tryb: 'wyslij' })).toBeNull()
    expect(sprawdzTryb(null)).toBeNull()
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run lib/skrzynka/asystent.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak modułu).

- [ ] **Krok 3: Implementacja**

`lib/skrzynka/asystent.ts` (nowy plik):

```ts
import type { WiadomoscPelna } from './typy'

export const TRYBY = ['strescz', 'szkic'] as const
export type TrybAsystenta = (typeof TRYBY)[number]

/** Spec §9: do Gemini najwyżej 20 000 znaków wątku, licząc od końca - najnowsze wiadomości są najważniejsze. */
export const MAKS_ZNAKOW_WATKU = 20_000
/** Miejsce, które szkic zostawia do wpisania - okno nie wyśle odpowiedzi, dopóki takie zostały. */
export const LUKA = '[do uzupełnienia]'

const WSPOLNE = `Jesteś D.E.C.K. - asystentem Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu.
Dostajesz jeden wątek ze skrzynki kontakt@samorzad.ue.wroc.pl i notatki - ustalenia zatwierdzone przez użytkownika, traktuj je jak pewne fakty.
Opieraj się wyłącznie na wątku i notatkach, nic nie zmyślaj. Pisz po polsku. Używaj zwykłego łącznika „-”, nigdy długich myślników.`

export const INSTRUKCJE: Record<TrybAsystenta, string> = {
  strescz: `${WSPOLNE}
Streść wątek w 3-6 punktach zaczynanych od „- ”: o co chodzi, kto pisze i w czyim imieniu, czego oczekują od Samorządu, co już ustalono, co jest otwarte i do kiedy. Bez wstępu i bez nagłówków.`,
  szkic: `${WSPOLNE}
Napisz szkic odpowiedzi Samorządu na ostatnią wiadomość drugiej strony: uprzejmie, rzeczowo, w tonie organizacji studenckiej, ze zwrotem grzecznościowym na początku.
Bez tematu, bez stopki i bez podpisu - stopkę dopisze wysyłka. Nie obiecuj terminów, kwot ani decyzji, których nie ma w wątku ani w notatkach - w takich miejscach wstaw ${LUKA}.
Zwróć sam tekst odpowiedzi.`,
}

export function sprawdzTryb(body: unknown): TrybAsystenta | null {
  const t = (body as { tryb?: unknown } | null)?.tryb
  return TRYBY.includes(t as TrybAsystenta) ? (t as TrybAsystenta) : null
}

/** HTML maila jako tekst - tylko dla wiadomości bez wersji tekstowej. */
export function htmlNaTekst(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Cytaty poprzednich wiadomości („> …”) dublowałyby wątek i zjadały limit. */
const bezCytatow = (t: string) =>
  t.split('\n').filter((l) => !l.trimStart().startsWith('>')).join('\n').trim()

const kiedy = (ms: number) =>
  new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' }).format(ms)

/** Wątek jako tekst dla modelu: kto i kiedy, potem treść; od najstarszej, przycięty od początku do limitu. */
export function tekstWatku(ws: WiadomoscPelna[], nasz: string): string {
  const n = nasz.toLowerCase()
  const calosc = ws
    .map((w) => {
      const kto = !w.od ? 'nieznany nadawca' : w.od.email === n ? 'Samorząd (my)' : w.od.imie ? `${w.od.imie} <${w.od.email}>` : w.od.email
      const tresc = bezCytatow(w.tekst ?? (w.html ? htmlNaTekst(w.html) : '')) || '(bez treści)'
      return `[${kiedy(w.kiedy)}] ${kto}:\n${tresc}`
    })
    .join('\n\n---\n\n')
  return calosc.length <= MAKS_ZNAKOW_WATKU ? calosc : `(początek wątku pominięty)\n${calosc.slice(-MAKS_ZNAKOW_WATKU)}`
}

export function wiadomoscAsystenta(temat: string, watek: string, notatki: string[]): string {
  const n = notatki.length ? notatki.map((x) => `- ${x}`).join('\n') : '(brak)'
  return `Temat: ${temat || '(bez tematu)'}\n\nNotatki (pewne ustalenia):\n${n}\n\nWątek (od najstarszej wiadomości):\n${watek}`
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run lib/skrzynka/asystent.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add lib/skrzynka/asystent.test.ts lib/skrzynka/asystent.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): watek jako tekst dla asystenta i instrukcje streszczenia i szkicu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 4: Trasa asystenta sprawy

**Pliki:** nowe `app/api/skrzynka/sprawy/[id]/asystent/route.ts`, `app/api/skrzynka/sprawy/asystent.test.ts`

**Interfejsy:**
- Korzysta z: zadania 3; `zapytajGemini`, `BladAsystenta`, `komunikatBledu` (asystent); `tresciNotatek`; `czytajSprawe`, `klientGmaila`, `zRozlaczeniem`, `nasz`, `odczytajWatekPelny`.
- Daje: `POST /api/skrzynka/sprawy/{id}/asystent` `{ tryb: 'strescz' | 'szkic' }` → `{ tekst }`; 400 zły tryb, 404 brak sprawy albo wątku, błędy Gemini z komunikatami asystenta, błędy Gmaila z komunikatami skrzynki.

- [ ] **Krok 1: Testy**

`app/api/skrzynka/sprawy/asystent.test.ts` (nowy plik):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as asystent } from '@/app/api/skrzynka/sprawy/[id]/asystent/route'
import { BladAsystenta } from '@/lib/asystent/gemini'
import { BladSkrzynki } from '@/lib/skrzynka/google'
import { INSTRUKCJE } from '@/lib/skrzynka/asystent'

const { ktoPyta, czytajSprawe, watekPelny, zapytajGemini } = vi.hoisted(() => ({
  ktoPyta: vi.fn(), czytajSprawe: vi.fn(), watekPelny: vi.fn(), zapytajGemini: vi.fn(),
}))
vi.mock('@/lib/auth/guard', () => ({ ktoPyta: (...a: unknown[]) => ktoPyta(...a) }))
vi.mock('@/lib/skrzynka/dane', () => ({ czytajSprawe: (...a: unknown[]) => czytajSprawe(...a) }))
vi.mock('@/lib/skrzynka/synchronizacja', () => ({
  klientGmaila: async () => ({ watekPelny: (...a: unknown[]) => watekPelny(...a) }),
  zRozlaczeniem: <T,>(f: () => Promise<T>) => f(),
  nasz: () => 'kontakt@samorzad.ue.wroc.pl',
}))
vi.mock('@/lib/asystent/pamiecDane', () => ({ tresciNotatek: async () => ['Juwenalia 15-17 maja'] }))
vi.mock('@/lib/asystent/gemini', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/asystent/gemini')>()),
  zapytajGemini: (...a: unknown[]) => zapytajGemini(...a),
}))

const BAZA = 'https://ssuew-analytics.vercel.app'
const zadanie = (body: unknown) =>
  ({ url: `${BAZA}/api/skrzynka/sprawy/t1/asystent`, nextUrl: new URL(`${BAZA}/api/skrzynka/sprawy/t1/asystent`), json: async () => body }) as never
const p = { params: Promise.resolve({ id: 't1' }) } as never
const utf = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const WATEK = {
  id: 't1',
  messages: [{
    id: 'm1', internalDate: String(Date.UTC(2026, 9, 1, 8)), labelIds: ['INBOX'],
    payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'Anna <anna@firma.pl>' }], body: { data: utf('Prosimy o ofertę na stoisko.') } },
  }],
}

beforeEach(() => {
  ktoPyta.mockReset().mockResolvedValue({ uid: 'u', email: 'kontakt@samorzad.ue.wroc.pl', rola: 'owner' })
  czytajSprawe.mockReset().mockResolvedValue({ id: 't1', temat: 'Stoisko na Juwenaliach' })
  watekPelny.mockReset().mockResolvedValue(WATEK)
  zapytajGemini.mockReset()
})

describe('asystent sprawy', () => {
  it('bez sesji 401, zarząd 403 - nic nie idzie do Gemini', async () => {
    ktoPyta.mockResolvedValue(null)
    expect((await asystent(zadanie({ tryb: 'szkic' }), p)).status).toBe(401)
    ktoPyta.mockResolvedValue({ uid: 'kod:1', email: 'Jula', rola: 'board' })
    expect((await asystent(zadanie({ tryb: 'szkic' }), p)).status).toBe(403)
    expect(zapytajGemini).not.toHaveBeenCalled()
  })

  it('szkic: instrukcja szkicu, temat, notatki i treść wątku; wynik bez spacji na brzegach', async () => {
    zapytajGemini.mockResolvedValue({ tekst: '  Dzień dobry,\nprzesyłamy ofertę [do uzupełnienia].\n', model: 'm' })
    const r = await asystent(zadanie({ tryb: 'szkic' }), p)
    expect(await r.json()).toEqual({ tekst: 'Dzień dobry,\nprzesyłamy ofertę [do uzupełnienia].' })
    const { instrukcja, wiadomosci, schemat } = zapytajGemini.mock.calls[0][0]
    expect(instrukcja).toBe(INSTRUKCJE.szkic)
    expect(schemat).toBeUndefined()
    expect(wiadomosci).toHaveLength(1)
    expect(wiadomosci[0].tekst).toContain('Temat: Stoisko na Juwenaliach')
    expect(wiadomosci[0].tekst).toContain('- Juwenalia 15-17 maja')
    expect(wiadomosci[0].tekst).toContain('Anna <anna@firma.pl>:\nProsimy o ofertę na stoisko.')
  })

  it('nieznany tryb 400; brak sprawy 404; wątek usunięty w Gmailu 404', async () => {
    expect((await asystent(zadanie({ tryb: 'wyslij' }), p)).status).toBe(400)
    czytajSprawe.mockResolvedValueOnce(null)
    expect((await asystent(zadanie({ tryb: 'strescz' }), p)).status).toBe(404)
    watekPelny.mockRejectedValueOnce(new BladSkrzynki('brak-watku', 'Gmail 404'))
    const r = await asystent(zadanie({ tryb: 'strescz' }), p)
    expect(r.status).toBe(404)
    expect((await r.json()).error).toBe('Tego wątku nie ma już w Gmailu.')
    expect(zapytajGemini).not.toHaveBeenCalled()
  })

  it('błędy Gemini z komunikatami asystenta; rozłączona skrzynka 409', async () => {
    zapytajGemini.mockRejectedValueOnce(new BladAsystenta('limit', 'x'))
    const r = await asystent(zadanie({ tryb: 'strescz' }), p)
    expect(r.status).toBe(429)
    expect((await r.json()).error).toMatch(/limit Gemini/)
    zapytajGemini.mockRejectedValueOnce(new BladAsystenta('brak-klucza', 'x'))
    expect((await asystent(zadanie({ tryb: 'strescz' }), p)).status).toBe(503)
    watekPelny.mockRejectedValueOnce(new BladSkrzynki('rozlaczona', '401'))
    expect((await asystent(zadanie({ tryb: 'strescz' }), p)).status).toBe(409)
  })
})
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run app/api/skrzynka/sprawy/asystent.test.ts > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak trasy).

- [ ] **Krok 3: Implementacja**

`app/api/skrzynka/sprawy/[id]/asystent/route.ts` (nowy plik):

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { BladAsystenta, komunikatBledu as komunikatAsystenta, zapytajGemini } from '@/lib/asystent/gemini'
import { tresciNotatek } from '@/lib/asystent/pamiecDane'
import { INSTRUKCJE, sprawdzTryb, tekstWatku, wiadomoscAsystenta } from '@/lib/skrzynka/asystent'
import { czytajSprawe } from '@/lib/skrzynka/dane'
import { BladSkrzynki, komunikatBledu } from '@/lib/skrzynka/google'
import { klientGmaila, nasz, zRozlaczeniem } from '@/lib/skrzynka/synchronizacja'
import { odczytajWatekPelny } from '@/lib/skrzynka/tresc'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

type Kontekst = { params: Promise<{ id: string }> }

/**
 * „Streść” albo „Szkic odpowiedzi”: treść jednego wątku i notatki idą do
 * Gemini tylko po kliknięciu (spec §2, decyzja B). Wynik wraca do okna -
 * nic się samo nie wysyła, a treść nie trafia do bazy ani do logów.
 */
export async function POST(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const { id } = await params
  const tryb = sprawdzTryb(await req.json().catch(() => null))
  if (!tryb) return NextResponse.json({ error: 'Nieznany tryb asystenta' }, { status: 400 })
  try {
    const s = await czytajSprawe(id)
    if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
    const [watek, notatki] = await Promise.all([
      zRozlaczeniem(async () => (await klientGmaila()).watekPelny(id)),
      tresciNotatek().catch(() => [] as string[]),
    ])
    const { tekst } = await zapytajGemini({
      instrukcja: INSTRUKCJE[tryb],
      wiadomosci: [{ rola: 'user', tekst: wiadomoscAsystenta(s.temat, tekstWatku(odczytajWatekPelny(watek), nasz()), notatki) }],
    })
    return NextResponse.json({ tekst: tekst.trim() })
  } catch (e) {
    if (e instanceof BladAsystenta) {
      const { status, error } = komunikatAsystenta(e)
      return NextResponse.json({ error }, { status })
    }
    if (e instanceof BladSkrzynki && e.rodzaj === 'brak-watku') {
      return NextResponse.json({ error: 'Tego wątku nie ma już w Gmailu.' }, { status: 404 })
    }
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run app/api/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add 'app/api/skrzynka/sprawy/[id]/asystent/route.ts' app/api/skrzynka/sprawy/asystent.test.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): trasa Stresc i Szkic odpowiedzi przez Gemini

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 5: Streść i Szkic odpowiedzi w panelu

**Pliki:** zmiana `lib/skrzynka/klient.ts`, `components/skrzynka/OknoOdpowiedzi.tsx`, `components/skrzynka/OknoOdpowiedzi.test.tsx`, `components/skrzynka/WidokSprawy.tsx`, `components/skrzynka/WidokSprawy.test.tsx`

**Interfejsy:**
- Korzysta z: trasy z zadania 4; `LUKA`, `TrybAsystenta` (zadanie 3); `TekstAsystenta` (`components/deck`).
- Daje: `klientSkrzynki.asystent(id, tryb): Promise<{ tekst }>`; przycisk „Streść” i sekcja „Streszczenie D.E.C.K.” w widoku sprawy; przycisk „Szkic odpowiedzi” w oknie; blokada „Wyślij”, dopóki w tekście jest `[do uzupełnienia]`.

- [ ] **Krok 1: Testy**

`components/skrzynka/OknoOdpowiedzi.test.tsx` - 3 zmiany:


1. Zamień:

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
```

   na:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OknoOdpowiedzi } from '@/components/skrzynka/OknoOdpowiedzi'
import { MAKS_ZALACZNIKOW } from '@/lib/skrzynka/typy'

const klient = { odpowiedz: vi.fn(), asystent: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: {
    odpowiedz: (...a: unknown[]) => klient.odpowiedz(...a),
    asystent: (...a: unknown[]) => klient.asystent(...a),
  },
}))

const plik = (nazwa: string, bajty: number) => new File([new Uint8Array(bajty)], nazwa, { type: 'application/pdf' })
```


2. Zamień:

```tsx
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }))
  })

beforeEach(() => klient.odpowiedz.mockReset())

describe('OknoOdpowiedzi', () => {
  it('adresat i podgląd stopki; pusta treść nie wysyła', () => {
```

   na:

```tsx
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }))
  })

beforeEach(() => Object.values(klient).forEach((f) => f.mockReset()))
afterEach(() => vi.restoreAllMocks())

describe('OknoOdpowiedzi', () => {
  it('adresat i podgląd stopki; pusta treść nie wysyła', () => {
```


3. Zamień:

```tsx
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled()
  })

  it('bez adresata - komunikat zamiast okna', () => {
    okno(null)
    expect(screen.getByText(/nie ma do kogo odpowiedzieć/)).toBeInTheDocument()
```

   na:

```tsx
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled()
  })

  it('szkic od D.E.C.K. trafia do okna; miejsca do uzupełnienia blokują wysyłkę, dopóki zostały', async () => {
    klient.asystent.mockResolvedValueOnce({ tekst: 'Dzień dobry,\nstoisko kosztuje [do uzupełnienia].' })
    okno()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Szkic odpowiedzi' }))
    })
    expect(klient.asystent).toHaveBeenCalledWith('t1', 'szkic')
    expect(screen.getByLabelText('Treść odpowiedzi')).toHaveValue('Dzień dobry,\nstoisko kosztuje [do uzupełnienia].')
    expect(screen.getByText(/Uzupełnij miejsca \[do uzupełnienia\]/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
    wpisz('Dzień dobry,\nstoisko kosztuje 500 zł.')
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled()
  })

  it('szkic zastępuje wpisany tekst tylko po potwierdzeniu; błąd szkicu widoczny, tekst zostaje', async () => {
    okno()
    wpisz('Mój tekst')
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Szkic odpowiedzi' }))
    })
    expect(klient.asystent).not.toHaveBeenCalled()
    klient.asystent.mockRejectedValueOnce(new Error('Darmowy limit Gemini na tę chwilę wyczerpany - spróbuj za minutę.'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Szkic odpowiedzi' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('limit Gemini')
    expect(screen.getByLabelText('Treść odpowiedzi')).toHaveValue('Mój tekst')
  })

  it('bez adresata - komunikat zamiast okna', () => {
    okno(null)
    expect(screen.getByText(/nie ma do kogo odpowiedzieć/)).toBeInTheDocument()
```

`components/skrzynka/WidokSprawy.test.tsx` - 2 zmiany:


1. Zamień:

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
```

   na:

```tsx
import { WidokSprawy } from '@/components/skrzynka/WidokSprawy'
import type { Sprawa, SzczegolySprawy } from '@/lib/skrzynka/typy'

const klient = { sprawa: vi.fn(), zmien: vi.fn(), odpowiedz: vi.fn(), asystent: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: {
    sprawa: (...a: unknown[]) => klient.sprawa(...a),
    zmien: (...a: unknown[]) => klient.zmien(...a),
    odpowiedz: (...a: unknown[]) => klient.odpowiedz(...a),
    asystent: (...a: unknown[]) => klient.asystent(...a),
  },
}))
```


2. Zamień:

```tsx
    expect(screen.queryByRole('region', { name: 'Odpowiedź' })).toBeNull()
  })

  it('przypisana osoba spoza Składu dalej widoczna w wyborze', async () => {
    await widok(D({ przypisana: 'Ola' }))
    expect(screen.getByLabelText('Przypisz')).toHaveValue('Ola')
```

   na:

```tsx
    expect(screen.queryByRole('region', { name: 'Odpowiedź' })).toBeNull()
  })

  it('Streść: streszczenie D.E.C.K. nad wątkiem dopiero po kliknięciu; błąd widoczny', async () => {
    await widok()
    expect(klient.asystent).not.toHaveBeenCalled()
    klient.asystent.mockResolvedValueOnce({ tekst: '- Firma proponuje sponsoring.\n- Czekają na odpowiedź do piątku.' })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Streść' }))
    })
    expect(klient.asystent).toHaveBeenCalledWith('t1', 'strescz')
    expect(screen.getByRole('region', { name: 'Streszczenie D.E.C.K.' })).toHaveTextContent('Czekają na odpowiedź do piątku.')
    klient.asystent.mockRejectedValueOnce(new Error('Gemini nie odpowiedział - spróbuj ponownie.'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Streść' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Gemini nie odpowiedział')
  })

  it('przypisana osoba spoza Składu dalej widoczna w wyborze', async () => {
    await widok(D({ przypisana: 'Ola' }))
    expect(screen.getByLabelText('Przypisz')).toHaveValue('Ola')
```

- [ ] **Krok 2: Uruchom - ma paść**

Run: `npx vitest run components/skrzynka/OknoOdpowiedzi.test.tsx components/skrzynka/WidokSprawy.test.tsx > "$TMP/vt.log" 2>&1; echo $?` → `1` (brak przycisków asystenta).

- [ ] **Krok 3: Implementacja**

`lib/skrzynka/klient.ts` - 2 zmiany:


1. Zamień:

```ts
'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type {
  KartaKontaktu, KartaOrganizacji, Organizacja, Sprawa, Status, StronaKontaktow, StronaSpraw, SzczegolySprawy, TypOrganizacji,
  UstawieniaSkrzynki, WynikSynchronizacji, ZmianaSprawy,
```

   na:

```ts
'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type { TrybAsystenta } from './asystent'
import type {
  KartaKontaktu, KartaOrganizacji, Organizacja, Sprawa, Status, StronaKontaktow, StronaSpraw, SzczegolySprawy, TypOrganizacji,
  UstawieniaSkrzynki, WynikSynchronizacji, ZmianaSprawy,
```


2. Zamień:

```ts
  organizacja: (domena: string) => wywolaj<KartaOrganizacji>(`/api/skrzynka/organizacje?${new URLSearchParams({ domena })}`),
  zmienOrganizacje: (domena: string, z: { nazwa?: string; typ?: TypOrganizacji }) =>
    wywolaj<Organizacja>('/api/skrzynka/organizacje', json('PATCH', { domena, ...z })),
}
```

   na:

```ts
  organizacja: (domena: string) => wywolaj<KartaOrganizacji>(`/api/skrzynka/organizacje?${new URLSearchParams({ domena })}`),
  zmienOrganizacje: (domena: string, z: { nazwa?: string; typ?: TypOrganizacji }) =>
    wywolaj<Organizacja>('/api/skrzynka/organizacje', json('PATCH', { domena, ...z })),
  asystent: (id: string, tryb: TrybAsystenta) =>
    wywolaj<{ tekst: string }>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}/asystent`, json('POST', { tryb })),
}
```

`components/skrzynka/OknoOdpowiedzi.tsx` - 6 zmian:


1. Zamień:

```tsx
'use client'
import { useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { rozmiar } from '@/lib/skrzynka/widok'
import { MAKS_ZALACZNIKOW, type Sprawa } from '@/lib/skrzynka/typy'
```

   na:

```tsx
'use client'
import { useRef, useState } from 'react'
import { Paperclip, Send, Sparkles, X } from 'lucide-react'
import { LUKA } from '@/lib/skrzynka/asystent'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { rozmiar } from '@/lib/skrzynka/widok'
import { MAKS_ZALACZNIKOW, type Sprawa } from '@/lib/skrzynka/typy'
```


2. Zamień:

```tsx
/**
 * Odpowiedź w wątku z kontakt@. Błąd wysyłki zostawia tekst i załączniki -
 * nic nie trzeba pisać od nowa. Limit 4 MB sprawdzany tu i na serwerze.
 */
export function OknoOdpowiedzi({ sprawaId, adresat, stopka, onWyslano }: {
  sprawaId: string
```

   na:

```tsx
/**
 * Odpowiedź w wątku z kontakt@. Błąd wysyłki zostawia tekst i załączniki -
 * nic nie trzeba pisać od nowa. Limit 4 MB sprawdzany tu i na serwerze.
 * Szkic od D.E.C.K. tylko wpisuje tekst do okna; miejsca do uzupełnienia
 * blokują wysyłkę, dopóki ich nie zastąpisz.
 */
export function OknoOdpowiedzi({ sprawaId, adresat, stopka, onWyslano }: {
  sprawaId: string
```


3. Zamień:

```tsx
  const [pliki, setPliki] = useState<File[]>([])
  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const wybor = useRef<HTMLInputElement>(null)
  const razem = pliki.reduce((s, p) => s + p.size, 0)
  const zaDuzo = razem > MAKS_ZALACZNIKOW

  if (!adresat) return <p className="text-[12px] text-deck-muted">W tym wątku nie ma do kogo odpowiedzieć - napisz z Gmaila.</p>
```

   na:

```tsx
  const [pliki, setPliki] = useState<File[]>([])
  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const [pisze, setPisze] = useState(false)
  const wybor = useRef<HTMLInputElement>(null)
  const razem = pliki.reduce((s, p) => s + p.size, 0)
  const zaDuzo = razem > MAKS_ZALACZNIKOW
  const luki = tekst.includes(LUKA)

  if (!adresat) return <p className="text-[12px] text-deck-muted">W tym wątku nie ma do kogo odpowiedzieć - napisz z Gmaila.</p>
```


4. Zamień:

```tsx
    }
  }

  const przycisk = 'deck-chip inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] transition hover:text-deck-text disabled:opacity-50'

  return (
```

   na:

```tsx
    }
  }

  async function szkic() {
    if (tekst.trim() && !window.confirm('Zastąpić wpisany tekst szkicem od D.E.C.K.?')) return
    setPisze(true)
    setBlad(null)
    try {
      setTekst((await klientSkrzynki.asystent(sprawaId, 'szkic')).tekst)
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setPisze(false)
    }
  }

  const przycisk = 'deck-chip inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] transition hover:text-deck-text disabled:opacity-50'

  return (
```


5. Zamień:

```tsx
        aria-label="Treść odpowiedzi"
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={6}
        className="deck-input w-full rounded-md px-2.5 py-2 text-[12.5px] leading-relaxed"
      />
```

   na:

```tsx
        aria-label="Treść odpowiedzi"
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        disabled={pisze}
        rows={6}
        className="deck-input w-full rounded-md px-2.5 py-2 text-[12.5px] leading-relaxed"
      />
```


6. Zamień:

```tsx
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
```

   na:

```tsx
          {stopka}
        </pre>
      )}
      {luki && <p className="text-deck-danger">Uzupełnij miejsca {LUKA} przed wysłaniem.</p>}
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={szkic} disabled={trwa || pisze} className={przycisk}>
          <Sparkles size={12} aria-hidden="true" />
          {pisze ? 'Piszę szkic…' : 'Szkic odpowiedzi'}
        </button>
        <button type="button" onClick={() => wybor.current?.click()} disabled={trwa} className={przycisk}>
          <Paperclip size={12} aria-hidden="true" />
          Dodaj załączniki
        </button>
        <button type="button" onClick={wyslij} disabled={trwa || pisze || !tekst.trim() || zaDuzo || luki} className={przycisk}>
          <Send size={12} aria-hidden="true" />
          {trwa ? 'Wysyłam…' : 'Wyślij'}
        </button>
```

`components/skrzynka/WidokSprawy.tsx` - 5 zmian:


1. Zamień:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { ExternalLink, Paperclip } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_STATUSOW, adresZalacznika, linkGmail, pelnaData, rozmiar } from '@/lib/skrzynka/widok'
import { MAKS_POBRANIA, type Sprawa, type Status, type SzczegolySprawy, type ZmianaSprawy } from '@/lib/skrzynka/typy'
```

   na:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { ExternalLink, Paperclip, Sparkles } from 'lucide-react'
import { TekstAsystenta } from '@/components/deck/TekstAsystenta'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_STATUSOW, adresZalacznika, linkGmail, pelnaData, rozmiar } from '@/lib/skrzynka/widok'
import { MAKS_POBRANIA, type Sprawa, type Status, type SzczegolySprawy, type ZmianaSprawy } from '@/lib/skrzynka/typy'
```


2. Zamień:

```tsx
  const [dane, setDane] = useState<SzczegolySprawy | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [trwa, setTrwa] = useState(false)

  useEffect(() => {
    let aktywny = true
```

   na:

```tsx
  const [dane, setDane] = useState<SzczegolySprawy | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [trwa, setTrwa] = useState(false)
  const [streszczenie, setStreszczenie] = useState<string | null>(null)
  const [mysli, setMysli] = useState(false)

  useEffect(() => {
    let aktywny = true
```


3. Zamień:

```tsx
    void zmien({ pomin: rodzaj })
  }

  async function poWyslaniu(s: Sprawa) {
    setDane((d) => d && { ...d, sprawa: s })
    onZmiana(s)
```

   na:

```tsx
    void zmien({ pomin: rodzaj })
  }

  /** Treść wątku idzie do Gemini dopiero po tym kliknięciu (spec §9). */
  async function strescz() {
    setMysli(true)
    setBlad(null)
    try {
      setStreszczenie((await klientSkrzynki.asystent(id, 'strescz')).tekst)
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setMysli(false)
    }
  }

  async function poWyslaniu(s: Sprawa) {
    setDane((d) => d && { ...d, sprawa: s })
    onZmiana(s)
```


4. Zamień:

```tsx
            {s.organizacja ? ` · ${s.organizacja}` : ''} · {ETYKIETY_STATUSOW[s.status]}
          </p>
        </div>
        <a href={linkGmail(email, s.id)} target="_blank" rel="noopener noreferrer" className={`${przycisk} inline-flex items-center gap-1`}>
          <ExternalLink size={12} aria-hidden="true" />
          Otwórz w Gmailu
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
```

   na:

```tsx
            {s.organizacja ? ` · ${s.organizacja}` : ''} · {ETYKIETY_STATUSOW[s.status]}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {dane.wiadomosci.length > 0 && (
            <button type="button" onClick={strescz} disabled={mysli} className={`${przycisk} inline-flex items-center gap-1`}>
              <Sparkles size={12} aria-hidden="true" />
              {mysli ? 'Streszczam…' : 'Streść'}
            </button>
          )}
          <a href={linkGmail(email, s.id)} target="_blank" rel="noopener noreferrer" className={`${przycisk} inline-flex items-center gap-1`}>
            <ExternalLink size={12} aria-hidden="true" />
            Otwórz w Gmailu
          </a>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
```


5. Zamień:

```tsx
        </span>
      </div>
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}

      {dane.wiadomosci.length === 0 && (
        <p className="text-deck-muted">Tego wątku nie ma już w Gmailu - sprawę można zamknąć albo pominąć.</p>
```

   na:

```tsx
        </span>
      </div>
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}
      {streszczenie && (
        <section aria-label="Streszczenie D.E.C.K." className="space-y-1 rounded-md border border-deck-accent/30 bg-deck-accent/5 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-deck-muted">Streszczenie D.E.C.K.</p>
          <TekstAsystenta tekst={streszczenie} />
        </section>
      )}

      {dane.wiadomosci.length === 0 && (
        <p className="text-deck-muted">Tego wątku nie ma już w Gmailu - sprawę można zamknąć albo pominąć.</p>
```

- [ ] **Krok 4: Uruchom - ma przejść**

Run: `npx vitest run components/skrzynka > "$TMP/vt.log" 2>&1; echo $?` → `0`.
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`.
Run: `npm run lint > "$TMP/lint.log" 2>&1; echo $?` → `0`.

- [ ] **Krok 5: Commit**

```bash
git add components/skrzynka/OknoOdpowiedzi.test.tsx components/skrzynka/OknoOdpowiedzi.tsx components/skrzynka/WidokSprawy.test.tsx components/skrzynka/WidokSprawy.tsx lib/skrzynka/klient.ts
git commit -m "$(cat <<'EOF'
feat(skrzynka): Stresc i Szkic odpowiedzi w widoku sprawy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Zadanie 6: README, sprawdzenie i wdrożenie

**Pliki:** zmiana `README.md`

- [ ] **Krok 1: README** - w sekcji „Skrzynka kontakt@ (Gmail)” po akapicie „Odpowiedź z widoku sprawy …” dopisz:

```markdown
Asystent: odprawa i czat widzą skrzynkę - liczby spraw, sprawy po terminie (temat, organizacja, dni czekania) i organizacje z ruchem w 7 dni, bez treści maili i adresów osób; bez połączenia sekcja jest pusta, a odprawa ma obszar „Skrzynka”. W widoku sprawy „Streść” i „Szkic odpowiedzi” wysyłają do Gemini treść jednego wątku (bez cytatów, do 20 000 znaków od końca) i notatki - dopiero po kliknięciu, bez zapisu. Szkic tylko wpisuje się do okna odpowiedzi; miejsca „[do uzupełnienia]” blokują wysyłkę.
```

- [ ] **Krok 2: Pełne sprawdzenie**

Run: `npx vitest run > "$TMP/vt.log" 2>&1; echo $?` → `0` (przy przekroczeniu czasu startu workera albo w niezwiązanym pliku uruchom go osobno i cały zestaw ponownie)
Run: `npx tsc --noEmit > "$TMP/tsc.log" 2>&1; echo $?` → `0`
Run: `npm run lint > "$TMP/lint.log" 2>&1; echo $?` → `0`
Run: `npm run build > "$TMP/build.log" 2>&1; echo $?` → `0`; w logu `ƒ /api/skrzynka/sprawy/[id]/asystent`. Potem `rm -rf .next/types`.
Run: `git diff --name-only main | PYTHONIOENCODING=utf-8 python -c "import sys,io; print([p for p in sys.stdin.read().split() if any(z in io.open(p,encoding='utf-8').read() for z in (chr(0x2014),chr(0x2013)))])"` → `[]`.

- [ ] **Krok 3: Commit, przegląd końcowy, scalenie i wypchnięcie (zgoda użytkownika: „na maina od razu”)**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(skrzynka): opis asystenta skrzynki w README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Po przeglądzie końcowym i poprawkach:

```bash
git checkout main && git pull origin main && git merge --ff-only deck-skrzynka-3 && npx vitest run && git push origin main && git branch -d deck-skrzynka-3
```

- [ ] **Krok 4: Produkcja**

- Wdrożenie z GitHuba w zespole `dzial-it-samorzadu` w stanie Ready.
- Bez sesji: `POST /api/skrzynka/sprawy/x/asystent` → 401.
- Właściciel (test użytkownika): „Streść” na długim wątku, „Szkic odpowiedzi” (wpisuje się do okna, `[do uzupełnienia]` blokuje „Wyślij”), odprawa po „Odśwież” może mieć zagrożenie w obszarze „Skrzynka” z odnośnikiem do `/skrzynka`, czat odpowiada na „ile spraw czeka po terminie?”.

- [ ] **Krok 5: Pamięć projektu** - moduł Skrzynka (części 1-3) na produkcji; zostają odłożone drobiazgi z przeglądów 2a, 2b i 3.
