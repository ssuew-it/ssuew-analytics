'use client'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useFilters } from '@/lib/useFilters'
import { applyFilters } from '@/lib/filters'
import { useAuth } from '@/lib/auth/useAuth'
import { survivalCurve, analyzeRetention } from '@/lib/stats'
import { chartTheme, axisTick, tooltipStyle, liczbaPl } from '@/lib/chartTheme'
import { BentoCard } from '@/components/ui/BentoCard'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import { formatNumber } from '@/lib/format'
import { linkWpisu } from '@/lib/wpis'

export default function RetencjaClient() {
  const { kohorty, loading } = useAnalyticsData()
  const { filters } = useFilters()
  const { rola } = useAuth()

  if (loading) return <ModuleSkeleton variant="retencja" />

  const koh = applyFilters(kohorty, filters)
  const editable = rola === 'owner'
  const sortedKoh = [...koh].sort((a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1))
  const reg = analyzeRetention(koh)


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
      <BentoCard
        title="Kohorty"
        sub={editable ? 'dane wpisujesz i poprawiasz w jednym miejscu - w „Wpisz dane”' : 'tylko do odczytu'}
        span={4}
        action={editable ? <Link href={linkWpisu('kohorta')} className="text-[11px] text-deck-accent hover:underline">+ dodaj kohortę</Link> : undefined}
      >
        <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-deck-muted text-left">
              <th className="p-1 font-medium">Edycja</th>
              <th className="p-1 text-right font-medium">Liczebność</th>
              <th className="p-1 text-right font-medium" title="średnia liczba semestrów aktywności">Średnio sem.</th>
              <th className="p-1 text-right font-medium" title="najdłuższa aktywność w kohorcie">Najdłużej</th>
              <th className="p-1 text-center font-medium">w toku</th>
              {editable && <th className="p-1"><span className="sr-only">Popraw</span></th>}
            </tr>
          </thead>
          <tbody className="text-deck-text">
            {sortedKoh.map((k) => (
              <tr key={k.id} className="border-t border-deck-border">
                <td className="p-1">{k.edycja}</td>
                <td className="p-1 text-right tabular">{k.n_czlonkow}</td>
                <td className="p-1 text-right tabular">{formatNumber(k.avg_retention_sem, 2)}</td>
                <td className="p-1 text-right tabular">{k.max_retention_sem}</td>
                <td className={`p-1 text-center text-[10px] ${k.in_progress ? 'text-deck-warn' : 'text-deck-muted'}`}>{k.in_progress ? 'tak' : 'nie'}</td>
                {editable && (
                  <td className="p-1 text-right">
                    <Link href={linkWpisu('kohorta', k.edycja)} className="text-[10.5px] text-deck-muted hover:text-deck-accent">popraw</Link>
                  </td>
                )}
              </tr>
            ))}
            {sortedKoh.length === 0 && (
              <tr><td colSpan={editable ? 6 : 5} className="p-2 text-deck-muted text-center">Brak kohort.</td></tr>
            )}
          </tbody>
        </table>
        </div>
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
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${liczbaPl(v)}%`} />
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
