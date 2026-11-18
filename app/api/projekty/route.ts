import { NextResponse, type NextRequest } from 'next/server'
import { gasList, gasWrite, GasError, odswiezAnalytics } from '@/lib/gas/client'
import { ktoPyta } from '@/lib/auth/guard'

const POLA = [
  'projekt', 'edycja', 'obszar',
  'budzet_plan', 'budzet_wydany', 'przedluzenia',
  'aplikujacy', 'uczestnicy', 'partnerzy_fin', 'partnerzy_barter',
  'problemy',
] as const

const TEKSTOWE = ['projekt', 'edycja', 'obszar', 'problemy'] as const

/** Bez nazwy i edycji wiersza nie da się z niczym powiązać. Reszta może poczekać. */
const WYMAGANE = ['projekt', 'edycja'] as const

function kompletny(w: Record<string, unknown>): boolean {
  return WYMAGANE.every((p) => w?.[p] !== undefined && w?.[p] !== null && w?.[p] !== '')
}

/**
 * Brakujące liczby stają się zerami, a nie powodem do odrzucenia wiersza.
 * Trzynaście kolumn to dużo do wypełnienia naraz. Flagi traktują zero jako
 * „nie wiem” wszędzie poza partnerem finansowym - tam zero jest odpowiedzią.
 */
function wybierz(w: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const p of POLA) {
    if ((TEKSTOWE as readonly string[]).includes(p)) {
      out[p] = w[p] ?? ''
    } else {
      const n = Number(w[p])
      out[p] = Number.isFinite(n) ? n : 0
    }
  }
  return out
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
    return NextResponse.json(await gasList('projekty'))
  } catch (e) {
    return blad(e)
  }
}

export async function POST(req: NextRequest) {
  const nie = await odmowa(req)
  if (nie) return nie

  const body = await req.json()
  const wchodzace: Record<string, unknown>[] = Array.isArray(body) ? body : [body]
  const poprawne = wchodzace.filter(kompletny).map(wybierz)
  if (!poprawne.length) {
    return NextResponse.json({ error: 'Brak nazwy projektu albo edycji' }, { status: 400 })
  }

  try {
    const wiersze = await gasWrite('projekty', 'insert', poprawne)
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
    const [wiersz] = await gasWrite('projekty', 'update', [zmiany])
    odswiezAnalytics()
    return NextResponse.json(wiersz)
  } catch (e) {
    return blad(e)
  }
}
