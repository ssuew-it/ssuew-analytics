'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { linkWpisu } from '@/lib/wpis'
import { useProjekty } from '@/lib/useProjekty'
import { edycje as wszystkieEdycje, kondycjaEdycji } from '@/lib/projekty/flagi'
import { BentoCard } from '@/components/ui/BentoCard'
import { KpiTile } from '@/components/ui/KpiTile'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'
import { KartaProjektu } from '@/components/modules/KartaProjektu'

export default function ProjektyClient() {
  const { projekty, loading, blad } = useProjekty()
  const { rola } = useAuth()
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
      <BentoCard title="Kondycja projektów" sub="jeszcze bez danych">
        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[12.5px] leading-relaxed text-deck-text">
              Tu zobaczysz każdy projekt w danej edycji: budżet planowany i wydany, nabór, uczestników i partnerów -
              z ostrzeżeniem, gdy coś odbiega od normy albo od zeszłego roku.
            </p>
            {rola === 'owner' ? (
              <Link href={linkWpisu('projekt')} className="deck-button mt-4 inline-flex rounded-md px-3 py-1.5 text-[12px] font-semibold">
                Dodaj pierwszy projekt
              </Link>
            ) : (
              <p className="mt-4 text-[11.5px] text-deck-muted">Projekty dopisuje właściciel kokpitu w „Wpisz dane”.</p>
            )}
            <p className="mt-2 text-[11px] text-deck-muted">Wystarczy nazwa i edycja - liczby można dopisać później.</p>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-deck-muted">Na co zwraca uwagę</div>
            <ul className="mt-2 space-y-1.5 text-[11.5px] text-deck-muted">
              <li><span className="text-deck-danger">alarm</span> · budżet przekroczony albo wydatek bez przyznanego budżetu</li>
              <li><span className="text-deck-warn">uwaga</span> · budżet ledwo ruszony, nabór przedłużany albo bez nadwyżki chętnych</li>
              <li><span className="text-deck-warn">uwaga</span> · brak partnera finansowego</li>
              <li><span className="text-deck-warn">uwaga</span> · mniej chętnych lub uczestników niż rok wcześniej</li>
            </ul>
          </div>
        </div>
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
