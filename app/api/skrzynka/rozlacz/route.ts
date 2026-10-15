import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { rozlaczSkrzynke } from '@/lib/skrzynka/synchronizacja'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

/** „Rozłącz”: `{ usunDane: true }` usuwa też sprawy, kontakty i organizacje (koniec kadencji). */
export async function POST(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const body = await req.json().catch(() => null)
  try {
    await rozlaczSkrzynke(body?.usunDane === true)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[skrzynka] rozłączenie:', e)
    return NextResponse.json({ error: 'Nie udało się rozłączyć skrzynki - spróbuj ponownie.' }, { status: 500 })
  }
}
