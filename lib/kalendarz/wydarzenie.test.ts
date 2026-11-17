import { describe, it, expect } from 'vitest'
import { POLA_DOMYSLNE, type Wydarzenie } from '@/lib/planer/typy'
import { DO_KALENDARZA, naWydarzenieGoogle } from './wydarzenie'

const W = (n: Partial<Wydarzenie> = {}): Wydarzenie => ({
  ...POLA_DOMYSLNE,
  id: 'w1', tytul: 'Komisja Dydaktyczna', kategoria: 'KOMISJE',
  rok: 2026, miesiac: 11, dzien: 21, godzina: '18:00', godzinaDo: '20:00',
  budynek: 'B/L', sala: '110L', osoby: ['Jula'],
  ...n,
})

describe('naWydarzenieGoogle', () => {
  it('godziny od-do, miejsce jak w Planerze, znacznik, bez osób', () => {
    const wynik = naWydarzenieGoogle(W(), '2026Z')
    expect(wynik.summary).toBe('Komisja Dydaktyczna')
    expect(wynik.start).toEqual({ dateTime: '2026-11-21T18:00:00', timeZone: 'Europe/Warsaw' })
    expect(wynik.end).toEqual({ dateTime: '2026-11-21T20:00:00', timeZone: 'Europe/Warsaw' })
    expect(wynik.location).toBe('B/L 110L')
    expect(wynik.extendedProperties.private).toEqual({ deck: '1', deckId: 'w1', deckSemestr: '2026Z' })
    expect(JSON.stringify(wynik)).not.toContain('Jula')
  })

  it('przez północ - koniec następnego dnia', () => {
    const wynik = naWydarzenieGoogle(W({ godzina: '18:00', godzinaDo: '04:00' }), '2026Z')
    expect(wynik.end).toEqual({ dateTime: '2026-11-22T04:00:00', timeZone: 'Europe/Warsaw' })
  })

  it('sama godzina startu - godzina trwania', () => {
    expect(naWydarzenieGoogle(W({ godzinaDo: null }), '2026Z').end)
      .toEqual({ dateTime: '2026-11-21T19:00:00', timeZone: 'Europe/Warsaw' })
    expect(naWydarzenieGoogle(W({ godzina: '23:30', godzinaDo: null }), '2026Z').end)
      .toEqual({ dateTime: '2026-11-22T00:30:00', timeZone: 'Europe/Warsaw' })
  })

  it('cały dzień i wielodniowe', () => {
    const caly = naWydarzenieGoogle(W({ calyDzien: true, dni: 3 }), '2026Z')
    expect(caly.start).toEqual({ date: '2026-11-21' })
    expect(caly.end).toEqual({ date: '2026-11-24' })
    const dwa = naWydarzenieGoogle(W({ dni: 2, godzina: '10:00', godzinaDo: '14:00' }), '2026Z')
    expect(dwa.start).toEqual({ dateTime: '2026-11-21T10:00:00', timeZone: 'Europe/Warsaw' })
    expect(dwa.end).toEqual({ dateTime: '2026-11-22T14:00:00', timeZone: 'Europe/Warsaw' })
  })

  it('godzina nieustalona - całodniowe z dopiskiem', () => {
    const wynik = naWydarzenieGoogle(W({ calyDzien: false, godzina: null, godzinaDo: null }), '2026Z')
    expect(wynik.start).toEqual({ date: '2026-11-21' })
    expect(wynik.end).toEqual({ date: '2026-11-22' })
    expect(wynik.summary).toBe('Komisja Dydaktyczna (godzina do ustalenia)')
  })

  it('bez miejsca - bez pola location', () => {
    const wynik = naWydarzenieGoogle(W({ budynek: null, sala: null }), '2026Z')
    expect('location' in wynik).toBe(false)
  })

  it('kategorie do kalendarza', () => {
    expect([...DO_KALENDARZA].sort()).toEqual(['KOMISJE', 'PROJEKTY', 'SSUEW', 'UE'])
  })
})
