import { NextResponse, type NextRequest } from 'next/server'
import { dzisWarszawa } from '@/lib/czas'
import { czytajKsiege } from '@/lib/dziennik/dane'
import { ksiegaNaHtml } from '@/lib/dziennik/eksport'
import { trasa } from '@/lib/dziennik/http'
import { zrobKopie } from '@/lib/dziennik/kopia'

export const runtime = 'nodejs'
export const maxDuration = 60

/** „Zapisz kopię” - dokument Google na Dysku kontakt@. */
export function POST(req: NextRequest) {
  return trasa(req, async () => {
    const w = await zrobKopie(new Date())
    if (!w.ok) return NextResponse.json({ error: w.komunikat, powod: w.powod }, { status: 409 })
    return NextResponse.json({ link: w.link })
  })
}

/** „Pobierz plik” - ta sama księga jako HTML, gdy Dysku nie ma albo zawiódł. */
export function GET(req: NextRequest) {
  return trasa(req, async () => {
    const d = dzisWarszawa(new Date())
    const dwie = (n: number) => String(n).padStart(2, '0')
    const html = ksiegaNaHtml(await czytajKsiege(), d)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="dziennik-stratega-${d.rok}-${dwie(d.miesiac)}-${dwie(d.dzien)}.html"`,
      },
    })
  })
}
