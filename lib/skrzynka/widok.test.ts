import { describe, it, expect } from 'vitest'
import { adresZalacznika, kiedyKrotko, linkGmail, rozmiar } from '@/lib/skrzynka/widok'

// Środa 14.10.2026, 12:00 w Warszawie.
const TERAZ = Date.UTC(2026, 9, 14, 10)

describe('widok', () => {
  it('kiedyKrotko: dziś godzina, wczoraj, ten rok, inny rok', () => {
    expect(kiedyKrotko(Date.UTC(2026, 9, 14, 7, 5), TERAZ)).toBe('09:05')
    expect(kiedyKrotko(Date.UTC(2026, 9, 13, 20), TERAZ)).toBe('wczoraj')
    expect(kiedyKrotko(Date.UTC(2026, 8, 2, 10), TERAZ)).toBe('02.09')
    expect(kiedyKrotko(Date.UTC(2025, 11, 30, 10), TERAZ)).toBe('30.12.2025')
  })

  it('link do Gmaila na koncie kontakt@', () => {
    expect(linkGmail('kontakt@samorzad.ue.wroc.pl', '18f2a')).toBe('https://mail.google.com/mail/?authuser=kontakt%40samorzad.ue.wroc.pl#all/18f2a')
  })

  it('adres załącznika koduje identyfikatory i nazwę', () => {
    expect(adresZalacznika('t1', { id: 'A/B', wiadomoscId: 'm1', nazwa: 'Oferta 2026.pdf', typ: 'application/pdf', rozmiar: 1 }))
      .toBe('/api/skrzynka/sprawy/t1/zalacznik/A%2FB?w=m1&nazwa=Oferta+2026.pdf&typ=application%2Fpdf')
  })

  it('rozmiar pliku', () => {
    expect(rozmiar(300)).toBe('1 KB')
    expect(rozmiar(120_000)).toBe('117 KB')
    expect(rozmiar(3_400_000)).toBe('3,2 MB')
  })
})
