import type { Etap, Zadanie } from '@/lib/orbita/typy'

/** Wspólne dane testów komponentów Orbity. */
export const DZIS = { rok: 2026, miesiac: 11, dzien: 20 }

let n = 0
export function etap(zmiany: Partial<Etap> = {}): Etap {
  n++
  return {
    id: `e${n}`, nazwa: `Etap ${n}`, rodzaj: 'praca', cel: 'Cel etapu', zacznijOd: '', materialy: '', gotoweGdy: '', dni: 3,
    czekaNa: [], czekamDo: null, zamkniety: null, wynik: '', ...zmiany,
  }
}

export function zadanie(id: string, termin: string | null, etapy: Etap[], zmiany: Partial<Zadanie> = {}): Zadanie {
  return { id, tytul: `Zadanie ${id}`, kontekst: '', termin, zrodlo: null, etapy, utworzono: 1, zmieniono: 1, zamkniete: null, ...zmiany }
}
