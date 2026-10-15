import { organizacjaZEmaila } from './kontakty'
import { STATUSY, TYPY_ORGANIZACJI, type Status, type TypOrganizacji, type UstawieniaSkrzynki, type ZmianaSprawy } from './typy'

/** Walidacja ciała PATCH sprawy. Przypisać można tylko osobę ze Składu zarządu albo nikogo. */
export function sprawdzZmiane(body: unknown, sklad: string[]): ZmianaSprawy | null {
  if (!body || typeof body !== 'object') return null
  const x = body as Record<string, unknown>
  const z: ZmianaSprawy = {}
  if (x.status !== undefined) {
    if (!STATUSY.includes(x.status as Status)) return null
    z.status = x.status as Status
  }
  if (x.przypisana !== undefined) {
    if (x.przypisana !== null && !(typeof x.przypisana === 'string' && sklad.includes(x.przypisana))) return null
    z.przypisana = x.przypisana as string | null
  }
  if (x.pomin !== undefined) {
    if (x.pomin !== 'adres' && x.pomin !== 'domena') return null
    z.pomin = x.pomin
  }
  return Object.keys(z).length ? z : null
}

const EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/
const DOMENA = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/
export const MAKS_STOPKI = 1000
const MAKS_LISTY = 1000
const MAKS_NAZWY = 120

/** Lista z formularza: małymi literami, bez spacji na brzegach i bez powtórzeń; `null` - to nie lista tekstów. */
function lista(x: unknown): string[] | null {
  if (!Array.isArray(x) || x.length > MAKS_LISTY || !x.every((y) => typeof y === 'string')) return null
  return [...new Set(x.map((y: string) => y.trim().toLowerCase()).filter(Boolean))]
}

/**
 * Walidacja PATCH ustawień skrzynki. Domeny skrzynek prywatnych (gmail.com)
 * i studentów nie da się pominąć w całości - jak przy „Pomiń zawsze” w sprawie.
 */
export function sprawdzUstawienia(body: unknown): { zmiana: Partial<UstawieniaSkrzynki> } | { blad: string } {
  if (!body || typeof body !== 'object') return { blad: 'Niepoprawne ustawienia' }
  const x = body as Record<string, unknown>
  const z: Partial<UstawieniaSkrzynki> = {}
  if (x.stopka !== undefined) {
    if (typeof x.stopka !== 'string' || x.stopka.length > MAKS_STOPKI) return { blad: `Stopka może mieć najwyżej ${MAKS_STOPKI} znaków.` }
    z.stopka = x.stopka
  }
  if (x.pomijaneAdresy !== undefined) {
    const l = lista(x.pomijaneAdresy)
    if (!l) return { blad: 'Niepoprawna lista adresów' }
    const zly = l.find((a) => !EMAIL.test(a))
    if (zly !== undefined) return { blad: `To nie wygląda na adres e-mail: ${zly}` }
    z.pomijaneAdresy = l
  }
  if (x.pomijaneDomeny !== undefined) {
    const l = lista(x.pomijaneDomeny)
    if (!l) return { blad: 'Niepoprawna lista domen' }
    const zla = l.find((d) => !DOMENA.test(d))
    if (zla !== undefined) return { blad: `To nie wygląda na domenę: ${zla}` }
    const prywatna = l.find((d) => !organizacjaZEmaila(`x@${d}`))
    if (prywatna !== undefined) return { blad: `Domeny ${prywatna} nie można pominąć w całości - dodaj pojedyncze adresy.` }
    z.pomijaneDomeny = l
  }
  return Object.keys(z).length ? { zmiana: z } : { blad: 'Brak zmian' }
}

/** Walidacja PATCH organizacji: nazwa (1-120 znaków) albo typ z listy. */
export function sprawdzOrganizacje(body: unknown): { domena: string; zmiana: { nazwa?: string; typ?: TypOrganizacji } } | null {
  if (!body || typeof body !== 'object') return null
  const x = body as Record<string, unknown>
  if (typeof x.domena !== 'string' || !x.domena) return null
  const zmiana: { nazwa?: string; typ?: TypOrganizacji } = {}
  if (x.nazwa !== undefined) {
    const n = typeof x.nazwa === 'string' ? x.nazwa.trim() : ''
    if (!n || n.length > MAKS_NAZWY) return null
    zmiana.nazwa = n
  }
  if (x.typ !== undefined) {
    if (!TYPY_ORGANIZACJI.includes(x.typ as TypOrganizacji)) return null
    zmiana.typ = x.typ as TypOrganizacji
  }
  return Object.keys(zmiana).length ? { domena: x.domena, zmiana } : null
}
