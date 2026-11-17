/**
 * Klient Gemini przez zwykły `fetch` - bez dodatkowej paczki. Wołany wyłącznie
 * z serwera: klucz nigdy nie trafia do przeglądarki.
 */

/**
 * Kolejność prób. Darmowy poziom bywa przeciążony (503) albo wyczerpany (429)
 * na pojedynczym modelu - wtedy pytamy następny, zamiast gasić odprawę.
 */
export const MODELE_DOMYSLNE = [
  'gemini-3.8-flash',
  // 17.11.2026 trzy dawne modele (3.8-flash, 3-flash-preview, flash-lite-latest)
  // dawały naraz 503 „high demand” i odprawa stała 9 dni; te odpowiadały.
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
]
const ADRES = 'https://generativelanguage.googleapis.com/v1beta/models'
/** Na wszystkie próby razem - trasy mają 60 s, a strona nie może czekać w nieskończoność. */
const LIMIT_CZASU_MS = 25_000
/** Na jeden model - przeciążony potrafi milczeć kilkanaście sekund, zanim odmówi. */
export const CZAS_MODELU_MS = 8_000
/** Statusy, przy których warto spróbować innego modelu (404 - model wycofany przez Google). */
const PRZEJSCIOWE = new Set([404, 429, 500, 503, 504])

export type KodBledu = 'brak-klucza' | 'limit' | 'przeciazenie' | 'odmowa' | 'siec' | 'format'

export class BladAsystenta extends Error {
  readonly kod: KodBledu
  constructor(kod: KodBledu, wiadomosc: string) {
    super(wiadomosc)
    this.name = 'BladAsystenta'
    this.kod = kod
  }
}

export interface WiadomoscGemini {
  rola: 'user' | 'model'
  tekst: string
}

/** `GEMINI_MODEL` może podać jeden model albo listę po przecinku. */
export function modeleGemini(): string[] {
  const z = (process.env.GEMINI_MODEL ?? '').split(',').map((m) => m.trim()).filter(Boolean)
  return z.length ? z : MODELE_DOMYSLNE
}

export interface OdpowiedzGemini {
  tekst: string
  /** Model, który faktycznie odpowiedział. */
  model: string
}

/** Użytkownik nie chce długich myślników - instrukcja to mówi, a to pilnuje. */
export function bezDlugichMyslnikow(tekst: string): string {
  return tekst.replace(/\s\u2014\s/g, ' - ').replace(/[\u2014\u2013]/g, '-')
}

const ZABLOKOWANE = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'])

export async function zapytajGemini(o: {
  instrukcja: string
  wiadomosci: WiadomoscGemini[]
  /** Schemat odpowiedzi (format Gemini `Schema`). Bez niego - zwykły tekst. */
  schemat?: object
}): Promise<OdpowiedzGemini> {
  const klucz = process.env.GEMINI_API_KEY
  if (!klucz) throw new BladAsystenta('brak-klucza', 'Brak GEMINI_API_KEY')

  const tresc = JSON.stringify({
    systemInstruction: { parts: [{ text: o.instrukcja }] },
    contents: o.wiadomosci.map((w) => ({ role: w.rola, parts: [{ text: w.tekst }] })),
    generationConfig: o.schemat ? { responseMimeType: 'application/json', responseSchema: o.schemat } : {},
  })

  const przerwij = new AbortController()
  const zegar = setTimeout(() => przerwij.abort(), LIMIT_CZASU_MS)
  let ostatni: BladAsystenta | null = null
  let wyczerpany = false
  try {
    for (const model of modeleGemini()) {
      if (przerwij.signal.aborted) break
      // Milczący model dostaje własny limit, żeby nie zjadł czasu kolejnym.
      const modelowy = new AbortController()
      const zegarModelu = setTimeout(() => modelowy.abort(), CZAS_MODELU_MS)
      let res: Response
      let dane: { error?: { message?: string } } & Parameters<typeof odczytaj>[0]
      try {
        res = await fetch(`${ADRES}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': klucz },
          body: tresc,
          signal: AbortSignal.any([przerwij.signal, modelowy.signal]),
        })
        dane = await res.json().catch(() => null)
      } catch (e) {
        const przerwane = e instanceof Error && e.name === 'AbortError'
        if (przerwane && !przerwij.signal.aborted) {
          ostatni = new BladAsystenta('przeciazenie', `Gemini (${model}) milczał ponad ${CZAS_MODELU_MS / 1000} s`)
          continue
        }
        throw new BladAsystenta('siec', przerwane ? 'Gemini nie odpowiedział w 25 s' : 'Nie udało się połączyć z Gemini')
      } finally {
        clearTimeout(zegarModelu)
      }

      if (PRZEJSCIOWE.has(res.status)) {
        if (res.status === 429) wyczerpany = true
        const kod = res.status === 404 ? 'siec' : 'przeciazenie'
        ostatni = new BladAsystenta(kod, dane?.error?.message ?? `Gemini (${model}) odpowiedział ${res.status}`)
        continue
      }
      if (!res.ok) throw new BladAsystenta('siec', dane?.error?.message ?? `Gemini odpowiedział ${res.status}`)
      return { tekst: odczytaj(dane), model }
    }
  } finally {
    clearTimeout(zegar)
  }
  // Każdy model odmówił chwilowo. Gdy któryś miał wyczerpany limit, to on jest
  // najbardziej użyteczną informacją - przeciążenie mija samo, limit nie.
  if (wyczerpany) throw new BladAsystenta('limit', 'Limit zapytań Gemini wyczerpany')
  throw ostatni ?? new BladAsystenta('siec', 'Brak modelu Gemini do zapytania')
}

/** Tekst z odpowiedzi albo nazwany błąd: blokada, pusta odpowiedź. */
function odczytaj(dane: {
  promptFeedback?: { blockReason?: string }
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[]
} | null): string {
  if (dane?.promptFeedback?.blockReason) throw new BladAsystenta('odmowa', `Zablokowane: ${dane.promptFeedback.blockReason}`)
  const kandydat = dane?.candidates?.[0]
  if (kandydat?.finishReason && ZABLOKOWANE.has(kandydat.finishReason)) {
    throw new BladAsystenta('odmowa', `Zablokowane: ${kandydat.finishReason}`)
  }
  const tekst = (kandydat?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  if (!tekst.trim()) throw new BladAsystenta('format', 'Gemini zwrócił pustą odpowiedź')
  return bezDlugichMyslnikow(tekst)
}

const STATUS: Record<KodBledu, number> = { 'brak-klucza': 503, limit: 429, przeciazenie: 503, odmowa: 422, siec: 502, format: 502 }
const KOMUNIKAT: Record<KodBledu, string> = {
  'brak-klucza': 'Brak klucza Gemini - dodaj GEMINI_API_KEY w zmiennych Vercela.',
  limit: 'Darmowy limit Gemini na tę chwilę wyczerpany - spróbuj za minutę.',
  odmowa: 'Gemini odmówił odpowiedzi na te dane.',
  przeciazenie: 'Gemini jest teraz przeciążony - spróbuj za kilka minut.',
  siec: 'Gemini nie odpowiedział - spróbuj ponownie.',
  format: 'Gemini odpowiedział w nieoczekiwanym formacie - spróbuj ponownie.',
}

/** Błąd na odpowiedź HTTP z ludzkim komunikatem. */
export function komunikatBledu(e: unknown): { status: number; error: string } {
  if (e instanceof BladAsystenta) return { status: STATUS[e.kod], error: KOMUNIKAT[e.kod] }
  return { status: 500, error: 'Nieoczekiwany błąd asystenta.' }
}
