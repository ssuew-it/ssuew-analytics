import { describe, it, expect } from 'vitest'
import type { DaneArkusza } from '@/lib/asystent/dane'
import type { Kohorta, KpiMetric, Rekrutacja } from '@/types'
import { naAnalityke } from './analityka'

const R = (edycja: string, rok: number, sezon: 'jesien' | 'wiosna', zgloszenia: number, przyjeci: number): Rekrutacja =>
  ({ id: edycja, edycja, rok, sezon, zgloszenia, przyjeci, created_at: '' })
const K = (edycja: string, avg: number, in_progress = false): Kohorta =>
  ({ id: edycja, edycja, sezon: 'jesien', rok: 2024, n_czlonkow: 10, avg_retention_sem: avg, max_retention_sem: 5, in_progress, created_at: '' })
const P = (nazwa: string, okres: string, wartosc: number): KpiMetric =>
  ({ id: `${nazwa}${okres}`, kategoria: 'SKS', nazwa, okres, wartosc, created_at: '' })

const ARKUSZ: DaneArkusza = {
  rekrutacje: [R("J'25", 2025, 'jesien', 138, 45), R("W'26", 2026, 'wiosna', 18, 11), R("J'26", 2026, 'jesien', 183, 44)],
  kohorty: [K("J'22", 4.24), K("J'23", 3.38), K("W'25", 1.8, true)],
  punkty: [
    P('Gala', '2024/2025', 1), P('Gala', '2025/2026', 5),
    P('ME', '2024/2025', 2), P('ME', '2025/2026', 1),
    P('Wigilia', '2024/2025', 3), P('Wigilia', '2025/2026', 3),
    P('Nowa', '2025/2026', 7),
  ],
  projekty: [],
  czlonkowie: [],
  czasMs: 30,
}

describe('naAnalityke (kafelek kokpitu)', () => {
  it('konwersja ostatniej edycji razem z jej nazwą - żeby nie mylić ze średnią w Analityce', () => {
    const a = naAnalityke(ARKUSZ)
    expect(a.edycja).toBe("J'26")
    expect(a.konwersja).toBeCloseTo((44 / 183) * 100, 5)
  })

  it('retencja - średnia ukończonych kohort, jak w Analityce', () => {
    expect(naAnalityke(ARKUSZ).retencja).toBeCloseTo(3.81, 2)
  })

  it('KPI r/r jak w Analityce: wzrosty na tle serii, w których jest zmiana; liczba wszystkich metryk osobno', () => {
    const a = naAnalityke(ARKUSZ)
    expect(a.kpiWzrosty).toBe(1)
    expect(a.kpiPorownywalne).toBe(2)
    expect(a.kpiRazem).toBe(4)
  })
})
