import { najblizszyTermin } from '@/lib/dziennik/terminy'
import type { WpisCyklu } from '@/lib/dziennik/typy'
import { naIso, type Data } from '@/lib/planer/trwanie'
import { etapPusty } from './szkielet'
import type { PolaZadania } from './typy'

/** Nowe zadanie z obowiązku Dziennika: najbliższe wystąpienie terminu i źródło do oznaczenia „w Orbicie”. */
export function szkicZDziennika(w: WpisCyklu, dzis: Data): PolaZadania {
  const termin = naIso(najblizszyTermin(w, dzis))
  return { tytul: w.tytul, kontekst: w.tresc, termin, zrodlo: { typ: 'dziennik', wpisId: w.id, termin }, etapy: [etapPusty()] }
}
