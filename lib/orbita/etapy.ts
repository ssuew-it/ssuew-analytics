import { naIso, przesunDate, type Data } from '@/lib/planer/trwanie'
import { LIMITY, type Zadanie } from './typy'

export const KOMUNIKAT_KOLIZJI = 'Zadanie zmieniło się w innej karcie - odśwież'

export type RodzajBleduOrbity = 'nie-ma' | 'zmienione' | 'walidacja' | 'nie-biezacy'

export class BladOrbity extends Error {
  constructor(
    readonly rodzaj: RodzajBleduOrbity,
    wiadomosc: string,
  ) {
    super(wiadomosc)
  }
}

/** Zamknięcie bieżącego etapu; następne konsultacje dostają `czekamDo` od dziś. */
export function zamknijEtap(z: Zadanie, etapId: string, wynik: string, teraz: number, dzis: Data): Zadanie {
  const k = z.etapy.findIndex((e) => e.zamkniety === null)
  if (k === -1 || z.etapy[k].id !== etapId) throw new BladOrbity('nie-biezacy', KOMUNIKAT_KOLIZJI)
  const etapy = z.etapy.map((e, i) => {
    if (i === k) return { ...e, zamkniety: teraz, wynik: wynik.trim().slice(0, LIMITY.wynik) }
    if (i === k + 1 && e.rodzaj === 'czekanie') return { ...e, czekamDo: naIso(przesunDate(dzis, e.dni)) }
    return e
  })
  return { ...z, etapy, zmieniono: teraz, zamkniete: k === etapy.length - 1 ? teraz : null }
}

/** Ponowne otwarcie - tylko ostatniego zamkniętego, żeby zamknięte zostały na początku listy. */
export function otworzEtap(z: Zadanie, etapId: string, teraz: number): Zadanie {
  const pierwszyOtwarty = z.etapy.findIndex((e) => e.zamkniety === null)
  const k = (pierwszyOtwarty === -1 ? z.etapy.length : pierwszyOtwarty) - 1
  if (k < 0 || z.etapy[k].id !== etapId) throw new BladOrbity('nie-biezacy', KOMUNIKAT_KOLIZJI)
  const etapy = z.etapy.map((e, i) => {
    if (i === k) return { ...e, zamkniety: null }
    if (i === k + 1 && e.rodzaj === 'czekanie') return { ...e, czekamDo: null }
    return e
  })
  return { ...z, etapy, zmieniono: teraz, zamkniete: null }
}
