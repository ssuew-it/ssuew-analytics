import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { listaSpraw } from '@/lib/skrzynka/dane'
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
