'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Projekt } from '@/types'
import { fetchZSesja } from '@/lib/auth/odnow'

type Stan = { projekty: Projekt[]; loading: boolean; blad: string | null }

async function pobierzProjekty(): Promise<Omit<Stan, 'loading'>> {
  try {
    const res = await fetchZSesja('/api/projekty')
    // Pusta zakładka to pusty moduł, a nie dane demo. Kondycji projektów nie
    // da się pokazać na wymyślonych liczbach - cała jej wartość polega na tym,
    // że mówi o prawdziwych projektach, a zmyślony alarm byłby gorszy niż brak.
    if (!res.ok) {
      const tresc = await res.json().catch(() => null)
      throw new Error(tresc?.error ?? `HTTP ${res.status}`)
    }
    const dane = await res.json()
    return { projekty: Array.isArray(dane) ? dane : [], blad: null }
  } catch (e) {
    return { projekty: [], blad: e instanceof Error ? e.message : 'Nie udało się pobrać projektów' }
  }
}

export function useProjekty() {
  const [stan, setStan] = useState<Stan>({ projekty: [], loading: true, blad: null })

  const fetchAll = useCallback(async () => {
    setStan({ ...(await pobierzProjekty()), loading: false })
  }, [])

  useEffect(() => {
    let aktywny = true
    pobierzProjekty().then((nowe) => {
      if (aktywny) setStan({ ...nowe, loading: false })
    })
    return () => { aktywny = false }
  }, [])

  const dodajProjekt = async (payload: Omit<Projekt, 'id' | 'created_at'>) => {
    const res = await fetchZSesja('/api/projekty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    await fetchAll()
  }

  return { ...stan, dodajProjekt, refresh: fetchAll }
}
