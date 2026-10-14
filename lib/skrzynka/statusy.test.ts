import { describe, it, expect } from 'vitest'
import { ocenSprawe, poTerminie, progAlarmu, ARCHIWUM_MS } from '@/lib/skrzynka/statusy'
import type { Status, WatekZGmaila, WiadomoscMeta } from '@/lib/skrzynka/typy'

const NASZ = 'kontakt@samorzad.ue.wroc.pl'
const TERAZ = Date.UTC(2026, 9, 14, 10)

function m(kto: 'my' | 'oni', kiedy: number, extra: Partial<WiadomoscMeta> = {}): WiadomoscMeta {
  const od = kto === 'my' ? { email: NASZ, imie: 'Samorząd' } : { email: 'anna@firma.pl', imie: 'Anna' }
  return { id: `m${kiedy}`, kiedy, od, do: [], temat: 'Współpraca', etykiety: ['INBOX'], masowa: false, fragment: '', ...extra }
}
const w = (...wiadomosci: WiadomoscMeta[]): WatekZGmaila => ({ id: 't1', wiadomosci })
const k = { nasz: NASZ, pomijana: false, teraz: TERAZ, import: false }

describe('ocenSprawe - nowy wątek', () => {
  it('ich mail - Do odpowiedzi od tej chwili', () => {
    expect(ocenSprawe(null, w(m('oni', 100)), k)).toEqual({ status: 'do-odpowiedzi', oczekujeOd: 100, nowa: true })
  })

  it('ostatnie słowo nasze - Czeka na nich', () => {
    expect(ocenSprawe(null, w(m('oni', 100), m('my', 200)), k)).toEqual({ status: 'czeka-na-nich', oczekujeOd: null, nowa: false })
    expect(ocenSprawe(null, w(m('my', 100)), k).status).toBe('czeka-na-nich')
  })

  it('czekanie liczone od pierwszego ich maila po naszej odpowiedzi', () => {
    expect(ocenSprawe(null, w(m('oni', 100), m('my', 200), m('oni', 300), m('oni', 400)), k).oczekujeOd).toBe(300)
  })

  it('kategoria Gmaila albo nagłówek listy - Do przejrzenia', () => {
    expect(ocenSprawe(null, w(m('oni', 100, { etykiety: ['INBOX', 'CATEGORY_PROMOTIONS'] })), k).status).toBe('do-przejrzenia')
    expect(ocenSprawe(null, w(m('oni', 100, { masowa: true })), k)).toEqual({ status: 'do-przejrzenia', oczekujeOd: null, nowa: true })
  })

  it('pomijany nadawca - Pominięta, nawet gdy to reklama', () => {
    expect(ocenSprawe(null, w(m('oni', 100, { masowa: true })), { ...k, pomijana: true }).status).toBe('pominieta')
  })

  it('import: ostatnia wiadomość starsza niż 30 dni - Załatwiona', () => {
    const stary = TERAZ - ARCHIWUM_MS - 1
    expect(ocenSprawe(null, w(m('oni', stary)), { ...k, import: true })).toEqual({ status: 'zalatwiona', oczekujeOd: null, nowa: false })
    expect(ocenSprawe(null, w(m('oni', stary)), k).status).toBe('do-odpowiedzi')
  })
})

describe('ocenSprawe - znana sprawa', () => {
  const pop = (status: Status, oczekujeOd: number | null = null) => ({ status, oczekujeOd, nowa: false, ostatniaKiedy: 100 })

  it('bez nowych wiadomości - bez zmian', () => {
    expect(ocenSprawe(pop('w-toku'), w(m('oni', 100)), k)).toEqual({ status: 'w-toku', oczekujeOd: null, nowa: false })
  })

  it('ich mail w Czeka na nich i w Załatwionej - Do odpowiedzi', () => {
    expect(ocenSprawe(pop('czeka-na-nich'), w(m('my', 100), m('oni', 300)), k)).toEqual({ status: 'do-odpowiedzi', oczekujeOd: 300, nowa: true })
    expect(ocenSprawe(pop('zalatwiona'), w(m('my', 100), m('oni', 300)), k).status).toBe('do-odpowiedzi')
  })

  it('ich mail w W toku, Pominiętej i Do przejrzenia - status zostaje, znacznik nowej wiadomości', () => {
    for (const s of ['w-toku', 'pominieta', 'do-przejrzenia'] as const) {
      expect(ocenSprawe(pop(s), w(m('oni', 100), m('oni', 300)), k)).toEqual({ status: s, oczekujeOd: null, nowa: true })
    }
  })

  it('nasz mail w Do odpowiedzi - Czeka na nich; w W toku i Załatwionej bez zmian', () => {
    expect(ocenSprawe(pop('do-odpowiedzi', 100), w(m('oni', 100), m('my', 300)), k)).toEqual({ status: 'czeka-na-nich', oczekujeOd: null, nowa: false })
    expect(ocenSprawe(pop('w-toku'), w(m('oni', 100), m('my', 300)), k).status).toBe('w-toku')
    expect(ocenSprawe(pop('zalatwiona'), w(m('oni', 100), m('my', 300)), k).status).toBe('zalatwiona')
  })

  it('kolejny ich mail w Do odpowiedzi - czekanie liczone od pierwszego', () => {
    expect(ocenSprawe(pop('do-odpowiedzi', 100), w(m('oni', 100), m('oni', 300)), k)).toEqual({ status: 'do-odpowiedzi', oczekujeOd: 100, nowa: true })
  })

  it('nowe: najpierw nasz, potem ich - liczy się ostatnie słowo', () => {
    expect(ocenSprawe(pop('czeka-na-nich'), w(m('my', 100), m('my', 200), m('oni', 300)), k).status).toBe('do-odpowiedzi')
    expect(ocenSprawe(pop('czeka-na-nich'), w(m('my', 100), m('oni', 200), m('my', 300)), k).status).toBe('czeka-na-nich')
  })
})

describe('alarm 3 dni roboczych', () => {
  // Wtorek 20.10.2026, 10:00 w Warszawie (UTC+2).
  const wtorek = Date.UTC(2026, 9, 20, 8)

  it('próg to północ czwartego dnia roboczego wstecz (czwartek 15.10)', () => {
    expect(progAlarmu(wtorek)).toBe(Date.UTC(2026, 9, 14, 22))
  })

  it('pt → wt to 2 dni robocze - jeszcze nie; środa - już tak; czwartek rano - jeszcze nie', () => {
    expect(poTerminie(Date.UTC(2026, 9, 16, 7), wtorek)).toBe(false)
    expect(poTerminie(Date.UTC(2026, 9, 14, 13), wtorek)).toBe(true)
    expect(poTerminie(Date.UTC(2026, 9, 15, 6), wtorek)).toBe(false)
    expect(poTerminie(null, wtorek)).toBe(false)
  })
})
