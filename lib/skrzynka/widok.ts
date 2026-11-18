import { dzisWarszawa } from '@/lib/czas'
import { poTerminie } from './statusy'
import type { Sprawa, Status, TypOrganizacji, Zalacznik } from './typy'

export const ETYKIETY_STATUSOW: Record<Status, string> = {
  'do-odpowiedzi': 'Do odpowiedzi',
  'w-toku': 'W toku',
  'czeka-na-nich': 'Czeka na nich',
  'do-przejrzenia': 'Do przejrzenia',
  zalatwiona: 'Załatwione',
  pominieta: 'Pominięte',
}

export const ETYKIETY_TYPOW: Record<TypOrganizacji, string> = {
  partner: 'Partner',
  sponsor: 'Sponsor',
  uczelnia: 'Uczelnia',
  'organizacja-studencka': 'Organizacja studencka',
  media: 'Media',
  inne: 'Inne',
}

/** Kolejność zakładek: od tego, co wymaga ruchu, do archiwum. */
export const ZAKLADKI: Status[] = ['do-odpowiedzi', 'w-toku', 'czeka-na-nich', 'do-przejrzenia', 'zalatwiona', 'pominieta']

const STREFA = 'Europe/Warsaw'
const dwie = (n: number) => String(n).padStart(2, '0')
const tenSamDzien = (a: { rok: number; miesiac: number; dzien: number }, b: typeof a) =>
  a.rok === b.rok && a.miesiac === b.miesiac && a.dzien === b.dzien

/** Na listę: dziś - godzina, wczoraj, w tym roku DD.MM, starsze DD.MM.RRRR. */
/** Po tylu dniach czekania sprawa ląduje w zwiniętej grupie „starsze” - zwykle już nieaktualna. */
export const DNI_STAREJ = 30

export interface GrupyDoOdpowiedzi {
  wTerminie: Sprawa[]
  poTerminie: Sprawa[]
  starsze: Sprawa[]
}

/**
 * „Do odpowiedzi” w trzech grupach. W terminie - od najdłużej czekającej, bo ta
 * pierwsza przekroczy termin. Po terminie i starsze - od najnowszej: świeża
 * zaległość jest jeszcze do uratowania, wrześniowa zwykle już nie.
 */
export function grupyDoOdpowiedzi(sprawy: Sprawa[], teraz: number): GrupyDoOdpowiedzi {
  const czeka = (s: Sprawa) => s.oczekujeOd ?? s.ostatnia.kiedy
  const granica = teraz - DNI_STAREJ * 86_400_000
  const g: GrupyDoOdpowiedzi = { wTerminie: [], poTerminie: [], starsze: [] }
  for (const s of sprawy) {
    if (!poTerminie(s.oczekujeOd, teraz)) g.wTerminie.push(s)
    else if (czeka(s) < granica) g.starsze.push(s)
    else g.poTerminie.push(s)
  }
  g.wTerminie.sort((a, b) => czeka(a) - czeka(b))
  g.poTerminie.sort((a, b) => czeka(b) - czeka(a))
  g.starsze.sort((a, b) => czeka(b) - czeka(a))
  return g
}

export function kiedyKrotko(ms: number, teraz: number): string {
  const d = dzisWarszawa(new Date(ms))
  const dzis = dzisWarszawa(new Date(teraz))
  if (tenSamDzien(d, dzis)) {
    return new Intl.DateTimeFormat('pl-PL', { timeZone: STREFA, hour: '2-digit', minute: '2-digit' }).format(ms)
  }
  if (tenSamDzien(d, dzisWarszawa(new Date(teraz - 86_400_000)))) return 'wczoraj'
  return d.rok === dzis.rok ? `${dwie(d.dzien)}.${dwie(d.miesiac)}` : `${dwie(d.dzien)}.${dwie(d.miesiac)}.${d.rok}`
}

export function pelnaData(ms: number): string {
  return new Intl.DateTimeFormat('pl-PL', { timeZone: STREFA, dateStyle: 'medium', timeStyle: 'short' }).format(ms)
}

/** Wątek w Gmailu na koncie kontakt@ - `authuser` wybiera właściwe konto, gdy w przeglądarce jest ich kilka. */
export function linkGmail(email: string, id: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#all/${id}`
}

export function adresZalacznika(sprawaId: string, z: Zalacznik): string {
  const p = new URLSearchParams({ w: z.wiadomoscId, nazwa: z.nazwa, typ: z.typ })
  return `/api/skrzynka/sprawy/${encodeURIComponent(sprawaId)}/zalacznik/${encodeURIComponent(z.id)}?${p}`
}

export function rozmiar(bajty: number): string {
  if (bajty < 1024 * 1024) return `${Math.max(1, Math.round(bajty / 1024))} KB`
  return `${(bajty / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
