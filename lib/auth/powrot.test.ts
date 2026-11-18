import { describe, expect, it } from 'vitest'
import { celPowrotu } from '@/lib/auth/powrot'

describe('celPowrotu', () => {
  it('ścieżka tej strony z parametrami zostaje', () => {
    expect(celPowrotu('/skrzynka')).toBe('/skrzynka')
    expect(celPowrotu('/analytics/wpis?tab=kohorta')).toBe('/analytics/wpis?tab=kohorta')
  })
  it('brak, obce adresy i pętla do logowania to kokpit', () => {
    for (const v of [null, undefined, '', 'https://obca.pl', '//obca.pl', '/\\obca.pl', '/login', 'skrzynka']) {
      expect(celPowrotu(v)).toBe('/')
    }
  })
})
