import type { Adres, Kontakt, Organizacja, WatekZGmaila } from './typy'

/** Skrzynki prywatne nie tworzą organizacji - inaczej „gmail.com” byłby największym partnerem. */
export const SKRZYNKI_PRYWATNE = new Set([
  'gmail.com', 'googlemail.com', 'wp.pl', 'o2.pl', 'onet.pl', 'op.pl', 'interia.pl',
  'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'yahoo.com', 'proton.me', 'protonmail.com',
])
const STUDENCI = 'student.ue.wroc.pl'
const UCZELNIA = 'ue.wroc.pl'

export function domena(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase()
}

export function organizacjaZEmaila(email: string): Organizacja | null {
  const d = domena(email)
  if (SKRZYNKI_PRYWATNE.has(d) || d === STUDENCI) return null
  if (d === UCZELNIA) return { domena: d, nazwa: 'Uniwersytet Ekonomiczny', typ: 'uczelnia' }
  return { domena: d, nazwa: d, typ: 'inne' }
}

export function typKontaktu(email: string): 'student' | null {
  return domena(email) === STUDENCI ? 'student' : null
}

/** Pierwszy adres w wątku inny niż nasz - nadawca albo, gdy zaczęliśmy my, pierwszy odbiorca. */
export function drugaStrona(w: WatekZGmaila, nasz: string): Adres | null {
  const n = nasz.toLowerCase()
  for (const m of w.wiadomosci) {
    for (const a of [m.od, ...m.do]) if (a && a.email !== n) return a
  }
  return null
}

export function kontaktZAdresu(a: Adres): Kontakt {
  return { email: a.email, imie: a.imie, organizacja: organizacjaZEmaila(a.email)?.domena ?? null, typ: typKontaktu(a.email) }
}
