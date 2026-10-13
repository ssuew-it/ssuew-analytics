import { SignJWT, importPKCS8 } from 'jose'
import type { OdpowiedzApi, RodzajBledu } from './model'

const ZAKRES = 'https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://searchconsole.googleapis.com/webmasters/v3'
/** Token odnawiamy z zapasem - zegar serwera i Google nie muszą się zgadzać co do sekundy. */
const ZAPAS_MS = 5 * 60 * 1000

export class BladGoogle extends Error {
  readonly rodzaj: RodzajBledu
  constructor(rodzaj: RodzajBledu, wiadomosc: string) {
    super(wiadomosc)
    this.name = 'BladGoogle'
    this.rodzaj = rodzaj
  }
}

interface Konto {
  client_email: string
  private_key: string
}

/**
 * To samo konto serwisowe co Firebase Admin - nic nowego do przechowywania.
 * W Search Console dodaje się je jako użytkownika „Ograniczone”.
 */
function konto(): Konto {
  const surowe = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!surowe) throw new BladGoogle('inny', 'Brak FIREBASE_SERVICE_ACCOUNT')
  let k: Partial<Konto>
  try {
    k = JSON.parse(surowe)
  } catch {
    throw new BladGoogle('inny', 'FIREBASE_SERVICE_ACCOUNT nie jest JSON-em')
  }
  if (typeof k.client_email !== 'string' || typeof k.private_key !== 'string') {
    throw new BladGoogle('inny', 'Konto serwisowe bez client_email albo private_key')
  }
  return { client_email: k.client_email, private_key: k.private_key }
}

/** Adres do instrukcji „dodaj użytkownika w Search Console”. */
export function emailKonta(): string | null {
  try {
    return konto().client_email
  } catch {
    return null
  }
}

let token: { wartosc: string; wygasa: number } | null = null

async function tokenDostepu(): Promise<string> {
  const teraz = Date.now()
  if (token && token.wygasa - ZAPAS_MS > teraz) return token.wartosc
  const k = konto()
  const klucz = await importPKCS8(k.private_key, 'RS256')
  const sekundy = Math.floor(teraz / 1000)
  const jwt = await new SignJWT({ scope: ZAKRES })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(k.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(sekundy)
    .setExpirationTime(sekundy + 3600)
    .sign(klucz)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    cache: 'no-store',
  })
  const dane = await res.json().catch(() => ({}))
  if (!res.ok || typeof dane.access_token !== 'string') {
    throw new BladGoogle('inny', `Token Google ${res.status}: ${dane.error_description ?? dane.error ?? ''}`.trim())
  }
  token = { wartosc: dane.access_token, wygasa: teraz + (Number(dane.expires_in) || 3600) * 1000 }
  return token.wartosc
}

/** Wyłączone API też daje 403 - rozpoznajemy je po treści, bo instrukcja naprawy jest inna. */
export function rodzajBledu(status: number, tresc: string): RodzajBledu {
  if (/has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(tresc)) return 'api-wylaczone'
  if (status === 401 || status === 403) return 'brak-dostepu'
  return 'inny'
}

async function wywolaj<T>(sciezka: string, cialo?: unknown): Promise<T> {
  const naglowki: Record<string, string> = { Authorization: `Bearer ${await tokenDostepu()}` }
  if (cialo !== undefined) naglowki['Content-Type'] = 'application/json'
  const res = await fetch(`${API}${sciezka}`, {
    method: cialo === undefined ? 'GET' : 'POST',
    headers: naglowki,
    body: cialo === undefined ? undefined : JSON.stringify(cialo),
    // Cache robi `lib/strony/dane.ts` na całych statystykach - klucz `fetch`
    // zawierałby nagłówek z tokenem, który zmienia się co godzinę.
    cache: 'no-store',
  })
  if (!res.ok) {
    const tresc = await res.text().catch(() => '')
    throw new BladGoogle(rodzajBledu(res.status, tresc), `Search Console ${res.status}: ${tresc.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

/** Witryny, do których konto ma dostęp. Niezweryfikowane pomijamy - i tak nie dadzą danych. */
export async function listaWitryn(): Promise<string[]> {
  const d = await wywolaj<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>('/sites')
  return (d.siteEntry ?? []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser').map((s) => s.siteUrl)
}

export interface ZapytanieApi {
  startDate: string
  endDate: string
  dimensions?: ('date' | 'query' | 'page')[]
  rowLimit?: number
}

export async function zapytanie(witryna: string, z: ZapytanieApi): Promise<OdpowiedzApi> {
  return wywolaj<OdpowiedzApi>(`/sites/${encodeURIComponent(witryna)}/searchAnalytics/query`, z)
}
