import type { WatekApi } from './naglowki'
import type { WatekPelnyApi } from './tresc'

export const ZAKRES_WYSYLKI = 'https://www.googleapis.com/auth/gmail.send'
const ZAKRESY = ['https://www.googleapis.com/auth/gmail.readonly', ZAKRES_WYSYLKI]
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const WYSYLKA = 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart'
const ODWOLANIE = 'https://oauth2.googleapis.com/revoke'
const NAGLOWKI_META = ['From', 'To', 'Cc', 'Subject', 'List-Unsubscribe', 'Precedence']
const NAGLOWKI_ODPOWIEDZI = ['From', 'To', 'Reply-To', 'Subject', 'Message-ID', 'References']
/** Granica części żądania wysyłki - znaków `_` nie ma w base64, więc nie trafi się w treści maila. */
const GRANICA_WYSYLKI = 'deck_wysylka_granica'
/** Przerwy przed kolejnymi próbami, gdy Gmail ogranicza tempo (limit liczony na minutę). */
const PRZERWY_MS = [1_000, 2_000, 4_000]
const MAKS_PRZERWA_MS = 10_000

/** Gmail zgłasza limit tempa jako 429 albo 403 - z `rateLimitExceeded` albo jako „Quota exceeded … per minute per user”. */
const czyLimit = (status: number, tresc: string) =>
  status === 429 || (status === 403 && /rateLimitExceeded|userRateLimitExceeded|Quota exceeded|RESOURCE_EXHAUSTED/i.test(tresc))
const czekaj = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type RodzajBledu =
  | 'rozlaczona' | 'historia-za-stara' | 'brak-watku' | 'limit' | 'konfiguracja' | 'brak-zgody' | 'brak-adresata' | 'inny'

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
  if (e instanceof BladSkrzynki && e.rodzaj === 'limit') return { status: 429, error: 'Gmail chwilowo ogranicza tempo - spróbuję ponownie za minutę.' }
  if (e instanceof BladSkrzynki && e.rodzaj === 'brak-zgody') {
    return { status: 403, error: 'Skrzynka nie ma zgody na wysyłkę - w Ustawieniach rozłącz ją i połącz ponownie, zaznaczając wszystkie uprawnienia.' }
  }
  if (e instanceof BladSkrzynki && e.rodzaj === 'brak-adresata') return { status: 400, error: 'W tym wątku nie ma do kogo odpowiedzieć - napisz z Gmaila.' }
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

async function token(cialo: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }> {
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

export async function wymienKod(kod: string): Promise<{ refreshToken: string; dostep: string; zakresy: string[] }> {
  const k = konfiguracja()
  const d = await token({ grant_type: 'authorization_code', code: kod, client_id: k.id, client_secret: k.sekret, redirect_uri: k.przekierowanie })
  if (!d.refresh_token) throw new BladSkrzynki('inny', 'Google nie zwrócił refresh tokenu')
  // Ekran zgody pozwala odznaczyć część uprawnień - `scope` mówi, co Google naprawdę dał.
  return { refreshToken: d.refresh_token, dostep: d.access_token, zakresy: String(d.scope ?? '').split(' ').filter(Boolean) }
}

/** „Rozłącz”: unieważnia refresh token w Google - D.E.C.K. traci dostęp do skrzynki. */
export async function odwolajToken(refreshToken: string): Promise<void> {
  const res = await fetch(ODWOLANIE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
    cache: 'no-store',
  })
  if (!res.ok) throw new BladSkrzynki('inny', `Odwołanie tokenu ${res.status}`)
}

export interface Gmail {
  profil(): Promise<{ emailAddress: string; historyId: string }>
  watek(id: string): Promise<WatekApi>
  watekPelny(id: string): Promise<WatekPelnyApi>
  watekDoOdpowiedzi(id: string): Promise<WatekApi>
  wyslij(mime: string, watekId: string): Promise<{ id: string; threadId: string }>
  zatrzymaj(): Promise<void>
  zalacznik(wiadomoscId: string, id: string): Promise<{ data: string; size: number }>
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

