import { zIso, type Data } from '@/lib/planer/trwanie'
import { planDnia } from './zapas'
import type { Zadanie } from './typy'

/** Co z Orbity widzi asystent: tytuły etapów i terminy, bez kontekstu, materiałów i wyników. */
export interface ObrazOrbity {
  dzis: { zadanie: string; etap: string; zapasDni: number; termin: string /* DD.MM.RRRR */ }[]
  /** Nic nie musi ruszyć dziś - w `dzis` jest tylko najbliższy etap. */
  podpowiedz: boolean
  czekam: { zadanie: string; etap: string; czekaNa: string[]; do: string /* DD.MM.RRRR */ }[]
}

const dwie = (n: number) => String(n).padStart(2, '0')
const naTekst = (d: Data) => `${dwie(d.dzien)}.${dwie(d.miesiac)}.${d.rok}`

export function obrazOrbity(zadania: Zadanie[], dzis: Data): ObrazOrbity {
  const plan = planDnia(zadania, dzis)
  return {
    dzis: plan.dzis.map((p) => ({
      zadanie: p.zadanie.tytul,
      etap: p.zadanie.etapy[p.etap].nazwa,
      zapasDni: p.zapas,
      termin: p.zadanie.termin ? naTekst(zIso(p.zadanie.termin)!) : '',
    })),
    podpowiedz: plan.podpowiedz,
    czekam: plan.czekam.map((c) => {
      const e = c.zadanie.etapy[c.etap]
      return { zadanie: c.zadanie.tytul, etap: e.nazwa, czekaNa: e.czekaNa, do: naTekst(c.do) }
    }),
  }
}
