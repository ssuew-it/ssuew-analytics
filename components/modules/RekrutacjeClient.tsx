'use client'
import { formatNumber } from '@/lib/format'
import Link from 'next/link'
import { ComposedChart, Bar, Line, Area, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useFilters } from '@/lib/useFilters'
import { applyFilters } from '@/lib/filters'
import { useAuth } from '@/lib/auth/useAuth'
import { analyzeRekrutacje, mean, prognozaPrzyjetych } from '@/lib/stats'
import { chartTheme, axisTick, tooltipStyle, liczbaPl } from '@/lib/chartTheme'
import { BentoCard } from '@/components/ui/BentoCard'
import { KpiTile } from '@/components/ui/KpiTile'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import { linkWpisu } from '@/lib/wpis'

export default function RekrutacjeClient() {
  const { rekrutacje, loading } = useAnalyticsData()
  const { filters } = useFilters()

  const { rola } = useAuth()

  if (loading) return <ModuleSkeleton variant="rekrutacje" />

  const rekr = applyFilters(rekrutacje, filters)
  const sorted = [...rekr].sort((a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1))
  const editable = rola === 'owner'


  const s = rekr.length >= 2 ? analyzeRekrutacje(rekr) : null
  const fc = s ? prognozaPrzyjetych(rekr, 2) : []
  const avgCR = s ? Math.round(mean(s.cr) * 10) / 10 : 0
  const lastIdx = s ? s.przyj.length - 1 : 0
  const trendData = s ? s.sorted.map((r, i) => ({ edycja: r.edycja, zgłoszenia: s.zglos[i], przyjęci: s.przyj[i], 'konwersja %': s.cr[i] })) : []
  const scatterData = s ? s.sorted.map((r, i) => ({ x: s.zglos[i], y: s.przyj[i], label: r.edycja })) : []
  const fcData: Record<string, number | string | number[]>[] = s
    ? [
        ...s.sorted.map((r, i) => ({ label: r.edycja, hist: s.przyj[i] })),
        ...fc.map((p) => ({ label: p.edycja, yhat: p.yhat, band: [p.lo, p.hi] as number[] })),
      ]
    : []

  return (
    <div className="space-y-3">
      <BentoCard
        title="Edycje rekrutacji"
        sub={editable ? 'dane wpisujesz i poprawiasz w jednym miejscu - w „Wpisz dane”' : 'tylko do odczytu'}
        span={4}
        action={editable ? <Link href={linkWpisu('rekrutacja')} className="text-[11px] text-deck-accent hover:underline">+ dodaj edycję</Link> : undefined}
      >
        <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-deck-muted text-left">
              <th className="p-1 font-medium">Edycja</th>
              <th className="p-1 text-right font-medium">Zgłoszenia</th>
              <th className="p-1 text-right font-medium">Przyjęci</th>
              <th className="p-1 text-right font-medium">Konwersja</th>
              {editable && <th className="p-1"><span className="sr-only">Popraw</span></th>}
            </tr>
          </thead>
          <tbody className="text-deck-text">
            {sorted.map((r) => {
              const cr = r.zgloszenia > 0 ? ((r.przyjeci / r.zgloszenia) * 100).toFixed(1).replace('.', ',') : '-'
              return (
                <tr key={r.id} className="border-t border-deck-border">
                  <td className="p-1">{r.edycja}</td>
                  <td className="p-1 text-right tabular">{r.zgloszenia}</td>
                  <td className="p-1 text-right tabular">{r.przyjeci}</td>
                  <td className="p-1 text-right text-deck-muted tabular">{cr}%</td>
                  {editable && (
                    <td className="p-1 text-right">
                      <Link href={linkWpisu('rekrutacja', r.edycja)} className="text-[10.5px] text-deck-muted hover:text-deck-accent">popraw</Link>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </BentoCard>

      {s ? (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiTile label={`Przyjęci ${s.sorted[lastIdx].edycja}`} value={s.przyj[lastIdx]} sub={`z ${s.zglos[lastIdx]} zgłoszeń`} />
            <KpiTile label="Średnia konwersja" value={`${formatNumber(avgCR, 1)}%`} sub="wszystkie edycje" accent="accent" />
            {fc[0] ? (
              <KpiTile label={`Prognoza ${fc[0].edycja}`} value={`~${Math.round(fc[0].yhat)}`} sub={`±${Math.round(fc[0].hi - fc[0].yhat)} · z edycji tego sezonu`} accent="violet" />
            ) : (
              <KpiTile label="Prognoza następnej" value="-" sub="za mało edycji w sezonie" accent="violet" />
            )}
            <KpiTile label="Zgłoszenia a przyjęci" value={s.corZglosAccepted.r.toFixed(3).replace('.', ',')} sub={`korelacja r · R² = ${(s.corZglosAccepted.r2 * 100).toFixed(0)}%`} />
          </div>

          <BentoCard title="Zgłoszenia, przyjęci i konwersja" sub="trend w kolejnych edycjach" span={4}>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={trendData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="edycja" tick={axisTick} />
                <YAxis yAxisId="l" tick={axisTick} />
                <YAxis yAxisId="r" orientation="right" tick={axisTick} tickFormatter={(v) => `${v}%`} domain={[0, 120]} />
                <Tooltip contentStyle={tooltipStyle} formatter={liczbaPl} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="zgłoszenia" fill={chartTheme.series[2]} radius={[3, 3, 0, 0]} />
                <Bar yAxisId="l" dataKey="przyjęci" fill={chartTheme.accent} radius={[3, 3, 0, 0]} />
                <Line yAxisId="r" dataKey="konwersja %" stroke={chartTheme.violet} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </BentoCard>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BentoCard
              title="Korelacja zgłoszenia ↔ przyjęci"
              sub={`r = ${s.corZglosAccepted.r.toFixed(3).replace('.', ',')} · R² = ${(s.corZglosAccepted.r2 * 100).toFixed(0)}% · p ${s.corZglosAccepted.p_approx}`}
            >
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis type="number" dataKey="x" name="zgłoszenia" tick={axisTick} />
                  <YAxis type="number" dataKey="y" name="przyjęci" tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} formatter={liczbaPl} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={scatterData} fill={chartTheme.accent} />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-deck-muted mt-2">{s.corZglosAccepted.interpretation}</p>
            </BentoCard>

            <BentoCard
              title="Sezonowość - test t Welcha"
              sub={`t = ${s.sezonowosc.tStat.toFixed(2).replace('.', ',')} · df ≈ ${formatNumber(s.sezonowosc.df, 1)} · p ${s.sezonowosc.p_approx}`}
            >
              <div className="flex gap-3 mb-2">
                <div className="flex-1 bg-deck-bg border border-deck-border rounded-lg p-2 text-center">
                  <div className="text-[10px] text-deck-muted">Jesień - średnia</div>
                  <div className="text-lg font-semibold tabular text-deck-accent">{s.sezonowosc.meanA.toFixed(1).replace('.', ',')}</div>
                  <div className="text-[9px] text-deck-muted">SD {s.sezonowosc.sdA.toFixed(1).replace('.', ',')}</div>
                </div>
                <div className="flex-1 bg-deck-bg border border-deck-border rounded-lg p-2 text-center">
                  <div className="text-[10px] text-deck-muted">Wiosna - średnia</div>
                  <div className="text-lg font-semibold tabular text-deck-violet">{s.sezonowosc.meanB.toFixed(1).replace('.', ',')}</div>
                  <div className="text-[9px] text-deck-muted">SD {s.sezonowosc.sdB.toFixed(1).replace('.', ',')}</div>
                </div>
              </div>
              <p className="text-[11px] text-deck-muted">{s.sezonowosc.interpretation}</p>
            </BentoCard>
          </div>

          <BentoCard title="Prognoza przyjętych" sub="historia + 2 edycje z pasem niepewności" span={4}>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={fcData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="label" tick={axisTick} />
                <YAxis tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} formatter={liczbaPl} />
                <Area dataKey="band" stroke="none" fill={chartTheme.accent} fillOpacity={0.15} />
                <Line dataKey="hist" stroke={chartTheme.accent} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line dataKey="yhat" stroke={chartTheme.accent} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </BentoCard>
        </>
      ) : (
        <p className="text-[11px] text-deck-muted">Dodaj co najmniej 2 edycje, aby zobaczyć analizy (korelacja, sezonowość, prognoza).</p>
      )}
    </div>
  )
}
