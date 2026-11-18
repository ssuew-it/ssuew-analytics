import { describe, it, expect } from 'vitest'
import { kpiSummary } from '@/lib/stats'
import type { SeriaKpi } from '@/types'

function seria(nazwa: string, wartosci: number[], kategoria = 'SKS'): SeriaKpi {
  return {
    kategoria,
    nazwa,
    punkty: wartosci.map((v, i) => ({
      id: `${nazwa}-${i}`, okres: `${2020 + i}/${2021 + i}`, wartosc: v,
    })),
  }
}

describe('kpiSummary', () => {
  it('liczy rosnące i spadające z dwóch ostatnich punktów', () => {
    const s = kpiSummary([seria('a', [1, 2]), seria('b', [4, 2]), seria('c', [3, 3])])
    expect(s.up).toBe(1)
    expect(s.down).toBe(1)
  })

  it('pomija serie, których nie da się policzyć', () => {
    const s = kpiSummary([seria('a', [5]), seria('b', [0, 9])])
    expect(s.up).toBe(0)
    expect(s.down).toBe(0)
    expect(s.typowyIloraz).toBe(0)
  })

  it('bierze pod uwagę tylko koniec długiej serii', () => {
    const s = kpiSummary([seria('a', [100, 50, 10, 20])])
    expect(s.up).toBe(1)
    expect(s.typowyIloraz).toBe(2)
  })

  it('średnia liczy się tylko z serii policzalnych', () => {
    const s = kpiSummary([seria('a', [2, 4]), seria('b', [7])])
    expect(s.typowyIloraz).toBe(2)
  })

  it('jeden skok nie ciągnie wyniku - mediana, nie średnia', () => {
    // ilorazy 0,5 · 1 · 1 · 5: średnia 1,88 („+88%”), mediana 1 („0%”)
    const s = kpiSummary([
      seria('a', [4, 2]), seria('b', [3, 3]), seria('c', [6, 6]), seria('gala', [1, 5]),
    ])
    expect(s.typowyIloraz).toBe(1)
  })

  it('przy nieparzystej liczbie serii bierze środkową', () => {
    const s = kpiSummary([seria('a', [10, 9]), seria('b', [10, 12]), seria('c', [1, 7])])
    expect(s.typowyIloraz).toBe(1.2)
  })

  it('pusta lista nie wywala się', () => {
    expect(kpiSummary([])).toEqual({ up: 0, down: 0, typowyIloraz: 0 })
  })
})
