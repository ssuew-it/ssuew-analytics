import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { czytajUstawienia, zapiszUstawienia } from '@/lib/skrzynka/dane'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'
import { sprawdzUstawienia } from '@/lib/skrzynka/zmiana'

export const runtime = 'nodejs'

const blad = (e: unknown) => {
  console.error('[skrzynka] ustawienia:', e)
  return NextResponse.json({ error: 'Nie udało się wczytać albo zapisać ustawień - spróbuj ponownie.' }, { status: 500 })
}

/** Stopka odpowiedzi i listy „zawsze pomijaj”. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  try {
    return NextResponse.json(await czytajUstawienia())
  } catch (e) {
    return blad(e)
  }
}

export async function PATCH(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const w = sprawdzUstawienia(await req.json().catch(() => null))
  if ('blad' in w) return NextResponse.json({ error: w.blad }, { status: 400 })
  try {
    return NextResponse.json(await zapiszUstawienia(w.zmiana))
  } catch (e) {
    return blad(e)
  }
}