  /** `surowe` - pełny adres i typ ciała (wysyłka idzie przez adres uploadu, nie JSON). */
  async function wywolaj<T>(sciezka: string, cialo?: unknown, surowe?: { adres: string; typ: string }): Promise<T> {
    for (let proba = 0; ; proba++) {
      const naglowki: Record<string, string> = { Authorization: `Bearer ${await tokenDostepu()}` }
      if (cialo !== undefined) naglowki['Content-Type'] = surowe?.typ ?? 'application/json'
      const res = await fetch(surowe?.adres ?? `${GMAIL}${sciezka}`, {
        method: cialo === undefined ? 'GET' : 'POST',
        headers: naglowki,
        body: cialo === undefined ? undefined : surowe ? String(cialo) : JSON.stringify(cialo),
        cache: 'no-store',
      })
      if (res.ok) {
        // `users.stop` odpowiada pustym ciałem.
        const t = await res.text()
        return (t ? JSON.parse(t) : {}) as T
      }
      const tresc = await res.text().catch(() => '')
      if (czyLimit(res.status, tresc)) {
        if (proba >= PRZERWY_MS.length) throw new BladSkrzynki('limit', `Gmail ${res.status}: ${tresc.slice(0, 300)}`)
        const poGoogle = Number(res.headers.get('Retry-After')) * 1000
        await czekaj(Math.min(MAKS_PRZERWA_MS, poGoogle > 0 ? poGoogle : PRZERWY_MS[proba]))
        continue
      }
      if (res.status === 401) throw new BladSkrzynki('rozlaczona', `Gmail 401: ${tresc.slice(0, 200)}`)
      if (res.status === 403 && /insufficient/i.test(tresc)) throw new BladSkrzynki('brak-zgody', `Gmail 403: ${tresc.slice(0, 200)}`)
      if (res.status === 404 && sciezka.startsWith('/history')) throw new BladSkrzynki('historia-za-stara', 'Punkt historii Gmaila jest za stary')
      if (res.status === 404) throw new BladSkrzynki('brak-watku', `Gmail 404: ${sciezka}`)
      throw new BladSkrzynki('inny', `Gmail ${res.status}: ${tresc.slice(0, 300)}`)
    }
  }

  return {
    profil: () => wywolaj('/profile'),
    watek: (id) => wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'metadata', metadataHeaders: NAGLOWKI_META })}`),
    watekPelny: (id) => wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'full' })}`),
    watekDoOdpowiedzi: (id) =>
      wywolaj(`/threads/${encodeURIComponent(id)}?${parametry({ format: 'metadata', metadataHeaders: NAGLOWKI_ODPOWIEDZI })}`),
    // Upload multipart: JSON z wątkiem i surowy mail - zwykłe `raw` w JSON ma niższy limit rozmiaru.
    wyslij: (mime, watekId) =>
      wywolaj(
        '/messages/send',
        [
          `--${GRANICA_WYSYLKI}`,
          'Content-Type: application/json; charset=UTF-8',
          '',
          JSON.stringify({ threadId: watekId }),
          `--${GRANICA_WYSYLKI}`,
          'Content-Type: message/rfc822',
          '',
          mime,
          `--${GRANICA_WYSYLKI}--`,
        ].join('\r\n'),
        { adres: WYSYLKA, typ: `multipart/related; boundary=${GRANICA_WYSYLKI}` },
      ),
    zatrzymaj: async () => {
      await wywolaj('/stop', {})
    },
    zalacznik: (wiadomoscId, id) =>
      wywolaj(`/messages/${encodeURIComponent(wiadomoscId)}/attachments/${encodeURIComponent(id)}`),
    listaWatkow: (zapytanie, strona) => wywolaj(`/threads?${parametry({ q: zapytanie, maxResults: '100', pageToken: strona })}`),
    historia: (od, strona) => wywolaj(`/history?${parametry({ startHistoryId: od, historyTypes: 'messageAdded', pageToken: strona })}`),
    // Tylko Odebrane i Wysłane - przeczytanie maila czy zmiana etykiety nie budzą serwera.
    obserwuj: (temat) => wywolaj('/watch', { topicName: temat, labelIds: ['INBOX', 'SENT'], labelFilterBehavior: 'include' }),
  }
}
