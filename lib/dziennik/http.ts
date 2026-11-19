import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { BladDziennika, type RodzajBleduDziennika } from './dane'

export const TYLKO_WLASCICIEL_DZIENNIK = 'Dziennik jest tylko dla właściciela'

const STATUS: Record<RodzajBleduDziennika, number> = {
  'brak-kadencji': 409, 'kadencja-zmieniona': 409, zamkniety: 409, 'nie-ma': 404, walidacja: 400,
}

export const blad = (error: string, status: number) => NextResponse.json({ error }, { status })
export const cialo = (req: NextRequest) => req.json().catch(() => null)

/** Wspólna obsługa tras Dziennika: tylko właściciel, błędy księgi na kody HTTP, reszta 500 bez szczegółów. */
export async function trasa(req: NextRequest, f: () => Promise<NextResponse>): Promise<NextResponse> {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL_DZIENNIK)
  if (odmowa) return odmowa
  try {
    return await f()
  } catch (e) {
    if (e instanceof BladDziennika) return blad(e.message, STATUS[e.rodzaj])
    console.error('[dziennik]', e)
    return blad('Księga chwilowo niedostępna - spróbuj ponownie', 500)
  }
}
