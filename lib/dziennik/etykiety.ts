import type { Dzial, StanCelu, StanWpisu, StatusStrategii, WpisCyklu } from './typy'

export const ETYKIETY_DZIALOW: Record<Dzial, string> = {
  cykl: 'Kalendarz pracy',
  luka: 'Luki',
  watek: 'Wątki w toku',
  innowacja: 'Pole do innowacji',
  strategia: 'Strategie',
  przemyslenie: 'Przemyślenia',
}

export const ETYKIETY_STANU: Record<StanWpisu, string> = {
  aktualne: 'aktualne',
  przejmuje: 'przejmuję',
  zamkniete: 'zamknięte',
  nieaktualne: 'nieaktualne',
}

export const ETYKIETY_STATUSU: Record<StatusStrategii, string> = {
  projekt: 'projekt',
  przyjeta: 'przyjęta',
  wygasla: 'wygasła',
  zastapiona: 'zastąpiona',
}

export const ETYKIETY_STANU_CELU: Record<StanCelu, string> = {
  realizowany: 'realizowany',
  zrealizowany: 'zrealizowany',
  porzucony: 'porzucony',
}

export const MIESIACE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień']
const MIESIACE_DOPELNIACZ = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']

/** „15 marca” albo „marzec (do końca miesiąca)”. */
export function opisTerminu(w: Pick<WpisCyklu, 'miesiac' | 'dzien'>): string {
  return w.dzien === null ? `${MIESIACE[w.miesiac - 1]} (do końca miesiąca)` : `${w.dzien} ${MIESIACE_DOPELNIACZ[w.miesiac - 1]}`
}

/** „15 marca” dla konkretnej daty. */
export function dzienIMiesiac(d: { miesiac: number; dzien: number }): string {
  return `${d.dzien} ${MIESIACE_DOPELNIACZ[d.miesiac - 1]}`
}
