'use client'
import type { ReactNode } from 'react'
import { poTerminie } from '@/lib/skrzynka/statusy'
import { ETYKIETY_STATUSOW, kiedyKrotko } from '@/lib/skrzynka/widok'
import type { Sprawa } from '@/lib/skrzynka/typy'

/**
 * Jedna sprawa na liście: kto, temat, fragment, wiek i znaczniki. `zStatusem`
 * - na karcie osoby albo organizacji, gdzie sprawy mają różne statusy.
 * `akcje` stoją obok przycisku, nie w nim - przycisk w przycisku jest niepoprawny.
 */
export function WierszSprawy({ s, teraz, wybrana, onWybierz, zStatusem = false, akcje }: {
  s: Sprawa
  teraz: number
  wybrana: boolean
  onWybierz: (id: string) => void
  zStatusem?: boolean
  akcje?: ReactNode
}) {
  const poCzasie = poTerminie(s.oczekujeOd, teraz)
  return (
    <li className="flex items-stretch gap-1.5">
      <button
        type="button"
        onClick={() => onWybierz(s.id)}
        aria-pressed={wybrana}
        className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-left transition ${
          wybrana ? 'border-deck-accent/50 bg-deck-accent/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2 text-[12px]">
          <span className={`truncate ${s.nowa ? 'font-semibold text-deck-text' : 'text-deck-text'}`}>
            {s.kontakt ?? '(bez nadawcy)'}
            {s.organizacja && <span className="font-normal text-deck-muted"> · {s.organizacja}</span>}
          </span>
          <span className="flex-none font-mono text-[10.5px] text-deck-muted">{kiedyKrotko(s.ostatnia.kiedy, teraz)}</span>
        </div>
        <div className="truncate text-[12.5px] text-deck-text">{s.temat}</div>
        <div className="truncate text-[11.5px] text-deck-muted">{s.ostatnia.fragment}</div>
        {(zStatusem || poCzasie || s.nowa || s.przypisana) && (
          <div className="mt-1 flex flex-wrap gap-2 font-mono text-[9.5px] uppercase tracking-[0.12em]">
            {zStatusem && <span className="text-deck-muted">{ETYKIETY_STATUSOW[s.status]}</span>}
            {poCzasie && <span className="text-deck-danger">po terminie</span>}
            {s.nowa && <span className="text-deck-accent">nowa</span>}
            {s.przypisana && <span className="text-deck-muted">{s.przypisana}</span>}
          </div>
        )}
      </button>
      {akcje && <div className="flex flex-none flex-col justify-center gap-1">{akcje}</div>}
    </li>
  )
}
