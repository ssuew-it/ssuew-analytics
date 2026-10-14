import type { WatekApi } from './naglowki'

const ZAKRESY = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const NAGLOWKI_META = ['From', 'To', 'Cc', 'Subject', 'List-Unsubscribe', 'Precedence']

export type RodzajBledu = 'rozlaczona' | 'historia-za-stara' | 'brak-watku' | 'konfiguracja' | 'inny'

export class BladSkrzynki extends Error {
  readonly rodzaj: RodzajBledu
  constructor(rodzaj: RodzajBledu, wiadomosc: string) {
    super(wiadomosc)
    this.name = 'BladSkrzynki'
    this.rodzaj = rodzaj
  }
}

/** Ludzki komunikat i status dla tras. Szczegóły z Google idą tylko do logów. */
export function komunikatBledu(e: unknown): { status: number; error: string } {
  if (e instanceof BladSkrzynki && e.rodzaj === 'rozlaczona') return { status: 409, error: 'Skrzynka jest rozłączona - połącz ją ponownie.' }
  if (e instanceof BladSkrzynki && e.rodzaj === 'konfiguracja') return { status: 500, error: 'Skrzynka nie jest skonfigurowana na serwerze.' }
  console.error('[skrzynka]', e)
  return { status: 502, error: 'Gmail nie odpowiedział - spróbuj ponownie.' }
}

function konfiguracja() {
  const id = process.env.SKRZYNKA_CLIENT_ID
  const sekret = process.env.SKRZYNKA_CLIENT_SECRET
  const adres = process.env.SKRZYNKA_ADRES
  if (!id || !sekret || !adres) throw new BladSkrzynki('konfiguracja', 'Brak SKRZYNKA_CLIENT_ID, SKRZYNKA_CLIENT_SECRET albo SKRZYNKA_ADRES')
  return { id, sekret, przekierowanie: `${adres.replace(/\/+$/, '')}/api/skrzynka/oauth` }
}

export function adresZgody(stan: string, email: string): string {
  const k = konfiguracja()
  const p = new URLSearchParams({
    client_id: k.id,
    redirect_uri: k.przekierowanie,
    response_type: 'code',
    scope: ZAKRESY.join(' '),
    // offline + consent: tylko tak Google za każdym razem oddaje refresh token.
    access_type: 'offline',
    prompt: 'consent',
    login_hint: email,
    state: stan,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

async function token(cialo: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(cialo),
    cache: 'no-store',
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || typeof d.access_token !== 'string') {
    throw new BladSkrzynki(d.error === 'invalid_grant' ? 'rozlaczona' : 'inny', `Token Google ${res.status}: ${d.error ?? ''}`)
  }
  return d
}

export async function wymienKod(kod: string): Promise<{ refreshToken: string; dostep: string }> {
  const k = konfiguracja()
  const d = await token({ grant_type: 'authorization_code', code: kod, client_id: k.id, client_secret: k.sekret, redirect_uri: k.przekierowanie })
  if (!d.refresh_token) throw new BladSkrzynki('inny', 'Google nie zwrócił refresh tokenu')
  return { refreshToken: d.refresh_token, dostep: d.access_token }
}

export interface Gmail {
  profil(): Promise<{ emailAddress: string; historyId: string }>
  watek(id: string): Promise<WatekApi>
  listaWatkow(zapytanie: string, strona: string | null): Promise<{ threads?: { id: string }[]; nextPageToken?: string; resultSizeEstimate?: number }>
  historia(od: string, strona: string | null): Promise<{
    history?: { messagesAdded?: { message: { threadId: string } }[] }[]
    nextPageToken?: string
    historyId: string
  }>
  obserwuj(temat: string): Promise<{ historyId: string; expiration: string }>
}

const parametry = (p: Record<string, string | string[] | null>) => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v === null) continue
    for (const x of [v].flat()) u.append(k, x)
  }
  return u.toString()
}

/** Klient Gmaila na refresh tokenie kontakt@. Token dostępu żyje w domknięciu - jeden klient na jedno wywołanie trasy. */
export function gmail(refreshToken: string, dostep?: string): Gmail {
  let biezacy = dostep ? { wartosc: dostep, wygasa: Date.now() + 50 * 60_000 } : null

  async function tokenDostepu(): Promise<string> {
    if (biezacy && biezacy.wygasa > Date.now()) return biezacy.wartosc
    const k = konfiguracja()
    const d = await token({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: k.id, client_secret: k.sekret })
    biezacy = { wartosc: d.access_token, wygasa: Date.now() + (d.expires_in - 300) * 1000 }
    return biezacy.wartosc
  }

  async function wywolaj<T>(sciezka: string, cialo?: unknown): Promise<T> {
    const naglowki: Record<string, string> = { Authorization: `Bearer ${await tokenDostepu()}` }
    if (cialo !== undefined) naglowki['Content-Type'] = 'application/json'
    const res = await fetch(`${GMAIL}${sciezka}`, {
      method: cialo === undefined ? 'GET' : 'POST',
      headers: naglowki,
      body: cialo === undefined ? undefined : JSON.stringify(cialo),
      cache: 'no-store',
    })
    if (!res.ok) {
      const tresc = await res.text().catch(() => '')
      if (res.status === 401) throw new BladSkrzynki('rozlaczona', `Gmail 401: ${tresc.slice(0, 200)}`)
      if (res.status === 404 && sciezka.startsWith('/history')) throw new BladSkrzynki('historia-za-stara', 'Punkt historii Gmaila jest za stary')
      if (res.status === 404) throw new BladSkrzynki('brak-watku', `Gmail 404: ${sciezka}`)
      throw new BladSkrzynki('inny', `Gmail ${res.status}: ${tresc.slice(0, 300)}`)
    }
    return res.json() as Promise<T>
  }

  return {
    profil: () => wywolaj('/profile'),
    watek: (id) => wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'metadata', metadataHeaders: NAGLOWKI_META })}`),
    listaWatkow: (zapytanie, strona) => wywolaj(`/threads?${parametry({ q: zapytanie, maxResults: '100', pageToken: strona })}`),
    historia: (od, strona) => wywolaj(`/history?${parametry({ startHistoryId: od, historyTypes: 'messageAdded', pageToken: strona })}`),
    // Tylko Odebrane i Wysłane - przeczytanie maila czy zmiana etykiety nie budzą serwera.
    obserwuj: (temat) => wywolaj('/watch', { topicName: temat, labelIds: ['INBOX', 'SENT'], labelFilterBehavior: 'include' }),
  }
}
