import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from './proxy'

const zada = (adres: string, ciastko?: string) =>
  new NextRequest(adres, ciastko ? { headers: { cookie: ciastko } } : undefined)

describe('proxy', () => {
  it('bez sesji do logowania z drogą powrotu', () => {
    const r = proxy(zada('https://deck.test/skrzynka?x=1'))
    expect(new URL(r.headers.get('location')!).pathname).toBe('/login')
    expect(new URL(r.headers.get('location')!).searchParams.get('dokad')).toBe('/skrzynka?x=1')
  })
  it('z kokpitu bez parametru; z sesją przepuszcza', () => {
    expect(proxy(zada('https://deck.test/')).headers.get('location')).toBe('https://deck.test/login')
    expect(proxy(zada('https://deck.test/planer', 'deck_session=t')).headers.get('location')).toBeNull()
  })
})
