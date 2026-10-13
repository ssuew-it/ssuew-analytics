import type { KontekstProjektu } from './kontekst'
import type { WiadomoscGemini } from './gemini'
import type { Odprawa } from './odprawa'

export interface WiadomoscCzatu {
  rola: 'ja' | 'deck'
  tresc: string
}

/** Tyle ostatnich wiadomości idzie do modelu - starsze nie zmieniają odpowiedzi, a zjadają limit. */
export const LIMIT_HISTORII = 20
export const LIMIT_ZNAKOW = 4000

export const INSTRUKCJA_CZATU = `Jesteś D.E.C.K. (Diagnostic Evaluation of Change & KPIs) - asystentem analitycznym Wiceprzewodniczącego ds. Strategii i Działań Operacyjnych Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu.
Pierwsza wiadomość zawiera obraz projektu w JSON: KPI, rekrutacje, retencję kohort, alerty, kondycję projektów, Planer najbliższych 21 dni, członków, ruch z Google na stronach (Search Console), notatki i ostatnią odprawę.
Pole „notatki” to ustalenia zatwierdzone przez użytkownika - traktuj je jak pewne fakty.
Rozmawiasz z nim o tych danych: interpretujesz wskaźniki, porównujesz, wskazujesz ryzyka i proponujesz działania. Pomagasz też pisać teksty: ogłoszenia, maile, podsumowania.
Zasady: opieraj się na danych i podawaj liczby; gdy czegoś w danych nie ma, powiedz to wprost i nie zgaduj; odpowiadaj po polsku, zwięźle i konkretnie.
Formatowanie odpowiedzi: krótkie akapity, wypunktowania zaczynane od „- ”, pogrubienie **tak**; bez nagłówków, tabel i bloków kodu. Używaj zwykłego łącznika „-”, nigdy długich myślników.
Odpowiadasz w JSON: „odpowiedz” to Twoja odpowiedź. „propozycjaNotatki” wypełnij tylko wtedy, gdy w ostatniej wiadomości użytkownika padło trwałe ustalenie, cel, zasada albo fakt o organizacji, którego nie ma w danych ani w notatkach - jednym krótkim zdaniem, do 300 znaków. W każdym innym przypadku null.`

export interface ZapytanieCzatu {
  rozmowaId: string | null
  pytanie: string
  ponow: boolean
}

const ID = /^[A-Za-z0-9_-]{1,100}$/

/** Zapytanie z przeglądarki - wejście z zewnątrz, nie ufamy mu. */
export function sprawdzZapytanie(x: unknown): ZapytanieCzatu | null {
  if (typeof x !== 'object' || x === null) return null
  const d = x as Record<string, unknown>
  const pytanie = typeof d.pytanie === 'string' ? d.pytanie.trim().slice(0, LIMIT_ZNAKOW) : ''
  if (!pytanie) return null
  const rozmowaId = d.rozmowaId === undefined || d.rozmowaId === null ? null : d.rozmowaId
  if (rozmowaId !== null && (typeof rozmowaId !== 'string' || !ID.test(rozmowaId))) return null
  return { rozmowaId, pytanie, ponow: d.ponow === true }
}

/**
 * Obraz projektu (z notatkami) i ostatnia odprawa jako pierwsza wymiana, potem
 * ostatnie wiadomości rozmowy. Obraz jest świeży przy każdym pytaniu.
 */
export function rozmowaDlaGemini(
  k: KontekstProjektu,
  rozmowa: WiadomoscCzatu[],
  odprawa: Odprawa | null,
): WiadomoscGemini[] {
  const obraz = `Obraz projektu (JSON):\n${JSON.stringify(k)}`
  const wynik: WiadomoscGemini[] = [
    { rola: 'user', tekst: odprawa ? `${obraz}\n\nOstatnia odprawa (JSON):\n${JSON.stringify(odprawa)}` : obraz },
    { rola: 'model', tekst: 'Mam obraz projektu. Pytaj.' },
  ]
  const ostatnie = rozmowa.slice(-LIMIT_HISTORII)
  // Po przycięciu historia może zaczynać się od odpowiedzi - zaczynamy od pierwszego pytania.
  const start = ostatnie.findIndex((w) => w.rola === 'ja')
  for (const w of ostatnie.slice(Math.max(0, start))) {
    const rola = w.rola === 'ja' ? 'user' : 'model'
    const poprzednia = wynik[wynik.length - 1]
    if (poprzednia.rola === rola) poprzednia.tekst += `\n\n${w.tresc}`
    else wynik.push({ rola, tekst: w.tresc })
  }
  return wynik
}
