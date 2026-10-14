import { BladSkrzynki, gmail as utworzGmail, wymienKod, type Gmail } from './google'
import { odszyfruj, zaszyfruj } from './szyfr'
import {
  czytajSprawy, czytajStan, pomijane, wezDzierzawe, zapiszStan, zapiszWynik, zwolnijDzierzawe, type StanSkrzynki,
} from './dane'
import { odczytajWatek } from './naglowki'
import { domena, drugaStrona, kontaktZAdresu, organizacjaZEmaila } from './kontakty'
import { kierunek, ocenSprawe } from './statusy'
import type { Kontakt, Organizacja, Sprawa, WynikSynchronizacji } from './typy'

export const ZAPYTANIE_IMPORTU = 'newer_than:365d'
const RUNDY = 3
const ROWNOLEGLE = 10
const MAKS_PRZEGLADU = 500

function nasz(): string {
  const e = process.env.DECK_OWNER_EMAIL
  if (!e) throw new BladSkrzynki('konfiguracja', 'Brak DECK_OWNER_EMAIL')
  return e.toLowerCase()
}

function temat(): string {
  const t = process.env.SKRZYNKA_TEMAT
  if (!t) throw new BladSkrzynki('konfiguracja', 'Brak SKRZYNKA_TEMAT')
  return t
}

const gmailZeStanu = (s: StanSkrzynki) => utworzGmail(odszyfruj(s.token))

/** Kilka zapytań do Gmaila naraz, ale nie sto - limit Gmail API liczy się na minutę. */
async function poKilka<T, W>(lista: T[], f: (x: T) => Promise<W>): Promise<W[]> {
  const wynik: W[] = []
  for (let i = 0; i < lista.length; i += ROWNOLEGLE) wynik.push(...(await Promise.all(lista.slice(i, i + ROWNOLEGLE).map(f))))
  return wynik
}

/** Odwołany dostęp oznaczamy w stanie - kafelek i panel powiedzą „rozłączona”. */
async function zRozlaczeniem<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f()
  } catch (e) {
    if (e instanceof BladSkrzynki && e.rodzaj === 'rozlaczona') await zapiszStan({ polaczona: false })
    throw e
  }
}

/** Pobiera wątki, przepuszcza przez automat statusów i zapisuje. Zwraca liczbę zapisanych spraw. */
export async function przetworzWatki(g: Gmail, ids: string[], k: { teraz: number; import: boolean }): Promise<number> {
  const unikalne = [...new Set(ids)]
  if (!unikalne.length) return 0
  const [surowe, poprzednie, pomin] = await Promise.all([
    poKilka(unikalne, (id) =>
      g.watek(id).catch((e) => {
        // Wątek usunięty między powiadomieniem a pobraniem - nie ma czego zapisać.
        if (e instanceof BladSkrzynki && e.rodzaj === 'brak-watku') return null
        throw e
      }),
    ),
    czytajSprawy(unikalne),
    pomijane(),
  ])
  const my = nasz()
  const sprawy: Sprawa[] = []
  const kontakty: Kontakt[] = []
  const organizacje: Organizacja[] = []

  for (const s of surowe) {
    if (!s) continue
    const w = odczytajWatek(s)
    if (!w.wiadomosci.length) continue
    const ostatnia = w.wiadomosci[w.wiadomosci.length - 1]
    const druga = drugaStrona(w, my)
    const org = druga ? organizacjaZEmaila(druga.email) : null
    const pop = poprzednie.get(w.id) ?? null
    const pomijana = !!druga && (pomin.adresy.includes(druga.email) || pomin.domeny.includes(domena(druga.email)))
    const stan = ocenSprawe(
      pop && { status: pop.status, oczekujeOd: pop.oczekujeOd, nowa: pop.nowa, ostatniaKiedy: pop.ostatnia.kiedy },
      w,
      { nasz: my, pomijana, teraz: k.teraz, import: k.import },
    )
    sprawy.push({
      id: w.id,
      temat: w.wiadomosci[0].temat || '(bez tematu)',
      ...stan,
      kontakt: druga?.email ?? null,
      organizacja: org?.domena ?? null,
      ostatnia: { kiedy: ostatnia.kiedy, kierunek: kierunek(ostatnia, my), fragment: ostatnia.fragment.slice(0, 200) },
      wiadomosci: w.wiadomosci.length,
      przypisana: pop?.przypisana ?? null,
      kategoriaGmail: w.wiadomosci.flatMap((m) => m.etykiety).find((e) => e.startsWith('CATEGORY_')) ?? null,
      zmieniono: k.teraz,
    })
    if (druga) kontakty.push(kontaktZAdresu(druga))
    if (org) organizacje.push(org)
  }
  await zapiszWynik({ sprawy, kontakty, organizacje })
  return sprawy.length
}

