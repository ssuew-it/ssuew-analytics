'use client'
import { createContext, useState, useEffect, useCallback, useContext, useMemo } from 'react'
import type { Rekrutacja, Kohorta, KpiMetric } from '@/types'
import { serieZWierszy } from '@/lib/kpi/serie'
import { fetchZSesja } from '@/lib/auth/odnow'

export type ZrodloDanych = 'live' | 'demo'
export type Zbior = 'rekrutacje' | 'kpi' | 'kohorty'

/** Nazwy modułów, jakie widzi użytkownik - komunikat ma mówić jego językiem, nie nazwami tras. */
export const NAZWA_ZBIORU: Record<Zbior, string> = {
  rekrutacje: 'Rekrutacje',
  kpi: 'KPI',
  kohorty: 'Retencja',
}

type Pobrany<T> = { dane: T[]; zrodlo: ZrodloDanych; blad: string | null }

/**
 * Każda zakładka arkusza osobno. Wcześniej jeden błąd (np. brak `kpi_punkty`)
 * przełączał na dane przykładowe całą analitykę, także rekrutacje, które
 * przyszły poprawnie - i nikt się o tym nie dowiadywał.
 *
 * Pusta lista to arkusz bez danych albo nieskonfigurowany skrypt: wtedy dane
 * przykładowe z historii SSUEW, ale zawsze z oznaczeniem `demo`.
 */
