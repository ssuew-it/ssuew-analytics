import { NextResponse, type NextRequest } from 'next/server'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { BladOrbity, type RodzajBleduOrbity } from './etapy'

export const TYLKO_WLASCICIEL_ORBITA = 'Orbita jest tylko dla właściciela'

const STATUS: Record<RodzajBleduOrbity, number> = { 'nie-ma': 404, zmienione: 409, 'nie-biezacy': 409, walidacja: 400 }

export const blad = (error: string, status: number) => NextResponse.json({ error }, { status })
export const cialo = (req: NextRequest) => req.json().catch(() => null)

/** Wspólna obsługa tras Orbity: tylko właściciel, błędy zadań na kody HTTP, reszta 500 bez szczegółów. */
export async function trasa(req: NextRequest, f: () => Promise<NextResponse>): Promise<NextResponse> {
  const { odmowa } = await tylkoWlasciciel(req, TYLKO_WLASCICIEL_ORBITA)
  if (odmowa) return odmowa
  try {
    return await f()
  } catch (e) {
    if (e instanceof BladOrbity) return blad(e.message, STATUS[e.rodzaj])
    console.error('[orbita]', e)
    return blad('Zadania chwilowo niedostępne - spróbuj ponownie', 500)
  }
}
