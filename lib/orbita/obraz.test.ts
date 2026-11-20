import { describe, it, expect } from 'vitest'
import { obrazOrbity } from '@/lib/orbita/obraz'
import type { Etap, Zadanie } from '@/lib/orbita/typy'

const DZIS = { rok: 2026, miesiac: 11, dzien: 20 }
const etap = (zmiany: Partial<Etap> = {}): Etap => ({
  id: 'e', nazwa: 'Koncepcja', rodzaj: 'praca', cel: 'tajny cel', zacznijOd: '', materialy: 'https://tajne.pl', gotoweGdy: '', dni: 3,
  czekaNa: [], czekamDo: null, zamkniety: null, wynik: '', ...zmiany,
})
const zadanie = (id: string, termin: string | null, etapy: Etap[]): Zadanie => ({
  id, tytul: `Zadanie ${id}`, kontekst: 'tajny kontekst', termin, zrodlo: null, etapy, utworzono: 0, zmieniono: 0, zamkniete: null,
})

describe('obrazOrbity', () => {
  it('dziś z zapasem i terminem, czekające z datą, bez treści', () => {
    const o = obrazOrbity(
      [
        zadanie('A', '2026-11-22', [etap()]), // zapas -1
        zadanie('B', '2027-01-30', [etap({ zamkniety: 1, wynik: 'tajny wynik' }), etap({ nazwa: 'Konsultacje', rodzaj: 'czekanie', czekaNa: ['KR'], czekamDo: '2026-11-28' })]),
      ],
      DZIS,
    )
    expect(o.dzis).toEqual([{ zadanie: 'Zadanie A', etap: 'Koncepcja', zapasDni: -1, termin: '22.11.2026' }])
    expect(o.podpowiedz).toBe(false)
    expect(o.czekam).toEqual([{ zadanie: 'Zadanie B', etap: 'Konsultacje', czekaNa: ['KR'], do: '28.11.2026' }])
    expect(JSON.stringify(o)).not.toMatch(/tajn/)
  })

  it('wszystkie pozycje dziś, bez limitu widoku', () => {
    const zadania = ['A', 'B', 'C', 'D', 'E'].map((id) => zadanie(id, '2026-11-21', [etap()]))
    expect(obrazOrbity(zadania, DZIS).dzis).toHaveLength(5)
  })

  it('podpowiedź przechodzi do asystenta', () => {
    expect(obrazOrbity([zadanie('A', '2027-01-30', [etap()])], DZIS).podpowiedz).toBe(true)
  })
})