async function pobierz<T>(zbior: Zbior, demo: T[]): Promise<Pobrany<T>> {
  try {
    const res = await fetchZSesja(`/api/${zbior}`)
    if (!res.ok) {
      const tresc = await res.json().catch(() => null)
      throw new Error(tresc?.error ?? `HTTP ${res.status}`)
    }
    const dane = await res.json()
    if (Array.isArray(dane) && dane.length > 0) return { dane, zrodlo: 'live', blad: null }
    return { dane: demo, zrodlo: 'demo', blad: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'nieznany błąd'
    return { dane: demo, zrodlo: 'demo', blad: `${NAZWA_ZBIORU[zbior]}: ${msg}` }
  }
}

type Stan = {
  rekrutacje: Rekrutacja[]
  kohorty: Kohorta[]
  kpiMetrics: KpiMetric[]
  zrodla: Record<Zbior, ZrodloDanych>
  bledy: string[]
  loading: boolean
}

async function pobierzWszystko(): Promise<Omit<Stan, 'loading'>> {
  const [r, k, h] = await Promise.all([
    pobierz<Rekrutacja>('rekrutacje', DEMO_REKRUTACJE),
    pobierz<KpiMetric>('kpi', DEMO_KPI_METRICS),
    pobierz<Kohorta>('kohorty', DEMO_KOHORTY),
  ])
  return {
    rekrutacje: r.dane,
    kpiMetrics: k.dane,
    kohorty: h.dane,
    zrodla: { rekrutacje: r.zrodlo, kpi: k.zrodlo, kohorty: h.zrodlo },
    bledy: [r.blad, k.blad, h.blad].filter((b): b is string => b !== null),
  }
}

const POCZATEK: Stan = {
  rekrutacje: [], kohorty: [], kpiMetrics: [],
  zrodla: { rekrutacje: 'live', kpi: 'live', kohorty: 'live' },
  bledy: [], loading: true,
}

/** Właściwy stan danych. Woła go tylko `AnalyticsDataProvider` - moduły czytają kontekst. */
export function useAnalyticsZrodlo() {
  const [stan, setStan] = useState<Stan>(POCZATEK)

  // Odświeżenie po zapisie nie wraca do szkieletu - stare liczby zostają
  // na ekranie, dopóki nie przyjdą nowe.
  const fetchAll = useCallback(async () => {
    const nowe = await pobierzWszystko()
    setStan({ ...nowe, loading: false })
  }, [])

  useEffect(() => {
    let aktywny = true
    pobierzWszystko().then((nowe) => {
      if (aktywny) setStan({ ...nowe, loading: false })
    })
    return () => { aktywny = false }
  }, [])

  const { rekrutacje, kohorty, kpiMetrics, zrodla, bledy, loading } = stan
  const usingDemo = Object.values(zrodla).includes('demo')
  const error = bledy.length ? bledy.join(' · ') : null

  const addRekrutacja = async (payload: Omit<Rekrutacja, 'id' | 'created_at'>) => {
    const res = await fetchZSesja('/api/rekrutacje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    await fetchAll()
  }

  const addKpiMetric = async (payload: Omit<KpiMetric, 'id' | 'created_at'>) => {
    const res = await fetchZSesja('/api/kpi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    await fetchAll()
  }

  const addKohorta = async (payload: Omit<Kohorta, 'id' | 'created_at' | 'survival'>) => {
    const res = await fetchZSesja('/api/kohorty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    await fetchAll()
  }

  // Wsadowy zapis metryk KPI (cały nowy rocznik naraz).
  const addKpiMetricsBulk = async (payloads: Omit<KpiMetric, 'id' | 'created_at'>[]) => {
    const res = await fetchZSesja('/api/kpi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads),
    })
    if (!res.ok) throw new Error(await res.text())
    await fetchAll()
  }

  // Edycja inline metryki KPI po id (autosave).
  const updateKpiMetric = async (id: string, patch: Partial<Omit<KpiMetric, 'id' | 'created_at'>>) => {
    const res = await fetchZSesja('/api/kpi', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    if (!res.ok) throw new Error(await res.text())
    await fetchAll()
  }

  // Serie liczymy raz na komplet wierszy - cały interfejs KPI patrzy na nie,
  // a nie na surowe wiersze, więc sklejanie nie może się dziać przy każdym renderze.
  const serie = useMemo(() => serieZWierszy(kpiMetrics), [kpiMetrics])

  return { rekrutacje, kohorty, kpiMetrics, serie, loading, error, bledy, zrodla, usingDemo, addRekrutacja, addKpiMetric, addKohorta, addKpiMetricsBulk, updateKpiMetric, refresh: fetchAll }
}

export type AnalyticsData = ReturnType<typeof useAnalyticsZrodlo>

export const AnalyticsDataContext = createContext<AnalyticsData | null>(null)

/**
 * Dane analityki, wspólne dla całej sekcji. Przejście między modułami nie
 * pobiera wszystkiego od nowa - Apps Script odpowiada 1-3 s i każda zakładka
 * zaczynała od szkieletu.
 */
export function useAnalyticsData(): AnalyticsData {
  const dane = useContext(AnalyticsDataContext)
  if (!dane) throw new Error('useAnalyticsData wymaga AnalyticsDataProvider (app/analytics/layout.tsx)')
  return dane
}

// ─── Dane demo (realne dane SSUEW, używane gdy arkusz jest pusty albo nie odpowiada) ─

// Z dane_zrodlowe/KPI SSUEW.xlsx - "PRZYJĘCI DZIAŁACZE". Zgłoszenia od rekrutacji J'23.
export const DEMO_REKRUTACJE: Rekrutacja[] = [
  { id:'1', edycja:"J'23", sezon:'jesien', rok:2023, zgloszenia:100, przyjeci:38, created_at:'' },
  { id:'2', edycja:"W'24", sezon:'wiosna', rok:2024, zgloszenia:28,  przyjeci:13, created_at:'' },
  { id:'3', edycja:"J'24", sezon:'jesien', rok:2024, zgloszenia:149, przyjeci:38, created_at:'' },
  { id:'4', edycja:"W'25", sezon:'wiosna', rok:2025, zgloszenia:31,  przyjeci:10, created_at:'' },
  { id:'5', edycja:"J'25", sezon:'jesien', rok:2025, zgloszenia:138, przyjeci:45, created_at:'' },
  { id:'6', edycja:"W'26", sezon:'wiosna', rok:2026, zgloszenia:18,  przyjeci:11, created_at:'' },
]

// Z dane_zrodlowe/Analiza - długość działania.xlsx. avg/max z PODSUMOWANIA;
// survival = REALNA krzywa przeżycia (% aktywnych po t sem.) liczona z danych per-osoba.
export const DEMO_KOHORTY: Kohorta[] = [
  { id:'1', edycja:"W'22", sezon:'wiosna', rok:2022, n_czlonkow:14, avg_retention_sem:4.36, max_retention_sem:9,  in_progress:false, survival:[100,100,100,100,73,36,9,9,9], created_at:'' },
  { id:'2', edycja:"J'22", sezon:'jesien', rok:2022, n_czlonkow:39, avg_retention_sem:4.24, max_retention_sem:8,  in_progress:false, survival:[100,100,100,85,73,33,18,9,6], created_at:'' },
  { id:'3', edycja:"W'23", sezon:'wiosna', rok:2023, n_czlonkow:11, avg_retention_sem:4.20, max_retention_sem:7,  in_progress:false, survival:[100,100,90,90,60,30,30,20], created_at:'' },
  { id:'4', edycja:"J'23", sezon:'jesien', rok:2023, n_czlonkow:39, avg_retention_sem:3.86, max_retention_sem:6,  in_progress:false, survival:[100,100,97,83,63,31,11], created_at:'' },
  { id:'5', edycja:"W'24", sezon:'wiosna', rok:2024, n_czlonkow:13, avg_retention_sem:2.69, max_retention_sem:5,  in_progress:false, survival:[100,100,77,69,23], created_at:'' },
  { id:'6', edycja:"J'24", sezon:'jesien', rok:2024, n_czlonkow:38, avg_retention_sem:3.53, max_retention_sem:4,  in_progress:false, survival:[100,100,100,80,73], created_at:'' },
  { id:'7', edycja:"W'25", sezon:'wiosna', rok:2025, n_czlonkow:10, avg_retention_sem:1.80, max_retention_sem:3,  in_progress:true,  survival:[100,60,60,60], created_at:'' },
]

// Z dane_zrodlowe/KPI SSUEW.xlsx (arkusz 20252026): porównanie 2024/2025 → 2025/2026.
const DEMO_OKRESY = ['2024/2025', '2025/2026']

/**
 * Dane demo trzymamy zwarto - nazwa i wartości rok po roku - a rozwijamy do
 * wierszy dopiero tutaj. Wypisanie sześćdziesięciu wierszy wprost byłoby
 * nieczytelne i przy każdej poprawce prosiłoby się o przekręconą liczbę.
 *
 * Kolejność wartości odpowiada DEMO_OKRESY. Dopisanie kolejnego rocznika to
 * dopisanie okresu wyżej i jednej liczby w każdym wierszu.
 */
function demoKpi(kategoria: string, wpisy: [string, number[]][]): KpiMetric[] {
  return wpisy.flatMap(([nazwa, wartosci]) =>
    wartosci.map((wartosc, i) => ({
      id: `${kategoria}-${nazwa}-${DEMO_OKRESY[i]}`,
      kategoria,
      nazwa,
      okres: DEMO_OKRESY[i],
      wartosc,
      created_at: '',
    })),
  )
}

export const DEMO_KPI_METRICS: KpiMetric[] = [
  // Obecność na SKS (miesięcznie)
  ...demoKpi('SKS', [
    ['Październik', [48, 45]],
    ['Listopad', [57, 84]],
    ['Grudzień', [43, 56]],
    ['Styczeń', [41, 56]],
    ['Luty', [34, 44]],
    ['Marzec', [42, 47]],
  ]),
  // Zapisy na wydarzenia wewnętrzne
  ...demoKpi('Wydarzenia', [
    ['JWK', [43, 52]],
    ['Wigilia', [83, 77]],
    ['Przydziałki', [56, 64]],
    ['WWK', [45, 40]],
  ]),
  // Zwrotność ankiety zarządu
  ...demoKpi('Ankieta', [['Zimowa Zarządu', [47, 28]]]),
  // Aplikacje na koordynatorów (pipeline liderów) - wszystkie projekty
  ...demoKpi('Koordynatorzy', [
    ['DA', [1, 1]],
    ['RJ', [2, 1]],
    ['JWK', [1, 2]],
    ['TWE', [1, 2]],
    ['ZFUE', [1, 1]],
    ['Bal', [1, 1]],
    ['ME', [2, 1]],
    ['Wigilia', [9, 12]],
    ['TEDx', [1, 1]],
    ['Przydziałki', [2, 2]],
    ['WWK', [1, 1]],
    ['RW', [1, 1]],
    ['Adapciak', [2, 1]],
    ['Animalia', [1, 2]],
    ['LWK', [1, 1]],
    ['Gala', [1, 5]],
    ['Graduation', [1, 2]],
  ]),
]
