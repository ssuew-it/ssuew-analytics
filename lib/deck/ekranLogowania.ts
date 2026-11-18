/**
 * Co losuje się na ekranie logowania przy każdym wejściu. Czyste dane - samo
 * losowanie dzieje się dopiero w przeglądarce, po zamontowaniu strony.
 */

export const SCENY = ['deszcz', 'radar', 'siec'] as const
export type Scena = (typeof SCENY)[number]

export const NAGLOWKI = [
  'Dane, które wyglądają jak centrum dowodzenia.',
  'Cała kadencja samorządu na jednym ekranie.',
  'Rekrutacje, retencja i KPI - zanim zapytasz.',
  'Liczby, które mówią, co robić dalej.',
  'Każdy projekt samorządu w jednym sygnale.',
] as const

export const PULA_TELEMETRII = [
  'rekrutacje: sygnał gotowy',
  'retencja: krzywe skalibrowane',
  'kpi r/r: porównanie na żywo',
  'planer: semestr zsynchronizowany',
  'skrzynka: kolejka posortowana',
  'strony: search console podłączone',
  'odprawa: wnioski przygotowane',
] as const

/** Zawsze na końcu - telemetria kończy się na tym, że system czeka na człowieka. */
export const OSTATNIA_TELEMETRIA = 'sejf: czeka na operatora'
const ILE_Z_PULI = 3

export interface EkranLogowania {
  scena: Scena
  naglowek: string
  telemetria: string[]
}

function wybierz<T>(lista: readonly T[], los: () => number): T {
  return lista[Math.min(lista.length - 1, Math.floor(los() * lista.length))]
}

export function losujEkran(los: () => number = Math.random): EkranLogowania {
  const scena = wybierz(SCENY, los)
  const naglowek = wybierz(NAGLOWKI, los)
  // Losowanie bez powtórzeń: wyjmujemy wybrane z kopii puli.
  const reszta: string[] = [...PULA_TELEMETRII]
  const telemetria: string[] = []
  for (let i = 0; i < ILE_Z_PULI; i++) {
    const idx = Math.min(reszta.length - 1, Math.floor(los() * reszta.length))
    telemetria.push(reszta.splice(idx, 1)[0])
  }
  return { scena, naglowek, telemetria: [...telemetria, OSTATNIA_TELEMETRIA] }
}
