'use client'
import { useState } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useFilters } from '@/lib/useFilters'
import { applyFilters } from '@/lib/filters'
import { correlationMatrix } from '@/lib/stats'
import { chartTheme, axisTick, tooltipStyle } from '@/lib/chartTheme'
import { BentoCard } from '@/components/ui/BentoCard'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import { Heatmap } from '@/components/ui/Heatmap'

const MAIN_VARS = ['zgłoszenia', 'przyjęci', 'konwersja %', 'liczebność', 'średnia retencja', 'najdłuższa retencja']

export default function KorelacjeClient() {
  const { rekrutacje, kohorty, loading } = useAnalyticsData()
  const { filters } = useFilters()
  const [pair, setPair] = useState<{ a: string; b: string } | null>(null)

  if (loading) return <ModuleSkeleton />

  const rekr = applyFilters(rekrutacje, filters)
  const kohByEd = new Map(applyFilters(kohorty, filters).map((k) => [k.edycja, k]))

  const mainRows: Record<string, number | null>[] = rekr.map((r) => {
    const k = kohByEd.get(r.edycja)
    return {
      'zgłoszenia': r.zgloszenia,
      'przyjęci': r.przyjeci,
      'konwersja %': r.zgloszenia > 0 ? (r.przyjeci / r.zgloszenia) * 100 : null,
      'liczebność': k?.n_czlonkow ?? null,
      'średnia retencja': k?.avg_retention_sem ?? null,
      'najdłuższa retencja': k?.max_retention_sem ?? null,
    }
  })
  const mainCells = correlationMatrix(mainRows, MAIN_VARS)

  const scatterData =
    pair && pair.a !== pair.b
      ? mainRows
          .filter((row) => row[pair.a] != null && row[pair.b] != null)
          .map((row) => ({ x: row[pair.a] as number, y: row[pair.b] as number }))
      : []

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-deck-muted border border-deck-border rounded-md px-2 py-1 inline-block">
        Korelacje per edycja (rekrutacje × retencja). KPI rok-do-roku ma inną ziarnistość i nie wchodzi do macierzy.
      </div>

      <BentoCard title="Macierz korelacji - rekrutacje × retencja" sub="kliknij komórkę, by zobaczyć wykres rozrzutu" span={4}>
        <Heatmap vars={MAIN_VARS} cells={mainCells} onSelect={(a, b) => setPair({ a, b })} />
      </BentoCard>

      {pair && pair.a !== pair.b && (
        <BentoCard title={`Rozrzut: ${pair.a} ↔ ${pair.b}`} span={2}>
          {scatterData.length >= 3 ? (
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis type="number" dataKey="x" name={pair.a} tick={axisTick} />
                <YAxis type="number" dataKey="y" name={pair.b} tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={scatterData} fill={chartTheme.accent} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[11px] text-deck-muted">Za mało wspólnych obserwacji dla tej pary.</p>
          )}
        </BentoCard>
      )}
    </div>
  )
}
