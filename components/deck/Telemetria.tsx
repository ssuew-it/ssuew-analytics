'use client'
import { useEffect, useState } from 'react'

/** Ile kroków przerwy po każdej linii - bez niej linie zlewają się w jeden ciąg. */
const PAUZA = 8

function ograniczRuch(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Props = {
  linie: string[]
  /** Co ile milisekund pojawia się kolejny znak. */
  tempoMs?: number
}

/**
 * Linie „telemetrii” pisane znak po znaku, jedna po drugiej. Ozdoba, nie dane -
 * dlatego jest ukryta przed czytnikami ekranu.
 */
export function Telemetria({ linie, tempoMs = 22 }: Props) {
  const razem = linie.reduce((s, l) => s + l.length + PAUZA, 0)
  const [krok, setKrok] = useState(() => (ograniczRuch() ? razem : 0))

  // Jeden interwał na całość - nie zależy od tego, kiedy React przerysuje.
  useEffect(() => {
    const t = setInterval(() => {
      setKrok((k) => {
        if (k + 1 >= razem) clearInterval(t)
        return Math.min(razem, k + 1)
      })
    }, tempoMs)
    return () => clearInterval(t)
  }, [razem, tempoMs])

  // Krok, od którego zaczyna się każda linia.
  const starty = linie.map((_, i) => linie.slice(0, i).reduce((s, l) => s + l.length + PAUZA, 0))
  return (
    <div className="space-y-2 font-mono text-[11px] text-deck-muted" aria-hidden="true">
      {linie.map((linia, i) => {
        const reszta = krok - starty[i]
        const widac = Math.max(0, Math.min(linia.length, reszta))
        const pisze = reszta >= 0 && reszta < linia.length + PAUZA && krok < razem
        if (widac === 0 && !pisze) return <div key={i} className="h-4" />
        return (
          <div key={i} className={`h-4 ${pisze ? 'deck-caret' : ''}`}>
            {linia.slice(0, widac)}
          </div>
        )
      })}
    </div>
  )
}
