import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { dodajStrone, statystykiStron, usunStrone } from '@/lib/strony/dane'
import { BladGoogle, emailKonta, listaWitryn } from '@/lib/strony/google'
import { DLUGOSC_NAZWY, TYLKO_WLASCICIEL, komunikatStrony } from '@/lib/strony/model'
import { nazwaZWitryny } from '@/lib/strony/okresy'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  return NextResponse.json(await statystykiStron())
}

/** Dodać można tylko witrynę z listy Search Console - ręcznie wpisany adres myliłby domenę z prefiksem URL. */
export async function POST(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const body = await req.json().catch(() => null)
  const witryna = typeof body?.witryna === 'string' ? body.witryna.trim() : ''
  if (!witryna) return NextResponse.json({ error: 'Wybierz witrynę' }, { status: 400 })

  let dostepne: string[]
  try {
    dostepne = await listaWitryn()
  } catch (e) {
    const rodzaj = e instanceof BladGoogle ? e.rodzaj : 'inny'
    return NextResponse.json({ error: komunikatStrony(rodzaj, emailKonta()) }, { status: 502 })
  }
  if (!dostepne.includes(witryna)) {
    return NextResponse.json({ error: 'Konto serwisowe nie ma dostępu do tej witryny w Search Console.' }, { status: 400 })
  }

  const nazwa =
    typeof body?.nazwa === 'string' && body.nazwa.trim() ? body.nazwa.trim().slice(0, DLUGOSC_NAZWY) : nazwaZWitryny(witryna)
  await dodajStrone({ witryna, nazwa })
  return NextResponse.json({ witryna, nazwa }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const witryna = req.nextUrl.searchParams.get('witryna')
  if (!witryna) return NextResponse.json({ error: 'Brak witryny' }, { status: 400 })
  await usunStrone(witryna)
  return NextResponse.json({ ok: true })
}
