import { describe, it, expect } from 'vitest'
import { otwarty, stanCelu, stanWpisu } from '@/lib/dziennik/stan'
import type { Adnotacja, Wpis } from '@/lib/dziennik/typy'

const a = (x: Partial<Adnotacja>): Adnotacja => ({ id: 'a', kadencjaId: 'k', stan: null, celId: null, stanCelu: null, komentarz: '', kiedy: 0, ...x })
const wpis = (adnotacje: Adnotacja[]): Wpis => ({ id: 'w', dzial: 'luka', ileCzasu: '', kadencjaId: 'k', tytul: 'L', tresc: '', utworzono: 0, zmieniono: 0, adnotacje })

describe('stanWpisu', () => {
  it('bez adnotacji - aktualne', () => expect(stanWpisu(wpis([]))).toBe('aktualne'))

  it('ostatnia adnotacja ze stanem, po czasie, nie po kolejności w tablicy', () => {
    expect(stanWpisu(wpis([a({ stan: 'zamkniete', kiedy: 3 }), a({ stan: 'przejmuje', kiedy: 1 }), a({ komentarz: 'x', kiedy: 2 })]))).toBe('zamkniete')
  })

  it('sam komentarz nie zmienia stanu', () => {
    expect(stanWpisu(wpis([a({ stan: 'przejmuje', kiedy: 1 }), a({ komentarz: 'x', kiedy: 5 })]))).toBe('przejmuje')
  })
})

describe('stanCelu', () => {
  it('ostatni stan danego celu albo null', () => {
    const w = wpis([a({ celId: 'c1', stanCelu: 'realizowany', kiedy: 1 }), a({ celId: 'c1', stanCelu: 'zrealizowany', kiedy: 2 }), a({ celId: 'c2', stanCelu: 'porzucony', kiedy: 3 })])
    expect(stanCelu(w, 'c1')).toBe('zrealizowany')
    expect(stanCelu(w, 'c3')).toBeNull()
  })
})

describe('otwarty', () => {
  it('zamknięte i nieaktualne nie są otwarte', () => {
    expect(otwarty('aktualne')).toBe(true)
    expect(otwarty('przejmuje')).toBe(true)
    expect(otwarty('zamkniete')).toBe(false)
    expect(otwarty('nieaktualne')).toBe(false)
  })
})
