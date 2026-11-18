'use client'
import type { CorrCell } from '@/lib/stats'

function cellColor(r: number | null): string {
  if (r == null) return 'transparent'
  const mag = Math.min(1, Math.abs(r))
  return r >= 0 ? `rgba(46,230,166,${mag})` : `rgba(255,138,138,${mag})`
}

type Props = {
  vars: string[]
  cells: CorrCell[]
  onSelect?: (a: string, b: string) => void
}

export function Heatmap({ vars, cells, onSelect }: Props) {
  const get = (a: string, b: string) => cells.find((c) => c.a === a && c.b === b)
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="p-1" />
            {vars.map((v) => (
              <th key={v} className="p-1 text-deck-muted font-normal align-bottom">
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vars.map((a) => (
            <tr key={a}>
              <td className="p-1 text-deck-muted text-right whitespace-nowrap">{a}</td>
              {vars.map((b) => {
                const c = get(a, b)
                const r = c?.r ?? null
                return (
                  <td
                    key={b}
                    onClick={() => onSelect?.(a, b)}
                    className="w-12 h-8 text-center cursor-pointer border border-deck-border tabular-nums text-deck-text"
                    style={{ background: cellColor(r) }}
                    title={`${a} ↔ ${b}: ${r == null ? '-' : r.toFixed(2).replace('.', ',')}`}
                  >
                    {r == null ? '-' : r.toFixed(2).replace('.', ',')}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
