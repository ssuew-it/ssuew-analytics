import { NextResponse, type NextRequest } from 'next/server'
import { dzisWarszawa } from '@/lib/czas'
import { akcjaEtapu } from '@/lib/orbita/dane'
import { blad, cialo, trasa } from '@/lib/orbita/http'

export const runtime = 'nodejs'

type Kontekst = { params: Promise<{ id: string; eid: string }> }

/** Zamknięcie albo ponowne otwarcie etapu: `{ akcja: 'zamknij' | 'otworz', wynik? }`. */
export function POST(req: NextRequest, { params }: Kontekst) {
  return trasa(req, async () => {
    const c = ((await cialo(req)) ?? {}) as { akcja?: unknown; wynik?: unknown }
    if (c.akcja !== 'zamknij' && c.akcja !== 'otworz') return blad('Nieznana akcja etapu', 400)
    const { id, eid } = await params
    const teraz = new Date()
    const wynik = typeof c.wynik === 'string' ? c.wynik : ''
    return NextResponse.json(await akcjaEtapu(id, eid, c.akcja, wynik, teraz.getTime(), dzisWarszawa(teraz)))
  })
}
