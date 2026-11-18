'use client'
import { useState } from 'react'

type Props = {
  value: number
  onCommit: (v: number) => void
  editable?: boolean
  decimals?: number
  suffix?: string
  className?: string
}

// Edytowalna komórka liczbowa: zachowuje się jak tekst, po kliknięciu/edycji zapisuje na blur/Enter.
export function EditableCell({ value, onCommit, editable = true, decimals, suffix = '', className = '' }: Props) {
  const [v, setV] = useState(String(value))
  // Nowa wartość z zewnątrz (np. po zapisie) nadpisuje to, co wpisano.
  const [poprzednia, setPoprzednia] = useState(value)
  if (value !== poprzednia) {
    setPoprzednia(value)
    setV(String(value))
  }

  const shown = (decimals != null ? value.toFixed(decimals) : String(value)).replace('.', ',')
  if (!editable) return <span className={`tabular ${className}`}>{shown}{suffix}</span>

  // kreskowany underline = wyraźny sygnał „to pole można kliknąć i edytować"

  return (
    <span className="inline-flex items-center">
      <input
        type="number"
        step={decimals ? 0.01 : 1}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          const n = parseFloat(v)
          if (!Number.isNaN(n) && n !== value) onCommit(n)
          else setV(String(value))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setV(String(value))
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className={`w-16 bg-transparent text-right tabular cursor-text border-b border-dashed border-deck-muted/40 hover:border-deck-accent hover:bg-white/[0.03] focus:border-solid focus:border-deck-accent outline-none rounded-sm px-0.5 ${className}`}
      />
      {suffix && <span className="text-deck-muted">{suffix}</span>}
    </span>
  )
}
