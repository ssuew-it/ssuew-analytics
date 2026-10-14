// @vitest-environment node
// TextDecoder z ISO-8859-2 i atob - jak na serwerze.
import { describe, it, expect } from 'vitest'
import { dekodujNaglowek, odczytajAdresy, odczytajWatek, type WatekApi } from '@/lib/skrzynka/naglowki'
import { drugaStrona, organizacjaZEmaila, typKontaktu, kontaktZAdresu } from '@/lib/skrzynka/kontakty'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'

describe('dekodujNaglowek', () => {
  it('RFC 2047: base64 UTF-8, quoted-printable ISO-8859-2, sąsiednie słowa i zwykły tekst', () => {
    expect(dekodujNaglowek('=?UTF-8?B?WmFwcm9zemVuaWUgbmEgSnV3ZW5hbGlh?=')).toBe('Zaproszenie na Juwenalia')
    expect(dekodujNaglowek('=?ISO-8859-2?Q?Wsp=F3=B3praca?=')).toBe('Współpraca')
    expect(dekodujNaglowek('=?utf-8?B?V3Nww7PFgnByYWNhIHogU2Ftb3J6xIVkZW0=?=')).toBe('Współpraca z Samorządem')
    expect(dekodujNaglowek('=?UTF-8?Q?Ala?= =?UTF-8?Q?_ma_kota?=')).toBe('Ala ma kota')
    expect(dekodujNaglowek('Zwykły temat')).toBe('Zwykły temat')
  })
})

describe('odczytajAdresy', () => {
  it('przecinek w cudzysłowie, kilku odbiorców, sam adres, wielkość liter', () => {
    expect(odczytajAdresy('"Kowalska, Anna" <Anna@Firma.pl>, jan@uew.pl, Zarząd <zarzad@ssuew.pl>')).toEqual([
      { email: 'anna@firma.pl', imie: 'Kowalska, Anna' },
      { email: 'jan@uew.pl', imie: '' },
      { email: 'zarzad@ssuew.pl', imie: 'Zarząd' },
    ])
    expect(odczytajAdresy('')).toEqual([])
    expect(odczytajAdresy('undisclosed-recipients:;')).toEqual([])
  })
})

function surowy(wiadomosci: { od: string; kiedy: number; do?: string; etykiety?: string[]; naglowki?: Record<string, string> }[]): WatekApi {
  return {
    id: 't1',
    messages: wiadomosci.map((w, i) => ({
      id: `m${i}`,
      internalDate: String(w.kiedy),
      labelIds: w.etykiety ?? ['INBOX'],
      snippet: 'Dzień dobry, piszę w sprawie &quot;Juwenaliów&quot; &amp; sponsoringu',
      payload: {
        headers: [
          { name: 'From', value: w.od },
          { name: 'To', value: w.do ?? NASZ },
          { name: 'Subject', value: 'Sponsoring' },
          ...Object.entries(w.naglowki ?? {}).map(([name, value]) => ({ name, value })),
        ],
      },
    })),
  }
}

describe('odczytajWatek', () => {
  it('sortuje od najstarszej, pomija szkice, spam i kosz, dekoduje fragment', () => {
    const w = odczytajWatek(surowy([
      { od: NASZ, kiedy: 300, etykiety: ['SENT'] },
      { od: 'Anna <anna@firma.pl>', kiedy: 100 },
      { od: NASZ, kiedy: 400, etykiety: ['DRAFT'] },
      { od: 'x@spam.pl', kiedy: 200, etykiety: ['SPAM'] },
    ]))
    expect(w.wiadomosci.map((m) => m.kiedy)).toEqual([100, 300])
    expect(w.wiadomosci[0].od).toEqual({ email: 'anna@firma.pl', imie: 'Anna' })
    expect(w.wiadomosci[0].temat).toBe('Sponsoring')
    expect(w.wiadomosci[0].fragment).toBe('Dzień dobry, piszę w sprawie "Juwenaliów" & sponsoringu')
  })

  it('List-Unsubscribe albo Precedence: bulk - poczta masowa', () => {
    expect(odczytajWatek(surowy([{ od: 'news@sklep.pl', kiedy: 1, naglowki: { 'List-Unsubscribe': '<mailto:x@sklep.pl>' } }])).wiadomosci[0].masowa).toBe(true)
    expect(odczytajWatek(surowy([{ od: 'news@sklep.pl', kiedy: 1, naglowki: { Precedence: 'Bulk' } }])).wiadomosci[0].masowa).toBe(true)
    expect(odczytajWatek(surowy([{ od: 'anna@firma.pl', kiedy: 1 }])).wiadomosci[0].masowa).toBe(false)
  })

  it('wątek bez wiadomości', () => {
    expect(odczytajWatek({ id: 't2' }).wiadomosci).toEqual([])
  })
})

describe('kontakty', () => {
  it('organizacja z domeny: prywatna, student, uczelnia, firma', () => {
    expect(organizacjaZEmaila('ktos@gmail.com')).toBeNull()
    expect(organizacjaZEmaila('ktos@wp.pl')).toBeNull()
    expect(organizacjaZEmaila('123456@student.ue.wroc.pl')).toBeNull()
    expect(organizacjaZEmaila('dziekan@ue.wroc.pl')).toEqual({ domena: 'ue.wroc.pl', nazwa: 'Uniwersytet Ekonomiczny', typ: 'uczelnia' })
    expect(organizacjaZEmaila('anna@Firma.pl')).toEqual({ domena: 'firma.pl', nazwa: 'firma.pl', typ: 'inne' })
    expect(typKontaktu('123456@student.ue.wroc.pl')).toBe('student')
    expect(typKontaktu('anna@firma.pl')).toBeNull()
  })

  it('druga strona: pierwszy adres w wątku inny niż nasz', () => {
    const odNas = odczytajWatek(surowy([{ od: NASZ, kiedy: 1, do: 'Anna <anna@firma.pl>, jan@firma.pl' }]))
    expect(drugaStrona(odNas, NASZ)).toEqual({ email: 'anna@firma.pl', imie: 'Anna' })
    const doNas = odczytajWatek(surowy([{ od: 'Jan <jan@firma.pl>', kiedy: 1 }]))
    expect(drugaStrona(doNas, NASZ.toUpperCase())).toEqual({ email: 'jan@firma.pl', imie: 'Jan' })
    const doSiebie = odczytajWatek(surowy([{ od: NASZ, kiedy: 1, do: NASZ }]))
    expect(drugaStrona(doSiebie, NASZ)).toBeNull()
  })

  it('kontakt z adresu', () => {
    expect(kontaktZAdresu({ email: '123@student.ue.wroc.pl', imie: 'Ola' })).toEqual({ email: '123@student.ue.wroc.pl', imie: 'Ola', organizacja: null, typ: 'student' })
    expect(kontaktZAdresu({ email: 'anna@firma.pl', imie: '' })).toEqual({ email: 'anna@firma.pl', imie: '', organizacja: 'firma.pl', typ: null })
  })
})
