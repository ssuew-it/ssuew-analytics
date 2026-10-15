import { STATUSY, type Status, type ZmianaSprawy } from './typy'

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
