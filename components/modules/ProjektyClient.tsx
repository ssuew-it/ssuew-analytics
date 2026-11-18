'use client'
import { useMemo, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useProjekty } from '@/lib/useProjekty'
import { edycje as wszystkieEdycje, kondycjaEdycji } from '@/lib/projekty/flagi'
import { BentoCard } from '@/components/ui/BentoCard'
import { KpiTile } from '@/components/ui/KpiTile'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import { KartaProjektu } from '@/components/modules/KartaProjektu'

export default function ProjektyClient() {
  const { projekty, loading, blad } = useProjekty()
  const [wybrana, setWybrana] = useState<string | null>(null)

  const dostepne = useMemo(() => wszystkieEdycje(projekty), [projekty])
  const edycja = wybrana ?? dostepne[0] ?? ''
  const kondycje = useMemo(() => kondycjaEdycji(projekty, edycja), [projekty, edycja])

  if (loading) return <ModuleSkeleton />

  if (blad) {
    return (
      <BentoCard title="Kondycja projektów">
        <p className="text-[11px] text-deck-danger">{blad}</p>
      </BentoCard>
    )
  }

  if (!projekty.length) {
    return (
      <BentoCard title="Kondycja projektów">
        <p className="text-[11px] text-deck-muted">
          Brak danych o projektach. Dodaj pierwszy w module „Wpisz dane” → zakładka „Projekt”.
        </p>
      </BentoCard>
    )
  }

  const zAlarmem = kondycje.filter((k) => k.flagi.some((f) => f.waga === 'alarm')).length
  const zUwaga = kondycje.filter((k) =>
    !k.flagi.some((f) => f.waga === 'alarm') && k.flagi.some((f) => f.waga === 'uwaga'),
  ).length
  const czyste = kondycje.length - zAlarmem - zUwaga

  return (
    <div className="space-y-4">
      <BentoCard span={4} className="deck-scan">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-deck-accent/30 bg-deck-accent/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-deck-accent">
              <ShieldAlert size={13} />
              Kondycja projektów
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-deck-text">Co się świeci i dlaczego.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-deck-muted">
              Bez oceny liczbowej - każdy projekt dostaje konkretne zastrzeżenia z konkretnym powodem.
              Najgłośniejsze stoją na górze.
            </p>
          </div>
          <label className="text-[11px] text-deck-muted">
            <span className="mb-1 block">Edycja</span>
            <select
              value={edycja}
              onChange={(e) => setWybrana(e.target.value)}
              className="deck-input rounded-lg px-3 py-2 text-sm text-deck-text"
            >
              {dostepne.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
        </div>
      </BentoCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile label="Z alarmem" value={String(zAlarmem)} sub="wymagają decyzji" accent="violet" />
        <KpiTile label="Z uwagami" value={String(zUwaga)} sub="do obserwacji" />
        <KpiTile label="Bez zastrzeżeń" value={String(czyste)} sub="nic się nie świeci" accent="accent" />
      </div>

      <BentoCard title={`Projekty · ${edycja}`} sub={`${kondycje.length} pozycji, od najgłośniejszej`} span={4}>
        <div className="space-y-2">
          {kondycje.map((k) => (
            <KartaProjektu key={`${k.projekt.projekt}|${k.projekt.edycja}`} kondycja={k} />
          ))}
        </div>
      </BentoCard>
    </div>
  )
}
