import type { PlanKalendarza, WpisKalendarza } from './porownanie'
import type { Termin, WydarzenieGoogle } from './wydarzenie'

/** Główny kalendarz kontakt@ = Kalendarz Samorządowicza. Stały - D.E.C.K. nie wybiera ani nie tworzy kalendarzy. */
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const STREFA = 'Europe/Warsaw'
const NARAZ = 5

export type RodzajBleduKalendarza = 'brak-zgody' | 'api-wylaczone' | 'limit' | 'google'

export class BladKalendarza extends Error {
  readonly rodzaj: RodzajBleduKalendarza
  constructor(rodzaj: RodzajBleduKalendarza, wiadomosc: string) {
    super(wiadomosc)
    this.name = 'BladKalendarza'
    this.rodzaj = rodzaj
  }
}

interface ZdarzenieApi {
  id: string
  status?: string
  summary?: string
  location?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
  extendedProperties?: { private?: Record<string, string> }
  organizer?: { self?: boolean }
  attendees?: unknown[]
}

function rodzajBledu(status: number, tresc: string): RodzajBleduKalendarza {
  if (/accessNotConfigured|SERVICE_DISABLED/.test(tresc)) return 'api-wylaczone'
  if (status === 429 || /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|RESOURCE_EXHAUSTED/.test(tresc)) return 'limit'
  // Samo PERMISSION_DENIED Google dokleja do każdego 403 - brak zgody to tylko brak zakresu.
  if (status === 401 || /insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT/.test(tresc)) return 'brak-zgody'
  return 'google'
}

