import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { BladSkrzynki, komunikatBledu } from '@/lib/skrzynka/google'
import { wyslijOdpowiedz } from '@/lib/skrzynka/synchronizacja'
import { MAKS_ZALACZNIKOW, TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60
const MAKS_TEKSTU = 50_000

type Kontekst = { params: Promise<{ id: string }> }

/** Odpowiedź z D.E.C.K.: `multipart/form-data` z polem `tekst` i plikami `pliki` (łącznie do 4 MB). */
export async function POST(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const { id } = await params
  const fd = await req.formData().catch(() => null)
  if (!fd) return NextResponse.json({ error: 'Niepoprawne żądanie' }, { status: 400 })
  const tekst = String(fd.get('tekst') ?? '').trim()
  if (!tekst) return NextResponse.json({ error: 'Wpisz treść odpowiedzi.' }, { status: 400 })
  if (tekst.length > MAKS_TEKSTU) return NextResponse.json({ error: 'Odpowiedź jest za długa.' }, { status: 400 })
  const pliki = fd.getAll('pliki').filter((p): p is File => typeof p !== 'string' && p.size > 0)
  if (pliki.reduce((s, p) => s + p.size, 0) > MAKS_ZALACZNIKOW) {
    return NextResponse.json({ error: 'Załączniki mogą mieć łącznie najwyżej 4 MB.' }, { status: 413 })
  }
  try {
    const dane = await Promise.all(pliki.map(async (p) => ({ nazwa: p.name, typ: p.type, dane: new Uint8Array(await p.arrayBuffer()) })))
    const s = await wyslijOdpowiedz(id, tekst, dane)
    if (!s) return NextResponse.json({ error: 'Nie ma takiej sprawy' }, { status: 404 })
    return NextResponse.json(s)
  } catch (e) {
    // Ogólny komunikat limitu obiecuje ponowienie, a wysyłki nikt sam nie ponowi.
    if (e instanceof BladSkrzynki && e.rodzaj === 'limit') {
      return NextResponse.json({ error: 'Gmail chwilowo ogranicza wysyłkę - odpowiedź nie poszła, wyślij ją ponownie za minutę.' }, { status: 429 })
    }
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
