import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { adresZgodyKalendarza } from '@/lib/skrzynka/google'
import { podpiszStan } from '@/lib/skrzynka/stanOauth'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'

/** „Połącz kalendarz” - zgoda Google na wydarzenia kontakt@, dołożona do zgody skrzynki. */
export async function GET(req: NextRequest) {
  const { kto, odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  try {
    return NextResponse.redirect(adresZgodyKalendarza(await podpiszStan(kto.uid, 'kalendarz'), process.env.DECK_OWNER_EMAIL ?? ''))
  } catch (e) {
    console.error('[kalendarz] zgoda:', e)
    return NextResponse.redirect(new URL('/skrzynka?blad=konfiguracja', req.url))
  }
}
