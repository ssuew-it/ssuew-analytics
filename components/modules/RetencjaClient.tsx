'use client'
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useFilters } from '@/lib/useFilters'
import { applyFilters } from '@/lib/filters'
import { useAuth } from '@/lib/auth/useAuth'
import { survivalCurve, analyzeRetention } from '@/lib/stats'
import { chartTheme, axisTick, tooltipStyle } from '@/lib/chartTheme'
import { BentoCard } from '@/components/ui/BentoCard'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import { EditableCell } from '@/components/ui/EditableCell'
import type { Kohorta } from '@/types'

const inp = 'bg-deck-bg border border-deck-border rounded-md px-2 py-1 text-[11px] text-deck-text'

export default function RetencjaClient() {
  const { kohorty, loading, addKohorta } = useAnalyticsData()
  const { filters } = useFilters()
  const [nowa, setNowa] = useState({ edycja: '', sezon: 'jesien' as 'jesien' | 'wiosna', rok: new Date().getFullYear(), n: '', avg: '', max: '', inProgress: false })
  const [err, setErr] = useState<string | null>(null)
  const { rola } = useAuth()

  if (loading) return <ModuleSkeleton variant="retencja" />

  const koh = applyFilters(kohorty, filters)
  const editable = rola === 'owner'
  const sortedKoh = [...koh].sort((a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1))
  const reg = analyzeRetention(koh)

  const saveKoh = (k: Kohorta, patch: Partial<Pick<Kohorta, 'n_czlonkow' | 'avg_retention_sem' | 'max_retention_sem' | 'in_progress'>>) => {
    addKohorta({ edycja: k.edycja, sezon: k.sezon, rok: k.rok, n_czlonkow: k.n_czlonkow, avg_retention_sem: k.avg_retention_sem, max_retention_sem: k.max_retention_sem, in_progress: k.in_progress, ...patch }).catch((e) => setErr(String(e)))
  }
  const addNewKoh = () => {
    setErr(null)
    if (!nowa.edycja || !nowa.n || !nowa.avg || !nowa.max) return
    addKohorta({ edycja: nowa.edycja, sezon: nowa.sezon, rok: nowa.rok, n_czlonkow: parseInt(nowa.n), avg_retention_sem: parseFloat(nowa.avg), max_retention_sem: parseInt(nowa.max), in_progress: nowa.inProgress })
      .then(() => setNowa({ edycja: '', sezon: 'jesien', rok: new Date().getFullYear(), n: '', avg: '', max: '', inProgress: false }))
      .catch((e) => setErr(String(e)))
  }

  // Krzywa per kohorta: realny pomiar (survival) gdy jest, inaczej aproksymacja.
  const pct = (k: typeof koh[number], s: number): number | null => {
    if (k.survival) return s < k.survival.length ? k.survival[s] : null
    const pt = survivalCurve(k.avg_retention_sem, k.max_retention_sem).find((p) => p.sem === s)
    return pt ? pt.pct : null
  }
  const curveLen = (k: typeof koh[number]) => (k.survival ? k.survival.length - 1 : Math.round(k.max_retention_sem))
  const maxSem = Math.max(0, ...koh.map(curveLen))
  const data: Record<string, number | string>[] = []
  for (let s = 0; s <= maxSem; s++) {
    const row: Record<string, number | string> = { sem: s }
    for (const k of koh) {
      const v = pct(k, s)
      if (v != null) row[k.edycja] = v
    }
    data.push(row)
  }
  const allMeasured = koh.length > 0 && koh.every((k) => k.survival)

  return (
    <div className="space-y-3">
      <BentoCard title="Kohorty" sub={editable ? 'kliknij wartość, by edytować · dodaj kohortę poniżej (autosave)' : 'tryb demo - read-only'} span={4}>
        <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-deck-muted text-left">
              <th className="p-1 font-medium">Edycja</th>
              <th className="p-1 text-right font-medium">Liczebność</th>
              <th className="p-1 text-right font-medium">Avg ret.</th>
              <th className="p-1 text-right font-medium">Max</th>
              <th className="p-1 text-center font-medium">w toku</th>
            </tr>
          </thead>
          <tbody className="text-deck-text">
            {sortedKoh.map((k) => (
              <tr key={k.id} className="border-t border-deck-border">
                <td className="p-1">{k.edycja}</td>
                <td className="p-1 text-right"><EditableCell value={k.n_czlonkow} editable={editable} onCommit={(v) => saveKoh(k, { n_czlonkow: v })} /></td>
                <td className="p-1 text-right"><EditableCell value={k.avg_retention_sem} decimals={2} editable={editable} onCommit={(v) => saveKoh(k, { avg_retention_sem: v })} /></td>
                <td className="p-1 text-right"><EditableCell value={k.max_retention_sem} editable={editable} onCommit={(v) => saveKoh(k, { max_retention_sem: v })} /></td>
                <td className="p-1 text-center">
                  <button disabled={!editable} onClick={() => saveKoh(k, { in_progress: !k.in_progress })} className={`text-[10px] px-2 py-0.5 rounded ${k.in_progress ? 'text-deck-warn border border-deck-warn/40' : 'text-deck-muted border border-deck-border'} disabled:opacity-60`}>
                    {k.in_progress ? 'tak' : 'nie'}
                  </button>
                </td>
              </tr>
            ))}
            {sortedKoh.length === 0 && (
              <tr><td colSpan={5} className="p-2 text-deck-muted text-center">Brak kohort{editable ? ' - dodaj pierwszą poniżej.' : '.'}</td></tr>
            )}
          </tbody>
        </table>
        </div>
        {editable && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <input className={`w-16 ${inp}`} placeholder="W'26" value={nowa.edycja} onChange={(e) => setNowa((p) => ({ ...p, edycja: e.target.value }))} />
            <select className={inp} value={nowa.sezon} onChange={(e) => setNowa((p) => ({ ...p, sezon: e.target.value as 'jesien' | 'wiosna' }))}>
              <option value="jesien">jesień</option>
              <option value="wiosna">wiosna</option>
            </select>
            <input type="number" className={`w-16 ${inp}`} placeholder="rok" value={nowa.rok} onChange={(e) => setNowa((p) => ({ ...p, rok: parseInt(e.target.value) }))} />
            <input type="number" className={`w-20 ${inp}`} placeholder="liczebność" value={nowa.n} onChange={(e) => setNowa((p) => ({ ...p, n: e.target.value }))} />
            <input type="number" step="0.01" className={`w-20 ${inp}`} placeholder="avg ret." value={nowa.avg} onChange={(e) => setNowa((p) => ({ ...p, avg: e.target.value }))} />
            <input type="number" className={`w-16 ${inp}`} placeholder="max" value={nowa.max} onChange={(e) => setNowa((p) => ({ ...p, max: e.target.value }))} />
            <label className="flex items-center gap-1 text-[10px] text-deck-muted"><input type="checkbox" checked={nowa.inProgress} onChange={(e) => setNowa((p) => ({ ...p, inProgress: e.target.checked }))} /> w toku</label>
            <button onClick={addNewKoh} disabled={!nowa.edycja || !nowa.n || !nowa.avg || !nowa.max} className="text-[11px] px-3 py-1 rounded-md border border-deck-accent/40 text-deck-accent disabled:opacity-40">+ dodaj kohortę</button>
          </div>
        )}
        {err && <p className="text-[11px] text-deck-danger mt-2">{err}</p>}
      </BentoCard>

      <div className={`text-[11px] border rounded-md px-2 py-1 inline-block ${allMeasured ? 'text-deck-accent border-deck-accent/40' : 'text-deck-warn border-deck-warn/40'}`}>
        {allMeasured
          ? 'Pomiar z danych per-osoba (% aktywnych po t semestrach)'
          : 'Część krzywych to szacunek (model wykładniczy) - brak pomiaru per semestr'}
      </div>

      <BentoCard title="Krzywe przeżycia kohort" sub="% aktywnych w kolejnych semestrach" span={4}>
        {koh.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="sem" tick={axisTick} label={{ value: 'semestr', position: 'insideBottom', offset: -2, fontSize: 10, fill: chartTheme.axis }} />
              <YAxis tick={axisTick} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {koh.map((k, i) => (
                <Line
                  key={k.edycja}
                  type="monotone"
                  dataKey={k.edycja}
                  stroke={chartTheme.series[i % chartTheme.series.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[11px] text-deck-muted">Brak kohort dla wybranych filtrów.</p>
        )}
      </BentoCard>

      <BentoCard title="Model regresji (OLS)" sub="trend, sezon, liczebność → retencja" span={4}>
        {reg.coefficients.length ? (
          <div className="space-y-2">
            {reg.coefficients.map((c) => (
              <div key={c.name} className="text-[11px]">
                <span className="text-deck-text">{c.name}: </span>
                <span className="tabular-nums text-deck-accent">β = {c.beta.toFixed(3).replace('.', ',')}</span>
                <span className="text-deck-muted"> - {c.interpretation}</span>
              </div>
            ))}
            <div className="text-[11px] text-deck-muted">
              R² = {(reg.r2 * 100).toFixed(0)}% · prognoza następnej edycji: {reg.prediction} sem.
            </div>
            {reg.warning && <div className="text-[11px] text-deck-warn">{reg.warning}</div>}
          </div>
        ) : (
          <p className="text-[11px] text-deck-muted">{reg.warning ?? 'Brak danych.'}</p>
        )}
      </BentoCard>
    </div>
  )
}
