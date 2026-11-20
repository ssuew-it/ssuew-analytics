import { NextResponse, type NextRequest } from 'next/server'
import { czytajZadania, dodajZadanie } from '@/lib/orbita/dane'
import { blad, cialo, trasa } from '@/lib/orbita/http'
import { sprawdzZadanie } from '@/lib/orbita/walidacja'

export const runtime = 'nodejs'

export function GET(req: NextRequest) {
  return trasa(req, async () => NextResponse.json({ zadania: await czytajZadania() }))
}

export function POST(req: NextRequest) {
  return trasa(req, async () => {
    const s = sprawdzZadanie(await cialo(req))
    if (!s.ok) return blad(s.blad, 400)
    return NextResponse.json(await dodajZadanie(s.pola, Date.now()), { status: 201 })
  })
}
