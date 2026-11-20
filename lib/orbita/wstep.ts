import { zIso } from '@/lib/planer/trwanie'
import { biezacy } from './zapas'
import type { Etap, Zadanie } from './typy'

const dwie = (n: number) => String(n).padStart(2, '0')

function termin(z: Zadanie): string {
  const d = z.termin ? zIso(z.termin) : null
  return d ? `${dwie(d.dzien)}.${dwie(d.miesiac)}.${d.rok}` : 'bez terminu'
}

const lubBrak = (s: string) => s.trim() || 'brak'

/** Kolejne linie wyniku wcięte, żeby było widać, do którego etapu należą; puste bez wiszących spacji. */
const wciecie = (s: string) =>
  s
    .trim()
    .split('\n')
    .map((l, i) => (i === 0 || !l.trim() ? l.trimEnd() : `  ${l.trimEnd()}`))
    .join('\n')

const ustalenia = (etapy: Etap[]) => {
  const linie = etapy.filter((x) => x.zamkniety !== null && x.wynik.trim()).map((x) => `- ${x.nazwa}: ${wciecie(x.wynik)}`)
  return linie.length ? linie : ['brak']
}

const zakonczenie = 'Pomóż mi przejść ten etap. Zacznij od pytań, jeśli czegoś brakuje.'

/**
 * Wstęp do rozmowy z Claude dla bieżącego etapu (spec sekcja 6) - szablon,
 * bez AI, gotowy do wklejenia. Zamknięte zadanie dostaje podsumowanie wszystkich etapów.
 */
export function wstepDoClaude(z: Zadanie): string {
  const naglowek = [`Pracuję nad: ${z.tytul}`, `Termin: ${termin(z)}`, `Kontekst: ${lubBrak(z.kontekst)}`, '']
  const k = biezacy(z)
  if (k === null) {
    return [
      ...naglowek,
      `Wszystkie etapy zamknięte (${z.etapy.length} z ${z.etapy.length}).`,
      '',
      'Ustalenia z etapów:',
      ...ustalenia(z.etapy),
      '',
      'Pomóż mi podsumować to zadanie i sprawdzić, czy czegoś nie brakuje.',
    ].join('\n')
  }
  const e = z.etapy[k]
  const pozostale = z.etapy.slice(k + 1).map((x) => x.nazwa)
  return [
    ...naglowek,
    `Teraz etap ${k + 1} z ${z.etapy.length}: ${e.nazwa}`,
    `Cel etapu: ${lubBrak(e.cel)}`,
    `Zacznij od: ${lubBrak(e.zacznijOd)}`,
    `Gotowe, gdy: ${lubBrak(e.gotoweGdy)}`,
    `Materiały: ${lubBrak(e.materialy)}`,
    // Etap otwarty ponownie pamięta, do czego doszedł za pierwszym razem.
    ...(e.wynik.trim() ? [`Poprzedni wynik tego etapu: ${wciecie(e.wynik)}`] : []),
    '',
    'Ustalenia z poprzednich etapów:',
    ...ustalenia(z.etapy.slice(0, k)),
    '',
    `Pozostałe etapy: ${pozostale.length ? pozostale.join(', ') : 'brak'}`,
    '',
    zakonczenie,
  ].join('\n')
}
