import { przesunDate, type Data } from '@/lib/planer/trwanie'

export const DNI_OKRESU = 28
/** Search Console ma 2-3 dni opóźnienia - ostatnie dni byłyby niepełne i udawały spadek. */
export const OPOZNIENIE_DNI = 3
export const PROG_SPADKU = 0.3
/** Przy kilku kliknięciach 30% to szum, nie spadek. */
export const MIN_KLIKNIEC_ALERTU = 50

/** Daty YYYY-MM-DD, oba końce włącznie - tak przyjmuje je Search Console. */
export interface Okres {
  od: string
  do: string
}

const dwie = (n: number) => String(n).padStart(2, '0')
const naIso = (d: Data) => `${d.rok}-${dwie(d.miesiac)}-${dwie(d.dzien)}`
const zIso = (s: string): Data => {
  const [rok, miesiac, dzien] = s.split('-').map(Number)
  return { rok, miesiac, dzien }
}

export function okresy(dzis: Data): { biezacy: Okres; poprzedni: Okres } {
  const koniec = przesunDate(dzis, -OPOZNIENIE_DNI)
  const poczatek = przesunDate(koniec, -(DNI_OKRESU - 1))
  const koniecPoprzedniego = przesunDate(poczatek, -1)
  const poczatekPoprzedniego = przesunDate(koniecPoprzedniego, -(DNI_OKRESU - 1))
  return {
    biezacy: { od: naIso(poczatek), do: naIso(koniec) },
    poprzedni: { od: naIso(poczatekPoprzedniego), do: naIso(koniecPoprzedniego) },
  }
}

export function dniOkresu(o: Okres): string[] {
  const dni: string[] = []
  let d = zIso(o.od)
  // Bezpiecznik na wypadek odwróconego okresu - nigdy nie więcej niż rok dni.
  for (let i = 0; i < 366; i++) {
    const iso = naIso(d)
    dni.push(iso)
    if (iso >= o.do) break
    d = przesunDate(d, 1)
  }
  return dni
}

/** Ułamek zmiany; `null`, gdy w poprzednim okresie było zero - procent od zera nic nie znaczy. */
export function zmiana(biez: number, pop: number): number | null {
  return pop === 0 ? null : (biez - pop) / pop
}

export function alertSpadku(biez: number, pop: number): boolean {
  return pop >= MIN_KLIKNIEC_ALERTU && (pop - biez) / pop >= PROG_SPADKU
}

/** `sc-domain:jwk26.pl` → `jwk26.pl`; `https://a.pl/b/` → `a.pl/b`. */
export function nazwaZWitryny(witryna: string): string {
  if (witryna.startsWith('sc-domain:')) return witryna.slice('sc-domain:'.length)
  try {
    const u = new URL(witryna)
    return `${u.host}${u.pathname}`.replace(/\/+$/, '')
  } catch {
    return witryna
  }
}

/** `2026-10-01` → `01.10`. */
export function dataKrotka(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`
}

export type Miara = 'klikniecia' | 'wyswietlenia' | 'ctr' | 'pozycja'

export interface OpisZmiany {
  tekst: string
  kierunek: 'gora' | 'dol' | 'brak'
  /** Czy zmiana jest na plus; `null`, gdy nie ma czego oceniać. */
  dobra: boolean | null
}

const BRAK: OpisZmiany = { tekst: '-', kierunek: 'brak', dobra: null }
const jedno = (n: number) => n.toFixed(1).replace('.', ',')
const znak = (n: number) => (n > 0 ? '+' : '')

export function opisZmiany(miara: Miara, biez: number, pop: number): OpisZmiany {
  let roznica: number
  let tekst: string
  if (miara === 'klikniecia' || miara === 'wyswietlenia') {
    const z = zmiana(biez, pop)
    if (z === null) return biez > 0 ? { tekst: 'nowe', kierunek: 'brak', dobra: null } : BRAK
    roznica = Math.round(z * 100)
    tekst = `${znak(roznica)}${roznica}%`
  } else if (miara === 'ctr') {
    if (!biez && !pop) return BRAK
    roznica = Math.round((biez - pop) * 1000) / 10
    tekst = `${znak(roznica)}${jedno(roznica)} p.p.`
  } else {
    // Pozycja 0 znaczy „brak wyświetleń”, a nie pierwsze miejsce.
    if (!biez || !pop) return BRAK
    roznica = Math.round((biez - pop) * 10) / 10
    tekst = `${znak(roznica)}${jedno(roznica)}`
  }
  if (roznica === 0) return { tekst: tekst.replace(/^-/, ''), kierunek: 'brak', dobra: null }
  // Pozycja w Google: mniejsza liczba to wyżej w wynikach.
  const dobra = miara === 'pozycja' ? roznica < 0 : roznica > 0
  return { tekst, kierunek: roznica > 0 ? 'gora' : 'dol', dobra }
}
