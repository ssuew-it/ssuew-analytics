import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { sprawdzStan } from '@/lib/skrzynka/stanOauth'
import { polaczSkrzynke } from '@/lib/skrzynka/synchronizacja'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Powrót ze zgody Google. Każdy wynik kończy się w panelu - z komunikatem, gdy coś nie wyszło. */
export async function GET(req: NextRequest) {
  const { kto, odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const wroc = (blad?: string) => NextResponse.redirect(new URL(blad ? `/skrzynka?blad=${blad}` : '/skrzynka', req.url))
  const p = req.nextUrl.searchParams
  if (p.get('error')) return wroc('odmowa')
  const kod = p.get('code')
  const stan = p.get('state')
  if (!kod || !stan || !(await sprawdzStan(stan, kto.uid))) return wroc('stan')
  try {
    return wroc((await polaczSkrzynke(kod)) === 'ok' ? undefined : 'inne-konto')
  } catch (e) {
    console.error('[skrzynka] połączenie:', e)
    return wroc('polaczenie')
  }
}
