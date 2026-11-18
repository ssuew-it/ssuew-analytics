import { describe, it, expect } from 'vitest'
import { opisCzasu, opisMiejsca, opisOsob, porownajWydarzenia } from '@/lib/planer/opis'
import { POLA_DOMYSLNE, type Wydarzenie } from '@/lib/planer/typy'

function w(nadpisz: Partial<Wydarzenie> = {}): Wydarzenie {
  return {
    id: 'x', tytul: 'A', kategoria: 'INNE', rok: 2026, miesiac: 10, dzien: 7,
    godzina: null, sala: null, osoby: [], ...POLA_DOMYSLNE, ...nadpisz,
  }
}

describe('opisCzasu', () => {
  it('cały dzień, przedział, sam start, brak', () => {
    expect(opisCzasu(w({ calyDzien: true }))).toBe('cały dzień')
    expect(opisCzasu(w({ godzina: '18:00', godzinaDo: '20:00' }))).toBe('18:00-20:00')
    expect(opisCzasu(w({ godzina: '18:00', godzinaDo: '04:00' }))).toBe('18:00-04:00 (+1)')
    expect(opisCzasu(w({ godzina: '18:00' }))).toBe('18:00')
    expect(opisCzasu(w({ godzina: '16:30', godzinaDo: '23:59' }))).toBe('od 16:30')
    expect(opisCzasu(w())).toBeNull()
  })
})

describe('opisMiejsca', () => {
  it('budynek z salą, sam budynek, stara sala, poza uczelnią', () => {
    expect(opisMiejsca(w({ budynek: 'B/L', sala: '110L' }))).toBe('B/L 110L')
    expect(opisMiejsca(w({ budynek: 'CKU' }))).toBe('CKU')
    expect(opisMiejsca(w({ sala: '9J' }))).toBe('9J')
    expect(opisMiejsca(w({ budynek: 'POZA', sala: 'Pralnia' }))).toBe('Poza: Pralnia')
    expect(opisMiejsca(w({ budynek: 'POZA' }))).toBe('Poza uczelnią')
    expect(opisMiejsca(w({ budynek: 'ONLINE', sala: 'Teams' }))).toBe('Online: Teams')
    expect(opisMiejsca(w({ budynek: 'ONLINE' }))).toBe('Online')
    expect(opisMiejsca(w({ budynek: 'MIASTO', sala: 'Kraków' }))).toBe('Kraków')
    expect(opisMiejsca(w({ budynek: 'MIASTO' }))).toBe('Inne miasto')
    expect(opisMiejsca(w({ budynek: 'WYJAZD', sala: 'Karpacz' }))).toBe('Wyjazd: Karpacz')
    expect(opisMiejsca(w({ budynek: 'UE', sala: 'dziedziniec' }))).toBe('UE: dziedziniec')
    expect(opisMiejsca(w())).toBeNull()
  })
})

describe('opisOsob', () => {
  it('lista, cały zarząd, nikt', () => {
    expect(opisOsob(['Jula', 'Kuba'])).toBe('Jula, Kuba')
    expect(opisOsob(['wszyscy'])).toBe('wszyscy')
    expect(opisOsob([])).toBeNull()
  })
})

describe('porownajWydarzenia', () => {
  it('najpierw ranga, potem godzina, potem tytuł', () => {
    const lista = [
      w({ id: 'apl', kategoria: 'APLIKACJE', godzina: '08:00' }),
      w({ id: 'zeb-pozno', kategoria: 'ZEBRANIA', godzina: '20:00' }),
      w({ id: 'zeb-wczesnie', kategoria: 'ZEBRANIA', godzina: '09:00' }),
      w({ id: 'ssuew', kategoria: 'SSUEW' }),
    ].sort(porownajWydarzenia)
    expect(lista.map((x) => x.id)).toEqual(['zeb-wczesnie', 'zeb-pozno', 'ssuew', 'apl'])
  })
})
