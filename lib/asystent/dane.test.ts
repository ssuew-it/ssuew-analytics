import { describe, it, expect, vi } from 'vitest'
import type { StatystykiStrony } from '@/lib/strony/model'

// `dane.ts` ciągnie arkusz i Firestore - tu potrzebna jest tylko czysta `daneProjektu`.
vi.mock('@/lib/gas/client', () => ({ gasList: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({
  odprawaRef: vi.fn(), propozycjeRef: vi.fn(), semestrRef: vi.fn(), wydarzeniaRef: vi.fn(), ustawieniaRef: vi.fn(),
}))

import { daneProjektu } from '@/lib/asystent/dane'

describe('daneProjektu', () => {
  it('do obrazu idą tylko strony, które odpowiedziały', () => {
    const strona = { witryna: 'sc-domain:jwk26.pl' } as StatystykiStrony
    const d = daneProjektu(
      { rekrutacje: [], kohorty: [], punkty: [], projekty: [], czlonkowie: [], czasMs: 1 },
      { wydarzenia: [], sesja: { wlaczony: false, od: null, przez: null }, sklad: [], propozycje: 0, ok: true },
      { id: '2026Z', nazwa: 'Z' },
      [],
      [{ ok: true, dane: strona }, { ok: false, witryna: 'x', nazwa: 'x', blad: 'inny', komunikat: '' }],
    )
    expect(d.strony).toEqual([strona])
  })
})
