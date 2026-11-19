import { NextResponse, type NextRequest } from 'next/server'
import { czytajKsiege } from '@/lib/dziennik/dane'
import { trasa } from '@/lib/dziennik/http'

export const runtime = 'nodejs'

export function GET(req: NextRequest) {
  return trasa(req, async () => NextResponse.json(await czytajKsiege()))
}
