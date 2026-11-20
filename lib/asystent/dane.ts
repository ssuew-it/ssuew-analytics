import { gasList } from '@/lib/gas/client'
import { obrazPlanera } from '@/lib/planer/obraz'
import { odprawaRef, propozycjeRef } from '@/lib/firebase/admin'
import { SESJA_WYLACZONA, type StanSesjiWspolnej } from '@/lib/planer/stan'
import { dzisWarszawa } from '@/lib/czas'
import type { Wydarzenie } from '@/lib/planer/typy'
import type { Czlonek, Kohorta, KpiMetric, Projekt, Rekrutacja } from '@/types'
import type { Rola } from '@/lib/auth/role'
import type { WynikStrony } from '@/lib/strony/model'
import { liczniki, obrazSkrzynki } from '@/lib/skrzynka/dane'
import type { LicznikiSkrzynki, ObrazSkrzynki } from '@/lib/skrzynka/typy'
import { czytajKsiege } from '@/lib/dziennik/dane'
import { obrazDziennika, type PozycjaDziennikaAsystenta } from '@/lib/dziennik/obraz'
import { czytajZadania } from '@/lib/orbita/dane'
import { obrazOrbity, type ObrazOrbity } from '@/lib/orbita/obraz'
import type { Data } from '@/lib/planer/trwanie'
import { zbudujKontekst, type DaneProjektu, type KontekstProjektu } from './kontekst'
import { INSTRUKCJA_ODPRAWY, SCHEMAT_ODPRAWY, sprawdzOdprawe, wiadomoscOdprawy, type ZapisanaOdprawa } from './odprawa'
import { BladAsystenta, zapytajGemini } from './gemini'
import { GODZINA_MS, czyOdswiezyc, sladKontekstu } from './odswiezanie'

export interface DaneArkusza {
  rekrutacje: Rekrutacja[]
  kohorty: Kohorta[]
  punkty: KpiMetric[]
  projekty: Projekt[]
  czlonkowie: Czlonek[]
  /** Czas odpowiedzi arkusza; `null`, gdy wszystkie zakładki zawiodły. */
  czasMs: number | null
}

export interface StanPlanera {
  wydarzenia: Wydarzenie[]
  sesja: StanSesjiWspolnej
  sklad: string[]
  propozycje: number
  ok: boolean
}

/** Arkusz - wolny (1-3 s przy pustym cache), nigdy nie rzuca. */
export async function pobierzArkusz(): Promise<DaneArkusza> {
  const start = Date.now()
  let bledy = 0
  const bezpiecznie = <T,>(p: Promise<T[]>) => p.catch(() => {
    bledy++
    return [] as T[]
  })
  const [rekrutacje, kohorty, punkty, projekty, czlonkowie] = await Promise.all([
    bezpiecznie(gasList('rekrutacje')),
    bezpiecznie(gasList('kohorty')),
    bezpiecznie(gasList('kpi_punkty')),
    bezpiecznie(gasList('projekty')),
    bezpiecznie(gasList('czlonkowie')),
  ])
  return { rekrutacje, kohorty, punkty, projekty, czlonkowie, czasMs: bledy === 5 ? null : Date.now() - start }
}

/** Planer z Firestore - szybki, nigdy nie rzuca. Propozycje liczymy tylko właścicielowi. */
export async function pobierzPlaner(semestrId: string, rola: Rola): Promise<StanPlanera> {
  const [obraz, propozycje] = await Promise.all([
    obrazPlanera(semestrId)
      .then((o) => ({ ...o, ok: true }))
      .catch(() => ({ wydarzenia: [] as Wydarzenie[], sesja: SESJA_WYLACZONA, sklad: [] as string[], ok: false })),
    rola === 'owner'
      ? propozycjeRef(semestrId).count().get().then((s) => s.data().count).catch(() => 0)
      : Promise.resolve(0),
  ])
  return { ...obraz, propozycje }
}

export function daneProjektu(
  a: DaneArkusza,
  p: StanPlanera,
  semestr: { id: string; nazwa: string },
  notatki: string[],
  strony: WynikStrony[],
  skrzynka: ObrazSkrzynki | null,
  dziennik: PozycjaDziennikaAsystenta[] | null,
  orbita: ObrazOrbity | null,
): DaneProjektu {
  return {
    rekrutacje: a.rekrutacje, kohorty: a.kohorty, punkty: a.punkty, projekty: a.projekty, czlonkowie: a.czlonkowie,
    semestr, wydarzenia: p.wydarzenia, sesja: p.sesja, sklad: p.sklad, propozycje: p.propozycje, notatki,
    strony: strony.flatMap((w) => (w.ok ? [w.dane] : [])),
    skrzynka,
    dziennik,
    orbita,
  }
}

/** Kalendarz pracy Dziennika do obrazu projektu - nigdy nie rzuca, błąd = `null` w logach. */
export function pobierzObrazDziennika(dzis: Data): Promise<PozycjaDziennikaAsystenta[] | null> {
  return czytajKsiege()
    .then((k) => obrazDziennika(k, dzis))
    .catch((e) => {
      console.error('[asystent] dziennik:', e)
      return null
    })
}

