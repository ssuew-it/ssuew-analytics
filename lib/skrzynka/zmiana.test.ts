import { describe, it, expect } from 'vitest'
import { sprawdzZmiane } from '@/lib/skrzynka/zmiana'

const SKLAD = ['Jula', 'Kuba']

describe('sprawdzZmiane', () => {
  it('przepuszcza status, przypisanie ze Składu (albo nikogo) i pominięcie', () => {
    expect(sprawdzZmiane({ status: 'w-toku' }, SKLAD)).toEqual({ status: 'w-toku' })
    expect(sprawdzZmiane({ przypisana: 'Jula' }, SKLAD)).toEqual({ przypisana: 'Jula' })
    expect(sprawdzZmiane({ przypisana: null }, SKLAD)).toEqual({ przypisana: null })
    expect(sprawdzZmiane({ pomin: 'domena' }, SKLAD)).toEqual({ pomin: 'domena' })
  })

  it('odrzuca nieznany status, osobę spoza Składu, złe pominięcie i pustą zmianę', () => {
    expect(sprawdzZmiane({ status: 'archiwum' }, SKLAD)).toBeNull()
    expect(sprawdzZmiane({ przypisana: 'Obcy' }, SKLAD)).toBeNull()
    expect(sprawdzZmiane({ pomin: 'wszystko' }, SKLAD)).toBeNull()
    expect(sprawdzZmiane({}, SKLAD)).toBeNull()
    expect(sprawdzZmiane(null, SKLAD)).toBeNull()
  })
})
