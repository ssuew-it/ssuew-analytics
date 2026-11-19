import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BladDysku, LIMIT_EKSPORTU, zapiszNaDysku } from '@/lib/dysk/google'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const odp = (status: number, cialo: unknown) => new Response(typeof cialo === 'string' ? cialo : JSON.stringify(cialo), { status })

async function rodzaj(p: Promise<unknown>) {
  const e = await p.then(() => null, (x) => x)
  expect(e).toBeInstanceOf(BladDysku)
  return (e as BladDysku).rodzaj
}

describe('zapiszNaDysku', () => {
  it('wysyła multipart z konwersją do dokumentu Google i zwraca link', async () => {
    fetchMock.mockResolvedValue(odp(200, { id: 'f1', webViewLink: 'https://docs.google.com/document/d/f1' }))
    expect(await zapiszNaDysku('d', 'Dziennik Stratega - stan na 19.11.2026', '<p>ż</p>')).toEqual({ id: 'f1', link: 'https://docs.google.com/document/d/f1' })
    const [adres, init] = fetchMock.mock.calls[0]
    expect(adres).toContain('https://www.googleapis.com/upload/drive/v3/files?')
    expect(adres).toContain('uploadType=multipart')
    expect(adres).toContain('webViewLink')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer d')
    expect(init.headers['Content-Type']).toMatch(/^multipart\/related; boundary=/)
    const cialo = String(init.body)
    expect(cialo).toContain('"mimeType":"application/vnd.google-apps.document"')
    expect(cialo).toContain('"name":"Dziennik Stratega - stan na 19.11.2026"')
    expect(cialo).toContain('Content-Type: text/html; charset=UTF-8')
    expect(cialo).toContain('<p>ż</p>')
  })

  it('mapuje błędy Google', async () => {
    fetchMock.mockResolvedValueOnce(odp(403, '{"error":{"errors":[{"reason":"accessNotConfigured"}]}}'))
    expect(await rodzaj(zapiszNaDysku('d', 'n', 'x'))).toBe('api-wylaczone')
    fetchMock.mockResolvedValueOnce(odp(403, '{"error":{"errors":[{"reason":"insufficientPermissions"}],"status":"PERMISSION_DENIED"}}'))
    expect(await rodzaj(zapiszNaDysku('d', 'n', 'x'))).toBe('brak-zgody')
    fetchMock.mockResolvedValueOnce(odp(429, 'rateLimitExceeded'))
    expect(await rodzaj(zapiszNaDysku('d', 'n', 'x'))).toBe('limit')
    fetchMock.mockResolvedValueOnce(odp(500, 'backendError'))
    expect(await rodzaj(zapiszNaDysku('d', 'n', 'x'))).toBe('google')
  })

  it('za duży HTML - odmowa bez wywołania Google', async () => {
    expect(await rodzaj(zapiszNaDysku('d', 'n', 'x'.repeat(LIMIT_EKSPORTU + 1)))).toBe('za-duzy')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('limit liczy bajty, nie znaki', async () => {
    expect(await rodzaj(zapiszNaDysku('d', 'n', 'ż'.repeat(LIMIT_EKSPORTU / 2 + 1)))).toBe('za-duzy')
  })
})
