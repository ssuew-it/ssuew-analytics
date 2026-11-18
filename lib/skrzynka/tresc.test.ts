// @vitest-environment node
// TextDecoder z ISO-8859-2 i atob - jak na serwerze.
import { describe, it, expect } from 'vitest'
import { odczytajWatekPelny, type CzescApi } from '@/lib/skrzynka/tresc'
import { bezpiecznyHtml, zewnetrzneObrazki } from '@/lib/skrzynka/html'

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

  it('treść już w UTF-8 mimo nagłówka ISO-8859-2 albo Windows-1250 - bez krzaczków', () => {
    // Tak przychodziły maile z UEW, UWr i lot.pl: „DzieĹ dobry”, „paĹşdziernik”.
    const [m] = odczytajWatekPelny({
      id: 't1',
      messages: [
        wiadomosc('m1', 1, 'jan@x.pl', {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset="iso-8859-2"' }], body: { data: utf('Dzień dobry, wykłady w październiku') } },
            { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset=windows-1250' }], body: { data: utf('<p>Przewodniczący Zespołu</p>') } },
          ],
        }),
      ],
    })
    expect(m.tekst).toBe('Dzień dobry, wykłady w październiku')
    expect(m.html).toBe('<p>Przewodniczący Zespołu</p>')
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

  it('obrazki wklejone w treść (stopki): Content-ID przy załączniku, małe wprost jako data:', () => {
    const [m] = odczytajWatekPelny({ id: 't1', messages: [wiadomosc('m1', 1, 'a@x.pl', {
      mimeType: 'multipart/related',
      parts: [
        { mimeType: 'text/html', body: { data: utf('<img src="cid:logo@x"><img src="cid:ikona">') } },
        { mimeType: 'image/png', filename: 'image001.png', headers: [{ name: 'Content-ID', value: '<logo@x>' }], body: { attachmentId: 'ATT9', size: 5000 } },
        { mimeType: 'image/gif', headers: [{ name: 'Content-ID', value: '<ikona>' }], body: { data: Buffer.from('GIF89a').toString('base64url'), size: 6 } },
        { mimeType: 'image/jpeg', headers: [{ name: 'Content-ID', value: '<bez-nazwy>' }], body: { attachmentId: 'ATT8', size: 900 } },
      ],
    })] })
    expect(m.zalaczniki).toEqual([
      { id: 'ATT9', wiadomoscId: 'm1', nazwa: 'image001.png', typ: 'image/png', rozmiar: 5000, cid: 'logo@x' },
      { id: 'ATT8', wiadomoscId: 'm1', nazwa: 'obrazek.jpeg', typ: 'image/jpeg', rozmiar: 900, cid: 'bez-nazwy' },
    ])
    expect(m.wbudowane).toEqual({ ikona: `data:image/gif;base64,${Buffer.from('GIF89a').toString('base64')}` })
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

describe('obrazki w ramce maila', () => {
  const ZRODLO = 'https://ssuew-analytics.vercel.app'

  it('cid: podmienione na adres załącznika albo data:; CSP wpuszcza obrazki z D.E.C.K., z internetu nie', () => {
    const h = bezpiecznyHtml(`<img src="cid:logo@x"><img src='cid:ikona'><img src="https://tracker.pl/p.gif">`, {
      obrazki: { 'logo@x': `${ZRODLO}/api/z?1`, ikona: 'data:image/gif;base64,R0lG' },
      zrodlo: ZRODLO,
    })
    expect(h).toContain(`<img src="${ZRODLO}/api/z?1">`)
    expect(h).toContain(`<img src='data:image/gif;base64,R0lG'>`)
    expect(h).toContain(`img-src data: cid: ${ZRODLO};`)
    expect(h).not.toMatch(/img-src[^;]*https:(?!\/\/ssuew)/)
  })

  it('„Pokaż obrazki” - CSP wpuszcza też obrazki z internetu', () => {
    expect(bezpiecznyHtml('<img src="https://firma.pl/logo.png">', { zrodlo: ZRODLO, zSieci: true }))
      .toContain(`img-src data: cid: ${ZRODLO} https: http:;`)
  })

  it('wykrywa obrazki z internetu: img, tło w stylu i atrybut background', () => {
    expect(zewnetrzneObrazki('<p>Hej</p><img src="cid:a">')).toBe(false)
    expect(zewnetrzneObrazki('<IMG alt="x" SRC="https://firma.pl/a.png">')).toBe(true)
    expect(zewnetrzneObrazki(`<div style="background-image: url('http://a.pl/t.jpg')">`)).toBe(true)
    expect(zewnetrzneObrazki('<td background="https://a.pl/t.jpg">')).toBe(true)
  })
})
