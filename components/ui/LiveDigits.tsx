'use client'
import { useEffect, useState } from 'react'

type Props = {
  label: string
  value: string
  speed?: number
}

const CYFRY = '0123456789'
/** Ile klatek przypadkowych cyfr przewija każda cyfra wartości, zanim stanie. */
const KLATKI_NA_CYFRE = 3

function ograniczRuch(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Wartość „dekoduje się” raz, od lewej: każda cyfra przez kilka klatek
 * pokazuje przypadkowe cyfry, potem staje na właściwej - i tak zostaje.
 * Litery, spacje i znaki jak „-” czy „/” stoją od początku, więc „-42 dBm”
 * nigdy nie zamienia się w same cyfry. Przypadkowa cyfra zależy też od
 * właściwej, więc dwie komórki nie migają tym samym ciągiem.
 */
function klatkaWartosci(value: string, klatka: number): string {
  let n = 0
  let wynik = ''
  for (const znak of value) {
    if (!/\d/.test(znak)) {
      wynik += znak
      continue
    }
    wynik += klatka >= (n + 1) * KLATKI_NA_CYFRE ? znak : CYFRY[(klatka * 7 + Number(znak) * 3 + n + 1) % CYFRY.length]
    n++
  }
  return wynik
}

export function LiveDigits({ label, value, speed = 90 }: Props) {
  const koniec = value.replace(/\D/g, '').length * KLATKI_NA_CYFRE
  // Start zawsze od klatki 0 - tak samo na serwerze i w przeglądarce.
  const [klatka, setKlatka] = useState(0)

  useEffect(() => {
    if (klatka >= koniec) return
    const bezRuchu = ograniczRuch()
    const t = window.setTimeout(() => setKlatka((k) => (bezRuchu ? koniec : k + 1)), bezRuchu ? 0 : speed)
    return () => window.clearTimeout(t)
  }, [klatka, koniec, speed])

  return (
    <div className="deck-row rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-deck-muted">{label}</div>
      <div className="deck-caret mt-2 font-mono text-2xl font-semibold tabular-nums text-deck-accent">
        {klatkaWartosci(value, klatka)}
      </div>
    </div>
  )
}
