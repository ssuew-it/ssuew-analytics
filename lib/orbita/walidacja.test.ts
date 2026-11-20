import { describe, it, expect } from 'vitest'
import { scalEdycje, sprawdzZadanie, ustalCzekamDo } from '@/lib/orbita/walidacja'
import type { Etap, PolaZadania, Zadanie } from '@/lib/orbita/typy'

const etap = (zmiany: Partial<Etap> = {}): Etap => ({
  id: 'e', nazwa: 'Etap', rodzaj: 'praca', cel: '', zacznijOd: '', materialy: '', gotoweGdy: '', dni: 3,
  czekaNa: [], czekamDo: null, zamkniety: null, wynik: '', ...zmiany,
})
const pola = (zmiany: Record<string, unknown> = {}) => ({ tytul: 'Zadanie', kontekst: '', termin: null, zrodlo: null, etapy: [etap()], ...zmiany })
const DZIS = { rok: 2026, miesiac: 11, dzien: 20 }
const blad = (x: unknown) => {
  const w = sprawdzZadanie(x)
  return w.ok ? null : w.blad
}

describe('sprawdzZadanie', () => {
  it('przycina teksty i przyjmuje poprawne zadanie', () => {
    const w = sprawdzZadanie(pola({ tytul: '  Zarządzenie  ', termin: '2026-12-20' }))
    expect(w.ok && w.pola.tytul).toBe('Zarządzenie')
    expect(w.ok && w.pola.termin).toBe('2026-12-20')
  })
  it.each([
    ['tytuł 121 znaków', { tytul: 'x'.repeat(121) }],
    ['pusty tytuł', { tytul: '   ' }],
    ['16 etapów', { etapy: Array.from({ length: 16 }, () => etap()) }],
    ['bez etapów', { etapy: [] }],
    ['dni 91', { etapy: [etap({ dni: 91 })] }],
    ['dni ułamkowe', { etapy: [etap({ dni: 2.5 })] }],
    ['miesiąc 13', { termin: '2026-13-01' }],
    ['31 listopada', { termin: '2026-11-31' }],
    ['zrodlo bez wpisId', { zrodlo: { typ: 'dziennik', termin: '2027-03-15' } }],
    ['kontekst 4001', { kontekst: 'x'.repeat(4001) }],
    ['zły rodzaj', { etapy: [etap({ rodzaj: 'inne' as never })] }],
  ])('odrzuca: %s', (_, zmiany) => expect(blad(pola(zmiany))).toBeTruthy())
  it('etap bez nazwy - poprawny po polsku komunikat', () => {
    expect(blad(pola({ etapy: [etap({ nazwa: ' ' })] }))).toBe('Każdy etap musi mieć nazwę')
  })
  it('etap pracy traci czekaNa i czekamDo', () => {
    const w = sprawdzZadanie(pola({ etapy: [etap({ czekaNa: ['KR'], czekamDo: '2026-12-01' })] }))
    expect(w.ok && w.pola.etapy[0]).toMatchObject({ czekaNa: [], czekamDo: null })
  })
  it('czekaNa przycięte, bez pustych i duplikatów', () => {
    const w = sprawdzZadanie(pola({ etapy: [etap({ rodzaj: 'czekanie', czekaNa: [' KR ', 'KR', ''], czekamDo: '2026-12-01' })] }))
    expect(w.ok && w.pola.etapy[0]).toMatchObject({ czekaNa: ['KR'], czekamDo: '2026-12-01' })
  })
  it('zamkniety z ciała ignorowany, brak id nadaje nowe', () => {
    const w = sprawdzZadanie(pola({ etapy: [{ ...etap({ zamkniety: 123 }), id: '' }] }))
    expect(w.ok && w.pola.etapy[0].zamkniety).toBeNull()
    expect(w.ok && w.pola.etapy[0].id).toBeTruthy()
  })
  it('pola spoza listy odrzucone', () => {
    const w = sprawdzZadanie({ ...pola(), zamkniete: 5, id: 'x' })
    expect(w.ok && Object.keys(w.pola).sort()).toEqual(['etapy', 'kontekst', 'termin', 'tytul', 'zrodlo'])
  })
  it('poprawne zrodlo', () => {
    const w = sprawdzZadanie(pola({ zrodlo: { typ: 'dziennik', wpisId: 'w1', termin: '2027-03-15' } }))
    expect(w.ok && w.pola.zrodlo).toEqual({ typ: 'dziennik', wpisId: 'w1', termin: '2027-03-15' })
  })
})

