import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { polaczKalendarz } from '@/lib/kalendarz/polaczenie'
import { polaczDysk } from '@/lib/dysk/polaczenie'
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
  const kod = p.get('code')
  const stan = p.get('state')
  const cel = stan ? await celStanu(stan, kto.uid) : null
  // Zgoda na Dysk zaczyna się w Dzienniku i tam wraca.
  const doDziennika = (wynik: string) => NextResponse.redirect(new URL(wynik === 'ok' ? '/dziennik?dysk=ok' : `/dziennik?blad=${wynik}`, req.url))
  if (p.get('error')) return cel === 'dysk' ? doDziennika('odmowa') : wroc('odmowa')
  if (!kod || !cel) return wroc('stan')
  try {
    if (cel === 'dysk') return doDziennika(await polaczDysk(kod))
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
