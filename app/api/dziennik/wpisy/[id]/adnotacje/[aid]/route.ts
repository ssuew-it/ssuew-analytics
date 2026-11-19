import { NextResponse, type NextRequest } from 'next/server'
import { usunAdnotacje, zmienAdnotacje } from '@/lib/dziennik/dane'
import { cialo, trasa } from '@/lib/dziennik/http'

export const runtime = 'nodejs'

type Kontekst = { params: Promise<{ id: string; aid: string }> }

export function PATCH(req: NextRequest, { params }: Kontekst) {
  return trasa(req, async () => {
    const { id, aid } = await params
    return NextResponse.json(await zmienAdnotacje(id, aid, await cialo(req), Date.now()))
  })
}

export function DELETE(req: NextRequest, { params }: Kontekst) {
  return trasa(req, async () => {
    const { id, aid } = await params
    await usunAdnotacje(id, aid)
    return NextResponse.json({ ok: true })
  })
}
