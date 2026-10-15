import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { kartaKontaktu, listaKontaktow } from '@/lib/skrzynka/dane'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'

/** Bez `email` - lista stronami (`po`); z `email` - karta osoby z jej sprawami. Adres w parametrze, nie w ścieżce. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const sp = req.nextUrl.searchParams
  const email = sp.get('email')?.trim().toLowerCase()
  try {
    if (!email) return NextResponse.json(await listaKontaktow(sp.get('po')))
    const k = await kartaKontaktu(email)
    return k ? NextResponse.json(k) : NextResponse.json({ error: 'Nie ma takiej osoby' }, { status: 404 })
  } catch (e) {
    console.error('[skrzynka] kontakty:', e)
    return NextResponse.json({ error: 'Nie udało się wczytać kontaktów - spróbuj ponownie.' }, { status: 500 })
  }
}
