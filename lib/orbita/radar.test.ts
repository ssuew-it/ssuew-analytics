import { describe, it, expect } from 'vitest'
import { kat, promien } from '@/lib/orbita/radar'

describe('promien', () => {
  it('progi zapasu', () => {
    expect([null, -3, 0, 2, 10, 30].map(promien)).toEqual([0.95, 0.1, 0.2, 0.4, 0.62, 0.82])
  })
  it('granice progów', () => {
    expect([1, 3, 4, 14, 15].map(promien)).toEqual([0.4, 0.4, 0.62, 0.62, 0.82])
  })
})

describe('kat', () => {
  it('stały dla zadania, różny dla różnych, w [0, 2π)', () => {
    expect(kat('a')).toBe(kat('a'))
    expect(kat('a')).not.toBe(kat('b'))
    for (const id of ['a', 'b', 'xyz', 'zadanie-123']) {
      expect(kat(id)).toBeGreaterThanOrEqual(0)
      expect(kat(id)).toBeLessThan(2 * Math.PI)
    }
  })
})
