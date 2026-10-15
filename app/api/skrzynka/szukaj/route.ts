import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { czytajSprawy } from '@/lib/skrzynka/dane'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { klientGmaila, zRozlaczeniem } from '@/lib/skrzynka/synchronizacja'
import { TYLKO_WLASCICIEL, type StronaSpraw } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
const WYNIKI = 50

/**
 * Wyszukiwanie Gmaila (znajdzie też treść), wyniki jako sprawy z bazy. Wątki
 * spoza importu (starsze niż 12 miesięcy) nie mają sprawy - pomijamy je.
 */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ error: 'Wpisz co najmniej 2 znaki.' }, { status: 400 })
  try {
    const sprawy = await zRozlaczeniem(async () => {
      const l = await (await klientGmaila()).listaWatkow(q, null)
      const ids = (l.threads ?? []).slice(0, WYNIKI).map((t) => t.id)
      const m = await czytajSprawy(ids)
      return ids.flatMap((id) => m.get(id) ?? []).sort((a, b) => b.ostatnia.kiedy - a.ostatnia.kiedy)
    })
    return NextResponse.json({ sprawy, nastepna: null } satisfies StronaSpraw)
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
