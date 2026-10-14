import { NextResponse, type NextRequest } from 'next/server'
import { komunikatBledu } from '@/lib/skrzynka/google'
import { odnowObserwacje, synchronizuj } from '@/lib/skrzynka/synchronizacja'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Codziennie: obserwacja Gmaila wygasa po 7 dniach, a synchronizacja łapie zgubione powiadomienia. Vercel wysyła `CRON_SECRET` jako Bearer. */
export async function GET(req: NextRequest) {
  const sekret = process.env.CRON_SECRET
  if (!sekret || req.headers.get('authorization') !== `Bearer ${sekret}`) {
    return NextResponse.json({ error: 'Brak dostępu' }, { status: 401 })
  }
  try {
    await odnowObserwacje()
    return NextResponse.json(await synchronizuj())
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error }, { status })
  }
}
