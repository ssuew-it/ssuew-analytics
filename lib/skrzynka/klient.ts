'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type { WynikSynchronizacji } from './typy'

export const klientSkrzynki = {
  importuj: (strona: string | null) =>
    wywolaj<{ nastepnaStrona: string | null; zrobione: number; razem: number }>('/api/skrzynka/import', json('POST', { strona })),
  synchronizuj: () => wywolaj<WynikSynchronizacji>('/api/skrzynka/synchronizuj', { method: 'POST' }),
}
