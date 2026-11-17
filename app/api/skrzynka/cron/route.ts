import { NextResponse, type NextRequest } from 'next/server'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { odnowObserwacje, synchronizuj } from '@/lib/skrzynka/synchronizacja'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Codziennie: obserwacja Gmaila wygasa po 7 dniach, a synchronizacja łapie
 * zgubione powiadomienia. Vercel wysyła `CRON_SECRET` jako Bearer.
 * Nieudane odnowienie nie blokuje synchronizacji, ale kończy się kodem 500
 * i wpisem w logach - inaczej push wygasłby po cichu.
 */
export async function GET(req: NextRequest) {
  const sekret = process.env.CRON_SECRET
  if (!sekret || req.headers.get('authorization') !== `Bearer ${sekret}`) {
    return NextResponse.json({ error: 'Brak dostępu' }, { status: 401 })
  }

  let obserwacja: string | null = null
  try {
    await odnowObserwacje()
  } catch (e) {
    console.error('[skrzynka] cron - odnowienie obserwacji:', e)
    obserwacja = komunikatBledu(e).error
  }

  try {
    const synchronizacja = await synchronizuj()
    if (obserwacja) return NextResponse.json({ synchronizacja, obserwacja }, { status: 500 })
    return NextResponse.json(synchronizacja)
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json(obserwacja ? { error, obserwacja } : { error }, { status })
  }
}
