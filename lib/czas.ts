import type { Data } from '@/lib/planer/trwanie'

const STREFA = 'Europe/Warsaw'

/**
 * Dzisiejsza data w Warszawie. Serwer na Vercelu liczy w UTC - bez tego
 * między północą a 2:00 „dziś” w odprawie byłoby wczorajsze.
 */
export function dzisWarszawa(teraz: Date): Data {
  const [rok, miesiac, dzien] = new Intl.DateTimeFormat('en-CA', {
    timeZone: STREFA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(teraz).split('-').map(Number)
  return { rok, miesiac, dzien }
}

export function godzinaWarszawa(teraz: Date): string {
  return new Intl.DateTimeFormat('pl-PL', { timeZone: STREFA, hour: '2-digit', minute: '2-digit' }).format(teraz)
}

/**
 * Chwila, w której w Warszawie zaczyna się dany dzień. Przesunięcie (UTC+1
 * albo UTC+2) odczytujemy z południa tego dnia - w południe zmiana czasu
 * nigdy nie wypada.
 */
export function polnocWarszawa(d: Data): number {
  const poludnie = Date.UTC(d.rok, d.miesiac - 1, d.dzien, 12)
  const godzina = Number(new Intl.DateTimeFormat('en-GB', { timeZone: STREFA, hour: '2-digit', hourCycle: 'h23' }).format(poludnie))
  return Date.UTC(d.rok, d.miesiac - 1, d.dzien) - (godzina - 12) * 3_600_000
}
