'use client'
import { useState } from 'react'
import { Plus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useAuth } from '@/lib/auth/useAuth'
import { buildStrategicKpis, kpiSummary } from '@/lib/stats'
import { ilorazSerii, ostatniPunkt, serieWgKategorii } from '@/lib/kpi/serie'
import { WykresSerii } from '@/components/modules/WykresSerii'
import { BentoCard } from '@/components/ui/BentoCard'
import { KpiTile } from '@/components/ui/KpiTile'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EditableCell } from '@/components/ui/EditableCell'

function ratioColor(ratio: number): string {
  if (ratio >= 1) return 'text-deck-accent'
  if (ratio >= 0.8) return 'text-deck-warn'
  return 'text-deck-danger'
}

function ratioIcon(ratio: number) {
  return ratio >= 1 ? <TrendingUp size={14} /> : <TrendingDown size={14} />
}

const inputClass = 'deck-input rounded-md px-2 py-1 text-[11px]'
const KATEGORIE = ['SKS', 'Wydarzenia', 'Ankieta', 'Koordynatorzy', 'Retencja', 'Pipeline', 'Zaangażowanie', 'Parytet']

export default function KpiClient() {
  const { rekrutacje, kohorty, serie, loading, addKpiMetric, updateKpiMetric } = useAnalyticsData()
  const [nowa, setNowa] = useState({ kategoria: '', nazwa: '', okres: '', wartosc: '' })
  const [err, setErr] = useState<string | null>(null)

  const { rola } = useAuth()

  if (loading) return <ModuleSkeleton variant="kpi" />

  const editable = rola === 'owner'
  // Podpowiadamy okres z najdłuższej serii - bierze się z realnych danych,
  // a nie z przypadkowego pierwszego wiersza arkusza.
  const najdluzsza = serie.reduce<(typeof serie)[number] | null>(
    (a, s) => (!a || s.punkty.length > a.punkty.length ? s : a), null,
  )
  const okresDomyslny = najdluzsza ? ostatniPunkt(najdluzsza)?.okres ?? '' : ''

  const gotowa = Boolean(nowa.kategoria.trim() && nowa.nazwa.trim() && nowa.okres.trim() && nowa.wartosc)

  const addMetric = () => {
    setErr(null)
    if (!gotowa) return
    addKpiMetric({
      kategoria: nowa.kategoria.trim(),
      nazwa: nowa.nazwa.trim(),
      okres: nowa.okres.trim(),
      wartosc: parseFloat(nowa.wartosc),
    })
      // Okres zostaje w polu: wpisując rocznik dodajesz wiele metryk pod rząd
      // i przepisywanie go za każdym razem byłoby karą za korzystanie z formularza.
      .then(() => setNowa({ kategoria: '', nazwa: '', okres: nowa.okres, wartosc: '' }))
      .catch((e) => setErr(String(e)))
  }

  const addForm = editable ? (
    <BentoCard title="Dodaj pomiar" sub="jedna metryka w jednym okresie" span={4}>
      <div className="flex items-center gap-2 flex-wrap">
        <input list="kpi-kat" className={`w-36 ${inputClass}`} placeholder="kategoria" value={nowa.kategoria} onChange={(e) => setNowa((p) => ({ ...p, kategoria: e.target.value }))} />
        <datalist id="kpi-kat">{KATEGORIE.map((k) => <option key={k} value={k} />)}</datalist>
        <input className={`w-52 ${inputClass}`} placeholder="nazwa (np. Kwiecień / Gala)" value={nowa.nazwa} onChange={(e) => setNowa((p) => ({ ...p, nazwa: e.target.value }))} />
        <input className={`w-28 ${inputClass}`} placeholder={okresDomyslny || '2026/2027'} value={nowa.okres} onChange={(e) => setNowa((p) => ({ ...p, okres: e.target.value }))} />
        <input type="number" className={`w-24 ${inputClass}`} placeholder="wartość" value={nowa.wartosc} onChange={(e) => setNowa((p) => ({ ...p, wartosc: e.target.value }))} />
        <button
          type="button"
          onClick={addMetric}
          disabled={!gotowa}
          className="deck-button inline-flex items-center gap-2 rounded-md px-3 py-1 text-[11px] font-semibold disabled:opacity-40"
        >
          <Plus size={13} />
          dodaj
        </button>
      </div>
      {err && <p className="text-[11px] text-deck-danger mt-2">{err}</p>}
    </BentoCard>
  ) : null

  if (!serie.length) {
    return (
      <div className="space-y-3">
        <BentoCard title="KPI">
          <p className="text-[11px] text-deck-muted">Brak metryk KPI{editable ? ' - dodaj pierwszą poniżej.' : '.'}</p>
        </BentoCard>
        {addForm}
      </div>
    )
  }

  const summary = kpiSummary(serie)
  const grouped = serieWgKategorii(serie)
  const strategic = buildStrategicKpis(rekrutacje, kohorty, serie)
  const total = summary.up + summary.down
  const growthPct = total ? Math.round((summary.up / total) * 100) : 0

  return (
    <div className="space-y-4">
      <BentoCard span={4} className="deck-scan">
        <div className="flex items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-deck-accent/30 bg-deck-accent/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-deck-accent">
              <Sparkles size={13} />
              KPI intelligence
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-deck-text">Metryki rok-do-roku, ale z pulsem.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-deck-muted">
              Każdy wskaźnik pokazuje przebieg przez lata. {editable ? 'Kliknij ostatnią liczbę, aby ją poprawić.' : 'Tryb demo jest read-only.'}
            </p>
          </div>
          <div className="relative grid h-32 w-32 place-items-center rounded-full border border-deck-accent/25 bg-deck-accent/8">
            <div
              className="absolute inset-2 rounded-full"
              style={{ background: `conic-gradient(#2EE6A6 ${growthPct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
            />
            <div className="relative grid h-24 w-24 place-items-center rounded-full bg-deck-bg-deep/95">
              <div className="text-center">
                <div className="text-3xl font-semibold text-deck-accent">{growthPct}%</div>
                <div className="text-[10px] text-deck-muted">rosnących</div>
              </div>
            </div>
          </div>
        </div>
      </BentoCard>

      <div className="grid grid-cols-3 gap-3">
        <KpiTile label="Metryki rosnące" value={<AnimatedNumber value={summary.up} />} sub="rok do roku" accent="accent" />
        <KpiTile label="Metryki spadające" value={<AnimatedNumber value={summary.down} />} sub="rok do roku" accent="violet" />
        <KpiTile label="Średnia zmiana" value={<AnimatedNumber value={Math.round(summary.avgRatio * 100)} suffix="%" />} sub="r/r" />
      </div>

      <BentoCard title="KPI strategiczne" sub="syntetyczne wskaźniki dla pracy Zarządu" span={4}>
        <div className="grid grid-cols-2 gap-3">
          {strategic.map((kpi) => (
            <div key={kpi.id} className="deck-row rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-deck-text">{kpi.title}</div>
                  <div className="text-[11px] text-deck-muted mt-1 leading-5">{kpi.detail}</div>
                </div>
                <div className={`text-xl font-semibold tabular-nums ${kpi.score >= 70 ? 'text-deck-accent' : kpi.score < 45 ? 'text-deck-danger' : 'text-deck-warn'}`}>{kpi.value}</div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-deck-bg-deep/70 overflow-hidden">
                <div className="deck-meter-fill h-full rounded-full bg-gradient-to-r from-deck-accent to-deck-warn" style={{ width: `${kpi.score}%` }} />
              </div>
              <div className="mt-3 text-[11px] text-deck-muted italic">{kpi.recommendation}</div>
            </div>
          ))}
        </div>
      </BentoCard>

      {[...grouped.entries()].map(([kat, metryki]) => {
        // Punkty w seriach są już posortowane, więc zbiór zachowuje kolejność lat.
        const okresy = [...new Set(metryki.flatMap((s) => s.punkty.map((p) => p.okres)))]
        const zakres = okresy.length > 1 ? `${okresy[0]} → ${okresy[okresy.length - 1]}` : okresy[0] ?? ''
        return (
          <BentoCard key={kat} title={kat} sub={`${metryki.length} metryk · ${zakres}`} span={4}>
            <div className="space-y-2">
              {metryki.map((s, index) => {
                const ratio = ilorazSerii(s)
                const ost = ostatniPunkt(s)
                return (
                  <div
                    key={`${s.kategoria}|${s.nazwa}`}
                    className="deck-row deck-pop grid grid-cols-[160px_72px_1fr_72px] items-center gap-3 rounded-lg px-3 py-2 text-[11px]"
                    style={{ animationDelay: `${index * 35}ms` }}
                  >
                    <span className="truncate font-medium text-deck-text">{s.nazwa}</span>
                    <span className="tabular flex justify-end text-deck-text">
                      {ost ? (
                        <EditableCell
                          value={ost.wartosc}
                          editable={editable}
                          onCommit={(v) => updateKpiMetric(ost.id, { wartosc: v })}
                          className="w-12"
                        />
                      ) : (
                        <span className="text-deck-muted">-</span>
                      )}
                    </span>
                    <WykresSerii
                      punkty={s.punkty}
                      etykieta={s.nazwa}
                      className={`h-7 w-full ${ratioColor(ratio)}`}
                    />
                    <span className={`inline-flex items-center justify-end gap-1 tabular font-semibold ${ratioColor(ratio)}`}>
                      {ratioIcon(ratio)}
                      {ratio > 0 ? `${Math.round(ratio * 100)}%` : '-'}
                    </span>
                  </div>
                )
              })}
            </div>
          </BentoCard>
        )
      })}

      {addForm}
    </div>
  )
}
