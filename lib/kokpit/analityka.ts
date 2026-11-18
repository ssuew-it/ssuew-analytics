import type { DaneArkusza } from '@/lib/asystent/dane'
import { serieZWierszy } from '@/lib/kpi/serie'
import { computeOverview } from '@/lib/overview'
import { buildAlerts, kpiSummary } from '@/lib/stats'

/** Liczby kafelka „SSUEW Analytics” w kokpicie. */
export interface DaneAnalityki {
  /** Konwersja OSTATNIEJ edycji (przyjęci / zgłoszenia) - Analityka pokazuje też średnią wszystkich edycji. */
  konwersja: number
  /** Edycja, z której jest konwersja, np. „J'26”. */
  edycja: string | null
  retencja: number
  kpiWzrosty: number
  /** Serie KPI, w których da się policzyć zmianę r/r - mianownik „wzrostów”, jak w Analityce. */
  kpiPorownywalne: number
  /** Wszystkie metryki KPI (pasek stanu). */
  kpiRazem: number
  alerty: number
  czasArkuszaMs: number | null
}

export function naAnalityke(a: DaneArkusza): DaneAnalityki {
  const serie = serieZWierszy(a.punkty)
  // Trzeci argument to KpiPeriod[], którego aplikacja nie pobiera - tak samo
  // wywołuje to OverviewClient.
  const m = computeOverview(a.rekrutacje, a.kohorty, [])
  const kpi = kpiSummary(serie)
  const konwersja =
    m.lastApplications && m.lastApplications > 0 && m.lastAccepted != null ? (m.lastAccepted / m.lastApplications) * 100 : 0
  return {
    konwersja,
    edycja: m.lastEdycja,
    retencja: m.histRetention ?? 0,
    kpiWzrosty: kpi.up,
    kpiPorownywalne: kpi.up + kpi.down,
    kpiRazem: serie.filter((s) => s.punkty.length > 0).length,
    alerty: buildAlerts(a.rekrutacje, a.kohorty, serie).length,
    czasArkuszaMs: a.czasMs,
  }
}
