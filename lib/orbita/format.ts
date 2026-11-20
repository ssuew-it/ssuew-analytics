import { odmiana } from '@/lib/asystent/fakty'
import { dzienIMiesiac } from '@/lib/dziennik/etykiety'
import type { Data } from '@/lib/planer/trwanie'

const DNI_TYGODNIA = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota']
const dwie = (n: number) => String(n).padStart(2, '0')

/** „czwartek 20 listopada” */
export function naglowekDnia(d: Data): string {
  return `${DNI_TYGODNIA[new Date(Date.UTC(d.rok, d.miesiac - 1, d.dzien)).getUTCDay()]} ${dzienIMiesiac(d)}`
}

/** „28.11” */
export const krotkaData = (d: Data) => `${dwie(d.dzien)}.${dwie(d.miesiac)}`

/** „zapas 3 dni”, „zapas 0 dni”, „spóźnione o 2 dni” */
export function opisZapasu(zapas: number): string {
  return zapas < 0 ? `spóźnione o ${odmiana(-zapas, ['dzień', 'dni', 'dni'])}` : `zapas ${odmiana(zapas, ['dzień', 'dni', 'dni'])}`
}
