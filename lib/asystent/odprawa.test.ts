import { describe, it, expect } from 'vitest'
import { sprawdzOdprawe, ODNOSNIK_OBSZARU, wiadomoscOdprawy, INSTRUKCJA_ODPRAWY } from '@/lib/asystent/odprawa'

const DOBRA = {
  podsumowanie: 'Rekrutacja trzyma poziom, retencja słabnie.',
  zagrozenia: [
    { obszar: 'retencja', waga: 'srednia', tytul: "W'25 odpływa", uzasadnienie: 'średnio 1,8 sem.' },
    { obszar: 'kpi', waga: 'wysoka', tytul: 'Ankieta w dół', uzasadnienie: '47 → 28' },
  ],
  dzis: ['Zebranie 18:00'],
}

describe('sprawdzOdprawe', () => {
  it('przyjmuje poprawną i ustawia zagrożenia od najpoważniejszego', () => {
    const o = sprawdzOdprawe(DOBRA)
    expect(o?.zagrozenia.map((z) => z.waga)).toEqual(['wysoka', 'srednia'])
  })

  it('odrzuca braki i nieznane wartości', () => {
    expect(sprawdzOdprawe({ ...DOBRA, podsumowanie: '' })).toBeNull()
    expect(sprawdzOdprawe({ ...DOBRA, zagrozenia: [{ ...DOBRA.zagrozenia[0], waga: 'krytyczna' }] })).toBeNull()
    expect(sprawdzOdprawe({ ...DOBRA, zagrozenia: [{ ...DOBRA.zagrozenia[0], obszar: 'pogoda' }] })).toBeNull()
    expect(sprawdzOdprawe({ ...DOBRA, zagrozenia: Array(6).fill(DOBRA.zagrozenia[0]) })).toBeNull()
    expect(sprawdzOdprawe({ ...DOBRA, dzis: 'Zebranie' })).toBeNull()
    expect(sprawdzOdprawe(null)).toBeNull()
  })

  it('każdy obszar ma odnośnik do modułu', () => {
    expect(ODNOSNIK_OBSZARU.retencja).toBe('/analytics/retencja')
    expect(ODNOSNIK_OBSZARU.planer).toBe('/planer')
    expect(ODNOSNIK_OBSZARU.strony).toBe('/strony')
  })

  it('wiadomość niesie dane jako JSON, instrukcja zakazuje długich myślników', () => {
    expect(wiadomoscOdprawy({ a: 1 } as never)).toContain('{"a":1}')
    expect(INSTRUKCJA_ODPRAWY).toMatch(/„-”/)
  })
})
