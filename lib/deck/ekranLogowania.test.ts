import { describe, it, expect } from 'vitest'
import { NAGLOWKI, OSTATNIA_TELEMETRIA, PULA_TELEMETRII, SCENY, losujEkran } from './ekranLogowania'

/** Zwraca kolejne wartości z listy, w kółko. */
const sekwencja = (...v: number[]) => {
  let i = 0
  return () => v[i++ % v.length]
}

describe('losujEkran', () => {
  it('scena i nagłówek wynikają z losowania', () => {
    const e = losujEkran(sekwencja(0.5, 0.99, 0, 0, 0))
    expect(e.scena).toBe(SCENY[1])
    expect(e.naglowek).toBe(NAGLOWKI[NAGLOWKI.length - 1])
  })

  it('skrajne losowania nie wychodzą poza listy', () => {
    for (const x of [0, 0.99999]) {
      const e = losujEkran(() => x)
      expect(SCENY).toContain(e.scena)
      expect(NAGLOWKI).toContain(e.naglowek)
      e.telemetria.forEach((l) => expect(l).toBeTruthy())
    }
  })

  it('telemetria: trzy różne linie z puli i stała ostatnia', () => {
    for (const x of [0, 0.3, 0.7, 0.99999]) {
      const { telemetria } = losujEkran(() => x)
      expect(telemetria).toHaveLength(4)
      expect(telemetria[3]).toBe(OSTATNIA_TELEMETRIA)
      expect(new Set(telemetria.slice(0, 3)).size).toBe(3)
      telemetria.slice(0, 3).forEach((l) => expect(PULA_TELEMETRII).toContain(l))
    }
  })

  it('wszystko po polsku - żadnych starych angielskich linii', () => {
    const wszystko = [...NAGLOWKI, ...PULA_TELEMETRII, OSTATNIA_TELEMETRIA].join(' ')
    expect(wszystko).not.toMatch(/awaiting|calibrated|online|ready/)
  })
})
