import { NextResponse, type NextRequest } from 'next/server'
import { czytajKsiege, zamknijKadencje } from '@/lib/dziennik/dane'
import { blad, cialo, trasa } from '@/lib/dziennik/http'
import { zrobKopie } from '@/lib/dziennik/kopia'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * „Przekaż księgę”: kopia na Dysku, potem zamknięcie kadencji. Bez udanej kopii
 * nic się nie zamyka. Gdy kopia powstała, a zamknięcie zawiodło, ponowna próba
 * zrobi drugą kopię - nadmiarowy plik na Dysku jest nieszkodliwy.
 */
export function POST(req: NextRequest) {
  return trasa(req, async () => {
    const kadencjaId = (await cialo(req))?.kadencjaId
    const ksiega = await czytajKsiege()
    if (typeof kadencjaId !== 'string' || ksiega.otwartaKadencjaId !== kadencjaId) return blad('Kadencja już się zmieniła - odśwież', 409)
    const teraz = new Date()
    const w = await zrobKopie(teraz, ksiega)
    if (!w.ok) return NextResponse.json({ error: w.komunikat, powod: w.powod }, { status: 409 })
    await zamknijKadencje(kadencjaId, teraz.getTime())
    return NextResponse.json({ link: w.link })
  })
}
