import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { kartaOrganizacji, listaOrganizacji, zmienOrganizacje } from '@/lib/skrzynka/dane'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'
import { sprawdzOrganizacje } from '@/lib/skrzynka/zmiana'

export const runtime = 'nodejs'

const blad = (e: unknown) => {
  console.error('[skrzynka] organizacje:', e)
  return NextResponse.json({ error: 'Nie udało się wczytać albo zapisać organizacji - spróbuj ponownie.' }, { status: 500 })
}

/** Bez `domena` - wszystkie organizacje; z `domena` - karta z osobami i sprawami. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const domena = req.nextUrl.searchParams.get('domena')?.trim().toLowerCase()
  try {
    if (!domena) return NextResponse.json({ organizacje: await listaOrganizacji() })
    const k = await kartaOrganizacji(domena)
    return k ? NextResponse.json(k) : NextResponse.json({ error: 'Nie ma takiej organizacji' }, { status: 404 })
  } catch (e) {
    return blad(e)
  }
}

/** Zmiana nazwy albo typu - `{ domena, nazwa?, typ? }`. */
export async function PATCH(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const z = sprawdzOrganizacje(await req.json().catch(() => null))
  if (!z) return NextResponse.json({ error: 'Niepoprawna zmiana' }, { status: 400 })
  try {
    const o = await zmienOrganizacje(z.domena, z.zmiana)
    return o ? NextResponse.json(o) : NextResponse.json({ error: 'Nie ma takiej organizacji' }, { status: 404 })
  } catch (e) {
    return blad(e)
  }
}
