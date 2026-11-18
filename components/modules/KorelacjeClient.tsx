'use client'
import { useState } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useFilters } from '@/lib/useFilters'
import { applyFilters } from '@/lib/filters'
import { correlationMatrix } from '@/lib/stats'
import { chartTheme, axisTick, tooltipStyle, liczbaPl } from '@/lib/chartTheme'
import { BentoCard } from '@/components/ui/BentoCard'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import { Heatmap } from '@/components/ui/Heatmap'

const MAIN_VARS = ['zgłoszenia', 'przyjęci', 'konwersja %', 'liczebność', 'średnia retencja', 'najdłuższa retencja']
const REKRUTACJA = ['zgłoszenia', 'przyjęci', 'konwersja %']
const RETENCJA = ['średnia retencja', 'najdłuższa retencja']

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
  // Bez kliknięcia pokazujemy najsilniejszą parę rekrutacja × retencja - prawa
  // połowa nie stoi pusta. Pary w obrębie jednej grupy (przyjęci ↔ liczebność)
  // to prawie ta sama liczba i r = 1 nic nie mówi.
  const najsilniejsza = mainCells
    .filter((c) => REKRUTACJA.includes(c.a) && RETENCJA.includes(c.b) && c.r !== null)
    .sort((x, y) => Math.abs(y.r ?? 0) - Math.abs(x.r ?? 0))[0]
  const para = pair ?? (najsilniejsza ? { a: najsilniejsza.a, b: najsilniejsza.b } : null)
  const rPary = para ? mainCells.find((c) => c.a === para.a && c.b === para.b)?.r ?? null : null
  const edycji = mainRows.length
  const zRetencja = mainRows.filter((r) => r['średnia retencja'] != null).length

  const scatterData =
    para && para.a !== para.b
      ? mainRows
          .filter((row) => row[para.a] != null && row[para.b] != null)
          .map((row) => ({ x: row[para.a] as number, y: row[para.b] as number }))
      : []

  return (
    <div className="space-y-3">
      <p className={`rounded-md border px-3 py-2 text-[11.5px] ${edycji < 10 ? 'border-deck-warn/40 text-deck-warn' : 'border-deck-border text-deck-muted'}`}>
        Jedna edycja = jeden punkt: {edycji} edycji z rekrutacją, z tego {zRetencja} z wpisaną kohortą (tylko te liczą się w parach z retencją).
        {edycji < 10 && ' Przy tak małej próbie korelacja to wskazówka, a nie dowód - jedna nietypowa edycja potrafi ją odwrócić.'}
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <BentoCard title="Macierz korelacji" sub="kliknij komórkę, by zobaczyć rozrzut obok">
        <Heatmap vars={MAIN_VARS} cells={mainCells} onSelect={(a, b) => setPair({ a, b })} />
      </BentoCard>

      {para && para.a !== para.b && (
        <BentoCard
          title={`Rozrzut: ${para.a} ↔ ${para.b}`}
          sub={`${pair ? 'wybrana para' : 'najsilniejszy związek rekrutacji z retencją'}${rPary !== null ? ` · r = ${rPary.toFixed(2).replace('.', ',')}` : ''} · ${scatterData.length} edycji`}
        >
          {scatterData.length >= 3 ? (
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis type="number" dataKey="x" name={para.a} tick={axisTick} />
                <YAxis type="number" dataKey="y" name={para.b} tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} formatter={liczbaPl} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={scatterData} fill={chartTheme.accent} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[11px] text-deck-muted">Za mało wspólnych obserwacji dla tej pary.</p>
          )}
        </BentoCard>
      )}
      </div>
    </div>
  )
}
