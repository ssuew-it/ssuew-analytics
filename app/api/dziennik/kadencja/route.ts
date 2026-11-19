import { NextResponse, type NextRequest } from 'next/server'
import { otworzKadencje } from '@/lib/dziennik/dane'
import { blad, cialo, trasa } from '@/lib/dziennik/http'
import { sprawdzKadencje } from '@/lib/dziennik/walidacja'

export const runtime = 'nodejs'

/** „Rozpocznij kadencję” - najwyżej jedna otwarta, pilnuje transakcja. */
export function POST(req: NextRequest) {
  return trasa(req, async () => {
    const s = sprawdzKadencje(await cialo(req))
    if (!s.ok) return blad(s.blad, 400)
    return NextResponse.json(await otworzKadencje(s.pola, Date.now()), { status: 201 })
  })
}
