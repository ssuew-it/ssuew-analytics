import { describe, it, expect } from 'vitest'
import { obrazDziennika } from '@/lib/dziennik/obraz'
import type { Ksiega, Wpis } from '@/lib/dziennik/typy'

const baza = { kadencjaId: 'k1', tresc: 'tajne przemyślenia o ludziach', utworzono: 1, zmieniono: 1, adnotacje: [] }
const cykl = (id: string, x: object): Wpis => ({ ...baza, id, dzial: 'cykl', tytul: id, miesiac: 12, dzien: 15, wyprzedzenieTygodni: 2, obowiazkowe: false, rozlicza: [], ...x }) as Wpis
const ksiega = (wpisy: Wpis[]): Ksiega => ({ otwartaKadencjaId: 'k1', kadencje: [], wpisy })
const DZIS = { rok: 2026, miesiac: 11, dzien: 19 }

describe('obrazDziennika', () => {
  it('tylko kalendarz pracy w oknie 30 dni, bez treści', () => {
    const obraz = obrazDziennika(ksiega([
      cykl('Sprawozdanie dla KR', { obowiazkowe: true, rozlicza: ['KR'] }),
      cykl('Daleko', { miesiac: 4 }),
      cykl('Zamknięte', { adnotacje: [{ id: 'a', kadencjaId: 'k1', stan: 'zamkniete', celId: null, stanCelu: null, komentarz: '', kiedy: 1 }] }),
      { ...baza, id: 'p', dzial: 'przemyslenie', tytul: 'O ludziach' },
    ]), DZIS)
    expect(obraz).toEqual([{ tytul: 'Sprawozdanie dla KR', termin: '15.12.2026', przygotowaniaOd: '01.12.2026', obowiazkowe: true, rozlicza: ['KR'] }])
    expect(JSON.stringify(obraz)).not.toContain('tajne')
  })
})
