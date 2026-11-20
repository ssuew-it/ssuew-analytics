'use client'
import { kat, promien } from '@/lib/orbita/radar'
import type { Zadanie } from '@/lib/orbita/typy'
import { zapas, type PlanDnia } from '@/lib/orbita/zapas'
import type { Data } from '@/lib/planer/trwanie'

const R = 200
const PIERSCIENIE = [0.2, 0.4, 0.62, 0.82, 0.95]
const skroc = (s: string) => (s.length > 24 ? `${s.slice(0, 23)}…` : s)

interface Punkt {
  z: Zadanie
  zapas: number | null
  czeka: boolean
}

/** Radar zapasu: im bliżej środka, tym mniej czasu do ostatniego bezpiecznego startu. */
export function Radar({ plan, dzis, onWybierz }: { plan: PlanDnia; dzis: Data; onWybierz: (zadanieId: string) => void }) {
  const punkty: Punkt[] = [
    ...[...plan.dzis, ...plan.najblizej].map((p) => ({ z: p.zadanie, zapas: p.zapas, czeka: false })),
    ...plan.czekam.map((c) => ({ z: c.zadanie, zapas: zapas(c.zadanie, dzis), czeka: true })),
    ...plan.kiedys.map((z) => ({ z, zapas: null, czeka: false })),
  ]

  return (
    <svg viewBox={`${-R - 10} ${-R - 10} ${2 * R + 20} ${2 * R + 20}`} className="mx-auto block w-full max-w-[560px]" role="img" aria-label="Radar zadań">
      {PIERSCIENIE.map((p) => (
        <circle key={p} r={p * R} fill="none" stroke="currentColor" className="text-white/10" strokeDasharray={p === 0.2 ? undefined : '3 5'} />
      ))}
      <circle r={0.2 * R} className="fill-deck-accent/5" />
      {punkty.map(({ z, zapas: z0, czeka }) => {
        const r = promien(z0) * R
        const a = kat(z.id)
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        const spoznione = z0 !== null && z0 < 0
        const kolor = spoznione ? 'fill-deck-danger text-deck-danger' : z0 !== null && z0 <= 3 ? 'fill-deck-accent text-deck-accent' : 'fill-deck-muted text-deck-muted'
        return (
          <g
            key={z.id}
            data-zadanie={z.id}
            role="button"
            tabIndex={0}
            aria-label={z.tytul}
            className="cursor-pointer focus:outline-none"
            onClick={() => onWybierz(z.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onWybierz(z.id)
            }}
          >
            <circle
              cx={x}
              cy={y}
              r={6}
              className={`${kolor} ${spoznione ? 'motion-safe:animate-pulse' : ''} ${z0 === null ? 'opacity-40' : ''}`}
              fill={czeka ? 'none' : undefined}
              stroke={czeka ? 'currentColor' : undefined}
              strokeWidth={czeka ? 1.5 : undefined}
            />
            <text x={x + 9} y={y + 4} className="fill-deck-text text-[10px]" style={{ fontSize: 10 }}>
              {skroc(z.tytul)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
