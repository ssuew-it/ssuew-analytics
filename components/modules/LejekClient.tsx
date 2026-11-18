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

  // Edycja bez kohorty nie ma jeszcze danych o aktywnych - zero udawałoby ubytek.
  const zKohorta = new Set(koh.map((k) => k.edycja))
  const bezKohorty = rekr.filter((r) => !zKohorta.has(r.edycja)).length
  const wgEdycji = [...rekr]
    .sort((a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1))
    .map((r) => {
      const etapy = buildFunnel(rekr, koh, { edycja: r.edycja, threshold })
      const znane = zKohorta.has(r.edycja) ? etapy.length : 2
      let najgorszy = -1
      let ubytek = -1
      for (let i = 1; i < znane; i++) {
        const d = etapy[i - 1].count > 0 ? (etapy[i - 1].count - etapy[i].count) / etapy[i - 1].count : 0
        if (d > ubytek) {
          ubytek = d
          najgorszy = i
        }
      }
      return { edycja: r.edycja, etapy, najgorszy, znane }
    })

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
                  {s.count} · {String(s.pct).replace('.', ',')}%{i === worstIdx && <span className="ml-2 text-deck-warn">· największy ubytek</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
        {bezKohorty > 0 && !chosen && (
          <p className="mt-3 text-[11px] text-deck-muted">
            {bezKohorty} z {rekr.length} edycji nie ma jeszcze kohorty - aktywni i utrzymani liczą się tylko z pozostałych, więc lejek zbiorczy zaniża te etapy.
          </p>
        )}
        {worstIdx > 0 && (
          <p className="text-[11px] text-deck-warn mt-3">
            Największy spadek: {funnel[worstIdx - 1].stage} → {funnel[worstIdx].stage}
            {' '}(−{Math.round(worstDrop * 100)}%)
          </p>
        )}
      </BentoCard>

      {/* Sam lejek zbiorczy zostawiał pół ekranu pustego - a pytanie zwykle brzmi:
          która edycja gubi ludzi i na którym etapie. */}
      {wgEdycji.length > 1 && (
        <BentoCard title="Lejek w kolejnych edycjach" sub="ile osób zostaje na każdym etapie, w % zgłoszeń" span={4}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="text-left text-deck-muted">
                  <th className="p-1 font-medium">Edycja</th>
                  {funnel.map((f) => (
                    <th key={f.stage} className="p-1 text-right font-medium">{f.stage}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-deck-text">
                {wgEdycji.map(({ edycja: e, etapy, najgorszy, znane }) => (
                  <tr key={e} className="border-t border-deck-border">
                    <td className="p-1">{e}</td>
                    {etapy.map((f, i) =>
                      i < znane ? (
                        <td key={f.stage} className={`p-1 text-right tabular ${i === najgorszy ? 'text-deck-warn' : ''}`}>
                          {f.count}
                          {i > 0 && <span className="ml-1 text-deck-muted">({String(f.pct).replace('.', ',')}%)</span>}
                        </td>
                      ) : (
                        <td key={f.stage} className="p-1 text-right text-deck-muted" title="brak kohorty dla tej edycji">-</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10.5px] text-deck-muted">
            Na złoto etap z największym ubytkiem w danej edycji. „-” to edycja bez wpisanej kohorty - aktywnych jeszcze nie policzono.
          </p>
        </BentoCard>
      )}
    </div>
  )
}
