import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { adresZgodyDysku } from '@/lib/skrzynka/google'
import { podpiszStan } from '@/lib/skrzynka/stanOauth'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'

/** „Połącz Dysk” - zgoda Google na pliki tworzone przez D.E.C.K. (kopie Dziennika), dołożona do zgody skrzynki. */
export async function GET(req: NextRequest) {
  const { kto, odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  try {
    return NextResponse.redirect(adresZgodyDysku(await podpiszStan(kto.uid, 'dysk'), process.env.DECK_OWNER_EMAIL ?? ''))
  } catch (e) {
    console.error('[dysk] zgoda:', e)
    return NextResponse.redirect(new URL('/dziennik?blad=konfiguracja', req.url))
  }
}
