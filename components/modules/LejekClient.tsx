'use client'
import { useState } from 'react'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useFilters } from '@/lib/useFilters'
import { applyFilters } from '@/lib/filters'
import { buildFunnel } from '@/lib/stats'
import { BentoCard } from '@/components/ui/BentoCard'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import { Slider } from '@/components/ui/Slider'

export default function LejekClient() {
  const { rekrutacje, kohorty, loading } = useAnalyticsData()
  const { filters } = useFilters()
  const [perEdycja, setPerEdycja] = useState(false)
  const [edycja, setEdycja] = useState<string>('')
  const [threshold, setThreshold] = useState(2)

  if (loading) return <ModuleSkeleton variant="lejek" />

  const rekr = applyFilters(rekrutacje, filters)
  const koh = applyFilters(kohorty, filters)
  const maxThreshold = Math.max(1, ...koh.map((k) => Math.round(k.max_retention_sem)))
  const chosen = perEdycja && edycja ? edycja : undefined
  const funnel = buildFunnel(rekr, koh, { edycja: chosen, threshold })

  // największy spadek między kolejnymi etapami
  let worstIdx = -1
  let worstDrop = -1
  for (let i = 1; i < funnel.length; i++) {
    const prev = funnel[i - 1].count
    const drop = prev > 0 ? (prev - funnel[i].count) / prev : 0
    if (drop > worstDrop) {
      worstDrop = drop
      worstIdx = i
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => setPerEdycja(false)}
            className={`text-[11px] px-3 py-1 rounded-md border ${!perEdycja ? 'bg-deck-accent/10 text-deck-accent border-deck-accent/40' : 'text-deck-muted border-deck-border'}`}
          >
            Zagregowany
          </button>
          <button
            onClick={() => setPerEdycja(true)}
            className={`text-[11px] px-3 py-1 rounded-md border ${perEdycja ? 'bg-deck-accent/10 text-deck-accent border-deck-accent/40' : 'text-deck-muted border-deck-border'}`}
          >
            Jedna edycja
          </button>
        </div>
        {perEdycja && (
          <select
            value={edycja}
            onChange={(e) => setEdycja(e.target.value)}
            className="bg-deck-panel border border-deck-border text-deck-muted text-[11px] rounded-md px-2 py-1"
          >
            <option value="">Wybierz edycję…</option>
            {rekr.map((r) => (
              <option key={r.id} value={r.edycja}>{r.edycja}</option>
            ))}
          </select>
        )}
        <Slider label="Próg utrzymania (sem.)" min={1} max={maxThreshold} value={threshold} onChange={setThreshold} />
      </div>

      <BentoCard title="Lejek rekrutacyjny" sub={perEdycja && edycja ? `edycja ${edycja}` : 'wszystkie edycje (po filtrach)'} span={4}>
        <div className="space-y-2">
          {funnel.map((s, i) => (
            <div key={s.stage} className="flex items-center gap-3">
              <span className="text-[11px] text-deck-muted w-40 shrink-0">{s.stage}</span>
              <div className="flex-1 bg-deck-bg rounded h-6 relative overflow-hidden border border-deck-border">
                <div
                  className={`h-full ${i === worstIdx ? 'bg-deck-warn/55' : 'bg-deck-accent/50'}`}
                  style={{ width: `${s.pct}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-[11px] text-deck-text tabular-nums">
                  {s.count} · {s.pct}%{i === worstIdx && <span className="ml-2 text-deck-warn">· największy ubytek</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
        {worstIdx > 0 && (
          <p className="text-[11px] text-deck-warn mt-3">
            Największy spadek: {funnel[worstIdx - 1].stage} → {funnel[worstIdx].stage}
            {' '}(−{Math.round(worstDrop * 100)}%)
          </p>
        )}
      </BentoCard>
    </div>
  )
}
