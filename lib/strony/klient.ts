'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type { DostepneWitryny, WpisStrony } from './model'

export const klientStron = {
  dostepne: () => wywolaj<DostepneWitryny>('/api/strony/dostepne'),
  dodaj: (witryna: string, nazwa: string) => wywolaj<WpisStrony>('/api/strony', json('POST', { witryna, nazwa })),
  // Identyfikator ma „:” i „/” - bez kodowania serwer dostałby obcięty adres.
  usun: (witryna: string) =>
    wywolaj<{ ok: true }>(`/api/strony?witryna=${encodeURIComponent(witryna)}`, { method: 'DELETE' }),
}
