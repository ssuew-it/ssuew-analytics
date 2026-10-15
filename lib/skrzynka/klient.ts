'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type { Sprawa, Status, StronaSpraw, SzczegolySprawy, WynikSynchronizacji, ZmianaSprawy } from './typy'

export const klientSkrzynki = {
  importuj: (strona: string | null) =>
    wywolaj<{ nastepnaStrona: string | null; zrobione: number; razem: number }>('/api/skrzynka/import', json('POST', { strona })),
  synchronizuj: () => wywolaj<WynikSynchronizacji>('/api/skrzynka/synchronizuj', { method: 'POST' }),
  sprawy: (status: Status, po: string | null) =>
    wywolaj<StronaSpraw>(`/api/skrzynka/sprawy?${new URLSearchParams(po ? { status, po } : { status })}`),
  szukaj: (q: string) => wywolaj<StronaSpraw>(`/api/skrzynka/szukaj?${new URLSearchParams({ q })}`),
  sprawa: (id: string) => wywolaj<SzczegolySprawy>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}`),
  zmien: (id: string, z: ZmianaSprawy) => wywolaj<Sprawa>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}`, json('PATCH', z)),
}
