import { NextResponse, type NextRequest } from 'next/server'
import { dzisWarszawa } from '@/lib/czas'
import { usunZadanie, zmienZadanie } from '@/lib/orbita/dane'
import { blad, cialo, trasa } from '@/lib/orbita/http'
import { sprawdzZadanie } from '@/lib/orbita/walidacja'

export const runtime = 'nodejs'

type Kontekst = { params: Promise<{ id: string }> }

/** Edycja całego zadania; `zmieniono` z ciała chroni przed nadpisaniem zmian z drugiej karty. */
export function PATCH(req: NextRequest, { params }: Kontekst) {
  return trasa(req, async () => {
    const c = await cialo(req)
    const zmieniono = (c as { zmieniono?: unknown } | null)?.zmieniono
    if (typeof zmieniono !== 'number') return blad('Brak wersji zadania - odśwież', 400)
    const s = sprawdzZadanie(c)
    if (!s.ok) return blad(s.blad, 400)
    const teraz = new Date()
    return NextResponse.json(await zmienZadanie((await params).id, s.pola, zmieniono, teraz.getTime(), dzisWarszawa(teraz)))
  })
}

export function DELETE(req: NextRequest, { params }: Kontekst) {
  return trasa(req, async () => {
    await usunZadanie((await params).id)
    return NextResponse.json({ ok: true })
  })
}
