'use client'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisTick, chartTheme, tooltipStyle } from '@/lib/chartTheme'
import { dataKrotka } from '@/lib/strony/okresy'
import type { StatystykiStrony } from '@/lib/strony/model'

type Dzienne = StatystykiStrony['dzienne']

/**
 * Dwa małe wykresy zamiast jednego z dwiema osiami: wyświetleń bywa sto razy
 * więcej niż kliknięć, a dwie skale na jednym rysunku sugerują związek,
 * którego dane nie mówią. Wspólna oś dni pozwala porównać kształt.
 */
export function WykresStrony({ dzienne }: { dzienne: Dzienne }) {
  const dane = dzienne.map((d) => ({ ...d, dzien: dataKrotka(d.data) }))
  return (
    <div className="grid gap-4">
      <Seria dane={dane} klucz="klikniecia" tytul="Kliknięcia dziennie" kolor={chartTheme.accent} />
      <Seria dane={dane} klucz="wyswietlenia" tytul="Wyświetlenia dziennie" kolor={chartTheme.violet} />
    </div>
  )
}

function Seria({ dane, klucz, tytul, kolor }: {
  dane: (Dzienne[number] & { dzien: string })[]
  klucz: 'klikniecia' | 'wyswietlenia'
  tytul: string
  kolor: string
}) {
  return (
    <figure aria-label={tytul}>
      <figcaption className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-deck-muted/70">{tytul}</figcaption>
      <div className="h-[130px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dane} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis dataKey="dzien" tick={axisTick} interval="preserveStartEnd" minTickGap={28} />
            <YAxis tick={axisTick} allowDecimals={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString('pl-PL'), tytul]} />
            <Line type="monotone" dataKey={klucz} stroke={kolor} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
