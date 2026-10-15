import type { DocumentData } from 'firebase-admin/firestore'
import { kontaktyRef, organizacjeRef, skrzynkaStanRef, skrzynkaUstawieniaRef, sprawyRef, ustawieniaRef } from '@/lib/firebase/admin'
import { naSklad } from '@/lib/planer/stan'
import { progAlarmu } from './statusy'
import { STATUSY, type Kontakt, type LicznikiSkrzynki, type Organizacja, type PostepImportu, type Sprawa, type Status, type StronaSpraw } from './typy'

export const DZIERZAWA_MS = 60_000
/** Limit partii Firestore to 500 zapisów - zostawiamy zapas. */
const PARTIA = 400
export const WERSJA_DANYCH = 2
export const NA_STRONE = 50
const MAKS_DO_ODPOWIEDZI = 300
/** Znak większy niż każdy w kluczu - górna granica zakresu jednego statusu. */
const KONIEC = '\uf8ff'

/**
 * Klucz listy: status, czas ostatniej wiadomości (15 cyfr) i id w jednym
 * polu. Zakres po tym polu z sortowaniem po nim samym nie wymaga indeksu
 * złożonego - a do konsoli projektu Firebase nie ma dostępu.
 */
export function kluczListy(s: Pick<Sprawa, 'id' | 'status'> & { ostatnia: { kiedy: number } }): string {
  return `${s.status}|${String(Math.max(0, Math.floor(s.ostatnia.kiedy))).padStart(15, '0')}|${s.id}`
}

/** Dokument sprawy do zapisu: bez `id` (to identyfikator dokumentu), z kluczem listy. */
function doZapisu({ id, ...s }: Sprawa): DocumentData {
  return { ...s, klucz: kluczListy({ id, ...s }) }
}

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
  /** 1 - sprawy bez pola `klucz` (przed częścią 2a); 2 - klucze uzupełnione. */
  wersjaDanych: number
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
    wersjaDanych: liczba(d.wersjaDanych) || 1,
    import: {
      trwa: d.import?.trwa === true,
      zrobione: liczba(d.import?.zrobione),
      razem: liczba(d.import?.razem),
      strona: typeof d.import?.strona === 'string' ? d.import.strona : null,
    },
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
 * Jedna zakładka. „Do odpowiedzi” rośnie od najdłużej czekającej - sprawy po
 * terminie są na górze; pozostałe od najnowszej, stronami po kluczu.
 */
export async function listaSpraw(status: Status, po: string | null, ile = NA_STRONE): Promise<StronaSpraw> {
  const s = sprawyRef()
  if (status === 'do-odpowiedzi') {
    // Niezmiennik: `oczekujeOd` mają tylko sprawy Do odpowiedzi.
    const z = await s.where('oczekujeOd', '>', 0).orderBy('oczekujeOd').limit(MAKS_DO_ODPOWIEDZI).get()
    return { sprawy: z.docs.map((d) => naSprawe(d.id, d.data())), nastepna: null }
  }
  let q = s.where('klucz', '>=', `${status}|`).where('klucz', '<', `${status}|${KONIEC}`).orderBy('klucz', 'desc')
  if (po) q = q.startAfter(po)
  const z = await q.limit(ile + 1).get()
  const docs = z.docs.slice(0, ile)
  return {
    sprawy: docs.map((d) => naSprawe(d.id, d.data())),
    nastepna: z.docs.length > ile ? String(docs[docs.length - 1].get('klucz')) : null,
  }
}

/** Jednorazowo: sprawy zapisane przed częścią 2a dostają klucz listy. Zwraca liczbę poprawionych. */
export async function uzupelnijKlucze(): Promise<number> {
  const s = sprawyRef()
  const z = await s.get()
  const doPoprawy = z.docs.filter((d) => d.get('klucz') !== kluczListy(naSprawe(d.id, d.data())))
  for (let i = 0; i < doPoprawy.length; i += PARTIA) {
    const partia = s.firestore.batch()
    for (const d of doPoprawy.slice(i, i + PARTIA)) partia.update(d.ref, { klucz: kluczListy(naSprawe(d.id, d.data())) })
    await partia.commit()
  }
  await zapiszStan({ wersjaDanych: WERSJA_DANYCH })
  return doPoprawy.length
}

