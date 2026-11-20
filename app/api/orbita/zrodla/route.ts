import { NextResponse, type NextRequest } from 'next/server'
import { zrodlaOtwartych } from '@/lib/orbita/dane'
import { trasa } from '@/lib/orbita/http'

export const runtime = 'nodejs'

/** Lekki odczyt dla Dziennika: które obowiązki są już w otwartych zadaniach. */
export function GET(req: NextRequest) {
  return trasa(req, async () => NextResponse.json({ zrodla: await zrodlaOtwartych() }))
}
