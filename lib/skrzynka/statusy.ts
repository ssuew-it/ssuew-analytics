import { dzisWarszawa, polnocWarszawa } from '@/lib/czas'
import { przesunDate, type Data } from '@/lib/planer/trwanie'
import type { Kierunek, StanSprawy, WatekZGmaila, WiadomoscMeta } from './typy'

export const DNI_ALARMU = 3
/** Przy imporcie starsze sprawy idą do archiwum - inaczej start dałby setki fałszywych alarmów. */
export const ARCHIWUM_MS = 30 * 24 * 3_600_000
const KATEGORIE_MASOWE = ['CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS']

export function kierunek(w: WiadomoscMeta, nasz: string): Kierunek {
  return w.od?.email.toLowerCase() === nasz.toLowerCase() ? 'my' : 'oni'
}

export function czyMasowa(w: WiadomoscMeta): boolean {
  return w.masowa || w.etykiety.some((e) => KATEGORIE_MASOWE.includes(e))
}

/** Pierwsza ich wiadomość po naszej ostatniej; `null`, gdy ostatnie słowo jest nasze. */
function poczatekCzekania(wiadomosci: WiadomoscMeta[], nasz: string): number | null {
  let od: number | null = null
  for (const w of wiadomosci) {
    if (kierunek(w, nasz) === 'my') od = null
    else if (od === null) od = w.kiedy
  }
  return od
}

const doOdpowiedzi = (oczekujeOd: number): StanSprawy => ({ status: 'do-odpowiedzi', oczekujeOd, nowa: true })

export interface KontekstOceny {
  nasz: string
  /** Druga strona jest na liście „zawsze pomijaj”. */
  pomijana: boolean
  teraz: number
  /** Pierwszy import skrzynki - stare sprawy idą do archiwum. */
  import: boolean
}

/**
 * Automat statusów (spec §5). `poprzednia` to stan z bazy z czasem ostatniej
 * znanej wiadomości; `null` - sprawa nowa. Wątek ma co najmniej jedną
 * wiadomość, od najstarszej.
 */
export function ocenSprawe(
  poprzednia: (StanSprawy & { ostatniaKiedy: number }) | null,
  watek: WatekZGmaila,
  k: KontekstOceny,
): StanSprawy {
  const ws = watek.wiadomosci
  const ostatnia = ws[ws.length - 1]

  if (!poprzednia) {
    if (k.pomijana) return { status: 'pominieta', oczekujeOd: null, nowa: false }
    if (k.import && k.teraz - ostatnia.kiedy > ARCHIWUM_MS) return { status: 'zalatwiona', oczekujeOd: null, nowa: false }
    const pierwszaIch = ws.find((w) => kierunek(w, k.nasz) === 'oni')
    if (pierwszaIch && czyMasowa(pierwszaIch)) return { status: 'do-przejrzenia', oczekujeOd: null, nowa: true }
    const od = poczatekCzekania(ws, k.nasz)
    return od === null ? { status: 'czeka-na-nich', oczekujeOd: null, nowa: false } : doOdpowiedzi(od)
  }

  const nowe = ws.filter((w) => w.kiedy > poprzednia.ostatniaKiedy)
  if (!nowe.length) return { status: poprzednia.status, oczekujeOd: poprzednia.oczekujeOd, nowa: poprzednia.nowa }
  const ichNowe = nowe.some((w) => kierunek(w, k.nasz) === 'oni')
  const ostatniKierunek = kierunek(nowe[nowe.length - 1], k.nasz)

  switch (poprzednia.status) {
    case 'pominieta':
    case 'do-przejrzenia':
    case 'w-toku':
      return { status: poprzednia.status, oczekujeOd: null, nowa: poprzednia.nowa || ichNowe }
    case 'czeka-na-nich':
    case 'zalatwiona':
      if (ostatniKierunek === 'oni') return doOdpowiedzi(poczatekCzekania(nowe, k.nasz) ?? ostatnia.kiedy)
      return { status: poprzednia.status, oczekujeOd: null, nowa: poprzednia.nowa }
    case 'do-odpowiedzi':
      if (ostatniKierunek === 'my') return { status: 'czeka-na-nich', oczekujeOd: null, nowa: false }
      return doOdpowiedzi(poprzednia.oczekujeOd ?? poczatekCzekania(nowe, k.nasz) ?? ostatnia.kiedy)
  }
}

const roboczy = (d: Data) => {
  const t = new Date(Date.UTC(d.rok, d.miesiac - 1, d.dzien)).getUTCDay()
  return t >= 1 && t <= 5
}

/**
 * Chwila graniczna alarmu: co czeka od wcześniej, jest po terminie. To
 * północ (Warszawa) czwartego dnia roboczego wstecz, licząc dziś - wtedy
 * między dniem maila a dziś mieszczą się co najmniej 4 dni robocze.
 */
export function progAlarmu(teraz: number): number {
  let d = dzisWarszawa(new Date(teraz))
  let n = 0
  for (;;) {
    if (roboczy(d)) n++
    if (n === DNI_ALARMU + 1) return polnocWarszawa(d)
    d = przesunDate(d, -1)
  }
}

export function poTerminie(oczekujeOd: number | null, teraz: number): boolean {
  return oczekujeOd !== null && oczekujeOd < progAlarmu(teraz)
}
