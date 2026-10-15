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
