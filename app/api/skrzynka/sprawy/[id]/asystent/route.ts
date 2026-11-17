import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { BladAsystenta, komunikatBledu as komunikatAsystenta, zapytajGemini } from '@/lib/asystent/gemini'
import { tresciNotatek } from '@/lib/asystent/pamiecDane'
import { INSTRUKCJE, sprawdzTryb, tekstWatku, wiadomoscAsystenta } from '@/lib/skrzynka/asystent'
import { czytajSprawe } from '@/lib/skrzynka/dane'
import { BladSkrzynki, komunikatBledu } from '@/lib/skrzynka/google'
import { klientGmaila, nasz, zRozlaczeniem } from '@/lib/skrzynka/synchronizacja'
import { odczytajWatekPelny } from '@/lib/skrzynka/tresc'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

type Kontekst = { params: Promise<{ id: string }> }

/**
 * „Streść” albo „Szkic odpowiedzi”: temat, notatki i treść jednego wątku idą
 * do Gemini tylko po kliknięciu (spec §2, wiersz „Asystent”). Streszczenie
 * wraca do widoku sprawy, szkic do okna odpowiedzi - nic się samo nie wysyła.
 * Treść nie trafia do bazy; w logach ląduje tylko obiekt błędu.
 */
export async function POST(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const { id } = await params
  const tryb = sprawdzTryb(await req.json().catch(() => null))
  if (!tryb) return NextResponse.json({ error: 'Nieznany tryb asystenta' }, { status: 400 })
  try {
    const s = await czytajSprawe(id)
    if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
    const [watek, notatki] = await Promise.all([
      zRozlaczeniem(async () => (await klientGmaila()).watekPelny(id)),
      tresciNotatek().catch(() => [] as string[]),
    ])
    const { tekst } = await zapytajGemini({
      instrukcja: INSTRUKCJE[tryb],
      wiadomosci: [{ rola: 'user', tekst: wiadomoscAsystenta(s.temat, tekstWatku(odczytajWatekPelny(watek), nasz()), notatki) }],
    })
    return NextResponse.json({ tekst: tekst.trim() })
  } catch (e) {
    if (e instanceof BladAsystenta) {
      const { status, error } = komunikatAsystenta(e)
      return NextResponse.json({ error }, { status })
    }
    if (e instanceof BladSkrzynki && e.rodzaj === 'brak-watku') {
      return NextResponse.json({ error: 'Tego wątku nie ma już w Gmailu.' }, { status: 404 })
    }
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
