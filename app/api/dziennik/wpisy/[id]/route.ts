import { NextResponse, type NextRequest } from 'next/server'
import { usunWpis, zmienWpis } from '@/lib/dziennik/dane'
import { blad, cialo, trasa } from '@/lib/dziennik/http'
import { sprawdzWpis } from '@/lib/dziennik/walidacja'

export const runtime = 'nodejs'

type Kontekst = { params: Promise<{ id: string }> }

/** Tylko wpis otwartej kadencji - własność sprawdza warstwa danych po `kadencjaId` z bazy. */
export function PATCH(req: NextRequest, { params }: Kontekst) {
  return trasa(req, async () => {
    const s = sprawdzWpis(await cialo(req))
    if (!s.ok) return blad(s.blad, 400)
    return NextResponse.json(await zmienWpis((await params).id, s.pola, Date.now()))
  })
}

export function DELETE(req: NextRequest, { params }: Kontekst) {
  return trasa(req, async () => {
    await usunWpis((await params).id)
    return NextResponse.json({ ok: true })
  })
}
