import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { LiveDigits } from '@/components/ui/LiveDigits'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Tekst komórki pod etykietą. */
const wartosc = (etykieta: string) => screen.getByText(etykieta).nextElementSibling?.textContent ?? ''

describe('LiveDigits', () => {
  it('dekoduje się raz i zostaje na właściwej wartości - bez ponownego mieszania', () => {
    vi.useFakeTimers()
    render(<LiveDigits label="sygnał" value="-42 dBm" speed={50} />)
    // Klatka po klatce: każda planuje następną dopiero po przerysowaniu.
    for (let i = 0; i < 40; i++) act(() => vi.advanceTimersByTime(50))
    expect(wartosc('sygnał')).toBe('-42 dBm')
    for (let i = 0; i < 200; i++) act(() => vi.advanceTimersByTime(50))
    expect(wartosc('sygnał')).toBe('-42 dBm')
  })

  it('w trakcie dekodowania litery, spacje, minus i ukośnik stoją na miejscu', () => {
    vi.useFakeTimers()
    render(
      <>
        <LiveDigits label="sygnał" value="-42 dBm" speed={50} />
        <LiveDigits label="węzły" value="12/12" speed={50} />
      </>,
    )
    expect(wartosc('sygnał')).not.toBe('-42 dBm')
    for (let i = 0; i < 6; i++) {
      const s = wartosc('sygnał')
      expect(s).toHaveLength(7)
      expect(s[0]).toBe('-')
      expect(s.slice(3)).toBe(' dBm')
      expect(s.slice(1, 3)).toMatch(/^\d\d$/)
      expect(wartosc('węzły')[2]).toBe('/')
      act(() => vi.advanceTimersByTime(50))
    }
  })

  it('komórki o różnych wartościach nie pokazują tych samych cyfr', () => {
    vi.useFakeTimers()
    render(
      <>
        <LiveDigits label="a" value="256 bit" />
        <LiveDigits label="b" value="128 bit" />
      </>,
    )
    expect(wartosc('a').slice(0, 3)).not.toBe(wartosc('b').slice(0, 3))
  })

  it('przy ograniczonym ruchu od razu właściwa wartość', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    render(<LiveDigits label="szyfrowanie" value="256 bit" />)
    act(() => vi.advanceTimersByTime(0))
    expect(wartosc('szyfrowanie')).toBe('256 bit')
  })
})
