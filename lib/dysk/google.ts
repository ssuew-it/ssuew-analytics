/** Kopie Dziennika na Dysku kontakt@ - jedno żądanie multipart z konwersją HTML do dokumentu Google. */
const ADRES = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink'

/** Drive przyjmuje multipart do 5 MB; zostawiamy zapas na metadane. */
export const LIMIT_EKSPORTU = 4 * 1024 * 1024

export type RodzajBleduDysku = 'brak-zgody' | 'api-wylaczone' | 'limit' | 'za-duzy' | 'google'

export class BladDysku extends Error {
  readonly rodzaj: RodzajBleduDysku
  constructor(rodzaj: RodzajBleduDysku, wiadomosc: string) {
    super(wiadomosc)
    this.name = 'BladDysku'
    this.rodzaj = rodzaj
  }
}

function rodzajBledu(status: number, tresc: string): RodzajBleduDysku {
  if (/accessNotConfigured|SERVICE_DISABLED/.test(tresc)) return 'api-wylaczone'
  if (status === 429 || /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|RESOURCE_EXHAUSTED/.test(tresc)) return 'limit'
  // Samo PERMISSION_DENIED Google dokleja do każdego 403 - brak zgody to tylko brak zakresu.
  if (status === 401 || /insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT/.test(tresc)) return 'brak-zgody'
  return 'google'
}

export async function zapiszNaDysku(dostep: string, nazwa: string, html: string): Promise<{ id: string; link: string }> {
  if (Buffer.byteLength(html, 'utf8') > LIMIT_EKSPORTU) throw new BladDysku('za-duzy', 'Księga przekracza 4 MB')
  const granica = `deck-${crypto.randomUUID()}`
  const cialo = [
    `--${granica}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: nazwa, mimeType: 'application/vnd.google-apps.document' }),
    `--${granica}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    `--${granica}--`,
    '',
  ].join('\r\n')
  const res = await fetch(ADRES, {
    method: 'POST',
    headers: { Authorization: `Bearer ${dostep}`, 'Content-Type': `multipart/related; boundary=${granica}` },
    body: cialo,
    cache: 'no-store',
  })
  if (!res.ok) {
    const tresc = await res.text().catch(() => '')
    throw new BladDysku(rodzajBledu(res.status, tresc), `Google Drive ${res.status}: ${tresc.slice(0, 300)}`)
  }
  const d = (await res.json().catch(() => ({}))) as { id?: string; webViewLink?: string }
  if (!d.id) throw new BladDysku('google', 'Google Drive nie zwrócił identyfikatora pliku')
  return { id: d.id, link: d.webViewLink ?? `https://docs.google.com/document/d/${d.id}/edit` }
}
