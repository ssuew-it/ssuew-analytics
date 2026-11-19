import { describe, it, expect } from 'vitest'
import { escapujHtml, ksiegaNaHtml } from '@/lib/dziennik/eksport'
import type { Ksiega, Wpis } from '@/lib/dziennik/typy'

const baza = { kadencjaId: 'k1', tresc: '', utworzono: 1, zmieniono: 1, adnotacje: [] }
const ksiega = (wpisy: Wpis[]): Ksiega => ({
  otwartaKadencjaId: 'k2',
  kadencje: [
    { id: 'k1', nazwa: '2025/26', autor: 'Jan K.', funkcja: 'Wiceprzewodniczący', otwarta: Date.UTC(2025, 9, 1), zamknieta: Date.UTC(2026, 5, 30), kopia: null },
    { id: 'k2', nazwa: '2026/27', autor: 'Anna W.', funkcja: null, otwarta: Date.UTC(2026, 6, 1), zamknieta: null, kopia: null },
  ],
  wpisy,
})
const dzis = { rok: 2026, miesiac: 11, dzien: 19 }

describe('escapujHtml', () => {
  it('escapuje znaki specjalne', () => expect(escapujHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'))
})

describe('ksiegaNaHtml', () => {
  it('pełny dokument z tytułem i datą stanu, bez długich myślników', () => {
    const html = ksiegaNaHtml(ksiega([]), dzis)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain('<title>Dziennik Stratega - stan na 19.11.2026</title>')
    expect(html).toContain('2025/26')
    expect(html).toContain('Jan K.')
    expect(html).not.toMatch(/[—–]/)
  })

  it('escapuje treść i zamienia adresy na linki, bez wykonywalnego kodu', () => {
    const html = ksiegaNaHtml(ksiega([{
      ...baza, id: 'w', dzial: 'luka', ileCzasu: 'semestr',
      tytul: '<script>alert(1)</script>', tresc: 'A & "B" https://drive.google.com/x?a=1&b=2',
    }]), dzis)
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('A &amp; &quot;B&quot;')
    expect(html).toContain('<a href="https://drive.google.com/x?a=1&amp;b=2">https://drive.google.com/x?a=1&amp;b=2</a>')
  })

  it('działy w kolejności zakładek, adnotacja z nazwą kadencji, nie id', () => {
    const html = ksiegaNaHtml(ksiega([
      { ...baza, id: 'p', dzial: 'przemyslenie', tytul: 'O ludziach' },
      { ...baza, id: 'c', dzial: 'cykl', tytul: 'Sprawozdanie', miesiac: 3, dzien: 15, wyprzedzenieTygodni: 2, obowiazkowe: true, rozlicza: ['KR', 'RUSS'] },
      { ...baza, id: 'l', dzial: 'luka', tytul: 'Archiwum', ileCzasu: 'semestr',
        adnotacje: [{ id: 'a', kadencjaId: 'k2', stan: 'przejmuje', celId: null, stanCelu: null, komentarz: 'od marca', kiedy: 2 }] },
    ]), dzis)
    const kolejnosc = ['Kalendarz pracy', 'Luki', 'Wątki w toku', 'Pole do innowacji', 'Strategie', 'Przemyślenia'].map((n) => html.indexOf(`<h2>${n}</h2>`))
    expect(kolejnosc.every((i) => i > 0)).toBe(true)
    expect([...kolejnosc].sort((a, b) => a - b)).toEqual(kolejnosc)
    expect(html).toContain('OBOWIĄZKOWE')
    expect(html).toContain('KR · RUSS')
    expect(html).toContain('15 marca')
    expect(html).toMatch(/2026\/27[^<]*Anna W\.[^<]*: przejmuję/)
    expect(html).toContain('od marca')
  })

  it('strategia: link, okres, status, uchwała i cele ze stanem', () => {
    const html = ksiegaNaHtml(ksiega([{
      ...baza, id: 's', dzial: 'strategia', tytul: 'Strategia Cyfryzacji', link: 'https://docs.google.com/s', okresOd: 2026, okresDo: 2027,
      status: 'przyjeta', uchwala: 'Uchwała 12/2026', cele: [{ id: 'c1', tresc: 'Nowe konta' }, { id: 'c2', tresc: 'Archiwum' }],
      adnotacje: [{ id: 'a', kadencjaId: 'k2', stan: null, celId: 'c1', stanCelu: 'zrealizowany', komentarz: '', kiedy: 3 }],
    }]), dzis)
    expect(html).toContain('<a href="https://docs.google.com/s">')
    expect(html).toContain('2026-2027')
    expect(html).toContain('przyjęta')
    expect(html).toContain('Uchwała 12/2026')
    expect(html).toMatch(/Nowe konta[^<]*zrealizowany/)
  })

  it('zamknięte wpisy po otwartych', () => {
    const html = ksiegaNaHtml(ksiega([
      { ...baza, id: 'z', dzial: 'luka', tytul: 'Zamknięta luka', ileCzasu: '', utworzono: 9,
        adnotacje: [{ id: 'a', kadencjaId: 'k2', stan: 'zamkniete', celId: null, stanCelu: null, komentarz: '', kiedy: 3 }] },
      { ...baza, id: 'o', dzial: 'luka', tytul: 'Otwarta luka', ileCzasu: '', utworzono: 1 },
    ]), dzis)
    expect(html.indexOf('Otwarta luka')).toBeLessThan(html.indexOf('Zamknięta luka'))
  })
})
