import { NextResponse, type NextRequest } from 'next/server'
import { gasList, gasWrite, GasError, odswiezAnalytics } from '@/lib/gas/client'
import { ktoPyta } from '@/lib/auth/guard'

function blad(e: unknown) {
  return NextResponse.json({ error: (e as Error).message }, { status: e instanceof GasError ? e.kod : 500 })
}

export async function GET(req: NextRequest) {
  // Proxy wpuszcza każdego z ciasteczkiem, także wygasłym - tu sprawdzamy token.
  if (!(await ktoPyta(req))) return NextResponse.json({ error: 'Wymagane logowanie' }, { status: 401 })
  try {
    return NextResponse.json(await gasList('kohorty'))
  } catch (e) {
    return blad(e)
  }
}

export async function POST(req: NextRequest) {
  const pytajacy = await ktoPyta(req)
  if (!pytajacy) return NextResponse.json({ error: 'Wymagane logowanie' }, { status: 401 })
  if (pytajacy.rola !== 'owner') return NextResponse.json({ error: 'Brak uprawnień do zapisu' }, { status: 403 })

  const { edycja, sezon, rok, n_czlonkow, avg_retention_sem, max_retention_sem, in_progress } =
    await req.json()
  if (
    !edycja || !sezon || !rok ||
    n_czlonkow == null || avg_retention_sem == null || max_retention_sem == null
  ) {
    return NextResponse.json({ error: 'Brakujące pola' }, { status: 400 })
  }

  try {
    const [wiersz] = await gasWrite('kohorty', 'upsert', [
      {
        edycja, sezon, rok, n_czlonkow, avg_retention_sem, max_retention_sem,
        in_progress: in_progress ?? false,
      },
    ])
    odswiezAnalytics()
    return NextResponse.json(wiersz, { status: 201 })
  } catch (e) {
    return blad(e)
  }
}
