import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { adresZgody } from '@/lib/skrzynka/google'
import { podpiszStan } from '@/lib/skrzynka/stanOauth'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'

/** „Połącz skrzynkę” - do zgody Google, z podpowiedzią konta kontakt@. */
export async function GET(req: NextRequest) {
  const { kto, odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  try {
    return NextResponse.redirect(adresZgody(await podpiszStan(kto.uid), process.env.DECK_OWNER_EMAIL ?? ''))
  } catch (e) {
    console.error('[skrzynka] zgoda:', e)
    return NextResponse.redirect(new URL('/skrzynka?blad=konfiguracja', req.url))
  }
}
