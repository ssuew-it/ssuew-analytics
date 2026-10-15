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
