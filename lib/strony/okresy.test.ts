import { describe, it, expect } from 'vitest'
import { alertSpadku, dataKrotka, dniOkresu, nazwaZWitryny, okresy, opisZmiany, zmiana } from '@/lib/strony/okresy'

describe('okresy', () => {
  it('bieżący kończy się 3 dni przed dziś i ma 28 dni; poprzedni leży tuż przed nim', () => {
    expect(okresy({ rok: 2026, miesiac: 10, dzien: 4 })).toEqual({
      biezacy: { od: '2026-09-04', do: '2026-10-01' },
      poprzedni: { od: '2026-08-07', do: '2026-09-03' },
    })
  })

  it('przez granicę roku', () => {
    expect(okresy({ rok: 2026, miesiac: 1, dzien: 2 }).biezacy).toEqual({ od: '2025-12-03', do: '2025-12-30' })
  })
})

describe('dniOkresu', () => {
  it('wszystkie dni po kolei, z oboma końcami', () => {
    const dni = dniOkresu({ od: '2026-09-04', do: '2026-10-01' })
    expect(dni).toHaveLength(28)
    expect(dni[0]).toBe('2026-09-04')
    expect(dni[26]).toBe('2026-09-30')
    expect(dni[27]).toBe('2026-10-01')
  })
})

describe('zmiana i alert', () => {
  it('zmiana to ułamek; przy zerze w poprzednim okresie null', () => {
    expect(zmiana(150, 100)).toBe(0.5)
    expect(zmiana(50, 100)).toBe(-0.5)
    expect(zmiana(5, 0)).toBeNull()
    expect(zmiana(0, 0)).toBeNull()
  })

  it('alert od 30% spadku i tylko przy co najmniej 50 kliknięciach wcześniej', () => {
    expect(alertSpadku(70, 100)).toBe(true)
    expect(alertSpadku(71, 100)).toBe(false)
    expect(alertSpadku(35, 50)).toBe(true)
    expect(alertSpadku(0, 49)).toBe(false)
    expect(alertSpadku(0, 0)).toBe(false)
  })
})

describe('nazwaZWitryny i dataKrotka', () => {
  it('domena, prefiks URL ze ścieżką i coś nieczytelnego', () => {
    expect(nazwaZWitryny('sc-domain:jwk26.pl')).toBe('jwk26.pl')
    expect(nazwaZWitryny('https://samorzad.ue.wroc.pl/')).toBe('samorzad.ue.wroc.pl')
    expect(nazwaZWitryny('https://www.uew.pl/dni/')).toBe('www.uew.pl/dni')
    expect(nazwaZWitryny('dziwne')).toBe('dziwne')
  })

  it('data DD.MM', () => {
    expect(dataKrotka('2026-10-01')).toBe('01.10')
  })
})

describe('opisZmiany', () => {
  it('kliknięcia i wyświetlenia w procentach', () => {
    expect(opisZmiany('klikniecia', 150, 100)).toEqual({ tekst: '+50%', kierunek: 'gora', dobra: true })
    expect(opisZmiany('wyswietlenia', 50, 100)).toEqual({ tekst: '-50%', kierunek: 'dol', dobra: false })
    expect(opisZmiany('klikniecia', 100, 100)).toEqual({ tekst: '0%', kierunek: 'brak', dobra: null })
  })

  it('bez poprzedniego okresu - „nowe” albo „-”, nigdy NaN ani Infinity', () => {
    expect(opisZmiany('klikniecia', 7, 0)).toEqual({ tekst: 'nowe', kierunek: 'brak', dobra: null })
    expect(opisZmiany('klikniecia', 0, 0)).toEqual({ tekst: '-', kierunek: 'brak', dobra: null })
    expect(opisZmiany('ctr', 0, 0)).toEqual({ tekst: '-', kierunek: 'brak', dobra: null })
    expect(opisZmiany('pozycja', 0, 9.4)).toEqual({ tekst: '-', kierunek: 'brak', dobra: null })
    expect(opisZmiany('pozycja', 8.2, 0)).toEqual({ tekst: '-', kierunek: 'brak', dobra: null })
  })

  it('CTR w punktach procentowych', () => {
    expect(opisZmiany('ctr', 0.054, 0.05)).toEqual({ tekst: '+0,4 p.p.', kierunek: 'gora', dobra: true })
  })

  it('pozycja: mniejsza liczba to lepiej', () => {
    expect(opisZmiany('pozycja', 8.2, 9.4)).toEqual({ tekst: '-1,2', kierunek: 'dol', dobra: true })
    expect(opisZmiany('pozycja', 9.4, 8.2)).toEqual({ tekst: '+1,2', kierunek: 'gora', dobra: false })
  })
})
