'use client'
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useFilters } from '@/lib/useFilters'
import { applyFilters } from '@/lib/filters'
import { linearForecast, retentionModel } from '@/lib/stats'
import { chartTheme, axisTick, tooltipStyle } from '@/lib/chartTheme'
import { BentoCard } from '@/components/ui/BentoCard'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import Symulator from './Symulator'

export default function PrognozyClient() {
  const { rekrutacje, kohorty, loading } = useAnalyticsData()
  const { filters } = useFilters()
  if (loading) return <ModuleSkeleton variant="rekrutacje" />

  const rekr = applyFilters(rekrutacje, filters)
  const koh = applyFilters(kohorty, filters)

  // Prognoza rekrutacji (przyjęci)
  const sorted = [...rekr].sort((a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1))
  const przyj = sorted.map((r) => r.przyjeci)
  const fc = przyj.length >= 2 ? linearForecast(przyj, 2) : []
  const rekrData: Record<string, number | string | number[]>[] = [
    ...sorted.map((r) => ({ label: r.edycja, hist: r.przyjeci })),
    ...fc.map((p, k) => ({ label: `prog.${k + 1}`, yhat: p.yhat, band: [p.lo, p.hi] as number[] })),
  ]

  // Prognoza retencji
  const model = retentionModel(koh)
  const completed = [...koh]
    .filter((k) => !k.in_progress)
    .sort((a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1))
  let retData: Record<string, number | string | number[]>[] = []
  if (model) {
    const pred = Math.round(model.predict(model.nextEdNr, 1, model.meanNCzl) * 100) / 100
    const sd = model.residualSd
    retData = [
      ...completed.map((k) => ({ label: k.edycja, hist: k.avg_retention_sem })),
      {
        label: 'prog.',
        yhat: pred,
        band: [Math.max(0, Math.round((pred - sd) * 100) / 100), Math.round((pred + sd) * 100) / 100] as number[],
      },
    ]
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-deck-warn border border-deck-warn/40 rounded-md px-2 py-1 inline-block">
        Prognozy orientacyjne - mała próba; pas = przedział predykcji
      </div>

      <div className="grid grid-cols-2 gap-3">
        <BentoCard title="Prognoza rekrutacji" sub="przyjęci - historia + 2 edycje">
          {rekrData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={rekrData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="label" tick={axisTick} />
                <YAxis tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area dataKey="band" stroke="none" fill={chartTheme.accent} fillOpacity={0.15} />
                <Line dataKey="hist" stroke={chartTheme.accent} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line dataKey="yhat" stroke={chartTheme.accent} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[11px] text-deck-muted">Za mało edycji do prognozy.</p>
          )}
        </BentoCard>

        <BentoCard title="Prognoza retencji" sub="średnia retencja - historia i następna edycja">
          {model ? (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={retData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="label" tick={axisTick} />
                <YAxis tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area dataKey="band" stroke="none" fill={chartTheme.violet} fillOpacity={0.15} />
                <Line dataKey="hist" stroke={chartTheme.violet} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line dataKey="yhat" stroke={chartTheme.violet} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[11px] text-deck-muted">Za mało ukończonych kohort (≥4) do modelu.</p>
          )}
        </BentoCard>
      </div>

      <Symulator rekrutacje={rekr} kohorty={koh} />
    </div>
  )
}
