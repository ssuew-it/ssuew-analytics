import { NextResponse, type NextRequest } from 'next/server'
import { gasList, gasWrite, GasError, odswiezAnalytics } from '@/lib/gas/client'
import { ktoPyta } from '@/lib/auth/guard'

const POLA = ['kategoria', 'nazwa', 'okres', 'wartosc'] as const

function kompletny(w: Record<string, unknown>): boolean {
  return POLA.every((p) => w?.[p] !== undefined && w?.[p] !== null && w?.[p] !== '')
}

function wybierz(w: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(POLA.map((p) => [p, w[p]]))
}

/** Zwraca odpowiedź odmowną albo `null`, gdy pytający ma prawo zapisu. */
async function odmowa(req: NextRequest) {
  const pytajacy = await ktoPyta(req)
  if (!pytajacy) return NextResponse.json({ error: 'Wymagane logowanie' }, { status: 401 })
  if (pytajacy.rola !== 'owner') return NextResponse.json({ error: 'Brak uprawnień do zapisu' }, { status: 403 })
  return null
}

function blad(e: unknown) {
  return NextResponse.json({ error: (e as Error).message }, { status: e instanceof GasError ? e.kod : 500 })
}

export async function GET(req: NextRequest) {
  // Proxy wpuszcza każdego z ciasteczkiem, także wygasłym - tu sprawdzamy token.
  if (!(await ktoPyta(req))) return NextResponse.json({ error: 'Wymagane logowanie' }, { status: 401 })
  try {
    return NextResponse.json(await gasList('kpi_punkty'))
  } catch (e) {
    return blad(e)
  }
}

export async function POST(req: NextRequest) {
  const nie = await odmowa(req)
  if (nie) return nie

  // Tryb wsadowy: tablica metryk (np. caly nowy rocznik naraz).
  const body = await req.json()
  const wchodzace: Record<string, unknown>[] = Array.isArray(body) ? body : [body]
  const poprawne = wchodzace.filter(kompletny).map(wybierz)
  if (!poprawne.length) {
    return NextResponse.json(
      { error: Array.isArray(body) ? 'Brak prawidłowych wierszy' : 'Brakujące pola' },
      { status: 400 },
    )
  }

  try {
    const wiersze = await gasWrite('kpi_punkty', 'insert', poprawne)
    odswiezAnalytics()
    return NextResponse.json(Array.isArray(body) ? wiersze : wiersze[0], { status: 201 })
  } catch (e) {
    return blad(e)
  }
}

export async function PATCH(req: NextRequest) {
  const nie = await odmowa(req)
  if (nie) return nie

  const body = await req.json()
  if (!body?.id) return NextResponse.json({ error: 'Brak id' }, { status: 400 })

  const zmiany: Record<string, unknown> = { id: body.id }
  POLA.forEach((p) => {
    if (body[p] !== undefined) zmiany[p] = body[p]
  })

  try {
    const [wiersz] = await gasWrite('kpi_punkty', 'update', [zmiany])
    odswiezAnalytics()
    return NextResponse.json(wiersz)
  } catch (e) {
    return blad(e)
  }
}
