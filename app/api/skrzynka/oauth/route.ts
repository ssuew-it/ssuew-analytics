import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { polaczKalendarz } from '@/lib/kalendarz/polaczenie'
import { celStanu } from '@/lib/skrzynka/stanOauth'
import { polaczSkrzynke } from '@/lib/skrzynka/synchronizacja'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Powrót ze zgody Google - skrzynki albo kalendarza (cel w podpisanym `state`).
 * Każdy wynik kończy się w panelu - z komunikatem, gdy coś nie wyszło.
 */
export async function GET(req: NextRequest) {
  const { kto, odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const wroc = (blad?: string, ok?: string) =>
    NextResponse.redirect(new URL(blad ? `/skrzynka?blad=${blad}` : ok ? `/skrzynka?${ok}` : '/skrzynka', req.url))
  const p = req.nextUrl.searchParams
  if (p.get('error')) return wroc('odmowa')
  const kod = p.get('code')
  const stan = p.get('state')
  const cel = kod && stan ? await celStanu(stan, kto.uid) : null
  if (!kod || !cel) return wroc('stan')
  try {
    if (cel === 'kalendarz') {
      const wynik = await polaczKalendarz(kod)
      return wynik === 'ok' ? wroc(undefined, 'kalendarz=ok') : wroc(wynik)
    }
    const wynik = await polaczSkrzynke(kod)
    return wroc(wynik === 'ok' ? undefined : wynik)
  } catch (e) {
    console.error(`[${cel}] połączenie:`, e)
    return wroc('polaczenie')
  }
}
