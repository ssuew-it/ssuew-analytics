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
    expect(h).toContain('<meta name="referrer" content="no-referrer">')
  })
})
