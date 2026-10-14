import type { Adres, WatekZGmaila, WiadomoscMeta } from './typy'

/** Odpowiedź `threads.get` z `format=metadata` - tylko pola, których używamy. */
export interface WatekApi {
  id: string
  messages?: {
    id: string
    internalDate?: string
    labelIds?: string[]
    snippet?: string
    payload?: { headers?: { name: string; value: string }[] }
  }[]
}

const POMIJANE_ETYKIETY = ['DRAFT', 'SPAM', 'TRASH']

/** Słowa zakodowane RFC 2047 (`=?UTF-8?B?…?=`). Gmail zwykle podaje nagłówki już odkodowane - to zabezpieczenie. */
export function dekodujNaglowek(s: string): string {
  return s
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (calosc, zestaw: string, kod: string, tekst: string) => {
      try {
        const znaki = kod.toUpperCase() === 'B'
          ? atob(tekst)
          : tekst.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
        return new TextDecoder(zestaw.toLowerCase()).decode(Uint8Array.from(znaki, (c) => c.charCodeAt(0)))
      } catch {
        return calosc
      }
    })
}

/** `Imię <a@b>, "Nazwisko, Imię" <c@d>, e@f` - przecinek w cudzysłowie albo w nawiasie nie dzieli adresów. */
export function odczytajAdresy(naglowek: string): Adres[] {
  const czesci: string[] = []
  let biezaca = ''
  let cudzyslow = false
  let nawias = false
  for (const z of naglowek) {
    if (z === '"') cudzyslow = !cudzyslow
    else if (z === '<' && !cudzyslow) nawias = true
    else if (z === '>' && !cudzyslow) nawias = false
    if (z === ',' && !cudzyslow && !nawias) {
      czesci.push(biezaca)
      biezaca = ''
    } else {
      biezaca += z
    }
  }
  czesci.push(biezaca)
  return czesci.flatMap((c) => {
    const t = c.trim()
    const m = t.match(/^(.*?)<([^>]+)>\s*$/)
    const email = (m ? m[2] : t).trim().toLowerCase()
    // Adres trafia jako identyfikator dokumentu Firestore - ukośnik podzieliłby ścieżkę i zablokował zapis.
    if (!/^[^\s@/]+@[^\s@/]+$/.test(email)) return []
    const imie = dekodujNaglowek((m ? m[1] : '').trim().replace(/^"(.*)"$/, '$1').trim())
    return [{ email, imie }]
  })
}

const ENCJE: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** `snippet` Gmaila ma encje HTML. */
function dekodujEncje(s: string): string {
  return s.replace(/&(#\d+|[a-z]+);/gi, (calosc, e: string) =>
    e.startsWith('#') ? String.fromCharCode(Number(e.slice(1))) : ENCJE[e.toLowerCase()] ?? calosc,
  )
}

export function odczytajWatek(w: WatekApi): WatekZGmaila {
  const wiadomosci: WiadomoscMeta[] = (w.messages ?? [])
    .filter((m) => !(m.labelIds ?? []).some((e) => POMIJANE_ETYKIETY.includes(e)))
    .map((m) => {
      const h = (nazwa: string) =>
        m.payload?.headers?.find((x) => x.name.toLowerCase() === nazwa.toLowerCase())?.value ?? ''
      const precedence = h('Precedence').trim().toLowerCase()
      return {
        id: m.id,
        kiedy: Number(m.internalDate) || 0,
        od: odczytajAdresy(h('From'))[0] ?? null,
        do: [...odczytajAdresy(h('To')), ...odczytajAdresy(h('Cc'))],
        temat: dekodujNaglowek(h('Subject')).trim(),
        etykiety: m.labelIds ?? [],
        masowa: Boolean(h('List-Unsubscribe')) || precedence === 'bulk' || precedence === 'list',
        fragment: dekodujEncje(m.snippet ?? ''),
      }
    })
    .sort((a, b) => a.kiedy - b.kiedy)
  return { id: w.id, wiadomosci }
}
