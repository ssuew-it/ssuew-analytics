import type { DocumentData } from 'firebase-admin/firestore'
import { kontaktyRef, organizacjeRef, skrzynkaStanRef, skrzynkaUstawieniaRef, sprawyRef } from '@/lib/firebase/admin'
import { progAlarmu } from './statusy'
import { STATUSY, type Kontakt, type LicznikiSkrzynki, type Organizacja, type PostepImportu, type Sprawa, type Status } from './typy'

export const DZIERZAWA_MS = 60_000
/** Limit partii Firestore to 500 zapisów - zostawiamy zapas. */
const PARTIA = 400

export interface StanSkrzynki {
  email: string
  /** Refresh token zaszyfrowany `szyfr.ts`. */
  token: string
  historyId: string | null
  watchWygasa: number | null
  ostatniaSynchronizacja: number | null
  dzierzawaDo: number
  doPowtorki: boolean
  polaczona: boolean
  import: PostepImportu
}

const liczba = (x: unknown) => Number(x) || 0

export async function czytajStan(): Promise<StanSkrzynki | null> {
  const d = (await skrzynkaStanRef().get()).data()
  if (!d || typeof d.token !== 'string') return null
  return {
    email: String(d.email ?? ''),
    token: d.token,
    historyId: typeof d.historyId === 'string' ? d.historyId : null,
    watchWygasa: liczba(d.watchWygasa) || null,
    ostatniaSynchronizacja: liczba(d.ostatniaSynchronizacja) || null,
    dzierzawaDo: liczba(d.dzierzawaDo),
    doPowtorki: d.doPowtorki === true,
    polaczona: d.polaczona === true,
    import: { trwa: d.import?.trwa === true, zrobione: liczba(d.import?.zrobione), razem: liczba(d.import?.razem) },
  }
}

export async function zapiszStan(zmiany: Partial<StanSkrzynki>): Promise<void> {
  await skrzynkaStanRef().set(zmiany, { merge: true })
}

/**
 * Jedna synchronizacja naraz. Gdy dzierżawa jest zajęta, zostawiamy
 * zgłoszenie `doPowtorki` - trwająca synchronizacja zrobi wtedy jeszcze
 * jedną rundę i nic z kilku powiadomień naraz nie zginie.
 */
export async function wezDzierzawe(teraz: number): Promise<boolean> {
  const ref = skrzynkaStanRef()
  return ref.firestore.runTransaction(async (t) => {
    const d = (await t.get(ref)).data()
    if (d && liczba(d.dzierzawaDo) > teraz) {
      t.update(ref, { doPowtorki: true })
      return false
    }
    t.set(ref, { dzierzawaDo: teraz + DZIERZAWA_MS, doPowtorki: false }, { merge: true })
    return true
  })
}

/** `true` - w trakcie przyszło zgłoszenie, dzierżawa przedłużona na kolejną rundę. */
export async function zwolnijDzierzawe(teraz: number): Promise<boolean> {
  const ref = skrzynkaStanRef()
  return ref.firestore.runTransaction(async (t) => {
    const d = (await t.get(ref)).data()
    if (d?.doPowtorki === true) {
      t.update(ref, { doPowtorki: false, dzierzawaDo: teraz + DZIERZAWA_MS })
      return true
    }
    t.update(ref, { dzierzawaDo: 0 })
    return false
  })
}

const naStatus = (x: unknown): Status => (STATUSY.includes(x as Status) ? (x as Status) : 'do-odpowiedzi')

function naSprawe(id: string, x: DocumentData): Sprawa {
  return {
    id,
    temat: String(x.temat ?? ''),
    status: naStatus(x.status),
    oczekujeOd: typeof x.oczekujeOd === 'number' ? x.oczekujeOd : null,
    nowa: x.nowa === true,
    kontakt: typeof x.kontakt === 'string' ? x.kontakt : null,
    organizacja: typeof x.organizacja === 'string' ? x.organizacja : null,
    ostatnia: {
      kiedy: liczba(x.ostatnia?.kiedy),
      kierunek: x.ostatnia?.kierunek === 'my' ? 'my' : 'oni',
      fragment: String(x.ostatnia?.fragment ?? ''),
    },
    wiadomosci: liczba(x.wiadomosci),
    przypisana: typeof x.przypisana === 'string' ? x.przypisana : null,
    kategoriaGmail: typeof x.kategoriaGmail === 'string' ? x.kategoriaGmail : null,
    zmieniono: liczba(x.zmieniono),
  }
}

