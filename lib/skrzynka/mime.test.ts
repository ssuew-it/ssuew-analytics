// @vitest-environment node
// Buffer i TextDecoder - jak na serwerze.
import { describe, it, expect } from 'vitest'
import { przygotujOdpowiedz, slowoNaglowka, zbudujMail, type MailWysylany } from '@/lib/skrzynka/mime'
import { dekodujNaglowek, type WatekApi } from '@/lib/skrzynka/naglowki'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'

function watek(wiadomosci: { kiedy: number; naglowki: Record<string, string>; etykiety?: string[] }[]): WatekApi {
  return {
    id: 't1',
    messages: wiadomosci.map((w, i) => ({
      id: `m${i}`,
      internalDate: String(w.kiedy),
      labelIds: w.etykiety ?? ['INBOX'],
      payload: { headers: Object.entries(w.naglowki).map(([name, value]) => ({ name, value })) },
    })),
  }
}

describe('przygotujOdpowiedz', () => {
  it('do nadawcy ostatniej ich wiadomości; Re: raz; References z całym łańcuchem', () => {
    const o = przygotujOdpowiedz(watek([
      { kiedy: 100, naglowki: { From: 'Anna <anna@firma.pl>', To: NASZ, Subject: 'Sponsoring Juwenaliów', 'Message-ID': '<a1@firma.pl>' } },
      { kiedy: 200, naglowki: { From: NASZ, To: 'anna@firma.pl', Subject: 'Re: Sponsoring Juwenaliów', 'Message-ID': '<m2@samorzad>', References: '<a1@firma.pl>' } },
      { kiedy: 300, naglowki: { From: 'Jan <jan@firma.pl>', To: NASZ, Subject: 'Re: Sponsoring Juwenaliów', 'Message-Id': '<j3@firma.pl>', References: '<a1@firma.pl> <m2@samorzad>' } },
    ]), NASZ)
    expect(o).toEqual({
      do: 'jan@firma.pl',
      temat: 'Re: Sponsoring Juwenaliów',
      inReplyTo: '<j3@firma.pl>',
      references: '<a1@firma.pl> <m2@samorzad> <j3@firma.pl>',
    })
  })

  it('Reply-To ma pierwszeństwo przed From', () => {
    const o = przygotujOdpowiedz(watek([
      { kiedy: 1, naglowki: { From: 'formularz@strona.pl', 'Reply-To': 'Ola <ola@gmail.com>', To: NASZ, Subject: 'Pytanie', 'Message-ID': '<f1@strona.pl>' } },
    ]), NASZ)
    expect(o).toMatchObject({ do: 'ola@gmail.com', temat: 'Re: Pytanie', inReplyTo: '<f1@strona.pl>', references: '<f1@strona.pl>' })
  })

  it('wątek tylko od nas - do pierwszego odbiorcy; szkice pominięte; bez Message-ID nagłówki puste', () => {
    const o = przygotujOdpowiedz(watek([
      { kiedy: 1, naglowki: { From: NASZ, To: 'rektor@ue.wroc.pl, kontakt@samorzad.ue.wroc.pl', Subject: 'Re: Spotkanie' } },
      { kiedy: 2, naglowki: { From: 'ktos@x.pl', To: NASZ, Subject: 'szkic' }, etykiety: ['DRAFT'] },
    ]), NASZ)
    expect(o).toEqual({ do: 'rektor@ue.wroc.pl', temat: 'Re: Spotkanie', inReplyTo: null, references: null })
  })

  it('nie ma do kogo - null', () => {
    expect(przygotujOdpowiedz(watek([{ kiedy: 1, naglowki: { From: NASZ, To: NASZ, Subject: 'notatka' } }]), NASZ)).toBeNull()
    expect(przygotujOdpowiedz({ id: 't1' }, NASZ)).toBeNull()
  })
})

const MAIL: MailWysylany = {
  od: NASZ,
  nazwaOd: 'Samorząd Studentów UEW',
  do: 'anna@firma.pl',
  temat: 'Re: Współpraca przy Juwenaliach 2026 - oferta sponsorska dla firmy',
  tekst: 'Dzień dobry,\ndziękujemy za ofertę.',
  stopka: '-- \nSamorząd Studentów UEW',
  inReplyTo: '<a1@firma.pl>',
  references: '<a1@firma.pl>',
  pliki: [],
}