export async function czytajSprawe(id: string): Promise<Sprawa | null> {
  const d = (await sprawyRef().doc(id).get()).data()
  return d ? naSprawe(id, d) : null
}

/**
 * Ręczna zmiana z panelu, w transakcji. Niezmiennik: czas czekania ma tylko
 * „Do odpowiedzi”, a ręczne oznaczenie liczy go od teraz. `zmieniono` = teraz
 * - synchronizacja nie nadpisze sprawy zmienionej w trakcie jej pracy.
 */
export async function zmienSprawe(
  id: string,
  z: { status?: Status; przypisana?: string | null; nowa?: boolean },
  teraz = Date.now(),
): Promise<Sprawa | null> {
  const ref = sprawyRef().doc(id)
  return ref.firestore.runTransaction(async (t) => {
    const d = (await t.get(ref)).data()
    if (!d) return null
    const s = naSprawe(id, d)
    const nowa: Sprawa = {
      ...s,
      ...(z.przypisana !== undefined ? { przypisana: z.przypisana } : {}),
      ...(z.nowa !== undefined ? { nowa: z.nowa } : {}),
      zmieniono: teraz,
    }
    if (z.status && z.status !== s.status) {
      nowa.status = z.status
      nowa.oczekujeOd = z.status === 'do-odpowiedzi' ? teraz : null
    }
    t.set(ref, doZapisu(nowa))
    return nowa
  })
}

/** Lista „zawsze pomijaj” - małymi literami, bez powtórzeń. */
export async function dodajPomijanie(rodzaj: 'adres' | 'domena', wartosc: string): Promise<void> {
  const ref = skrzynkaUstawieniaRef()
  const pole = rodzaj === 'adres' ? 'pomijaneAdresy' : 'pomijaneDomeny'
  const v = wartosc.toLowerCase()
  await ref.firestore.runTransaction(async (t) => {
    const d = (await t.get(ref)).data()
    const lista = Array.isArray(d?.[pole]) ? (d[pole] as unknown[]).filter((x): x is string => typeof x === 'string') : []
    if (!lista.includes(v)) t.set(ref, { [pole]: [...lista, v] }, { merge: true })
  })
}

/** Skład zarządu z ustawień Planera - lista do przypisywania spraw. */
export async function skladZarzadu(): Promise<string[]> {
  return naSklad((await ustawieniaRef('sklad').get()).data())
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

  // Jedna osoba z kilkoma wątkami w partii to jeden zapis; wersja z imieniem wygrywa.
  const kontaktyUnikalne = [...w.kontakty.reduce((m, k) => (m.get(k.email)?.imie && !k.imie ? m : m.set(k.email, k)), new Map<string, Kontakt>()).values()]

  const zapisy = [
    ...w.sprawy.map((s) => ({ ref: sprawy.doc(s.id), dane: doZapisu(s), scal: false })),
    ...kontaktyUnikalne.map((k) => ({
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
  const zero = { doOdpowiedzi: 0, poTerminie: 0, doPrzejrzenia: 0, czekaNaNich: 0, wToku: 0, zalatwione: 0, pominiete: 0 }
  if (!stan) return { stan: 'brak', ...zero, ostatniaSynchronizacja: null }
  const s = sprawyRef()
  const ile = (status: Status) => s.where('status', '==', status).count().get().then((x) => x.data().count)
  const [doOdpowiedzi, poTerminie, doPrzejrzenia, czekaNaNich, wToku, zalatwione, pominiete] = await Promise.all([
    ile('do-odpowiedzi'),
    s.where('oczekujeOd', '<', progAlarmu(teraz)).count().get().then((x) => x.data().count),
    ile('do-przejrzenia'),
    ile('czeka-na-nich'),
    ile('w-toku'),
    ile('zalatwiona'),
    ile('pominieta'),
  ])
  return {
    stan: stan.polaczona ? 'polaczona' : 'rozlaczona',
    doOdpowiedzi, poTerminie, doPrzejrzenia, czekaNaNich, wToku, zalatwione, pominiete,
    ostatniaSynchronizacja: stan.ostatniaSynchronizacja,
  }
}
