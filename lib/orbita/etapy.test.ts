import { describe, it, expect } from 'vitest'
import { BladOrbity, KOMUNIKAT_KOLIZJI, otworzEtap, zamknijEtap } from '@/lib/orbita/etapy'
import type { Etap, Zadanie } from '@/lib/orbita/typy'

const DZIS = { rok: 2026, miesiac: 11, dzien: 20 }
const etap = (id: string, zmiany: Partial<Etap> = {}): Etap => ({
  id, nazwa: id, rodzaj: 'praca', cel: '', zacznijOd: '', materialy: '', gotoweGdy: '', dni: 3,
  czekaNa: [], czekamDo: null, zamkniety: null, wynik: '', ...zmiany,
})
const zadanie = (etapy: Etap[], zmiany: Partial<Zadanie> = {}): Zadanie => ({
  id: 'z', tytul: 'Z', kontekst: '', termin: null, zrodlo: null, etapy, utworzono: 0, zmieniono: 0, zamkniete: null, ...zmiany,
})

function rzuca(f: () => unknown): BladOrbity {
  try {
    f()
  } catch (e) {
    return e as BladOrbity
  }
  throw new Error('nie rzuciło')
}

describe('zamknijEtap', () => {
  it('niebieżący etap → nie-biezacy z komunikatem kolizji', () => {
    const e = rzuca(() => zamknijEtap(zadanie([etap('a'), etap('b')]), 'b', '', 5, DZIS))
    expect(e).toBeInstanceOf(BladOrbity)
    expect(e.rodzaj).toBe('nie-biezacy')
    expect(e.message).toBe(KOMUNIKAT_KOLIZJI)
  })
  it('zamyka bieżący z wynikiem i ustawia czekamDo następnych konsultacji', () => {
    const z = zamknijEtap(zadanie([etap('a'), etap('k', { rodzaj: 'czekanie', dni: 14 })]), 'a', '  link  ', 5, DZIS)
    expect(z.etapy[0]).toMatchObject({ zamkniety: 5, wynik: 'link' })
    expect(z.etapy[1].czekamDo).toBe('2026-12-04')
    expect(z.zmieniono).toBe(5)
    expect(z.zamkniete).toBeNull()
  })
  it('ostatni etap zamyka zadanie', () => {
    const z = zamknijEtap(zadanie([etap('a', { zamkniety: 1 }), etap('b')]), 'b', '', 9, DZIS)
    expect(z.zamkniete).toBe(9)
  })
  it('wynik przycięty do 2000 znaków', () => {
    expect(zamknijEtap(zadanie([etap('a')]), 'a', 'x'.repeat(2500), 1, DZIS).etapy[0].wynik).toHaveLength(2000)
  })
})

describe('otworzEtap', () => {
  it('nie ostatni zamknięty → nie-biezacy', () => {
    const z = zadanie([etap('a', { zamkniety: 1 }), etap('b', { zamkniety: 2 }), etap('c')])
    expect(rzuca(() => otworzEtap(z, 'a', 5)).rodzaj).toBe('nie-biezacy')
    expect(rzuca(() => otworzEtap(z, 'c', 5)).rodzaj).toBe('nie-biezacy')
  })
  it('ostatni zamknięty wraca jako bieżący, czekamDo następnego czyszczone, zadanie otwarte', () => {
    const z = zadanie(
      [etap('a', { zamkniety: 1 }), etap('k', { rodzaj: 'czekanie', czekamDo: '2026-12-04', zamkniety: 2 })],
      { zamkniete: 2 },
    )
    const o1 = otworzEtap(z, 'k', 7)
    expect(o1.etapy[1].zamkniety).toBeNull()
    expect(o1.etapy[1].czekamDo).toBe('2026-12-04')
    expect(o1.zamkniete).toBeNull()
    const o2 = otworzEtap(o1, 'a', 8)
    expect(o2.etapy[0].zamkniety).toBeNull()
    expect(o2.etapy[1].czekamDo).toBeNull()
    expect(o2.zmieniono).toBe(8)
  })
})
