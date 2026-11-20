import { describe, it, expect } from 'vitest'
import { biezacy, czeka, dopasuj, ileBrakuje, planDnia, zapas } from '@/lib/orbita/zapas'
import { szkieletDokumentu } from '@/lib/orbita/szkielet'
import type { Etap, RodzajEtapu, Zadanie } from '@/lib/orbita/typy'

const d = (rok: number, miesiac: number, dzien: number) => ({ rok, miesiac, dzien })
const DZIS = d(2026, 11, 20)

let n = 0
function etap(rodzaj: RodzajEtapu, dni: number, zmiany: Partial<Etap> = {}): Etap {
  n++
  return {
    id: `e${n}`, nazwa: `Etap ${n}`, rodzaj, cel: '', zacznijOd: '', materialy: '', gotoweGdy: '', dni,
    czekaNa: [], czekamDo: null, zamkniety: null, wynik: '', ...zmiany,
  }
}

function zadanie(termin: string | null, etapy: Etap[], zmiany: Partial<Zadanie> = {}): Zadanie {
  return { id: 'z', tytul: 'Zadanie', kontekst: '', termin, zrodlo: null, etapy, utworzono: 0, zmieniono: 0, zamkniete: null, ...zmiany }
}

const zamkniety = (e: Etap): Etap => ({ ...e, zamkniety: 1 })

describe('zapas', () => {
  it('suma etapów od bieżącego wstecz od terminu', () => {
    expect(zapas(zadanie('2026-12-20', [etap('praca', 3), etap('praca', 7), etap('czekanie', 14)]), DZIS)).toBe(6)
  })
  it('pomija zamknięte etapy', () => {
    expect(zapas(zadanie('2026-12-20', [zamkniety(etap('praca', 3)), etap('praca', 7), etap('czekanie', 14)]), DZIS)).toBe(9)
  })
  it('szkielet 34 dni przy terminie za 20 dni → -14', () => {
    expect(zapas(zadanie('2026-12-10', szkieletDokumentu()), DZIS)).toBe(-14)
  })
  it('bez terminu → null', () => expect(zapas(zadanie(null, [etap('praca', 3)]), DZIS)).toBeNull())
  it('zamknięte zadanie → null', () => {
    expect(zapas(zadanie('2026-12-20', [zamkniety(etap('praca', 3))], { zamkniete: 5 }), DZIS)).toBeNull()
  })
  it('termin w przeszłości → ujemny zapas', () => expect(zapas(zadanie('2026-11-10', [etap('praca', 0)]), DZIS)).toBe(-10))
  it('bieżące czekanie liczy od czekamDo', () => {
    const z = zadanie('2026-12-20', [zamkniety(etap('praca', 3)), etap('czekanie', 14, { czekamDo: '2026-12-05' }), etap('praca', 3)])
    expect(zapas(z, DZIS)).toBe(12)
  })
  it('czekanie bez czekamDo liczy od dziś + dni', () => {
    // czekamDo efektywne = 4.12; do 20.12 zostaje 16, minus 3 dni pracy po nim
    const z = zadanie('2026-12-20', [zamkniety(etap('praca', 3)), etap('czekanie', 14), etap('praca', 3)])
    expect(zapas(z, DZIS)).toBe(13)
  })
})

describe('biezacy i czeka', () => {
  it('bieżący = pierwszy niezamknięty, null gdy wszystkie zamknięte', () => {
    expect(biezacy(zadanie(null, [zamkniety(etap('praca', 1)), etap('praca', 1)]))).toBe(1)
    expect(biezacy(zadanie(null, [zamkniety(etap('praca', 1))]))).toBeNull()
  })
  it('czeka do czekamDo włącznie', () => {
    const z = (czekamDo: string) => zadanie('2026-12-20', [zamkniety(etap('praca', 1)), etap('czekanie', 14, { czekamDo })])
    expect(czeka(z('2026-11-20'), DZIS)).toBe(true)
    expect(czeka(z('2026-11-19'), DZIS)).toBe(false)
  })
})

