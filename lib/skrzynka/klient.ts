'use client'
import { json, wywolaj } from '@/lib/asystent/klient'
import type {
  KartaKontaktu, KartaOrganizacji, Organizacja, Sprawa, Status, StronaKontaktow, StronaSpraw, SzczegolySprawy, TypOrganizacji,
  UstawieniaSkrzynki, WynikSynchronizacji, ZmianaSprawy,
} from './typy'

export const klientSkrzynki = {
  importuj: (strona: string | null) =>
    wywolaj<{ nastepnaStrona: string | null; zrobione: number; razem: number }>('/api/skrzynka/import', json('POST', { strona })),
  synchronizuj: () => wywolaj<WynikSynchronizacji>('/api/skrzynka/synchronizuj', { method: 'POST' }),
  sprawy: (status: Status, po: string | null) =>
    wywolaj<StronaSpraw>(`/api/skrzynka/sprawy?${new URLSearchParams(po ? { status, po } : { status })}`),
  szukaj: (q: string) => wywolaj<StronaSpraw>(`/api/skrzynka/szukaj?${new URLSearchParams({ q })}`),
  sprawa: (id: string) => wywolaj<SzczegolySprawy>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}`),
  zmien: (id: string, z: ZmianaSprawy) => wywolaj<Sprawa>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}`, json('PATCH', z)),
  odpowiedz: (id: string, tekst: string, pliki: File[]) => {
    const fd = new FormData()
    fd.append('tekst', tekst)
    for (const p of pliki) fd.append('pliki', p)
    return wywolaj<Sprawa>(`/api/skrzynka/sprawy/${encodeURIComponent(id)}/odpowiedz`, { method: 'POST', body: fd })
  },
  ustawienia: () => wywolaj<UstawieniaSkrzynki>('/api/skrzynka/ustawienia'),
  zapiszUstawienia: (z: Partial<UstawieniaSkrzynki>) => wywolaj<UstawieniaSkrzynki>('/api/skrzynka/ustawienia', json('PATCH', z)),
  rozlacz: (usunDane: boolean) => wywolaj<{ ok: true }>('/api/skrzynka/rozlacz', json('POST', { usunDane })),
  kontakty: (po: string | null) =>
    wywolaj<StronaKontaktow>(`/api/skrzynka/kontakty${po ? `?${new URLSearchParams({ po })}` : ''}`),
  kontakt: (email: string) => wywolaj<KartaKontaktu>(`/api/skrzynka/kontakty?${new URLSearchParams({ email })}`),
  organizacje: () => wywolaj<{ organizacje: Organizacja[] }>('/api/skrzynka/organizacje'),
  organizacja: (domena: string) => wywolaj<KartaOrganizacji>(`/api/skrzynka/organizacje?${new URLSearchParams({ domena })}`),
  zmienOrganizacje: (domena: string, z: { nazwa?: string; typ?: TypOrganizacji }) =>
    wywolaj<Organizacja>('/api/skrzynka/organizacje', json('PATCH', { domena, ...z })),
}
