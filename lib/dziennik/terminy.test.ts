import { describe, it, expect } from 'vitest'
import { najblizszyTermin, najblizsze, poczatekPrzygotowan } from '@/lib/dziennik/terminy'
import type { Adnotacja, WpisCyklu } from '@/lib/dziennik/typy'

const d = (rok: number, miesiac: number, dzien: number) => ({ rok, miesiac, dzien })

function cykl(id: string, miesiac: number, dzien: number | null, wyprzedzenieTygodni: number, obowiazkowe: boolean, adnotacje: Adnotacja[] = []): WpisCyklu {
  return {
    id, dzial: 'cykl', kadencjaId: 'k1', tytul: id, tresc: '', utworzono: 0, zmieniono: 0, adnotacje,
    miesiac, dzien, wyprzedzenieTygodni, obowiazkowe, rozlicza: obowiazkowe ? ['KR'] : [],
  }
}

const zamknieta: Adnotacja = { id: 'a', kadencjaId: 'k2', stan: 'zamkniete', celId: null, stanCelu: null, komentarz: '', kiedy: 1 }

describe('najblizszyTermin', () => {
  it('termin w przyszłym roku, gdy w tym już minął', () => expect(najblizszyTermin({ miesiac: 3, dzien: 15 }, d(2026, 11, 19))).toEqual(d(2027, 3, 15)))
  it('termin dziś to dziś', () => expect(najblizszyTermin({ miesiac: 11, dzien: 19 }, d(2026, 11, 19))).toEqual(d(2026, 11, 19)))
  it('termin wczoraj przeskakuje na następny rok', () => expect(najblizszyTermin({ miesiac: 11, dzien: 18 }, d(2026, 11, 19))).toEqual(d(2027, 11, 18)))
  it('dzien null = ostatni dzień miesiąca', () => expect(najblizszyTermin({ miesiac: 2, dzien: null }, d(2027, 1, 1))).toEqual(d(2027, 2, 28)))
  it('31 w lutym = ostatni dzień lutego w roku przestępnym', () => expect(najblizszyTermin({ miesiac: 2, dzien: 31 }, d(2028, 1, 1))).toEqual(d(2028, 2, 29)))
  it('29 lutego w roku nieprzestępnym = 28', () => expect(najblizszyTermin({ miesiac: 2, dzien: 29 }, d(2026, 12, 1))).toEqual(d(2027, 2, 28)))
  it('dzien null w bieżącym miesiącu jeszcze trwa', () => expect(najblizszyTermin({ miesiac: 11, dzien: null }, d(2026, 11, 19))).toEqual(d(2026, 11, 30)))
})

describe('poczatekPrzygotowan', () => {
  it('2 tygodnie przed terminem', () => expect(poczatekPrzygotowan(d(2027, 3, 15), 2)).toEqual(d(2027, 3, 1)))
  it('0 tygodni = dzień terminu', () => expect(poczatekPrzygotowan(d(2027, 3, 15), 0)).toEqual(d(2027, 3, 15)))
})

describe('najblizsze', () => {
  it('okno przez przełom roku: kolejność po terminie, obowiązkowe pierwsze, poza oknem i zamknięte pominięte', () => {
    const A = cykl('A', 1, 10, 2, false)
    const B = cykl('B', 12, 31, 0, false)
    const C = cykl('C', 12, 31, 0, true)
    const D = cykl('D', 3, 15, 0, true)
    const E = cykl('E', 12, 25, 0, true, [zamknieta])
    expect(najblizsze([A, B, C, D, E], d(2026, 12, 20)).map((p) => p.wpis.id)).toEqual(['C', 'B', 'A'])
  })

  it('okno przygotowań zaczęte przed oknem 30 dni też się liczy, z flagą trwa', () => {
    const [p] = najblizsze([cykl('X', 12, 25, 2, true)], d(2026, 12, 20))
    expect(p.termin).toEqual(d(2026, 12, 25))
    expect(p.od).toEqual(d(2026, 12, 11))
    expect(p.trwa).toBe(true)
  })

  it('przygotowania zaczynające się w oknie, ale termin po nim - na liście, trwa false', () => {
    const [p] = najblizsze([cykl('Y', 1, 30, 4, false)], d(2026, 12, 20))
    expect(p.od).toEqual(d(2027, 1, 2))
    expect(p.trwa).toBe(false)
  })

  it('pomija wpisy innych działów', () => {
    const luka = { ...cykl('L', 12, 21, 0, true), dzial: 'luka', ileCzasu: '' } as unknown as WpisCyklu
    expect(najblizsze([luka], d(2026, 12, 20))).toEqual([])
  })
})
