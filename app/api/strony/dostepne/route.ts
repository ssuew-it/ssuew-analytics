import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { listaStron } from '@/lib/strony/dane'
import { BladGoogle, emailKonta, listaWitryn } from '@/lib/strony/google'
import { TYLKO_WLASCICIEL, komunikatStrony, type DostepneWitryny } from '@/lib/strony/model'
import { nazwaZWitryny } from '@/lib/strony/okresy'

export const runtime = 'nodejs'

/** Witryny do dodania. Błąd Google idzie w polu `blad` - panel pokazuje wtedy instrukcję zamiast listy. */
export async function GET(req: NextRequest) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const email = emailKonta()
  try {
    const [wszystkie, lista] = await Promise.all([listaWitryn(), listaStron()])
    const obecne = new Set(lista.map((s) => s.witryna))
    const witryny = wszystkie.filter((w) => !obecne.has(w)).map((w) => ({ witryna: w, nazwa: nazwaZWitryny(w) }))
    return NextResponse.json({ email, witryny, blad: null } satisfies DostepneWitryny)
  } catch (e) {
    const rodzaj = e instanceof BladGoogle ? e.rodzaj : 'inny'
    return NextResponse.json({ email, witryny: [], blad: komunikatStrony(rodzaj, email) } satisfies DostepneWitryny)
  }
}
