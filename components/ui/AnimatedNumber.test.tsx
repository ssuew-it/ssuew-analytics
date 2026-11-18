import { act, render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

function ruch(ograniczony: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: ograniczony,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false
      },
    }) as unknown as MediaQueryList
}

describe('AnimatedNumber', () => {
  beforeEach(() => ruch(true))
  afterEach(() => vi.useRealTimers())

  it('pokazuje wartość (reduced motion → natychmiast)', () => {
    render(<AnimatedNumber value={42} suffix="%" />)
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('respektuje miejsca po przecinku i prefix', () => {
    render(<AnimatedNumber value={3.456} decimals={1} prefix="~" />)
    expect(screen.getByText('~3,5')).toBeInTheDocument()
  })

  it('pierwsze wejście bez liczenia od zera - od razu prawdziwa wartość, nawet z animacjami', () => {
    ruch(false)
    render(<AnimatedNumber value={24} decimals={1} />)
    expect(screen.getByText('24,0')).toBeInTheDocument()
  })

  it('zmiana wartości (np. filtr) przechodzi od poprzedniej do nowej, nie od zera', () => {
    ruch(false)
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const { rerender } = render(<AnimatedNumber value={100} />)
    rerender(<AnimatedNumber value={200} />)
    act(() => vi.advanceTimersByTime(50))
    const w = Number(screen.getByText(/^\d+$/).textContent)
    expect(w).toBeGreaterThanOrEqual(100)
    expect(w).toBeLessThan(200)
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('200')).toBeInTheDocument()
  })
})
