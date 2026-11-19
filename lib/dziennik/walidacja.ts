import {
  DZIALY, STANY_CELU, STANY_WPISU, STATUSY_STRATEGII,
  type Adnotacja, type Cel, type Kadencja, type StanCelu, type StanWpisu, type StatusStrategii, type Wpis,
} from './typy'

type BezMeta<T> = T extends unknown ? Omit<T, 'id' | 'kadencjaId' | 'utworzono' | 'zmieniono' | 'adnotacje'> : never
export type PolaWpisu = BezMeta<Wpis>
export type PolaAdnotacji = Omit<Adnotacja, 'id' | 'kadencjaId' | 'kiedy'>
export type PolaKadencji = Pick<Kadencja, 'nazwa' | 'autor' | 'funkcja'>

type Wynik<T> = { ok: true; pola: T } | { ok: false; blad: string }

export const LIMITY = {
  tytul: 120, tresc: 4000, trescPrzemyslenia: 20_000, komentarz: 500, ileCzasu: 80,
  rozlicza: 10, podmiot: 40, cele: 20, cel: 300, nazwaKadencji: 40, autor: 80,
} as const

class Odrzut extends Error {}
const odrzuc = (blad: string): never => {
  throw new Odrzut(blad)
}

const tekst = (x: unknown) => (typeof x === 'string' ? x.trim() : '')

function tekstDo(x: unknown, max: number, nazwa: string, wymagany = false): string {
  const t = tekst(x)
  if (wymagany && !t) odrzuc(`${nazwa} jest wymagany`)
  if (t.length > max) odrzuc(`${nazwa}: najwyżej ${max} znaków`)
  return t
}

function calkowita(x: unknown, od: number, do_: number, nazwa: string): number {
  if (typeof x !== 'number' || !Number.isInteger(x) || x < od || x > do_) odrzuc(`${nazwa}: liczba od ${od} do ${do_}`)
  return x as number
}

function zListy<T extends string>(x: unknown, lista: readonly T[], nazwa: string): T {
  if (!(lista as readonly unknown[]).includes(x)) odrzuc(`Nieznany ${nazwa}`)
  return x as T
}

function rozlicza(x: unknown): string[] {
  const lista = [...new Set((Array.isArray(x) ? x : []).map(tekst).filter(Boolean))]
  if (lista.length > LIMITY.rozlicza) odrzuc(`Najwyżej ${LIMITY.rozlicza} podmiotów rozliczających`)
  if (lista.some((p) => p.length > LIMITY.podmiot)) odrzuc(`Nazwa podmiotu: najwyżej ${LIMITY.podmiot} znaków`)
  return lista
}

/** Cel bez `id` dostaje pusty - identyfikator nada serwer przy zapisie. */
function cele(x: unknown): Cel[] {
  const lista = Array.isArray(x) ? x : []
  if (lista.length > LIMITY.cele) odrzuc(`Najwyżej ${LIMITY.cele} celów`)
  return lista.map((c) => ({ id: tekst(c?.id), tresc: tekstDo(c?.tresc, LIMITY.cel, 'Cel', true) }))
}

function link(x: unknown): string {
  const t = tekst(x)
  if (t && !/^https:\/\/\S+$/.test(t)) odrzuc('Link musi zaczynać się od https://')
  return t
}

function pola(x: Record<string, unknown>): PolaWpisu {
  const dzial = zListy(x.dzial, DZIALY, 'dział')
  const tytul = tekstDo(x.tytul, LIMITY.tytul, 'Tytuł', true)
  const tresc = tekstDo(x.tresc, dzial === 'przemyslenie' ? LIMITY.trescPrzemyslenia : LIMITY.tresc, 'Treść')
  switch (dzial) {
    case 'cykl':
      return {
        dzial, tytul, tresc,
        miesiac: calkowita(x.miesiac, 1, 12, 'Miesiąc'),
        dzien: x.dzien === null || x.dzien === undefined ? null : calkowita(x.dzien, 1, 31, 'Dzień'),
        wyprzedzenieTygodni: x.wyprzedzenieTygodni === undefined ? 2 : calkowita(x.wyprzedzenieTygodni, 0, 12, 'Wyprzedzenie'),
        obowiazkowe: x.obowiazkowe === true,
        rozlicza: rozlicza(x.rozlicza),
      }
    case 'luka':
      return { dzial, tytul, tresc, ileCzasu: tekstDo(x.ileCzasu, LIMITY.ileCzasu, 'Ile czasu') }
    case 'watek':
      return { dzial, tytul, tresc, zostalo: tekstDo(x.zostalo, LIMITY.tresc, 'Co zostało') }
    case 'innowacja':
    case 'przemyslenie':
      return { dzial, tytul, tresc }
    case 'strategia': {
      const okresOd = calkowita(x.okresOd, 2000, 2100, 'Początek okresu')
      const okresDo = calkowita(x.okresDo, 2000, 2100, 'Koniec okresu')
      if (okresOd > okresDo) odrzuc('Okres kończy się przed początkiem')
      const uchwala = tekstDo(x.uchwala, LIMITY.tytul, 'Uchwała')
      return {
        dzial, tytul, tresc, link: link(x.link), okresOd, okresDo,
        status: zListy<StatusStrategii>(x.status, STATUSY_STRATEGII, 'status'),
        uchwala: uchwala || null,
        cele: cele(x.cele),
      }
    }
  }
}

function sprawdz<T>(f: () => T): Wynik<T> {
  try {
    return { ok: true, pola: f() }
  } catch (e) {
    if (e instanceof Odrzut) return { ok: false, blad: e.message }
    throw e
  }
}

const obiekt = (x: unknown): Record<string, unknown> => {
  if (typeof x !== 'object' || x === null) odrzuc('Pusta treść')
  return x as Record<string, unknown>
}

/** Pola wpisu z ciała żądania. Pola spoza działu (i `kadencjaId`) są pomijane. */
export function sprawdzWpis(x: unknown): Wynik<PolaWpisu> {
  return sprawdz(() => pola(obiekt(x)))
}

export function sprawdzAdnotacje(x: unknown, celeWpisu: Cel[]): Wynik<PolaAdnotacji> {
  return sprawdz(() => {
    const o = obiekt(x)
    const stan = o.stan === null || o.stan === undefined ? null : zListy<StanWpisu>(o.stan, STANY_WPISU, 'stan')
    const celId = tekst(o.celId) || null
    if (celId && !celeWpisu.some((c) => c.id === celId)) odrzuc('Nie ma takiego celu')
    const stanCelu = o.stanCelu === null || o.stanCelu === undefined ? null : zListy<StanCelu>(o.stanCelu, STANY_CELU, 'stan celu')
    if (celId && !stanCelu) odrzuc('Wybierz stan celu')
    const komentarz = tekstDo(o.komentarz, LIMITY.komentarz, 'Komentarz')
    if (!stan && !celId && !komentarz) odrzuc('Wybierz stan albo napisz komentarz')
    return { stan, celId, stanCelu: celId ? stanCelu : null, komentarz }
  })
}

export function sprawdzKadencje(x: unknown): Wynik<PolaKadencji> {
  return sprawdz(() => {
    const o = obiekt(x)
    const funkcja = tekstDo(o.funkcja, LIMITY.autor, 'Funkcja')
    return {
      nazwa: tekstDo(o.nazwa, LIMITY.nazwaKadencji, 'Nazwa kadencji', true),
      autor: tekstDo(o.autor, LIMITY.autor, 'Autor', true),
      funkcja: funkcja || null,
    }
  })
}
