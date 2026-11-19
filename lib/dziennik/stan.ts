import type { StanCelu, StanWpisu, Wpis } from './typy'

const poCzasie = <T extends { kiedy: number }>(x: T[]) => [...x].sort((a, b) => a.kiedy - b.kiedy)

/** Stan wpisu = stan z ostatniej adnotacji, która go ustawia. Sam komentarz stanu nie zmienia. */
export function stanWpisu(w: Wpis): StanWpisu {
  return poCzasie(w.adnotacje.filter((a) => a.stan !== null)).at(-1)?.stan ?? 'aktualne'
}

export function stanCelu(w: Wpis, celId: string): StanCelu | null {
  return poCzasie(w.adnotacje.filter((a) => a.celId === celId && a.stanCelu !== null)).at(-1)?.stanCelu ?? null
}

/** Zamknięte i nieaktualne lądują zwinięte - nie znikają. */
export function otwarty(s: StanWpisu): boolean {
  return s !== 'zamkniete' && s !== 'nieaktualne'
}
