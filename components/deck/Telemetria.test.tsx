import { act, render } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { Telemetria } from './Telemetria'

const LINIE = ['abc: jeden', 'def: dwa', 'sejf: czeka na operatora']

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function ruch(ograniczony: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: ograniczony && q.includes('reduce'), media: q }))
}

describe('Telemetria', () => {
  it('pisze linia po linii - na starcie nie ma jeszcze ostatniej, po czasie są wszystkie', () => {
    ruch(false)
    vi.useFakeTimers()
    const { container } = render(<Telemetria linie={LINIE} tempoMs={10} />)
    expect(container.textContent).not.toContain('sejf: czeka na operatora')
    act(() => {
      vi.advanceTimersByTime(10 * 200)
    })
    for (const l of LINIE) expect(container.textContent).toContain(l)
  })

  it('kursor stoi tylko przy linii, która się pisze', () => {
    ruch(false)
    vi.useFakeTimers()
    const { container } = render(<Telemetria linie={LINIE} tempoMs={10} />)
    act(() => {
      vi.advanceTimersByTime(10 * 3)
    })
    expect(container.querySelectorAll('.deck-caret')).toHaveLength(1)
  })

  it('przy ograniczeniu ruchu wszystko od razu', () => {
    ruch(true)
    const { container } = render(<Telemetria linie={LINIE} />)
    for (const l of LINIE) expect(container.textContent).toContain(l)
  })
})
