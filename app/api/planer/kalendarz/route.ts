import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { polnocWarszawa } from '@/lib/czas'
import { BladKalendarza, wpisyKalendarza, wykonajPlan } from '@/lib/kalendarz/google'
import { porownaj, type PlanKalendarza } from '@/lib/kalendarz/porownanie'
import { obrazPlanera } from '@/lib/planer/obraz'
import { biezacySemestr } from '@/lib/planer/semestry'
import { czytajStan } from '@/lib/skrzynka/dane'
import { BladSkrzynki, komunikatBledu, odswiezDostep } from '@/lib/skrzynka/google'
import { odszyfruj } from '@/lib/skrzynka/szyfr'

export const runtime = 'nodejs'
export const maxDuration = 60

const TYLKO_WLASCICIEL = 'Wysyłka do kalendarza jest tylko dla właściciela'
const NIEPOLACZONY = 'Kalendarz niepołączony - połącz go w Ustawieniach skrzynki.'

class Niepolaczony extends Error {}

/** Plan zmian liczony zawsze na serwerze - z Planera bieżącego semestru i tego, co dziś jest w kalendarzu. */
async function policz(): Promise<{ semestr: string; dostep: string; plan: PlanKalendarza }> {
  const stan = await czytajStan()
  if (!stan?.polaczona || !stan.kalendarz) throw new Niepolaczony()
  const semestr = biezacySemestr(new Date())
  const pierwszy = semestr.miesiace[0]
  const ostatni = semestr.miesiace[semestr.miesiace.length - 1]
  const po = ostatni.m === 12 ? { rok: ostatni.y + 1, miesiac: 1 } : { rok: ostatni.y, miesiac: ostatni.m + 1 }
  const od = new Date(polnocWarszawa({ rok: pierwszy.y, miesiac: pierwszy.m, dzien: 1 })).toISOString()
  const do_ = new Date(polnocWarszawa({ ...po, dzien: 1 })).toISOString()

  const dostep = await odswiezDostep(odszyfruj(stan.token))
  const [obraz, wpisy] = await Promise.all([obrazPlanera(semestr.id), wpisyKalendarza(dostep, semestr.id, od, do_)])
  return { semestr: semestr.id, dostep, plan: porownaj(obraz.wydarzenia, wpisy, semestr.id) }
}

function blad(e: unknown): NextResponse {
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

/** Podsumowanie: co D.E.C.K. przejmie, doda, zmieni i usunie. Nic nie zapisuje. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  try {
    const { semestr, plan } = await policz()
    return NextResponse.json({ semestr, plan })
  } catch (e) {
    return blad(e)
  }
}

/** Wysyłka: plan liczony od nowa (klient mógł patrzeć na stare podsumowanie) i wykonany. */
export async function POST(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  try {
    const { dostep, plan } = await policz()
    return NextResponse.json(await wykonajPlan(dostep, plan))
  } catch (e) {
    return blad(e)
  }
}
