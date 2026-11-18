import { miejsceSpecjalne } from './budynki'
import { KATEGORIE, type Wydarzenie } from './typy'

/** Koniec przed startem znaczy: kończy się następnego dnia (18:00-04:00). */
export function przezPolnoc(w: Pick<Wydarzenie, 'godzina' | 'godzinaDo'>): boolean {
  return !!w.godzina && !!w.godzinaDo && w.godzinaDo < w.godzina
}

/**
 * „cały dzień”, „18:00-20:00”, „18:00-04:00 (+1)”, „18:00” albo nic, gdy godzina nieustalona.
 * Koniec 23:59 to w danych „do końca dnia”, czyli koniec nieznany - pokazujemy „od 16:30”.
 */
export function opisCzasu(w: Pick<Wydarzenie, 'calyDzien' | 'godzina' | 'godzinaDo'>): string | null {
  if (w.calyDzien) return 'cały dzień'
  if (w.godzina && w.godzinaDo === '23:59') return `od ${w.godzina}`
  if (w.godzina && w.godzinaDo) return `${w.godzina}-${w.godzinaDo}${przezPolnoc(w) ? ' (+1)' : ''}`
  return w.godzina
}

/** „B/L 110L”, sam budynek, sama sala ze starszych wpisów albo miejsce spoza budynków („Online: Teams”). */
export function opisMiejsca(w: Pick<Wydarzenie, 'budynek' | 'sala'>): string | null {
  const specjalne = miejsceSpecjalne(w.budynek)
  if (specjalne) return w.sala ? specjalne.zOpisem(w.sala) : specjalne.etykieta
  if (w.budynek && w.sala) return `${w.budynek} ${w.sala}`
  return w.budynek ?? w.sala
}

export function opisOsob(osoby: string[]): string | null {
  if (!osoby.length) return null
  return osoby.includes('wszyscy') ? 'wszyscy' : osoby.join(', ')
}

/** Klucz czasu do sortowania: cały dzień przed godzinami, nieustalona na końcu. */
const kluczCzasu = (w: Wydarzenie) => (w.calyDzien ? '00:00' : w.godzina ?? '99:99')

/**
 * Kolejność w kratce i w eksporcie: najpierw ranga kategorii, w obrębie rangi
 * w kolejności zegara, na końcu tytuł.
 */
export function porownajWydarzenia(a: Wydarzenie, b: Wydarzenie): number {
  return (
    KATEGORIE[a.kategoria].ranga - KATEGORIE[b.kategoria].ranga
    || kluczCzasu(a).localeCompare(kluczCzasu(b))
    || a.tytul.localeCompare(b.tytul, 'pl')
  )
}
