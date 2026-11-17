import { describe, it, expect } from 'vitest'
import { POLA_DOMYSLNE, type Wydarzenie } from '@/lib/planer/typy'
import { naWydarzenieGoogle, type WydarzenieGoogle } from './wydarzenie'
import { porownaj, type WpisKalendarza } from './porownanie'

const S = '2026Z'

const W = (n: Partial<Wydarzenie> = {}): Wydarzenie => ({
  ...POLA_DOMYSLNE,
  id: 'w1', tytul: 'Komisja Dydaktyczna', kategoria: 'KOMISJE',
  rok: 2026, miesiac: 11, dzien: 21, godzina: '18:00', godzinaDo: '20:00',
  budynek: 'B/L', sala: '110L', osoby: [],
  ...n,
})

/** Wpis kalendarza z wydarzenia Google; `znacznik: false` = ręczny wpis bez znacznika D.E.C.K. */
function wpis(g: WydarzenieGoogle, id: string, znacznik: boolean | string = true): WpisKalendarza {
  const p = g.extendedProperties.private
  return {
    id,
    summary: g.summary,
    start: g.start,
    end: g.end,
    location: g.location ?? null,
    deckId: znacznik ? p.deckId : null,
    deckSemestr: znacznik ? (typeof znacznik === 'string' ? znacznik : p.deckSemestr) : null,
  }
}

const pusty = { przejmij: [], dodaj: [], zmien: [], usun: [], doSprawdzenia: [] }

describe('porownaj', () => {
  it('nowe wydarzenie - dodaj; Zebrania, Aplikacje, Inne pominięte', () => {
    const plan = porownaj([
      W(),
      W({ id: 'z', kategoria: 'ZEBRANIA' }),
      W({ id: 'a', kategoria: 'APLIKACJE' }),
      W({ id: 'i', kategoria: 'INNE' }),
    ], [], S)
    expect(plan.dodaj).toEqual([naWydarzenieGoogle(W(), S)])
    expect(plan.przejmij).toEqual([])
    expect(plan.zmien).toEqual([])
  })

  it('bez zmian - nic do zrobienia', () => {
    const w = W()
    expect(porownaj([w], [wpis(naWydarzenieGoogle(w, S), 'g1')], S)).toEqual(pusty)
  })

  it('zmieniona sala albo godzina - zmień', () => {
    const stary = wpis(naWydarzenieGoogle(W({ sala: '010' }), S), 'g1')
    const plan = porownaj([W()], [stary], S)
    expect(plan.zmien).toEqual([{ wpisId: 'g1', wydarzenie: naWydarzenieGoogle(W(), S) }])
    const godzina = porownaj([W({ godzina: '17:00' })], [wpis(naWydarzenieGoogle(W(), S), 'g1')], S)
    expect(godzina.zmien).toHaveLength(1)
    expect(godzina.dodaj).toEqual([])
  })

  it('usunięte z Planera albo przeniesione do Zebrań - usuń', () => {
    const g = wpis(naWydarzenieGoogle(W(), S), 'g1')
    expect(porownaj([], [g], S).usun).toEqual([g])
    const przeniesione = porownaj([W({ kategoria: 'ZEBRANIA' })], [g], S)
    expect(przeniesione.usun).toEqual([g])
    expect(przeniesione.dodaj).toEqual([])
  })

  it('wpis ze znacznikiem innego semestru - nietknięty', () => {
    const inny = wpis(naWydarzenieGoogle(W({ id: 'stare' }), '2026L'), 'g9', '2026L')
    expect(porownaj([], [inny], S)).toEqual(pusty)
  })

  it('ręczny wpis z tym samym tytułem (inna wielkość liter) i datą - przejmij zamiast dodaj', () => {
    const reczny: WpisKalendarza = {
      id: 'r1', summary: '  komisja DYDAKTYCZNA ', start: { date: '2026-11-21' }, end: { date: '2026-11-22' },
      location: null, deckId: null, deckSemestr: null,
    }
    const plan = porownaj([W()], [reczny], S)
    expect(plan.przejmij).toEqual([{ wpisId: 'r1', wydarzenie: naWydarzenieGoogle(W(), S) }])
    expect(plan.dodaj).toEqual([])
  })

  it('dwa pasujące ręczne wpisy - do sprawdzenia, nic nie dodane', () => {
    const g = naWydarzenieGoogle(W(), S)
    const plan = porownaj([W()], [wpis(g, 'r1', false), wpis(g, 'r2', false)], S)
    expect(plan.doSprawdzenia).toEqual([{ wydarzenie: g, kandydaci: 2, spotkanie: false }])
    expect(plan.dodaj).toEqual([])
    expect(plan.przejmij).toEqual([])
  })

  it('jeden ręczny wpis nie zostanie przejęty przez dwa wydarzenia', () => {
    const a = W({ id: 'a' })
    const b = W({ id: 'b', godzina: '20:00', godzinaDo: '21:00' })
    const plan = porownaj([a, b], [wpis(naWydarzenieGoogle(a, S), 'r1', false)], S)
    expect(plan.przejmij).toHaveLength(1)
    expect(plan.dodaj).toHaveLength(1)
  })

  it('pasujący wpis z gośćmi albo cudze zaproszenie - do sprawdzenia, nie przejęty i nic nie dodane', () => {
    const g = naWydarzenieGoogle(W(), S)
    const plan = porownaj([W()], [{ ...wpis(g, 'r1', false), spotkanie: true }], S)
    expect(plan.przejmij).toEqual([])
    expect(plan.dodaj).toEqual([])
    expect(plan.doSprawdzenia).toEqual([{ wydarzenie: g, kandydaci: 1, spotkanie: true }])
  })

  it('ręczny wpis bez pary w Planerze - nietknięty', () => {
    const reczny = wpis(naWydarzenieGoogle(W({ tytul: 'Urodziny' }), S), 'r1', false)
    expect(porownaj([W()], [reczny], S)).toEqual({ ...pusty, dodaj: [naWydarzenieGoogle(W(), S)] })
  })

  it('tytuł z dopiskiem „godzina do ustalenia” pasuje do ręcznego wpisu bez dopisku', () => {
    const w = W({ godzina: null, godzinaDo: null })
    const reczny = wpis(naWydarzenieGoogle(W(), S), 'r1', false)
    expect(porownaj([w], [reczny], S).przejmij).toHaveLength(1)
  })
})
