import { describe, it, expect } from 'vitest'
import { etapPusty, szkieletDokumentu } from '@/lib/orbita/szkielet'

describe('szkieletDokumentu', () => {
  it('pięć etapów dokumentu z domyślnymi długościami', () => {
    const s = szkieletDokumentu()
    expect(s.map((e) => e.nazwa)).toEqual(['Koncepcja', 'Projekt', 'Konsultacje', 'Poprawki', 'Przyjęcie'])
    expect(s.map((e) => e.dni)).toEqual([3, 7, 14, 3, 7])
    expect(s.map((e) => e.rodzaj)).toEqual(['praca', 'praca', 'czekanie', 'praca', 'praca'])
    expect(s[2].czekaNa).toEqual(['RUSS', 'KR'])
    expect(s.filter((e) => e.czekaNa.length > 0)).toHaveLength(1)
    expect(s[0].cel).toBe('Podstawa wprowadzenia, tryb i charakter dokumentu')
    expect(s[0].zacznijOd).toBe('Rozmowa z Claude, jak to może wyglądać')
    expect(s[1].gotoweGdy).toBe('Projekt skompletowany i sprawdzony przez Claude')
    expect(s.every((e) => e.zamkniety === null && e.czekamDo === null && e.wynik === '')).toBe(true)
  })
  it('nowe identyfikatory przy każdym wywołaniu', () => {
    const a = szkieletDokumentu().map((e) => e.id)
    const b = szkieletDokumentu().map((e) => e.id)
    expect(new Set([...a, ...b]).size).toBe(10)
  })
  it('bez długich myślników', () => {
    expect(JSON.stringify(szkieletDokumentu())).not.toMatch(/[—–]/)
  })
})

describe('etapPusty', () => {
  it('pusty etap pracy na 3 dni', () => {
    const e = etapPusty()
    expect(e).toMatchObject({ rodzaj: 'praca', dni: 3, nazwa: '', cel: '', czekaNa: [], zamkniety: null })
    expect(e.id).toBeTruthy()
  })
})
