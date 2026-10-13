'use client'
import type { Notatka, Rozmowa, SkrotRozmowy, ZrodloNotatki } from './pamiec'

/** Błąd z ludzkim komunikatem; przy czacie niesie id rozmowy, w której zostało pytanie. */
export class BladKlienta extends Error {
  readonly rozmowaId: string | null
  constructor(wiadomosc: string, rozmowaId: string | null = null) {
    super(wiadomosc)
    this.name = 'BladKlienta'
    this.rozmowaId = rozmowaId
  }
}

export async function wywolaj<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new BladKlienta('Brak połączenia - spróbuj ponownie.')
  }
  const dane = await res.json().catch(() => ({}))
  if (!res.ok) throw new BladKlienta(dane.error ?? 'Coś poszło nie tak - spróbuj ponownie.', dane.rozmowaId ?? null)
  return dane as T
}

export const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const klient = {
  zapytaj: (b: { rozmowaId: string | null; pytanie: string; ponow: boolean }) =>
    wywolaj<{ rozmowaId: string; odpowiedz: string; propozycja: string | null }>('/api/asystent/czat', json('POST', b)),
  rozmowy: () => wywolaj<SkrotRozmowy[]>('/api/asystent/rozmowy'),
  rozmowa: (id: string) => wywolaj<Rozmowa>(`/api/asystent/rozmowy/${id}`),
  usunRozmowe: (id: string) => wywolaj<{ ok: true }>(`/api/asystent/rozmowy/${id}`, { method: 'DELETE' }),
  usunRozmowy: () => wywolaj<{ usuniete: number }>('/api/asystent/rozmowy', { method: 'DELETE' }),
  notatki: () => wywolaj<Notatka[]>('/api/asystent/notatki'),
  dodajNotatke: (tresc: string, zrodlo: ZrodloNotatki) => wywolaj<Notatka>('/api/asystent/notatki', json('POST', { tresc, zrodlo })),
  zmienNotatke: (id: string, tresc: string) =>
    wywolaj<{ ok: true; tresc: string }>(`/api/asystent/notatki/${id}`, json('PATCH', { tresc })),
  usunNotatke: (id: string) => wywolaj<{ ok: true }>(`/api/asystent/notatki/${id}`, { method: 'DELETE' }),
}
