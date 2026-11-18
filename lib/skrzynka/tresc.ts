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
export function dekodujBase64Url(dane: string): Uint8Array<ArrayBuffer> {
  const b64 = dane.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

const naglowek = (c: CzescApi, nazwa: string) =>
  c.headers?.find((h) => h.name.toLowerCase() === nazwa.toLowerCase())?.value ?? ''

/**
 * Tekst części. Najpierw ścisły UTF-8: Gmail potrafi oddać treść już w UTF-8,
 * choć nagłówek dalej mówi `iso-8859-2` albo `windows-1250` - dekodowanie wg
 * nagłówka dawało wtedy „DzieĹ dobry”. Gdy bajty nie są poprawnym UTF-8
 * (prawdziwy ISO-8859-2 czy Windows-1250 - polskie litery to tam pojedyncze
 * bajty > 0x7F), dekodujemy wg `charset`; nieznany - UTF-8 z zamiennikami.
 */
function tekstCzesci(c: CzescApi): string {
  const bajty = dekodujBase64Url(c.body?.data ?? '')
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bajty)
  } catch {
    // Nie UTF-8 - zostaje kodowanie z nagłówka.
  }
  const zestaw = naglowek(c, 'Content-Type').match(/charset="?([^";\s]+)"?/i)?.[1]?.toLowerCase() ?? 'utf-8'
  try {
    return new TextDecoder(zestaw).decode(bajty)
  } catch {
    return new TextDecoder('utf-8').decode(bajty)
  }
}

type Zebrane = { tekst: string | null; html: string | null; zalaczniki: Zalacznik[]; wbudowane: Record<string, string> }

/** base64url Gmaila → zwykły base64 do adresu `data:`. */
const naBase64 = (dane: string) => {
  const b64 = dane.replace(/-/g, '+').replace(/_/g, '/')
  return b64 + '='.repeat((4 - (b64.length % 4)) % 4)
}

/** Pierwszy tekst, pierwszy HTML, wszystkie załączniki i obrazki wklejone w treść - przez całe drzewo części. */
function zbierz(c: CzescApi, wiadomoscId: string, w: Zebrane): void {
  const typ = (c.mimeType ?? '').toLowerCase()
  const cid = naglowek(c, 'Content-ID').trim().replace(/^<|>$/g, '')
  if (c.body?.attachmentId && (c.filename || (cid && typ.startsWith('image/')))) {
    w.zalaczniki.push({
      id: c.body.attachmentId,
      wiadomoscId,
      nazwa: c.filename ? dekodujNaglowek(c.filename) : `obrazek.${typ.split('/')[1] ?? 'img'}`,
      typ: typ || 'application/octet-stream',
      rozmiar: c.body.size ?? 0,
      ...(cid ? { cid } : {}),
    })
    return
  }
  if (cid && typ.startsWith('image/') && c.body?.data) {
    w.wbudowane[cid] = `data:${typ};base64,${naBase64(c.body.data)}`
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
      const z: Zebrane = { tekst: null, html: null, zalaczniki: [], wbudowane: {} }
      zbierz(p, m.id, z)
      const { wbudowane, ...reszta } = z
      return {
        id: m.id,
        kiedy: Number(m.internalDate) || 0,
        od: odczytajAdresy(naglowek(p, 'From'))[0] ?? null,
        do: [...odczytajAdresy(naglowek(p, 'To')), ...odczytajAdresy(naglowek(p, 'Cc'))],
        temat: dekodujNaglowek(naglowek(p, 'Subject')).trim(),
        ...reszta,
        ...(Object.keys(wbudowane).length ? { wbudowane } : {}),
      }
    })
    .sort((a, b) => a.kiedy - b.kiedy)
}
