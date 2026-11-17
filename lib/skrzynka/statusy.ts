import { dzisWarszawa, polnocWarszawa } from '@/lib/czas'
import { przesunDate, type Data } from '@/lib/planer/trwanie'
import type { Kierunek, StanSprawy, WatekZGmaila, WiadomoscMeta } from './typy'

export const DNI_ALARMU = 3
/** Przy imporcie starsze sprawy idą do archiwum - inaczej start dałby setki fałszywych alarmów. */
export const ARCHIWUM_MS = 30 * 24 * 3_600_000
const KATEGORIE_MASOWE = ['CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS']

/** Nadawcy-automaty: noreply, powiadomienia, kody systemowe, zwroty. Sprawdzana część przed „@”. */
const AUTOMATY = /^(no-?reply|nie-?odpowiadaj|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounces?|notifications?|notify|powiadomieni[ae]|system|alerts?)([+._-].*)?@/i

/**
 * Kierunek każdej wiadomości wątku. Nasze są: kontakt@ i inne adresy domeny
 * samorządu (zespół odpowiada też ze swoich skrzynek i aliasów, np. dni.adaptacyjne@).
 * Wyjątek: w wątku bez nikogo z zewnątrz członek zespołu, który go zaczął, pisze
 * do nas - jak każdy inny nadawca.
 */
export function kierunki(ws: WiadomoscMeta[], nasz: string): Kierunek[] {
  const n = nasz.toLowerCase()
  const domena = `@${n.split('@')[1]}`
  const adres = (w: WiadomoscMeta) => w.od?.email.toLowerCase() ?? ''
  const zespol = (e: string) => e === n || e.endsWith(domena)
  const autor = adres(ws[0])
  const wewnetrzny = ws.every((w) => zespol(adres(w)))
  return ws.map((w) => {
    const e = adres(w)
    if (e === n) return 'my'
    if (!zespol(e)) return 'oni'
    return wewnetrzny && e === autor ? 'oni' : 'my'
  })
}

/** Kierunek jednej wiadomości z kontekstem jej wątku. */
export function kierunek(w: WiadomoscMeta, nasz: string, watek: WiadomoscMeta[] = [w]): Kierunek {
  const i = watek.indexOf(w)
  return kierunki(i >= 0 ? watek : [w], nasz)[i >= 0 ? i : 0]
}

export function czyMasowa(w: WiadomoscMeta): boolean {
  return w.masowa || w.etykiety.some((e) => KATEGORIE_MASOWE.includes(e)) || AUTOMATY.test(w.od?.email ?? '')
}

/** Pierwsza ich wiadomość po naszej ostatniej; `null`, gdy ostatnie słowo jest nasze. */
function poczatekCzekania(wiadomosci: WiadomoscMeta[], kier: Kierunek[]): number | null {
  let od: number | null = null
  wiadomosci.forEach((w, i) => {
    if (kier[i] === 'my') od = null
    else if (od === null) od = w.kiedy
  })
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
  const kier = kierunki(ws, k.nasz)

  if (!poprzednia) {
    if (k.pomijana) return { status: 'pominieta', oczekujeOd: null, nowa: false }
    if (k.import && k.teraz - ostatnia.kiedy > ARCHIWUM_MS) return { status: 'zalatwiona', oczekujeOd: null, nowa: false }
    const pierwszaIch = ws.find((_, i) => kier[i] === 'oni')
    if (pierwszaIch && czyMasowa(pierwszaIch)) return { status: 'do-przejrzenia', oczekujeOd: null, nowa: true }
    const od = poczatekCzekania(ws, kier)
    return od === null ? { status: 'czeka-na-nich', oczekujeOd: null, nowa: false } : doOdpowiedzi(od)
  }

  const od = ws.findIndex((w) => w.kiedy > poprzednia.ostatniaKiedy)
  if (od < 0) return { status: poprzednia.status, oczekujeOd: poprzednia.oczekujeOd, nowa: poprzednia.nowa }
  const nowe = ws.slice(od)
  const kierNowych = kier.slice(od)
  const ichNowe = kierNowych.includes('oni')
  const ostatniKierunek = kierNowych[kierNowych.length - 1]

  switch (poprzednia.status) {
    case 'pominieta':
    case 'do-przejrzenia':
    case 'w-toku':
      return { status: poprzednia.status, oczekujeOd: null, nowa: poprzednia.nowa || ichNowe }
    case 'czeka-na-nich':
    case 'zalatwiona':
      if (ostatniKierunek === 'oni') return doOdpowiedzi(poczatekCzekania(nowe, kierNowych) ?? ostatnia.kiedy)
      return { status: poprzednia.status, oczekujeOd: null, nowa: poprzednia.nowa }
    case 'do-odpowiedzi':
      if (ostatniKierunek === 'my') return { status: 'czeka-na-nich', oczekujeOd: null, nowa: false }
      return doOdpowiedzi(poprzednia.oczekujeOd ?? poczatekCzekania(nowe, kierNowych) ?? ostatnia.kiedy)
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
