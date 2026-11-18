import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { listaSpraw, zmienSprawe } from '@/lib/skrzynka/dane'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { STATUSY, TYLKO_WLASCICIEL, type Status } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'

/** Jedna zakładka listy spraw - tylko Firestore, bez Gmaila. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const status = req.nextUrl.searchParams.get('status') as Status
  if (!STATUSY.includes(status)) return NextResponse.json({ error: 'Nieznany status' }, { status: 400 })
  try {
    return NextResponse.json(await listaSpraw(status, req.nextUrl.searchParams.get('po')))
  } catch (e) {
    const { status: kod, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status: kod })
  }
}

/** Najwięcej spraw w jednej zbiorczej zmianie - tyle mieści lista „Do odpowiedzi”. */
const MAKS_ZBIORCZO = 300
const NARAZ = 10

/** Zbiorcza zmiana statusu zaznaczonych spraw (np. stare „Do odpowiedzi” → Załatwione). Znacznik „nowa” znika. */
export async function POST(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const cialo = (await req.json().catch(() => null)) as { ids?: unknown; status?: unknown } | null
  const ids = cialo?.ids
  const status = cialo?.status as Status
  if (!Array.isArray(ids) || !ids.length || ids.length > MAKS_ZBIORCZO || !ids.every((x) => typeof x === 'string' && x) || !STATUSY.includes(status)) {
    return NextResponse.json({ error: 'Nieprawidłowe zaznaczenie spraw' }, { status: 400 })
  }
  try {
    const kolejka = [...new Set(ids as string[])]
    let zmienione = 0
    const pracownik = async () => {
      for (let id = kolejka.shift(); id !== undefined; id = kolejka.shift()) {
        if (await zmienSprawe(id, { status, nowa: false })) zmienione++
      }
    }
    await Promise.all(Array.from({ length: NARAZ }, pracownik))
    return NextResponse.json({ zmienione })
  } catch (e) {
    const { status: kod, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status: kod })
  }
}
