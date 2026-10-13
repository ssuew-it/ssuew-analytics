import { NextResponse, type NextRequest } from 'next/server'
import { ktoPyta } from '@/lib/auth/guard'
import { biezacySemestr } from '@/lib/planer/semestry'
import { dzisWarszawa } from '@/lib/czas'
import { komunikatBledu } from '@/lib/asystent/gemini'
import { daneProjektu, generujOdprawe, pobierzArkusz, pobierzPlaner, zbudujKontekst } from '@/lib/asystent/dane'
import { tresciNotatek } from '@/lib/asystent/pamiecDane'
import { statystykiStron } from '@/lib/strony/dane'

export const runtime = 'nodejs'
export const maxDuration = 60

/** „Odśwież” w panelu odprawy - nowa odprawa od razu. Tylko właściciel. */
export async function POST(req: NextRequest) {
  const kto = await ktoPyta(req)
  if (!kto) return NextResponse.json({ error: 'Wymagane logowanie' }, { status: 401 })
  if (kto.rola !== 'owner') return NextResponse.json({ error: 'Asystent jest tylko dla właściciela' }, { status: 403 })

  const teraz = new Date()
  const semestr = biezacySemestr(teraz)
  try {
    const [a, p, notatki, strony] = await Promise.all([
      pobierzArkusz(), pobierzPlaner(semestr.id, kto.rola), tresciNotatek().catch(() => []), statystykiStron().catch(() => []),
    ])
    const k = zbudujKontekst(daneProjektu(a, p, { id: semestr.id, nazwa: semestr.nazwa }, notatki, strony), dzisWarszawa(teraz))
    return NextResponse.json(await generujOdprawe(k, teraz.getTime()))
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