/** Nagłówki do pierwszej pustej linii; zawinięte linie sklejone. */
const naglowki = (raw: string) => raw.split('\r\n\r\n')[0].replace(/\r\n /g, ' ').split('\r\n')
const zBase64 = (s: string) => Buffer.from(s.replace(/\r\n/g, ''), 'base64')

describe('zbudujMail', () => {
  it('sam tekst: nadawca i temat w RFC 2047, wątek, treść UTF-8 ze stopką i CRLF', () => {
    const raw = zbudujMail(MAIL)
    const n = naglowki(raw)
    expect(n).toContain('To: anna@firma.pl')
    expect(n).toContain('In-Reply-To: <a1@firma.pl>')
    expect(n).toContain('References: <a1@firma.pl>')
    expect(n).toContain('MIME-Version: 1.0')
    expect(n).toContain('Content-Type: text/plain; charset=UTF-8')
    expect(dekodujNaglowek(n.find((l) => l.startsWith('From: '))!.slice(6))).toBe('Samorząd Studentów UEW <kontakt@samorzad.ue.wroc.pl>')
    expect(dekodujNaglowek(n.find((l) => l.startsWith('Subject: '))!.slice(9))).toBe(MAIL.temat)
    expect(raw.split('\r\n\r\n')[1].split('\r\n').every((l) => l.length <= 76)).toBe(true)
    expect(zBase64(raw.split('\r\n\r\n')[1]).toString('utf8')).toBe('Dzień dobry,\r\ndziękujemy za ofertę.\r\n\r\n-- \r\nSamorząd Studentów UEW')
  })

  it('nowa linia w temacie albo adresie nie dopisze nagłówka', () => {
    const n = naglowki(zbudujMail({ ...MAIL, temat: 'Hej\r\nBcc: wszyscy@x.pl', do: 'anna@firma.pl\nCc: b@x.pl', inReplyTo: null, references: null }))
    expect(n.some((l) => /^(Bcc|Cc):/i.test(l))).toBe(false)
    expect(n).toContain('Subject: Hej Bcc: wszyscy@x.pl')
    expect(n.some((l) => l.startsWith('In-Reply-To'))).toBe(false)
  })

  it('załączniki: multipart/mixed, bajty bez zmian, polska nazwa w filename*, bezpieczny typ', () => {
    const bajty = Uint8Array.from([0, 255, 1, 128, 10, 13])
    const raw = zbudujMail(
      {
        ...MAIL,
        stopka: '',
        pliki: [
          { nazwa: 'Umowa „Sponsor” O\'Neil.pdf', typ: 'application/pdf', dane: bajty },
          { nazwa: 'x.bin', typ: 'zły typ\r\nX: y', dane: Uint8Array.from([1]) },
        ],
      },
      'GRANICA',
    )
    expect(naglowki(raw)).toContain('Content-Type: multipart/mixed; boundary="GRANICA"')
    const czesci = raw.split('--GRANICA')
    expect(czesci).toHaveLength(5)
    expect(czesci[4]).toBe('--\r\n')
    expect(zBase64(czesci[1].split('\r\n\r\n')[1]).toString('utf8')).toBe('Dzień dobry,\r\ndziękujemy za ofertę.')
    const [n1, c1] = czesci[2].split('\r\n\r\n')
    expect(n1).toContain('Content-Type: application/pdf; name="Umowa _Sponsor_ O\'Neil.pdf"')
    expect(n1).toContain(`filename*=UTF-8''Umowa%20%E2%80%9ESponsor%E2%80%9D%20O%27Neil.pdf`)
    expect([...zBase64(c1)]).toEqual([...bajty])
    expect(czesci[3]).toContain('Content-Type: application/octet-stream; name="x.bin"')
  })

  it('czysty ASCII bez kodowania; długi polski temat w kilku słowach po 75 znaków', () => {
    expect(slowoNaglowka('Re: Spotkanie')).toBe('Re: Spotkanie')
    const s = slowoNaglowka('Zażółć gęślą jaźń 🎉 '.repeat(5))
    const slowa = s.split('\r\n ')
    expect(slowa.length).toBeGreaterThan(1)
    expect(slowa.every((w) => w.length <= 75)).toBe(true)
    expect(dekodujNaglowek(s)).toBe('Zażółć gęślą jaźń 🎉 '.repeat(5))
  })
})
