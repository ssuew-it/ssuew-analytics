import { describe, it, expect } from 'vitest'
import { easeOutCubic, formatNumber, zmianaRr } from '@/lib/format'

describe('easeOutCubic', () => {
  it('zaczyna w 0 i kończy w 1', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })
  it('jest monotoniczny i wypukły (szybko na starcie)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })
})

describe('formatNumber', () => {
  it('formatuje z przecinkiem dziesiętnym', () => {
    expect(formatNumber(3.456, 1)).toBe('3,5')
    expect(formatNumber(42, 0)).toBe('42')
  })
})

describe('zmianaRr', () => {
  it('zamienia iloraz na zmianę ze znakiem - 47 → 28 to spadek o 40%, nie „60%”', () => {
    expect(zmianaRr(28 / 47)).toBe('-40%')
    expect(zmianaRr(0.5)).toBe('-50%')
    expect(zmianaRr(1.29)).toBe('+29%')
    expect(zmianaRr(5)).toBe('+400%')
  })
  it('brak zmiany to 0%, a zmiana poniżej pół procenta nie udaje zera', () => {
    expect(zmianaRr(1)).toBe('0%')
    expect(zmianaRr(1.003)).toBe('+<1%')
    expect(zmianaRr(0.997)).toBe('-<1%')
  })
  it('iloraz 0 (nie da się policzyć) daje kreskę', () => {
    expect(zmianaRr(0)).toBe('-')
  })
})
