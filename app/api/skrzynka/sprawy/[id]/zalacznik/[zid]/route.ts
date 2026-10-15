import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { klientGmaila, zRozlaczeniem } from '@/lib/skrzynka/synchronizacja'
import { dekodujBase64Url } from '@/lib/skrzynka/tresc'
import { TYLKO_WLASCICIEL } from '@/lib/skrzynka/typy'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Tylko te typy podajemy wprost; reszta jako octet-stream. Plik od nadawcy nigdy nie renderuje się w domenie D.E.C.K. */
const BEZPIECZNE_TYPY = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif']

type Kontekst = { params: Promise<{ id: string; zid: string }> }

export async function GET(req: NextRequest, { params }: Kontekst) {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL)
  if (odmowa) return odmowa
  const { zid } = await params
  const sp = req.nextUrl.searchParams
  const wiadomoscId = sp.get('w')
  if (!wiadomoscId) return NextResponse.json({ error: 'Brak wiadomości' }, { status: 400 })
  const nazwa = (sp.get('nazwa') || 'zalacznik').replace(/[\r\n"\\]/g, '_')
  const typ = BEZPIECZNE_TYPY.includes(sp.get('typ') ?? '') ? sp.get('typ')! : 'application/octet-stream'
  try {
    const z = await zRozlaczeniem(async () => (await klientGmaila()).zalacznik(wiadomoscId, zid))
    return new NextResponse(dekodujBase64Url(z.data), {
      headers: {
        'Content-Type': typ,
        'Content-Disposition': `attachment; filename="${nazwa.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nazwa)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
