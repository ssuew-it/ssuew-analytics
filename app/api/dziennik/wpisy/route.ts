import { NextResponse, type NextRequest } from 'next/server'
import { dodajWpis } from '@/lib/dziennik/dane'
import { blad, cialo, trasa } from '@/lib/dziennik/http'
import { sprawdzWpis } from '@/lib/dziennik/walidacja'

export const runtime = 'nodejs'

export function POST(req: NextRequest) {
  return trasa(req, async () => {
    const s = sprawdzWpis(await cialo(req))
    if (!s.ok) return blad(s.blad, 400)
    return NextResponse.json(await dodajWpis(s.pola, Date.now()), { status: 201 })
  })
}
