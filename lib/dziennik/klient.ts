'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type { Adnotacja, Kadencja, Ksiega, Wpis } from './typy'

/** Zapytania strony Dziennika. Błąd = `BladKlienta` z komunikatem serwera. */
export const klientDziennika = {
  ksiega: () => wywolaj<Ksiega>('/api/dziennik', { cache: 'no-store' }),
  rozpocznij: (pola: { nazwa: string; autor: string; funkcja: string }) => wywolaj<Kadencja>('/api/dziennik/kadencja', json('POST', pola)),
  dodajWpis: (pola: unknown) => wywolaj<Wpis>('/api/dziennik/wpisy', json('POST', pola)),
  zmienWpis: (id: string, pola: unknown) => wywolaj<Wpis>(`/api/dziennik/wpisy/${id}`, json('PATCH', pola)),
  usunWpis: (id: string) => wywolaj<{ ok: true }>(`/api/dziennik/wpisy/${id}`, { method: 'DELETE' }),
  dodajAdnotacje: (wpisId: string, pola: unknown) => wywolaj<Adnotacja>(`/api/dziennik/wpisy/${wpisId}/adnotacje`, json('POST', pola)),
  zmienAdnotacje: (wpisId: string, aid: string, pola: unknown) =>
    wywolaj<Adnotacja>(`/api/dziennik/wpisy/${wpisId}/adnotacje/${aid}`, json('PATCH', pola)),
  usunAdnotacje: (wpisId: string, aid: string) => wywolaj<{ ok: true }>(`/api/dziennik/wpisy/${wpisId}/adnotacje/${aid}`, { method: 'DELETE' }),
  kopia: () => wywolaj<{ link: string }>('/api/dziennik/kopia', { method: 'POST' }),
  przekaz: (kadencjaId: string) => wywolaj<{ link: string }>('/api/dziennik/przekaz', json('POST', { kadencjaId })),
}