export async function czytajSprawy(ids: string[]): Promise<Map<string, Sprawa>> {
  const wynik = new Map<string, Sprawa>()
  if (!ids.length) return wynik
  const kol = sprawyRef()
  const migawki = await kol.firestore.getAll(...ids.map((id) => kol.doc(id)))
  for (const m of migawki) {
    const d = m.data()
    if (m.exists && d) wynik.set(m.id, naSprawe(m.id, d))
  }
  return wynik
}

/**
 * Zapis wyniku synchronizacji. Organizacje tylko nowe - nazwę i typ
 * właściciel poprawia ręcznie. Kontakt bez imienia nie kasuje znanego.
 */
export async function zapiszWynik(w: { sprawy: Sprawa[]; kontakty: Kontakt[]; organizacje: Organizacja[] }): Promise<void> {
  const sprawy = sprawyRef()
  const kontakty = kontaktyRef()
  const organizacje = organizacjeRef()
  const baza = sprawy.firestore
  const orgUnikalne = [...new Map(w.organizacje.map((o) => [o.domena, o])).values()]
  const istniejace = orgUnikalne.length ? await baza.getAll(...orgUnikalne.map((o) => organizacje.doc(o.domena))) : []
  const nowe = orgUnikalne.filter((_, i) => !istniejace[i].exists)

  const zapisy = [
    ...w.sprawy.map(({ id, ...s }) => ({ ref: sprawy.doc(id), dane: s as DocumentData, scal: false })),
    ...w.kontakty.map((k) => ({
      ref: kontakty.doc(k.email),
      dane: (k.imie ? k : { email: k.email, organizacja: k.organizacja, typ: k.typ }) as DocumentData,
      scal: true,
    })),
    ...nowe.map((o) => ({ ref: organizacje.doc(o.domena), dane: o as DocumentData, scal: false })),
  ]
  for (let i = 0; i < zapisy.length; i += PARTIA) {
    const partia = baza.batch()
    for (const z of zapisy.slice(i, i + PARTIA)) {
      if (z.scal) partia.set(z.ref, z.dane, { merge: true })
      else partia.set(z.ref, z.dane)
    }
    await partia.commit()
  }
}

export async function pomijane(): Promise<{ adresy: string[]; domeny: string[] }> {
  const d = (await skrzynkaUstawieniaRef().get()).data()
  const lista = (x: unknown) =>
    Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string').map((y) => y.toLowerCase()) : []
  return { adresy: lista(d?.pomijaneAdresy), domeny: lista(d?.pomijaneDomeny) }
}

/**
 * Liczniki kafelka - same zapytania zliczające, bez list. „Po terminie” to
 * jedno zapytanie zakresowe dzięki niezmiennikowi: `oczekujeOd` ma wartość
 * tylko w sprawach Do odpowiedzi.
 */
export async function liczniki(teraz: number): Promise<LicznikiSkrzynki> {
  const stan = await czytajStan()
  const zero = { doOdpowiedzi: 0, poTerminie: 0, doPrzejrzenia: 0, czekaNaNich: 0, wToku: 0 }
  if (!stan) return { stan: 'brak', ...zero, ostatniaSynchronizacja: null }
  const s = sprawyRef()
  const ile = (status: Status) => s.where('status', '==', status).count().get().then((x) => x.data().count)
  const [doOdpowiedzi, poTerminie, doPrzejrzenia, czekaNaNich, wToku] = await Promise.all([
    ile('do-odpowiedzi'),
    s.where('oczekujeOd', '<', progAlarmu(teraz)).count().get().then((x) => x.data().count),
    ile('do-przejrzenia'),
    ile('czeka-na-nich'),
    ile('w-toku'),
  ])
  return {
    stan: stan.polaczona ? 'polaczona' : 'rozlaczona',
    doOdpowiedzi, poTerminie, doPrzejrzenia, czekaNaNich, wToku,
    ostatniaSynchronizacja: stan.ostatniaSynchronizacja,
  }
}
