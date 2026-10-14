import { describe, it, expect } from 'vitest'
import { dzisWarszawa, godzinaWarszawa, polnocWarszawa } from '@/lib/czas'

describe('czas w Warszawie', () => {
  it('po północy w Warszawie to już kolejny dzień, choć w UTC jeszcze nie', () => {
    const t = new Date('2026-10-02T22:30:00Z') // 00:30 czasu letniego
    expect(dzisWarszawa(t)).toEqual({ rok: 2026, miesiac: 10, dzien: 3 })
    expect(godzinaWarszawa(t)).toBe('00:30')
  })

  it('zimą przesunięcie to godzina', () => {
    expect(godzinaWarszawa(new Date('2026-12-01T12:00:00Z'))).toBe('13:00')
  })
})

describe('polnocWarszawa', () => {
  it('lato (UTC+2) i zima (UTC+1)', () => {
    expect(polnocWarszawa({ rok: 2026, miesiac: 10, dzien: 14 })).toBe(Date.UTC(2026, 9, 13, 22))
    expect(polnocWarszawa({ rok: 2026, miesiac: 12, dzien: 1 })).toBe(Date.UTC(2026, 10, 30, 23))
  })
})
