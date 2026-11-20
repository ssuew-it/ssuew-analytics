'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type { PolaZadania, Zadanie } from './typy'

/** Zapytania strony Orbity. Błąd = `BladKlienta` z komunikatem serwera. */
export const klientOrbity = {
  zadania: () => wywolaj<{ zadania: Zadanie[] }>('/api/orbita', { cache: 'no-store' }).then((x) => x.zadania),
  dodaj: (pola: PolaZadania) => wywolaj<Zadanie>('/api/orbita', json('POST', pola)),
  zmien: (id: string, pola: PolaZadania, zmieniono: number) => wywolaj<Zadanie>(`/api/orbita/${id}`, json('PATCH', { ...pola, zmieniono })),
  usun: (id: string) => wywolaj<{ ok: true }>(`/api/orbita/${id}`, { method: 'DELETE' }),
  zamknij: (id: string, etapId: string, wynik: string) =>
    wywolaj<Zadanie>(`/api/orbita/${id}/etapy/${etapId}`, json('POST', { akcja: 'zamknij', wynik })),
  otworz: (id: string, etapId: string) => wywolaj<Zadanie>(`/api/orbita/${id}/etapy/${etapId}`, json('POST', { akcja: 'otworz' })),
  zrodla: () =>
    wywolaj<{ zrodla: { wpisId: string; termin: string; zadanieId: string }[] }>('/api/orbita/zrodla', { cache: 'no-store' }).then((x) => x.zrodla),
}