/** Etapy Orbity do obrazu projektu - nigdy nie rzuca, błąd = `null` w logach. */
export function pobierzObrazOrbity(dzis: Data): Promise<ObrazOrbity | null> {
  return czytajZadania()
    .then((z) => obrazOrbity(z, dzis))
    .catch((e) => {
      console.error('[asystent] orbita:', e)
      return null
    })
}

/**
 * Skrzynka do obrazu projektu - nigdy nie rzuca: bez połączenia albo przy
 * błędzie sekcja jest `null`, a odprawa i czat działają dalej. Kokpit podaje
 * liczniki, które i tak pobrał dla kafelka.
 */
export function pobierzObrazSkrzynki(teraz: number, l?: Promise<LicznikiSkrzynki | null>): Promise<ObrazSkrzynki | null> {
  return (l ?? liczniki(teraz))
    .then((x) => obrazSkrzynki(teraz, x))
    .catch((e) => {
      console.error('[asystent] skrzynka:', e)
      return null
    })
}

export async function czytajOdprawe(): Promise<ZapisanaOdprawa | null> {
  const d = (await odprawaRef().get()).data()
  if (!d) return null
  const odprawa = sprawdzOdprawe(d.odprawa)
  if (!odprawa || typeof d.slad !== 'string' || typeof d.utworzono !== 'number') return null
  return { slad: d.slad, dzien: String(d.dzien ?? ''), utworzono: d.utworzono, model: String(d.model ?? ''), odprawa }
}

/** Pyta Gemini, sprawdza odpowiedź i zapisuje. Rzuca `BladAsystenta`. */
export async function generujOdprawe(k: KontekstProjektu, teraz = Date.now()): Promise<ZapisanaOdprawa> {
  const { tekst, model } = await zapytajGemini({
    instrukcja: INSTRUKCJA_ODPRAWY,
    wiadomosci: [{ rola: 'user', tekst: wiadomoscOdprawy(k) }],
    schemat: SCHEMAT_ODPRAWY,
  })
  let surowe: unknown
  try {
    surowe = JSON.parse(tekst)
  } catch {
    throw new BladAsystenta('format', 'Odprawa nie jest JSON-em')
  }
  const odprawa = sprawdzOdprawe(surowe)
  if (!odprawa) throw new BladAsystenta('format', 'Odprawa niezgodna ze schematem')
  const zapis: ZapisanaOdprawa = { slad: sladKontekstu(k), dzien: k.meta.data, utworzono: teraz, model, odprawa }
  await odprawaRef().set(zapis)
  return zapis
}

/**
 * Wołane z `after()` kokpitu - już po wysłaniu strony, więc Gemini nigdy nie
 * opóźnia wejścia. Nowa odprawa będzie widoczna przy następnym wejściu.
 * Nie rzuca: błąd w tle ma trafić do logów, nie wywrócić funkcji.
 */
export async function odswiezOdpraweWTle(w: {
  arkusz: Promise<DaneArkusza>
  planer: Promise<StanPlanera>
  zapisana: Promise<ZapisanaOdprawa | null>
  notatki: Promise<string[]>
  strony: Promise<WynikStrony[]>
  /**
   * Funkcja, nie obietnica: obraz skrzynki to do 120 odczytów. Liczymy go tylko,
   * gdy odprawy nie ma albo jest starsza niż godzina - także wtedy, gdy nowa
   * odprawa ostatecznie nie powstanie, bo dane się nie zmieniły.
   */
  skrzynka: () => Promise<ObrazSkrzynki | null>
  /** Kalendarz pracy Dziennika - jedno odczytanie księgi, wspólne z kafelkiem kokpitu. */
  dziennik: Promise<PozycjaDziennikaAsystenta[] | null>
  /** Etapy Orbity - jedno odczytanie zadań, wspólne z kafelkiem kokpitu. */
  orbita: Promise<ObrazOrbity | null>
  semestr: { id: string; nazwa: string }
  teraz: Date
}): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return
  try {
    const zapisana = await w.zapisana
    // Pierwsza reguła `czyOdswiezyc` (`lib/asystent/odswiezanie.ts`): odprawa młodsza niż godzina zostaje.
    // Sprawdzona przed obrazem skrzynki, żeby nie czytać spraw na darmo.
    if (zapisana && w.teraz.getTime() - zapisana.utworzono < GODZINA_MS) return
    const [a, p, notatki, strony] = await Promise.all([w.arkusz, w.planer, w.notatki, w.strony])
    // Odprawa z pustego arkusza albo bez Planera byłaby o niczym - poczekamy.
    if (a.czasMs === null || !p.ok) return
    const [skrzynka, dziennik, orbita] = await Promise.all([w.skrzynka(), w.dziennik, w.orbita])
    const k = zbudujKontekst(daneProjektu(a, p, w.semestr, notatki, strony, skrzynka, dziennik, orbita), dzisWarszawa(w.teraz))
    if (!czyOdswiezyc(zapisana, sladKontekstu(k), k.meta.data, w.teraz.getTime())) return
    await generujOdprawe(k, w.teraz.getTime())
  } catch (e) {
    console.error('[asystent] odprawa w tle:', e)
  }
}

export { zbudujKontekst }
