import { describe, it, expect } from 'vitest'
import { liczbaPl } from '@/lib/chartTheme'

describe('liczbaPl', () => {
  it('przecinek dziesiętny i najwyżej dwa miejsca', () => {
    expect(liczbaPl(46.4)).toBe('46,4')
    expect(liczbaPl(3.8123)).toBe('3,81')
    expect(liczbaPl(44)).toBe('44')
  })
  it('pas prognozy jako „lo - hi”', () => {
    expect(liczbaPl([2.5, 3.75])).toBe('2,5 - 3,75')
  })
  it('tekst zostaje tekstem', () => {
    expect(liczbaPl("J'26")).toBe("J'26")
  })
})