describe('scalEdycje', () => {
  const stare: Zadanie = {
    id: 'z', tytul: 'Z', kontekst: '', termin: null, zrodlo: null, utworzono: 1, zmieniono: 2, zamkniete: null,
    etapy: [etap({ id: 'z1', nazwa: 'Koncepcja', zamkniety: 10, wynik: 'stary' }), etap({ id: 'o2' })],
  }
  const nowe = (etapy: Etap[]): PolaZadania => ({ tytul: 'Z2', kontekst: '', termin: null, zrodlo: null, etapy })

  it('przestawienie zamkniętego za otwarty → błąd', () => {
    expect(typeof scalEdycje(stare, nowe([etap({ id: 'o2' }), etap({ id: 'z1' })]), 50, DZIS)).toBe('string')
  })
  it('usunięcie zamkniętego → błąd', () => {
    expect(scalEdycje(stare, nowe([etap({ id: 'o2' })]), 50, DZIS)).toBe('Zamkniętych etapów nie można usuwać ani przestawiać')
  })
  it('zamknięty zachowuje pola, poza wynikiem', () => {
    const w = scalEdycje(stare, nowe([etap({ id: 'z1', nazwa: 'Podmiana', wynik: 'nowy' }), etap({ id: 'o2', nazwa: 'Projekt' })]), 50, DZIS) as Zadanie
    expect(w.etapy[0]).toMatchObject({ nazwa: 'Koncepcja', zamkniety: 10, wynik: 'nowy' })
    expect(w.etapy[1]).toMatchObject({ nazwa: 'Projekt', zamkniety: null })
    expect(w).toMatchObject({ tytul: 'Z2', zmieniono: 50, utworzono: 1, id: 'z' })
  })
  it('usunięcie ostatniego otwartego zamyka zadanie', () => {
    const w = scalEdycje(stare, nowe([etap({ id: 'z1' })]), 50, DZIS) as Zadanie
    expect(w.zamkniete).toBe(50)
  })
  it('bez etapów → błąd', () => {
    expect(scalEdycje({ ...stare, etapy: [etap({ id: 'o2' })] }, nowe([]), 50, DZIS)).toBe('Zadanie musi mieć co najmniej jeden etap')
  })
})

describe('ustalCzekamDo', () => {
  it('bieżące konsultacje bez daty dostają dziś + dni', () => {
    const e = ustalCzekamDo([etap({ id: 'k', rodzaj: 'czekanie', dni: 14 }), etap({ id: 'p' })], DZIS)
    expect(e[0].czekamDo).toBe('2026-12-04')
  })
  it('istniejąca data, bieżąca praca i dalsze konsultacje bez zmian', () => {
    expect(ustalCzekamDo([etap({ rodzaj: 'czekanie', czekamDo: '2026-12-01' })], DZIS)[0].czekamDo).toBe('2026-12-01')
    const e = ustalCzekamDo([etap({ id: 'p' }), etap({ id: 'k', rodzaj: 'czekanie' })], DZIS)
    expect(e[1].czekamDo).toBeNull()
  })
  it('po zamkniętych etapach patrzy na pierwszy otwarty', () => {
    const e = ustalCzekamDo([etap({ id: 'a', zamkniety: 1 }), etap({ id: 'k', rodzaj: 'czekanie', dni: 0 })], DZIS)
    expect(e[1].czekamDo).toBe('2026-11-20')
  })
})

describe('scalEdycje - konsultacje stają się bieżące', () => {
  it('usunięcie etapów przed konsultacjami ustawia czekamDo', () => {
    const stare: Zadanie = {
      id: 'z', tytul: 'Z', kontekst: '', termin: null, zrodlo: null, utworzono: 1, zmieniono: 2, zamkniete: null,
      etapy: [etap({ id: 'a' }), etap({ id: 'k', rodzaj: 'czekanie', dni: 14 })],
    }
    const w = scalEdycje(stare, { tytul: 'Z', kontekst: '', termin: null, zrodlo: null, etapy: [etap({ id: 'k', rodzaj: 'czekanie', dni: 14 })] }, 50, DZIS) as Zadanie
    expect(w.etapy[0].czekamDo).toBe('2026-12-04')
  })
})