async function zmienioneWatki(g: Gmail, od: string): Promise<{ ids: string[]; nowyHistoryId: string }> {
  try {
    const ids: string[] = []
    let strona: string | null = null
    let nowy = od
    do {
      const h = await g.historia(od, strona)
      for (const wpis of h.history ?? []) for (const m of wpis.messagesAdded ?? []) ids.push(m.message.threadId)
      nowy = h.historyId
      strona = h.nextPageToken ?? null
    } while (strona)
    return { ids, nowyHistoryId: nowy }
  } catch (e) {
    if (!(e instanceof BladSkrzynki) || e.rodzaj !== 'historia-za-stara') throw e
    // Długa przerwa: Gmail nie pamięta już naszego punktu - przeglądamy 30 dni.
    const { historyId } = await g.profil()
    const ids: string[] = []
    let strona: string | null = null
    do {
      const l = await g.listaWatkow('newer_than:30d', strona)
      ids.push(...(l.threads ?? []).map((t) => t.id))
      strona = l.nextPageToken ?? null
    } while (strona && ids.length < MAKS_PRZEGLADU)
    return { ids, nowyHistoryId: historyId }
  }
}

/** Jedyna droga zmian w bazie poza importem. Woła ją push, cron, wejście do panelu i „Dociągnij”. */
export async function synchronizuj(teraz = Date.now()): Promise<WynikSynchronizacji> {
  const stan = await czytajStan()
  if (!stan?.polaczona || !stan.historyId) return { stan: 'niepolaczona' }
  if (!(await wezDzierzawe(teraz))) return { stan: 'zajete' }
  const g = gmailZeStanu(stan)
  let historyId = stan.historyId
  let watki = 0
  try {
    for (let runda = 0; runda < RUNDY; runda++) {
      const { ids, nowyHistoryId } = await zmienioneWatki(g, historyId)
      watki += await przetworzWatki(g, ids, { teraz, import: false })
      historyId = nowyHistoryId
      await zapiszStan({ historyId, ostatniaSynchronizacja: Date.now() })
      if (!(await zwolnijDzierzawe(Date.now()))) return { stan: 'zrobione', watki }
    }
    // Po ostatniej rundzie dzierżawa była przedłużona - zwalniamy ją; kolejne powiadomienie zacznie od nowa.
    await zapiszStan({ dzierzawaDo: 0 })
    return { stan: 'zrobione', watki }
  } catch (e) {
    await zapiszStan({ dzierzawaDo: 0 })
    if (e instanceof BladSkrzynki && e.rodzaj === 'rozlaczona') {
      await zapiszStan({ polaczona: false })
      return { stan: 'rozlaczona' }
    }
    throw e
  }
}

/** Jedna strona importu (100 wątków). Prowadzi ją przeglądarka - żadne wywołanie nie trwa długo. */
export async function importujStrone(
  strona: string | null,
  teraz = Date.now(),
): Promise<{ nastepnaStrona: string | null; zrobione: number; razem: number }> {
  const stan = await czytajStan()
  if (!stan?.polaczona) throw new BladSkrzynki('rozlaczona', 'Skrzynka nie jest połączona')
  return zRozlaczeniem(async () => {
    const g = gmailZeStanu(stan)
    const l = await g.listaWatkow(ZAPYTANIE_IMPORTU, strona)
    const ile = await przetworzWatki(g, (l.threads ?? []).map((t) => t.id), { teraz, import: true })
    const zrobione = (strona ? stan.import.zrobione : 0) + ile
    const razem = Math.max(zrobione, strona ? stan.import.razem : (l.resultSizeEstimate ?? zrobione))
    const nastepnaStrona = l.nextPageToken ?? null
    await zapiszStan({ import: { trwa: nastepnaStrona !== null, zrobione, razem } })
    return { nastepnaStrona, zrobione, razem }
  })
}

/**
 * Po zgodzie Google: tylko konto właściciela, token zaszyfrowany, obserwacja
 * włączona. Ponowne połączenie zachowuje punkt historii i stan importu -
 * synchronizacja dociągnie zmiany z czasu rozłączenia.
 */
export async function polaczSkrzynke(kod: string): Promise<'ok' | 'inne-konto'> {
  const { refreshToken, dostep } = await wymienKod(kod)
  const g = utworzGmail(refreshToken, dostep)
  const profil = await g.profil()
  if (profil.emailAddress.toLowerCase() !== nasz()) return 'inne-konto'
  const w = await g.obserwuj(temat())
  const poprzedni = await czytajStan()
  await zapiszStan({
    email: profil.emailAddress,
    token: zaszyfruj(refreshToken),
    polaczona: true,
    historyId: poprzedni?.historyId ?? w.historyId,
    watchWygasa: Number(w.expiration),
    dzierzawaDo: 0,
    doPowtorki: false,
    import: poprzedni ? poprzedni.import : { trwa: true, zrobione: 0, razem: 0 },
  })
  return 'ok'
}

/** Obserwacja Gmaila wygasa po 7 dniach - cron odnawia ją codziennie. */
export async function odnowObserwacje(): Promise<void> {
  const stan = await czytajStan()
  if (!stan?.polaczona) return
  await zRozlaczeniem(async () => {
    const w = await gmailZeStanu(stan).obserwuj(temat())
    await zapiszStan({ watchWygasa: Number(w.expiration) })
  })
}
