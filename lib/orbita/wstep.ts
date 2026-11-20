import { zIso } from '@/lib/planer/trwanie'
import { biezacy } from './zapas'
import type { Zadanie } from './typy'

const dwie = (n: number) => String(n).padStart(2, '0')

function termin(z: Zadanie): string {
  const d = z.termin ? zIso(z.termin) : null
  return d ? `${dwie(d.dzien)}.${dwie(d.miesiac)}.${d.rok}` : 'bez terminu'
}

const lubBrak = (s: string) => s.trim() || 'brak'

/** Kolejne linie wyniku wcięte, żeby było widać, do którego etapu należą. */
const wciecie = (s: string) => s.trim().split('\n').join('\n  ')

/**
 * Wstęp do rozmowy z Claude dla bieżącego etapu (spec sekcja 6) - szablon,
 * bez AI, gotowy do wklejenia. Zamknięte zadanie dostaje wstęp ostatniego etapu.
 */
export function wstepDoClaude(z: Zadanie): string {
  const k = biezacy(z) ?? z.etapy.length - 1
  const e = z.etapy[k]
  const ustalenia = z.etapy
    .slice(0, k)
    .filter((x) => x.zamkniety !== null && x.wynik.trim())
    .map((x) => `- ${x.nazwa}: ${wciecie(x.wynik)}`)
  const pozostale = z.etapy.slice(k + 1).map((x) => x.nazwa)
  return [
    `Pracuję nad: ${z.tytul}`,
    `Termin: ${termin(z)}`,
    `Kontekst: ${lubBrak(z.kontekst)}`,
    '',
    `Teraz etap ${k + 1} z ${z.etapy.length}: ${e.nazwa}`,
    `Cel etapu: ${lubBrak(e.cel)}`,
    `Zacznij od: ${lubBrak(e.zacznijOd)}`,
    `Gotowe, gdy: ${lubBrak(e.gotoweGdy)}`,
    `Materiały: ${lubBrak(e.materialy)}`,
    '',
    'Ustalenia z poprzednich etapów:',
    ...(ustalenia.length ? ustalenia : ['brak']),
    '',
    `Pozostałe etapy: ${pozostale.length ? pozostale.join(', ') : 'brak'}`,
    '',
    'Pomóż mi przejść ten etap. Zacznij od pytań, jeśli czegoś brakuje.',
  ].join('\n')
}
