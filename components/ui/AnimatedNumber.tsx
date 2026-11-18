'use client'
import { useEffect, useRef, useState } from 'react'
import { easeOutCubic, formatNumber } from '@/lib/format'

type Props = {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
}

/**
 * Liczba, która przy ZMIANIE przechodzi płynnie od starej wartości do nowej
 * (np. po zmianie filtra). Pierwsze wejście pokazuje od razu prawdziwą wartość -
 * liczenie od zera wyświetlało przez chwilę nieprawdziwe liczby („0.6% konwersji”)
 * obok prawdziwych plakietek.
 */
export function AnimatedNumber({ value, decimals = 0, prefix = '', suffix = '', duration = 700 }: Props) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = fromRef.current
    const to = value
    if (reduce || from === to) {
      setDisplay(to)
      fromRef.current = to
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setDisplay(from + (to - from) * easeOutCubic(t))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return (
    <span className="tabular">
      {prefix}
      {formatNumber(display, decimals)}
      {suffix}
    </span>
  )
}
