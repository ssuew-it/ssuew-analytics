'use client'
import { useState } from 'react'
import type { Rekrutacja, Kohorta } from '@/types'
import { retentionModel, retentionFraction, prognozaPrzyjetych, mean } from '@/lib/stats'
import { BentoCard } from '@/components/ui/BentoCard'
import { Slider } from '@/components/ui/Slider'

type Props = { rekrutacje: Rekrutacja[]; kohorty: Kohorta[] }

interface Scenario {
  name: string
  przyjeciCR: number
  retencjaPred: number | null
  utrzymani: number
}

export default function Symulator({ rekrutacje, kohorty }: Props) {
  const sorted = [...rekrutacje].sort((a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1))
  const last = sorted[sorted.length - 1]
  const avgCR = sorted.length
    ? Math.round(
        (sorted.reduce((s, r) => s + (r.zgloszenia > 0 ? (r.przyjeci / r.zgloszenia) * 100 : 0), 0) / sorted.length) * 10,
      ) / 10
    : 50
  const model = retentionModel(kohorty)
  // Domyślnie jesień, więc i liczebność jesienna - średnia z obu sezonów
  // (ok. 26) to obsada, jakiej jesień nie miała, i model wyrzucał ok. 6 sem.
  const jesienne = kohorty.filter((k) => k.sezon === 'jesien' && !k.in_progress)
  const meanN = jesienne.length ? Math.round(mean(jesienne.map((k) => k.n_czlonkow))) : model ? Math.round(model.meanNCzl) : 15
  const [trend] = prognozaPrzyjetych(rekrutacje, 1)
  const maxZgloszen = Math.max(60, ...sorted.map((r) => Math.ceil((r.zgloszenia * 1.5) / 10) * 10))

  // Sekcja 1: rekrutacja
  const [zgloszenia, setZgloszenia] = useState(last?.zgloszenia ?? 30)
  const [cr, setCr] = useState(Math.round(avgCR))
  const przyjeciCR = Math.round((zgloszenia * cr) / 100)

  // Sekcja 2: retencja
  const [liczebnosc, setLiczebnosc] = useState(meanN)
  const [sezonJesien, setSezonJesien] = useState(true)
  const retencjaPred = model
    ? Math.round(model.predict(model.nextEdNr, sezonJesien ? 1 : 0, liczebnosc) * 100) / 100
    : null

  // Sekcja 3: utrzymanie
  const [przyjeci2, setPrzyjeci2] = useState(last?.przyjeci ?? 15)
  const [retencja2, setRetencja2] = useState(4)
  const [prog, setProg] = useState(2)
  const utrzymani = Math.round(przyjeci2 * retentionFraction(retencja2, prog))

  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const saveScenario = () => {
    if (scenarios.length >= 3) return
    setScenarios((prev) => [
      ...prev,
      { name: `Scenariusz ${prev.length + 1}`, przyjeciCR, retencjaPred, utrzymani },
    ])
  }

  return (
    <div className="space-y-3">
      <BentoCard title="Symulator „co jeśli”" sub="suwaki przeliczają wynik na żywo" span={4}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Rekrutacja */}
          <div className="space-y-2">
            <div className="text-[11px] text-deck-text font-medium">Rekrutacja</div>
            <Slider label="Zgłoszenia" min={0} max={maxZgloszen} value={zgloszenia} onChange={setZgloszenia} />
            <Slider label="Konwersja %" min={0} max={100} value={cr} onChange={setCr} />
            <div className="text-deck-accent text-lg font-semibold tabular">{przyjeciCR} przyjętych</div>
            {trend && (
              <div className="text-[10px] text-deck-muted">
                trend {trend.edycja}: ~{Math.round(trend.yhat)} (±{Math.round(trend.hi - trend.yhat)})
              </div>
            )}
          </div>

          {/* Retencja */}
          <div className="space-y-2">
            <div className="text-[11px] text-deck-text font-medium">Retencja</div>
            <Slider label="Liczebność" min={1} max={50} value={liczebnosc} onChange={setLiczebnosc} />
            <button
              onClick={() => setSezonJesien((s) => !s)}
              className="text-[11px] px-2 py-1 rounded-md border border-deck-border text-deck-muted"
            >
              Sezon: {sezonJesien ? 'jesień' : 'wiosna'}
            </button>
            <div className="text-deck-violet text-lg font-semibold tabular">
              {retencjaPred != null ? `${retencjaPred} sem` : '-'}
            </div>
            {!model && <div className="text-[10px] text-deck-warn">za mało danych do modelu (≥4 kohort)</div>}
          </div>

          {/* Utrzymanie */}
          <div className="space-y-2">
            <div className="text-[11px] text-deck-text font-medium">Utrzymanie</div>
            <Slider label="Przyjęci" min={0} max={50} value={przyjeci2} onChange={setPrzyjeci2} />
            <Slider label="Średnia retencja" min={1} max={10} value={retencja2} onChange={setRetencja2} />
            <Slider label="Próg N sem." min={1} max={10} value={prog} onChange={setProg} />
            <div className="text-deck-accent text-lg font-semibold tabular">{utrzymani} utrzymanych</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={saveScenario}
            disabled={scenarios.length >= 3}
            className="text-[11px] px-3 py-1 rounded-md border border-deck-accent/40 text-deck-accent disabled:opacity-40"
          >
            Zapisz scenariusz
          </button>
          {scenarios.length > 0 && (
            <button onClick={() => setScenarios([])} className="text-[11px] text-deck-muted">
              wyczyść
            </button>
          )}
        </div>
      </BentoCard>

      {scenarios.length > 0 && (
        <BentoCard title="Porównanie scenariuszy" span={4}>
          <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-deck-muted text-left">
                <th className="py-1">Scenariusz</th>
                <th>Przyjęci (konwersja)</th>
                <th>Retencja</th>
                <th>Utrzymani</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.name} className="border-t border-deck-border tabular">
                  <td className="py-1 text-deck-text">{s.name}</td>
                  <td className="text-deck-accent">{s.przyjeciCR}</td>
                  <td className="text-deck-violet">{s.retencjaPred != null ? `${s.retencjaPred} sem` : '-'}</td>
                  <td className="text-deck-accent">{s.utrzymani}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </BentoCard>
      )}
    </div>
  )
}
