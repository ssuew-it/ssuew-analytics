import { describe, it, expect } from 'vitest'
import { prognozaPrzyjetych, prognozaRetencji } from '@/lib/stats'
import { DEMO_KOHORTY, DEMO_REKRUTACJE } from '@/lib/useAnalyticsData'
import type { Kohorta, Rekrutacja } from '@/types'

const r = (edycja: string, sezon: 'jesien' | 'wiosna', rok: number, przyjeci: number): Rekrutacja =>
  ({ id: edycja, edycja, sezon, rok, zgloszenia: 100, przyjeci, created_at: '' })

describe('prognozaPrzyjetych', () => {
  it('każdą edycję prognozuje z historii jej sezonu i podpisuje nazwą edycji', () => {
    const f = prognozaPrzyjetych([
      r("J'23", 'jesien', 2023, 30), r("W'24", 'wiosna', 2024, 10),
      r("J'24", 'jesien', 2024, 40), r("W'25", 'wiosna', 2025, 12),
      r("J'25", 'jesien', 2025, 50), r("W'26", 'wiosna', 2026, 14),
    ], 2)
    expect(f.map((p) => [p.edycja, p.yhat])).toEqual([["J'26", 60], ["W'27", 16]])
  })

  it('sezon z jedną edycją nie daje prognozy', () => {
    expect(prognozaPrzyjetych([r("J'25", 'jesien', 2025, 50), r("W'26", 'wiosna', 2026, 14)], 2)).toEqual([])
  })

  it('pusta lista - pusta prognoza', () => {
    expect(prognozaPrzyjetych([], 2)).toEqual([])
  })
})

describe('prognozaRetencji', () => {
  it('nie wyskakuje ponad historię - liczebność z tego samego sezonu', () => {
    const p = prognozaRetencji(DEMO_KOHORTY)!
    const hist = DEMO_KOHORTY.filter((k) => !k.in_progress).map((k) => k.avg_retention_sem)
    expect(p.edycja).toBe("W'25")
    expect(p.yhat).toBeGreaterThan(0)
    expect(p.yhat).toBeLessThanOrEqual(Math.max(...hist))
  })

  it('za mało kohort - brak prognozy', () => {
    expect(prognozaRetencji(DEMO_KOHORTY.slice(0, 3) as Kohorta[])).toBeNull()
  })
})

it('dane demo nie zmieniają kolejności sezonów', () => {
  expect(prognozaPrzyjetych(DEMO_REKRUTACJE, 2).map((p) => p.edycja)).toEqual(["J'26", "W'27"])
})
