import { describe, it, expect } from 'vitest'
import { sprawdzAdnotacje, sprawdzKadencje, sprawdzWpis } from '@/lib/dziennik/walidacja'

const cykl = (x: object = {}) => ({ dzial: 'cykl', tytul: 'Sprawozdanie', tresc: '', miesiac: 3, dzien: null, obowiazkowe: true, rozlicza: [], ...x })
const strategia = (x: object = {}) => ({
  dzial: 'strategia', tytul: 'Strategia Cyfryzacji', tresc: '', link: 'https://drive.google.com/x', okresOd: 2026, okresDo: 2027,
  status: 'projekt', uchwala: null, cele: [], ...x,
})
const zle = (x: unknown) => expect(sprawdzWpis(x).ok).toBe(false)

describe('sprawdzWpis', () => {
  it('przycina teksty, czyści rozlicza i nadaje domyślne wyprzedzenie', () => {
    const w = sprawdzWpis(cykl({ tytul: '  Sprawozdanie  ', rozlicza: [' KR ', 'KR', ''] }))
    expect(w).toEqual({ ok: true, pola: expect.objectContaining({ tytul: 'Sprawozdanie', rozlicza: ['KR'], wyprzedzenieTygodni: 2 }) })
  })

  it('odrzuca nieznany dział i pusty tytuł', () => {
    zle({ ...cykl(), dzial: 'kronika' })
    zle(cykl({ tytul: '   ' }))
    zle(null)
  })

  it('pilnuje zakresów terminu', () => {
    zle(cykl({ miesiac: 13 }))
    zle(cykl({ miesiac: 0 }))
    zle(cykl({ dzien: 0 }))
    zle(cykl({ dzien: 32 }))
    zle(cykl({ wyprzedzenieTygodni: 13 }))
    zle(cykl({ wyprzedzenieTygodni: -1 }))
    expect(sprawdzWpis(cykl({ dzien: 31, wyprzedzenieTygodni: 0 })).ok).toBe(true)
  })

  it('pilnuje limitów długości', () => {
    zle(cykl({ tytul: 'x'.repeat(121) }))
    zle({ dzial: 'luka', tytul: 'L', tresc: 'x'.repeat(4001), ileCzasu: '' })
    zle({ dzial: 'luka', tytul: 'L', tresc: '', ileCzasu: 'x'.repeat(81) })
    zle({ dzial: 'przemyslenie', tytul: 'P', tresc: 'x'.repeat(20_001) })
    expect(sprawdzWpis({ dzial: 'przemyslenie', tytul: 'P', tresc: 'x'.repeat(20_000) }).ok).toBe(true)
    zle(cykl({ rozlicza: ['x'.repeat(41)] }))
    zle(cykl({ rozlicza: Array.from({ length: 11 }, (_, i) => `R${i}`) }))
  })

  it('strategia: tylko link https, okres rosnący w latach 2000-2100', () => {
    zle(strategia({ link: 'javascript:alert(1)' }))
    zle(strategia({ okresOd: 2027, okresDo: 2026 }))
    zle(strategia({ okresOd: 1999 }))
    zle(strategia({ status: 'archiwalna' }))
    expect(sprawdzWpis(strategia({ link: '' })).ok).toBe(true)
  })

  it('strategia: cele przycięte, bez id dostają null do nadania przez serwer, limity', () => {
    const w = sprawdzWpis(strategia({ cele: [{ id: 'c1', tresc: ' Bezpieczne konta ' }, { tresc: 'Nowy' }] }))
    expect(w.ok && w.pola.dzial === 'strategia' && w.pola.cele).toEqual([{ id: 'c1', tresc: 'Bezpieczne konta' }, { id: '', tresc: 'Nowy' }])
    zle(strategia({ cele: [{ id: 'c', tresc: '' }] }))
    zle(strategia({ cele: [{ id: 'c', tresc: 'x'.repeat(301) }] }))
    zle(strategia({ cele: Array.from({ length: 21 }, (_, i) => ({ id: `c${i}`, tresc: 'x' })) }))
  })

  it('odrzuca pola spoza działu', () => {
    const w = sprawdzWpis({ dzial: 'luka', tytul: 'L', tresc: '', ileCzasu: 'semestr', miesiac: 3, kadencjaId: 'obca' })
    expect(w.ok && w.pola).toEqual({ dzial: 'luka', tytul: 'L', tresc: '', ileCzasu: 'semestr' })
  })
})

describe('sprawdzAdnotacje', () => {
  const cele = [{ id: 'y', tresc: 'Cel' }]

  it('cel spoza listy celów to błąd', () => {
    expect(sprawdzAdnotacje({ celId: 'x', stanCelu: 'zrealizowany' }, cele).ok).toBe(false)
  })

  it('wymaga stanu, stanu celu albo komentarza', () => {
    expect(sprawdzAdnotacje({ komentarz: '   ' }, cele).ok).toBe(false)
    expect(sprawdzAdnotacje({ stan: 'przejmuje', komentarz: ' od marca ' }, cele)).toEqual({
      ok: true, pola: { stan: 'przejmuje', celId: null, stanCelu: null, komentarz: 'od marca' },
    })
    expect(sprawdzAdnotacje({ celId: 'y', stanCelu: 'porzucony' }, cele).ok).toBe(true)
    expect(sprawdzAdnotacje({ komentarz: 'tylko uwaga' }, cele).ok).toBe(true)
  })

  it('odrzuca zły stan i za długi komentarz', () => {
    expect(sprawdzAdnotacje({ stan: 'usuniete' }, cele).ok).toBe(false)
    expect(sprawdzAdnotacje({ celId: 'y', stanCelu: 'prawie' }, cele).ok).toBe(false)
    expect(sprawdzAdnotacje({ komentarz: 'x'.repeat(501) }, cele).ok).toBe(false)
  })
})

describe('sprawdzKadencje', () => {
  it('przycina i pilnuje długości', () => {
    expect(sprawdzKadencje({ nazwa: ' 2025/26 ', autor: ' Jan K. ', funkcja: '' })).toEqual({
      ok: true, pola: { nazwa: '2025/26', autor: 'Jan K.', funkcja: null },
    })
    expect(sprawdzKadencje({ nazwa: '', autor: 'A' }).ok).toBe(false)
    expect(sprawdzKadencje({ nazwa: 'x'.repeat(41), autor: 'A' }).ok).toBe(false)
    expect(sprawdzKadencje({ nazwa: 'N', autor: 'x'.repeat(81) }).ok).toBe(false)
  })
})
