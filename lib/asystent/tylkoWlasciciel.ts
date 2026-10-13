import { NextResponse, type NextRequest } from 'next/server'
import { ktoPyta, type Pytajacy } from '@/lib/auth/guard'

/** Wspólna bramka tras tylko dla właściciela: bez sesji 401, zarząd 403. */
export async function tylkoWlasciciel(
  req: NextRequest,
  komunikat = 'Asystent jest tylko dla właściciela',
): Promise<{ kto: Pytajacy; odmowa: null } | { kto: null; odmowa: NextResponse }> {
  const kto = await ktoPyta(req)
  if (!kto) return { kto: null, odmowa: NextResponse.json({ error: 'Wymagane logowanie' }, { status: 401 }) }
  if (kto.rola !== 'owner') return { kto: null, odmowa: NextResponse.json({ error: komunikat }, { status: 403 }) }
  return { kto, odmowa: null }
}