async function wywolaj<T>(dostep: string, adres: string, init: { method?: string; cialo?: unknown } = {}): Promise<T | null> {
  const res = await fetch(adres, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${dostep}`,
      ...(init.cialo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: init.cialo === undefined ? undefined : JSON.stringify(init.cialo),
    cache: 'no-store',
  })
  if (res.ok) return res.status === 204 ? null : ((await res.json().catch(() => null)) as T | null)
  const tresc = await res.text().catch(() => '')
  throw Object.assign(new BladKalendarza(rodzajBledu(res.status, tresc), `Google Calendar ${res.status}: ${tresc.slice(0, 300)}`), { status: res.status })
}

/** Termin z odpowiedzi Google w naszym kształcie: przesunięcie strefy odcięte (lista idzie w strefie Warszawy). */
function termin(t: ZdarzenieApi['start']): Termin {
  if (t?.date) return { date: t.date }
  return { dateTime: (t?.dateTime ?? '').slice(0, 19), timeZone: STREFA }
}

function naWpis(z: ZdarzenieApi): WpisKalendarza {
  const p = z.extendedProperties?.private
  const nasz = p?.deck === '1' && !!p.deckId
  return {
    id: z.id,
    summary: z.summary ?? '',
    start: termin(z.start),
    end: termin(z.end),
    location: z.location || null,
    deckId: nasz ? p!.deckId : null,
    deckSemestr: nasz ? p!.deckSemestr ?? null : null,
    spotkanie: z.organizer?.self !== true || (z.attendees?.length ?? 0) > 0,
  }
}

async function wszystkie(dostep: string, parametry: Record<string, string>): Promise<ZdarzenieApi[]> {
  const wynik: ZdarzenieApi[] = []
  let strona: string | null = null
  do {
    const p = new URLSearchParams({ ...parametry, maxResults: '2500', timeZone: STREFA })
    if (strona) p.set('pageToken', strona)
    const d: { items?: ZdarzenieApi[]; nextPageToken?: string } | null = await wywolaj(dostep, `${API}?${p}`)
    wynik.push(...(d?.items ?? []))
    strona = d?.nextPageToken ?? null
  } while (strona)
  return wynik
}

/**
 * Wpisy, z którymi trzeba porównać Planer: wszystkie ze znacznikiem semestru
 * (także te przeniesione poza okno) i wszystkie z okna `od`-`do` (kandydaci do przejęcia).
 */
export async function wpisyKalendarza(dostep: string, semestrId: string, od: string, do_: string): Promise<WpisKalendarza[]> {
  const [oznaczone, zOkna] = await Promise.all([
    wszystkie(dostep, { privateExtendedProperty: `deckSemestr=${semestrId}` }),
    wszystkie(dostep, { timeMin: od, timeMax: do_, singleEvents: 'true' }),
  ])
  const poId = new Map<string, WpisKalendarza>()
  for (const z of [...oznaczone, ...zOkna]) {
    if (z.status === 'cancelled' || poId.has(z.id)) continue
    poId.set(z.id, naWpis(z))
  }
  return [...poId.values()]
}

/**
 * PATCH scala zagnieżdżone pola, więc przejście całodniowe ↔ godzinowe musi
 * jawnie wyczyścić stare pole terminu (null), inaczej Google odrzuca zmianę.
 * Puste `location` czyści salę, której w Planerze już nie ma.
 */
const terminZmiany = (t: Termin) => ('date' in t ? { date: t.date, dateTime: null, timeZone: null } : { date: null, ...t })
const cialoZmiany = (g: WydarzenieGoogle) => ({ ...g, start: terminZmiany(g.start), end: terminZmiany(g.end), location: g.location ?? '' })

function powod(e: unknown): string {
  if (e instanceof BladKalendarza) {
    if (e.rodzaj === 'limit') return 'limit Google - kliknij Wyślij ponownie za minutę'
    if (e.rodzaj === 'brak-zgody') return 'brak zgody na kalendarz'
    if (e.rodzaj === 'api-wylaczone') return 'Google Calendar API wyłączone'
  }
  return 'Google nie przyjął zmiany'
}

/**
 * Wykonuje plan po `NARAZ` zapisów równolegle. Każdy zapis z `sendUpdates=none` -
 * Google nikogo nie powiadamia. Błąd jednego zapisu nie zatrzymuje reszty;
 * powtórka po częściowej porażce nie dubluje, bo dodane mają już znacznik.
 */
export async function wykonajPlan(dostep: string, plan: PlanKalendarza): Promise<{ udane: number; nieudane: { tytul: string; powod: string }[] }> {
  const q = '?sendUpdates=none'
  const zadania: { tytul: string; wykonaj: () => Promise<unknown> }[] = [
    ...[...plan.przejmij, ...plan.zmien].map(({ wpisId, wydarzenie }) => ({
      tytul: wydarzenie.summary,
      wykonaj: () => wywolaj(dostep, `${API}/${encodeURIComponent(wpisId)}${q}`, { method: 'PATCH', cialo: cialoZmiany(wydarzenie) }),
    })),
    ...plan.dodaj.map((wydarzenie) => ({
      tytul: wydarzenie.summary,
      wykonaj: () => wywolaj(dostep, `${API}${q}`, { method: 'POST', cialo: wydarzenie }),
    })),
    ...plan.usun.map((w) => ({
      tytul: w.summary,
      wykonaj: async () => {
        try {
          await wywolaj(dostep, `${API}/${encodeURIComponent(w.id)}${q}`, { method: 'DELETE' })
        } catch (e) {
          // Już usunięty w Google - cel osiągnięty.
          const status = (e as { status?: number }).status
          if (status !== 404 && status !== 410) throw e
        }
      },
    })),
  ]

  let udane = 0
  const nieudane: { tytul: string; powod: string }[] = []
  let nastepne = 0
  async function pracownik() {
    while (nastepne < zadania.length) {
      const z = zadania[nastepne++]
      try {
        await z.wykonaj()
        udane++
      } catch (e) {
        console.error('[kalendarz]', e)
        nieudane.push({ tytul: z.tytul, powod: powod(e) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(NARAZ, zadania.length) }, pracownik))
  return { udane, nieudane }
}
