'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Gauge, Sparkles } from 'lucide-react'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useFilters } from '@/lib/useFilters'
import { applyFilters } from '@/lib/filters'
import { computeOverview } from '@/lib/overview'
import { buildExecutiveInsights, buildStrategicKpis, kpiSummary } from '@/lib/stats'
import { ilorazSerii } from '@/lib/kpi/serie'
import { zmianaRr } from '@/lib/format'
import { chartTheme, axisTick, tooltipStyle, liczbaPl } from '@/lib/chartTheme'
import { KpiTile } from '@/components/ui/KpiTile'
import { BentoCard } from '@/components/ui/BentoCard'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { InsightCard } from '@/components/ui/InsightCard'

export default function OverviewClient() {
  const { rekrutacje, kohorty, serie, loading } = useAnalyticsData()
  const { filters } = useFilters()

  if (loading) return <ModuleSkeleton variant="overview" />

  const rekr = applyFilters(rekrutacje, filters)
  const koh = applyFilters(kohorty, filters)
  const m = computeOverview(rekr, koh, [])
  const summary = kpiSummary(serie)
  const strategic = buildStrategicKpis(rekr, koh, serie)
  const insights = buildExecutiveInsights(rekr, koh, serie)
  const health = strategic[0]

  // ilorazSerii daje 0 tam, gdzie zmiany nie da się policzyć - takie serie
  // wypadają, zamiast lądować na dnie zestawienia jako fałszywe spadki.
  const movers = serie
    .filter((s) => ilorazSerii(s) > 0)
    .sort((a, b) => ilorazSerii(b) - ilorazSerii(a))
  const top = movers.slice(0, 3)
  const bottom = movers.slice(-3).reverse()

  const barData = [...rekr]
    .sort((a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1))
    .map((row) => ({ edycja: row.edycja, zgłoszenia: row.zgloszenia, przyjęci: row.przyjeci }))

  return (
    <div className="space-y-4">
      <BentoCard span={4} className="p-0">
        <div className="grid min-h-[260px] grid-cols-1 md:grid-cols-[1.15fr_0.85fr] overflow-hidden rounded-lg">
          <div className="p-6">
            <div className="inline-flex items-center gap-2 rounded-lg border border-deck-accent/30 bg-deck-accent/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-deck-accent">
              <Sparkles size={13} />
              Na żywo z arkusza
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-normal text-deck-text">
              Kondycja organizacji w jednym, żywym kokpicie.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-deck-muted">
              Rekrutacja, retencja i KPI rok-do-roku składają się tu w jeden obraz decyzji zarządczych.
            </p>
            <div className="mt-6 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-3">
              {strategic.slice(1, 4).map((kpi) => (
                <div key={kpi.id} className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
                  <div className="text-[10px] text-deck-muted">{kpi.title}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-deck-text">{kpi.value}</div>
                  <div className="mt-2 h-1 rounded-full bg-deck-bg-deep/70">
                    <div className="h-full rounded-full bg-deck-accent" style={{ width: `${kpi.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative flex flex-col gap-5 border-t border-white/10 bg-deck-bg-deep/55 p-6 md:border-l md:border-t-0">
            <div className="absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-deck-accent/70 to-transparent" />
            <div className="grid flex-1 place-items-center pt-4">
              <div className="relative grid h-44 w-44 place-items-center rounded-full border border-deck-accent/30 bg-deck-accent/8">
                <div className="absolute inset-4 rounded-full border border-white/10" />
                <div className="text-center">
                  {/* Ikona w przepływie, nie absolute - wcześniej leżała na napisie „Kondycja”. */}
                  <Gauge size={26} className="mx-auto mb-1 text-deck-accent" />
                  <div className="text-[10px] uppercase tracking-[0.18em] text-deck-muted">Kondycja</div>
                  <div className="mt-2 text-5xl font-semibold tabular-nums text-deck-accent">{health.value}</div>
                  <div className="mt-1 text-[10px] text-deck-muted">
                    {/* Poziom wyniku, nie trend - „stabilny wzrost” przy 74/100 nic nie mówił o wzroście. */}
                    {health.trend === 'up' ? 'dobra kondycja' : health.trend === 'down' ? 'słaba kondycja' : 'przeciętna kondycja'}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 text-[11px] leading-5">
              <p className="text-deck-muted">{health.recommendation}</p>
              {/* Bez tego kondycja „dobra” obok odprawy z zagrożeniami wyglądała na sprzeczność. */}
              <p className="text-deck-muted/70">
                Liczona z rekrutacji, retencji i KPI rok do roku. Odprawa w kokpicie patrzy szerzej - także na Planer, Skrzynkę i Strony.
              </p>
            </div>
          </div>
        </div>
      </BentoCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Konwersja - średnia edycji"
          value={m.avgConversion != null ? <AnimatedNumber value={m.avgConversion} decimals={1} suffix="%" /> : '-'}
          sub="wszystkie edycje w filtrze"
          accent="accent"
        />
        <KpiTile
          label="Retencja hist."
          value={m.histRetention != null ? <AnimatedNumber value={m.histRetention} decimals={2} suffix=" sem" /> : '-'}
          sub="ukończone kohorty"
          accent="violet"
        />
        <KpiTile
          label={`Przyjęci ${m.lastEdycja ?? ''}`.trim()}
          value={m.lastAccepted != null ? <AnimatedNumber value={m.lastAccepted} /> : '-'}
          sub={
            m.lastApplications != null && m.lastAccepted != null
              ? `z ${m.lastApplications} zgłoszeń · ${m.lastApplications > 0 ? ((m.lastAccepted / m.lastApplications) * 100).toFixed(1).replace('.', ',') : '0,0'}% konwersji`
              : ''
          }
        />
        <KpiTile
          label="KPI rosnące r/r"
          value={`${summary.up}/${summary.up + summary.down}`}
          sub={`typowa zmiana ${zmianaRr(summary.typowyIloraz)} r/r`}
          accent="accent"
        />
      </div>

      <BentoCard title="Najważniejsze wnioski" sub="automatyczna lista działań na podstawie danych" span={4}>
        {insights.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {insights.slice(0, 3).map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-deck-muted">Brak pilnych wniosków przy obecnych filtrach.</p>
        )}
      </BentoCard>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <BentoCard title="Zgłoszenia i przyjęci" sub="trend historyczny" span={2}>
          {barData.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={barData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="edycja" tick={axisTick} />
                <YAxis tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} formatter={liczbaPl} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="zgłoszenia" fill={chartTheme.series[2]} radius={[5, 5, 0, 0]} />
                <Bar dataKey="przyjęci" fill={chartTheme.accent} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[11px] text-deck-muted">Brak edycji dla wybranych filtrów.</p>
          )}
        </BentoCard>

        <BentoCard title="KPI - zmiany rok-do-roku" sub="największe wzrosty i spadki" span={2}>
          {movers.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                {top.map((s) => (
                  <div key={`${s.kategoria}|${s.nazwa}`} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px]">
                    <span className="truncate text-deck-muted">{s.kategoria}: {s.nazwa}</span>
                    <span className="inline-flex items-center gap-1 tabular text-deck-accent">
                      <ArrowUpRight size={13} />
                      {Math.round((ilorazSerii(s) - 1) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {bottom.map((s) => (
                  <div key={`${s.kategoria}|${s.nazwa}`} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px]">
                    <span className="truncate text-deck-muted">{s.kategoria}: {s.nazwa}</span>
                    <span className="inline-flex items-center gap-1 tabular text-deck-danger">
                      <ArrowDownRight size={13} />
                      {Math.round((ilorazSerii(s) - 1) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-deck-muted">Brak metryk KPI.</p>
          )}
        </BentoCard>
      </div>
    </div>
  )
}
