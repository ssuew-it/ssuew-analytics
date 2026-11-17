import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { dzisWarszawa, polnocWarszawa } from '@/lib/czas'
import { BladKalendarza, wpisyKalendarza, wykonajPlan } from '@/lib/kalendarz/google'
import { porownaj, wybierz, type PlanKalendarza } from '@/lib/kalendarz/porownanie'
import { obrazPlanera } from '@/lib/planer/obraz'
import { biezacySemestr } from '@/lib/planer/semestry'
import type { Miesiac, Semestr } from '@/lib/planer/typy'
import { czytajStan } from '@/lib/skrzynka/dane'
import { BladSkrzynki, komunikatBledu, odswiezDostep } from '@/lib/skrzynka/google'
import { odszyfruj } from '@/lib/skrzynka/szyfr'

export const runtime = 'nodejs'
export const maxDuration = 60

const TYLKO_WLASCICIEL = 'Wysyłka do kalendarza jest tylko dla właściciela'
const NIEPOLACZONY = 'Kalendarz niepołączony - połącz go w Ustawieniach skrzynki.'

class Niepolaczony extends Error {}
class ZlyMiesiac extends Error {}

const dwie = (n: number) => String(n).padStart(2, '0')
const naTekst = (m: Miesiac) => `${m.y}-${dwie(m.m)}`
const nastepny = (m: Miesiac): Miesiac => (m.m === 12 ? { m: 1, y: m.y + 1 } : { m: m.m + 1, y: m.y })

/**
 * Miesiąc wysyłki: podany (musi należeć do semestru) albo domyślny - następny,
 * a gdy go już nie ma w semestrze, bieżący, w ostateczności pierwszy.
 */
function wybranyMiesiac(semestr: Semestr, tekst: unknown, teraz: Date): Miesiac {
  const wSemestrze = (t: string) => semestr.miesiace.find((m) => naTekst(m) === t)
  if (tekst !== null && tekst !== undefined) {
    const m = typeof tekst === 'string' ? wSemestrze(tekst) : undefined
    if (!m) throw new ZlyMiesiac()
    return m
  }
  const dzis = dzisWarszawa(teraz)
  const biezacy = { m: dzis.miesiac, y: dzis.rok }
  return wSemestrze(naTekst(nastepny(biezacy))) ?? wSemestrze(naTekst(biezacy)) ?? semestr.miesiace[0]
}

/** Plan zmian liczony zawsze na serwerze - z Planera bieżącego semestru i tego, co dziś jest w kalendarzu w wybranym miesiącu. */
async function policz(miesiacTekst: unknown) {
  const teraz = new Date()
  const semestr = biezacySemestr(teraz)
  const miesiac = wybranyMiesiac(semestr, miesiacTekst, teraz)
  const stan = await czytajStan()
  if (!stan?.polaczona || !stan.kalendarz) throw new Niepolaczony()
  const po = nastepny(miesiac)
  const od = new Date(polnocWarszawa({ rok: miesiac.y, miesiac: miesiac.m, dzien: 1 })).toISOString()
  const do_ = new Date(polnocWarszawa({ rok: po.y, miesiac: po.m, dzien: 1 })).toISOString()

  const dostep = await odswiezDostep(odszyfruj(stan.token))
  const [obraz, wpisy] = await Promise.all([obrazPlanera(semestr.id), wpisyKalendarza(dostep, semestr.id, od, do_)])
  return {
    semestr: semestr.id,
    miesiace: semestr.miesiace.map(naTekst),
    miesiac: naTekst(miesiac),
    dostep,
    plan: porownaj(obraz.wydarzenia, wpisy, semestr.id, miesiac) as PlanKalendarza,
  }
}

function blad(e: unknown): NextResponse {
  if (e instanceof ZlyMiesiac) return NextResponse.json({ error: 'Ten miesiąc nie należy do bieżącego semestru.' }, { status: 400 })
  if (e instanceof Niepolaczony) return NextResponse.json({ error: NIEPOLACZONY }, { status: 409 })
  if (e instanceof BladKalendarza) {
    if (e.rodzaj === 'brak-zgody') return NextResponse.json({ error: NIEPOLACZONY }, { status: 409 })
    if (e.rodzaj === 'api-wylaczone') return NextResponse.json({ error: 'Włącz Google Calendar API w projekcie deck-samorzad.' }, { status: 503 })
    if (e.rodzaj === 'limit') return NextResponse.json({ error: 'Google chwilowo ogranicza tempo - spróbuj za minutę.' }, { status: 429 })
    console.error('[kalendarz]', e)
    return NextResponse.json({ error: 'Kalendarz Google nie odpowiedział - spróbuj ponownie.' }, { status: 502 })
  }
  if (e instanceof BladSkrzynki) {
    const k = komunikatBledu(e)
    return NextResponse.json({ error: k.error }, { status: k.status })
  }
  console.error('[kalendarz]', e)
  return NextResponse.json({ error: 'Nie udało się porównać Planera z kalendarzem.' }, { status: 500 })
}

/** Podsumowanie wybranego miesiąca (`?miesiac=2026-12`): co D.E.C.K. przejmie, doda, zmieni i usunie. Nic nie zapisuje. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  try {
    const { semestr, miesiace, miesiac, plan } = await policz(req.nextUrl.searchParams.get('miesiac'))
    return NextResponse.json({ semestr, miesiace, miesiac, plan })
  } catch (e) {
    return blad(e)
  }
}

/**
 * Wysyłka `{ miesiac, wybrane }`: plan liczony od nowa i wykonane tylko pozycje
 * zaznaczone i nadal aktualne - zmiana w Planerze po otwarciu okna nie wyśle się sama.
 */
export async function POST(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const cialo = (await req.json().catch(() => null)) as { miesiac?: unknown; wybrane?: unknown } | null
  const wybrane = cialo?.wybrane
  if (!cialo || typeof cialo.miesiac !== 'string' || !Array.isArray(wybrane) || wybrane.length > 5000 || !wybrane.every((k) => typeof k === 'string')) {
    return NextResponse.json({ error: 'Nieprawidłowe zaznaczenie - otwórz okno wysyłki jeszcze raz.' }, { status: 400 })
  }
  try {
    const { dostep, plan } = await policz(cialo.miesiac)
    return NextResponse.json(await wykonajPlan(dostep, wybierz(plan, wybrane as string[])))
  } catch (e) {
    return blad(e)
  }
}
