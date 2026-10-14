import { NextResponse, after, type NextRequest } from 'next/server'
import { zweryfikujPush } from '@/lib/skrzynka/push'
import { synchronizuj } from '@/lib/skrzynka/synchronizacja'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Powiadomienie Pub/Sub o zmianie w skrzynce. Odpowiadamy od razu, a
 * synchronizacja idzie w `after()` - Pub/Sub ponawia, gdy odpowiedź się
 * spóźnia. Treść powiadomienia nie jest potrzebna: synchronizacja zna swój
 * punkt historii.
 */
export async function POST(req: NextRequest) {
  if (!(await zweryfikujPush(req.headers.get('authorization')))) return new NextResponse(null, { status: 401 })
  after(() => synchronizuj().catch((e) => console.error('[skrzynka] push:', e)))
  return new NextResponse(null, { status: 204 })
}
