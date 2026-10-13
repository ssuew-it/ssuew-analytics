import type { KontekstProjektu } from './kontekst'

export const OBSZARY = ['kpi', 'rekrutacja', 'retencja', 'projekty', 'planer', 'zespol', 'strony'] as const
export const WAGI = ['wysoka', 'srednia', 'niska'] as const
export type Obszar = (typeof OBSZARY)[number]
export type Waga = (typeof WAGI)[number]

export interface Zagrozenie {
  obszar: Obszar
  waga: Waga
  tytul: string
  uzasadnienie: string
}

export interface Odprawa {
  podsumowanie: string
  zagrozenia: Zagrozenie[]
  dzis: string[]
}

/** Odprawa zapisana w Firestore razem z tym, z jakich danych powstała. */
export interface ZapisanaOdprawa {
  slad: string
  /** Data z obrazu („DD.MM.RRRR”) - nowy dzień to nowa odprawa. */
  dzien: string
  utworzono: number
  model: string
  odprawa: Odprawa
}

/** Odnośniki dobiera kod - model nie wymyśla adresów. */
export const ODNOSNIK_OBSZARU: Record<Obszar, string> = {
  kpi: '/analytics/kpi',
  rekrutacja: '/analytics/rekrutacje',
  retencja: '/analytics/retencja',
  projekty: '/analytics/projekty',
  planer: '/planer',
  zespol: '/analytics/czlonkowie',
  strony: '/strony',
}

export const INSTRUKCJA_ODPRAWY = `Jesteś D.E.C.K. (Diagnostic Evaluation of Change & KPIs) - asystentem analitycznym Wiceprzewodniczącego ds. Strategii i Działań Operacyjnych Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu.
Dostajesz obraz projektu w JSON: KPI, rekrutacje, retencję kohort, alerty, kondycję projektów, Planer najbliższych 21 dni (wydarzenia, kolizje, Sesja Operacyjna, propozycje), członków i ruch z Google na stronach (Search Console, 28 dni do 3 dni temu).
Przygotuj odprawę:
- podsumowanie: 2-4 zdania, co z danych wynika teraz;
- zagrozenia: do 5 obszarów wzbudzających niepokój, od najpoważniejszego, każde z uzasadnieniem opartym na konkretnych liczbach z danych;
- dzis: do 4 krótkich punktów na dziś (wydarzenia, decyzje, kolizje).
Zasady: tylko na podstawie przekazanych danych, nic nie zmyślaj; gdy danych brakuje, powiedz to; pisz po polsku, zwięźle, rzeczowo; używaj zwykłego łącznika „-”, nigdy długich myślników.`

const S = (extra: object = {}) => ({ type: 'STRING', ...extra })

export const SCHEMAT_ODPRAWY = {
  type: 'OBJECT',
  properties: {
    podsumowanie: S(),
    zagrozenia: {
      type: 'ARRAY',
      maxItems: 5,
      items: {
        type: 'OBJECT',
        properties: {
          obszar: S({ format: 'enum', enum: [...OBSZARY] }),
          waga: S({ format: 'enum', enum: [...WAGI] }),
          tytul: S(),
          uzasadnienie: S(),
        },
        required: ['obszar', 'waga', 'tytul', 'uzasadnienie'],
      },
    },
    dzis: { type: 'ARRAY', maxItems: 4, items: S() },
  },
  required: ['podsumowanie', 'zagrozenia', 'dzis'],
}

export function wiadomoscOdprawy(k: KontekstProjektu): string {
  return `Obraz projektu (JSON):\n${JSON.stringify(k)}\n\nPrzygotuj odprawę.`
}

const tekst = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null)
const KOLEJNOSC: Record<Waga, number> = { wysoka: 0, srednia: 1, niska: 2 }

/** Sprawdza odpowiedź modelu - schemat Gemini to prośba, nie gwarancja. */
export function sprawdzOdprawe(x: unknown): Odprawa | null {
  if (typeof x !== 'object' || x === null) return null
  const d = x as Record<string, unknown>
  const podsumowanie = tekst(d.podsumowanie)
  if (!podsumowanie || !Array.isArray(d.zagrozenia) || !Array.isArray(d.dzis)) return null
  if (d.zagrozenia.length > 5 || d.dzis.length > 4) return null

  const zagrozenia: Zagrozenie[] = []
  for (const z of d.zagrozenia as Record<string, unknown>[]) {
    const obszar = z?.obszar
    const waga = z?.waga
    const tytul = tekst(z?.tytul)
    const uzasadnienie = tekst(z?.uzasadnienie)
    if (!(OBSZARY as readonly unknown[]).includes(obszar) || !(WAGI as readonly unknown[]).includes(waga)) return null
    if (!tytul || !uzasadnienie) return null
    zagrozenia.push({ obszar: obszar as Obszar, waga: waga as Waga, tytul, uzasadnienie })
  }
  const dzis = (d.dzis as unknown[]).map(tekst).filter((t): t is string => t !== null)

  return { podsumowanie, zagrozenia: zagrozenia.sort((a, b) => KOLEJNOSC[a.waga] - KOLEJNOSC[b.waga]), dzis }
}
