import { unstable_cache } from 'next/cache'
import { stronyRef } from '@/lib/firebase/admin'
import { dzisWarszawa } from '@/lib/czas'
import { BladGoogle, emailKonta, zapytanie } from './google'
import { nazwaZWitryny, okresy, type Okres } from './okresy'
import { komunikatStrony, zlozStatystyki, type StatystykiStrony, type WpisStrony, type WynikStrony } from './model'

/** Dane Google mają 2-3 dni opóźnienia - częstsze pytanie nic nie da, a kosztuje CPU wspólnego konta Vercel. */
const CACHE_S = 6 * 60 * 60

export async function listaStron(): Promise<WpisStrony[]> {
  const d = (await stronyRef().get()).data()
  const surowe: unknown[] = Array.isArray(d?.witryny) ? d.witryny : []
  return surowe.flatMap((x) => {
    const w = x as { witryna?: unknown; nazwa?: unknown }
    if (typeof w?.witryna !== 'string' || !w.witryna) return []
    const nazwa = typeof w.nazwa === 'string' && w.nazwa.trim() ? w.nazwa.trim() : nazwaZWitryny(w.witryna)
    return [{ witryna: w.witryna, nazwa }]
  })
}

export async function dodajStrone(wpis: WpisStrony): Promise<void> {
  const lista = await listaStron()
  if (lista.some((s) => s.witryna === wpis.witryna)) return
  await stronyRef().set({ witryny: [...lista, wpis] })
}

export async function usunStrone(witryna: string): Promise<void> {
  const lista = await listaStron()
  await stronyRef().set({ witryny: lista.filter((s) => s.witryna !== witryna) })
}

/**
 * Pięć zapytań na witrynę, równolegle. Argumenty są kluczem cache, więc nowy
 * dzień (nowe okresy) to nowy wpis. Wyjątek nie trafia do cache - dodanie
 * uprawnień w Search Console działa od następnego wejścia.
 */
const pobierzStatystyki = unstable_cache(
  async (strona: WpisStrony, biezacy: Okres, poprzedni: Okres): Promise<StatystykiStrony> => {
    const okres = { startDate: biezacy.od, endDate: biezacy.do }
    const [suma, sumaPoprzednia, dzienne, zapytania, podstrony] = await Promise.all([
      zapytanie(strona.witryna, okres),
      zapytanie(strona.witryna, { startDate: poprzedni.od, endDate: poprzedni.do }),
      zapytanie(strona.witryna, { ...okres, dimensions: ['date'] }),
      zapytanie(strona.witryna, { ...okres, dimensions: ['query'], rowLimit: 10 }),
      zapytanie(strona.witryna, { ...okres, dimensions: ['page'], rowLimit: 10 }),
    ])
    return zlozStatystyki({ strona, okres: biezacy, suma, sumaPoprzednia, dzienne, zapytania, podstrony })
  },
  ['strony-statystyki'],
  { revalidate: CACHE_S, tags: ['strony'] },
)

/** Błąd jednej witryny zostaje w jej wyniku. Rzuca tylko, gdy nie da się odczytać listy. */
export async function statystykiStron(teraz = new Date()): Promise<WynikStrony[]> {
  const lista = await listaStron()
  const { biezacy, poprzedni } = okresy(dzisWarszawa(teraz))
  return Promise.all(
    lista.map(async (strona): Promise<WynikStrony> => {
      try {
        return { ok: true, dane: await pobierzStatystyki(strona, biezacy, poprzedni) }
      } catch (e) {
        console.error('[strony]', strona.witryna, e)
        const blad = e instanceof BladGoogle ? e.rodzaj : 'inny'
        return { ok: false, witryna: strona.witryna, nazwa: strona.nazwa, blad, komunikat: komunikatStrony(blad, emailKonta()) }
      }
    }),
  )
}
