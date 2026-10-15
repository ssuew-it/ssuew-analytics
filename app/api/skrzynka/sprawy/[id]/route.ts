import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { czytajSprawe, dodajPomijanie, skladZarzadu, zmienSprawe } from '@/lib/skrzynka/dane'
import { BladSkrzynki, komunikatBledu } from '@/lib/skrzynka/google'
import { domena } from '@/lib/skrzynka/kontakty'
import { klientGmaila, zRozlaczeniem } from '@/lib/skrzynka/synchronizacja'
import { odczytajWatekPelny } from '@/lib/skrzynka/tresc'
import { TYLKO_WLASCICIEL, type SzczegolySprawy } from '@/lib/skrzynka/typy'
import { sprawdzZmiane } from '@/lib/skrzynka/zmiana'

export const runtime = 'nodejs'

type Kontekst = { params: Promise<{ id: string }> }

/** Sprawa z bazy i wątek z Gmaila na żywo. Otwarcie zdejmuje znacznik „nowa wiadomość”. */
export async function GET(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const { id } = await params
  try {
    const s = await czytajSprawe(id)
    if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
    const wiadomosci = await zRozlaczeniem(async () => odczytajWatekPelny(await (await klientGmaila()).watekPelny(id))).catch((e) => {
      // Wątek usunięty w Gmailu - sprawa zostaje widoczna, żeby dało się ją zamknąć albo pominąć.
      if (e instanceof BladSkrzynki && e.rodzaj === 'brak-watku') return []
      throw e
    })
    const sprawa = s.nowa ? ((await zmienSprawe(id, { nowa: false })) ?? s) : s
    return NextResponse.json({ sprawa, wiadomosci } satisfies SzczegolySprawy)
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function PATCH(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const { id } = await params
  const z = sprawdzZmiane(await req.json().catch(() => null), await skladZarzadu().catch(() => []))
  if (!z) return NextResponse.json({ error: 'Niepoprawna zmiana' }, { status: 400 })
  const s = await czytajSprawe(id)
  if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
  if (z.pomin) {
    if (!s.kontakt) return NextResponse.json({ error: 'Ta sprawa nie ma nadawcy do pominięcia.' }, { status: 400 })
    // Domena skrzynki prywatnej (gmail.com) albo studentów wyciszyłaby wszystkich - tylko organizacje.
    if (z.pomin === 'domena' && !s.organizacja) {
      return NextResponse.json({ error: 'Tej domeny nie można pominąć w całości - pomiń sam adres.' }, { status: 400 })
    }
    await dodajPomijanie(z.pomin, z.pomin === 'adres' ? s.kontakt : domena(s.kontakt))
  }
  const zmiana = {
    ...(z.pomin ? { status: 'pominieta' as const } : z.status ? { status: z.status } : {}),
    ...(z.przypisana !== undefined ? { przypisana: z.przypisana } : {}),
  }
  return NextResponse.json(await zmienSprawe(id, zmiana))
}