describe('planDnia', () => {
  const A = zadanie('2026-11-28', [etap('praca', 10)], { id: 'A' }) // zapas -2
  const B = zadanie('2026-11-30', [etap('praca', 10)], { id: 'B' }) // zapas 0
  const C = zadanie('2026-12-10', [etap('praca', 15)], { id: 'C' }) // zapas 5
  const D = zadanie('2027-01-31', [zamkniety(etap('praca', 1)), etap('czekanie', 14, { czekamDo: '2026-11-28' })], { id: 'D' })
  const E = zadanie(null, [etap('praca', 3)], { id: 'E' })
  const F = zadanie('2026-12-01', [zamkniety(etap('praca', 3))], { id: 'F', zamkniete: 7 })

  it('dziś, czekam, najbliżej, kiedyś, zamknięte', () => {
    const p = planDnia([C, A, D, E, B, F], DZIS)
    expect(p.dzis.map((x) => x.zadanie.id)).toEqual(['A', 'B'])
    expect(p.podpowiedz).toBe(false)
    expect(p.czekam.map((x) => x.zadanie.id)).toEqual(['D'])
    expect(p.czekam[0].do).toEqual(d(2026, 11, 28))
    expect(p.najblizej.map((x) => x.zadanie.id)).toEqual(['C'])
    expect(p.kiedys.map((z) => z.id)).toEqual(['E'])
    expect(p.zamkniete.map((z) => z.id)).toEqual(['F'])
  })
  it('czekanie po czekamDo trafia na dziś z poCzekaniu', () => {
    const G = zadanie('2027-01-31', [zamkniety(etap('praca', 1)), etap('czekanie', 14, { czekamDo: '2026-11-19' })], { id: 'G' })
    const p = planDnia([G], DZIS)
    expect(p.dzis.map((x) => [x.zadanie.id, x.poCzekaniu])).toEqual([['G', true]])
    expect(p.czekam).toEqual([])
  })
  it('nic nie pali się → podpowiedź z najmniejszym zapasem', () => {
    const H = zadanie('2026-12-14', [etap('praca', 15)], { id: 'H' }) // zapas 9
    const p = planDnia([H, C], DZIS)
    expect(p.dzis.map((x) => x.zadanie.id)).toEqual(['C'])
    expect(p.podpowiedz).toBe(true)
    expect(p.najblizej.map((x) => x.zadanie.id)).toEqual(['H'])
  })
  it('bez terminu po czekaniu zostaje w kiedyś', () => {
    const K = zadanie(null, [zamkniety(etap('praca', 1)), etap('czekanie', 3, { czekamDo: '2026-11-01' })], { id: 'K' })
    const p = planDnia([K], DZIS)
    expect(p.dzis).toEqual([])
    expect(p.kiedys.map((z) => z.id)).toEqual(['K'])
  })
})

describe('ileBrakuje i dopasuj', () => {
  it('konsultacje nietknięte, praca skrócona', () => {
    const s = szkieletDokumentu()
    expect(ileBrakuje(s, '2026-12-10', DZIS)).toBe(14)
    const w = dopasuj(s, '2026-12-10', DZIS)
    expect(w.etapy.map((e) => e.dni)).toEqual([1, 2, 14, 1, 2])
    expect(w.brakuje).toBe(0)
    expect(w.etapy.map((e) => e.id)).toEqual(s.map((e) => e.id))
  })
  it('nawet po skróceniu brakuje', () => {
    const w = dopasuj(szkieletDokumentu(), '2026-11-30', DZIS)
    expect(w.etapy.map((e) => e.dni)).toEqual([1, 1, 14, 1, 1])
    expect(w.brakuje).toBe(8)
  })
  it('mieści się → bez zmian', () => {
    const s = szkieletDokumentu()
    expect(ileBrakuje(s, '2027-03-01', DZIS)).toBe(0)
    expect(dopasuj(s, '2027-03-01', DZIS)).toEqual({ etapy: s, brakuje: 0 })
  })
  it('zamknięte etapy nie liczą się i się nie zmieniają', () => {
    const s = [zamkniety(etap('praca', 30)), etap('praca', 10)]
    expect(ileBrakuje(s, '2026-11-25', DZIS)).toBe(5)
    expect(dopasuj(s, '2026-11-25', DZIS).etapy.map((e) => e.dni)).toEqual([30, 5])
  })
  it('bez terminu nic nie brakuje', () => expect(ileBrakuje(szkieletDokumentu(), null, DZIS)).toBe(0))
})
