import { NextResponse, type NextRequest } from 'next/server'
import { dodajAdnotacje } from '@/lib/dziennik/dane'
import { cialo, trasa } from '@/lib/dziennik/http'

export const runtime = 'nodejs'

type Kontekst = { params: Promise<{ id: string }> }

/** Cele strategii zna dopiero wpis, więc adnotację sprawdza warstwa danych (błąd = 400). */
export function POST(req: NextRequest, { params }: Kontekst) {
  return trasa(req, async () => NextResponse.json(await dodajAdnotacje((await params).id, await cialo(req), Date.now()), { status: 201 }))
}
