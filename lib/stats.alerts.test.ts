import { describe, it, expect } from 'vitest'
import { buildAlerts } from '@/lib/stats'
import type { Kohorta, SeriaKpi } from '@/types'

function seria(nazwa: string, wartosci: number[], kategoria = 'SKS'): SeriaKpi {
  return {
    kategoria,
    nazwa,
    punkty: wartosci.map((v, i) => ({
      id: `${nazwa}-${i}`, okres: `${2020 + i}/${2021 + i}`, wartosc: v,
    })),
  }
}
function koh(edycja: string, sezon: 'jesien' | 'wiosna', rok: number, avg: number): Kohorta {
  return { id: edycja, edycja, sezon, rok, n_czlonkow: 20, avg_retention_sem: avg, max_retention_sem: 8, in_progress: false, created_at: '' }
}

describe('buildAlerts', () => {
  it('puste dane → brak alertów', () => {
    expect(buildAlerts([], [], [])).toEqual([])
  })

  it('metryka KPI z dużym spadkiem r/r → alert krytyczny z linkiem /kpi', () => {
    const alerts = buildAlerts([], [], [seria('Gala', [100, 30], 'Wydarzenia')]) // ratio 0.3 < 0.6
    const crit = alerts.find((a) => a.severity === 'critical')
    expect(crit).toBeTruthy()
    expect(crit!.href).toBe('/analytics/kpi')
  })

  it('opis alertu podaje zmianę, nie iloraz: 47 → 28 to -40%, nie „60%”', () => {
    const [a] = buildAlerts([], [], [seria('Gala', [47, 28], 'Wydarzenia')])
    expect(a.detail).toBe('47 → 28 (-40% r/r)')
  })

  it('umiarkowany spadek (ratio 0.7) → warning', () => {
    const alerts = buildAlerts([], [], [seria('Luty', [100, 70])])
    expect(alerts.some((a) => a.severity === 'warning' && a.href === '/analytics/kpi')).toBe(true)
  })

  it('wzrost r/r → brak alertu KPI', () => {
    expect(buildAlerts([], [], [seria('Listopad', [57, 84])])).toEqual([])
  })

  it('seria ze spadkiem daje jeden alert, nie po jednym na rok', () => {
    const alerts = buildAlerts([], [], [seria('Wigilia', [10, 8, 4])])
    expect(alerts.filter((a) => a.id.startsWith('kpi-'))).toHaveLength(1)
  })

  it('liczy spadek z końca serii, nie z jej początku', () => {
    // Spadek 10 → 4 jest wcześniej, ale ostatnia zmiana 4 → 9 to wzrost.
    expect(buildAlerts([], [], [seria('Odbicie', [10, 4, 9])])).toEqual([])
  })

  it('spadek o jedną-dwie sztuki to szum, nie alert: Koordynatorzy ME 2 → 1', () => {
    expect(buildAlerts([], [], [seria('ME', [2, 1], 'Koordynatorzy'), seria('RJ', [5, 3])])).toEqual([])
  })

  it('mała baza daje najwyżej ostrzeżenie, nie krytyczny', () => {
    const [a] = buildAlerts([], [], [seria('Bal', [8, 3])]) // -63%, ale z 8
    expect(a.severity).toBe('warning')
  })

  it('seria jednopunktowa nie daje alertu', () => {
    const alerts = buildAlerts([], [], [seria('Nowa', [3])])
    expect(alerts.filter((a) => a.id.startsWith('kpi-'))).toHaveLength(0)
  })

  it('spadkowy trend retencji → ostrzeżenie z linkiem /retencja', () => {
    const cohorts = [koh("W'22", 'wiosna', 2022, 4.4), koh("J'24", 'jesien', 2024, 2.1)]
    expect(buildAlerts([], cohorts, []).some((a) => a.href === '/analytics/retencja')).toBe(true)
  })

  it('sortuje critical przed warning', () => {
    const metrics = [seria('Gala', [100, 30], 'Wydarzenia')]
    const cohorts = [koh("W'22", 'wiosna', 2022, 4.4), koh("J'24", 'jesien', 2024, 2.1)]
    const sev = buildAlerts([], cohorts, metrics).map((a) => a.severity)
    expect(sev.lastIndexOf('critical')).toBeLessThan(sev.indexOf('warning'))
  })
})
