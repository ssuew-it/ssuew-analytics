import { describe, it, expect } from 'vitest'
import { sprawdzOrganizacje, sprawdzUstawienia, sprawdzZmiane } from '@/lib/skrzynka/zmiana'

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

describe('sprawdzUstawienia', () => {
  it('stopka i listy: małymi literami, bez spacji i powtórzeń', () => {
    expect(sprawdzUstawienia({ stopka: 'Pozdrawiamy\nSamorząd', pomijaneAdresy: [' News@Sklep.pl', 'news@sklep.pl', ''], pomijaneDomeny: ['Reklama.pl'] })).toEqual({
      zmiana: { stopka: 'Pozdrawiamy\nSamorząd', pomijaneAdresy: ['news@sklep.pl'], pomijaneDomeny: ['reklama.pl'] },
    })
    expect(sprawdzUstawienia({ pomijaneDomeny: [] })).toEqual({ zmiana: { pomijaneDomeny: [] } })
  })

  it('odrzuca złe adresy i domeny, domeny prywatne i studentów, za długą stopkę, pustą zmianę', () => {
    expect(sprawdzUstawienia({ pomijaneAdresy: ['nie-adres'] })).toEqual({ blad: 'To nie wygląda na adres e-mail: nie-adres' })
    expect(sprawdzUstawienia({ pomijaneDomeny: ['http://x.pl'] })).toEqual({ blad: 'To nie wygląda na domenę: http://x.pl' })
    expect(sprawdzUstawienia({ pomijaneDomeny: ['Gmail.com'] })).toEqual({ blad: 'Domeny gmail.com nie można pominąć w całości - dodaj pojedyncze adresy.' })
    expect(sprawdzUstawienia({ pomijaneDomeny: ['student.ue.wroc.pl'] })).toMatchObject({ blad: expect.stringContaining('student.ue.wroc.pl') })
    expect(sprawdzUstawienia({ stopka: 'x'.repeat(1001) })).toEqual({ blad: 'Stopka może mieć najwyżej 1000 znaków.' })
    expect(sprawdzUstawienia({ pomijaneAdresy: 'a@b.pl' })).toEqual({ blad: 'Niepoprawna lista adresów' })
    expect(sprawdzUstawienia({})).toEqual({ blad: 'Brak zmian' })
    expect(sprawdzUstawienia(null)).toEqual({ blad: 'Niepoprawne ustawienia' })
  })
})

describe('sprawdzOrganizacje', () => {
  it('nazwa bez spacji na brzegach i typ z listy', () => {
    expect(sprawdzOrganizacje({ domena: 'firma.pl', nazwa: '  Firma S.A. ', typ: 'sponsor' })).toEqual({ domena: 'firma.pl', zmiana: { nazwa: 'Firma S.A.', typ: 'sponsor' } })
  })

  it('odrzuca pustą nazwę, nieznany typ, brak domeny i pustą zmianę', () => {
    expect(sprawdzOrganizacje({ domena: 'firma.pl', nazwa: '   ' })).toBeNull()
    expect(sprawdzOrganizacje({ domena: 'firma.pl', typ: 'wrog' })).toBeNull()
    expect(sprawdzOrganizacje({ nazwa: 'X' })).toBeNull()
    expect(sprawdzOrganizacje({ domena: 'firma.pl' })).toBeNull()
  })
})
