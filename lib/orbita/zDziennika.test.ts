import { describe, it, expect } from 'vitest'
import { szkicZDziennika } from '@/lib/orbita/zDziennika'
import type { WpisCyklu } from '@/lib/dziennik/typy'

const wpis: WpisCyklu = {
  id: 'w1', dzial: 'cykl', kadencjaId: 'k', tytul: 'Sprawozdanie dla KR', tresc: 'Co roku w marcu', utworzono: 1, zmieniono: 1,
  adnotacje: [], miesiac: 3, dzien: 15, wyprzedzenieTygodni: 2, obowiazkowe: true, rozlicza: ['KR'],
}

describe('szkicZDziennika', () => {
  it('tytuł, kontekst, najbliższy termin i źródło z wpisu', () => {
    const s = szkicZDziennika(wpis, { rok: 2026, miesiac: 11, dzien: 20 })
    expect(s).toMatchObject({
      tytul: 'Sprawozdanie dla KR', kontekst: 'Co roku w marcu', termin: '2027-03-15',
      zrodlo: { typ: 'dziennik', wpisId: 'w1', termin: '2027-03-15' },
    })
    expect(s.etapy).toHaveLength(1)
    expect(s.etapy[0].rodzaj).toBe('praca')
  })
})
