import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { PanelOdprawy } from '@/components/deck/PanelOdprawy'
import type { ZapisanaOdprawa } from '@/lib/asystent/odprawa'
import type { Fakt } from '@/lib/asystent/fakty'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}))

const ZAPIS: ZapisanaOdprawa = {
  slad: 's',
  dzien: '02.10.2026',
  utworzono: Date.UTC(2026, 9, 2, 12, 32), // 14:32 w Warszawie
  model: 'gemini-3.8-flash',
  odprawa: {
    podsumowanie: 'Rekrutacja trzyma poziom, retencja słabnie.',
    zagrozenia: [{ obszar: 'retencja', waga: 'wysoka', tytul: "W'25 odpływa", uzasadnienie: 'średnio 1,8 sem. wobec 3,8' }],
    dzis: ['Zebranie Zarządu 18:00'],
  },
}

async function panel(odprawa: ZapisanaOdprawa | null, fakty: Fakt[] = []) {
  await act(async () => {
    render(<PanelOdprawy odprawa={Promise.resolve(odprawa)} fakty={Promise.resolve(fakty)} />)
  })
}

afterEach(() => vi.unstubAllGlobals())

const rozwin = () => fireEvent.click(screen.getByRole('button', { name: /rozwiń/ }))

describe('PanelOdprawy', () => {
  it('domyślnie zwinięta: nagłówek, godzina i liczba zagrożeń - treść dopiero po „rozwiń”', async () => {
    await panel({
      ...ZAPIS,
      odprawa: { ...ZAPIS.odprawa, zagrozenia: [...ZAPIS.odprawa.zagrozenia, { obszar: 'kpi', waga: 'srednia', tytul: 'KPI', uzasadnienie: 'x' }] },
    })
    expect(screen.getByText(/02\.10\.2026 · 14:32/)).toBeInTheDocument()
    expect(screen.getByText('2 zagrożenia · 1 wysokie')).toBeInTheDocument()
    expect(screen.queryByText(/retencja słabnie/)).not.toBeInTheDocument()
    const przycisk = screen.getByRole('button', { name: /rozwiń/ })
    expect(przycisk).toHaveAttribute('aria-expanded', 'false')
    rozwin()
    expect(screen.getByText(/retencja słabnie/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zwiń/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('podsumowanie, zagrożenie z wagą i odnośnikiem, punkty na dziś, godzina', async () => {
    await panel(ZAPIS)
    rozwin()
    expect(screen.getByText(/retencja słabnie/)).toBeInTheDocument()
    const z = screen.getByRole('link', { name: /W'25 odpływa/ })
    expect(z).toHaveAttribute('href', '/analytics/retencja')
    expect(z).toHaveAttribute('data-waga', 'wysoka')
    expect(screen.getByText('Zebranie Zarządu 18:00')).toBeInTheDocument()
    expect(screen.getByText(/02\.10\.2026 · 14:32/)).toBeInTheDocument()
  })

  it('„Odśwież” podmienia odprawę na nową i ją rozwija', async () => {
    const nowa = { ...ZAPIS, odprawa: { ...ZAPIS.odprawa, podsumowanie: 'Nowe podsumowanie.' } }
    const f = vi.fn(async () => new Response(JSON.stringify(nowa), { status: 200 }))
    vi.stubGlobal('fetch', f)
    await panel(ZAPIS)
    fireEvent.click(screen.getByRole('button', { name: /Odśwież/ }))
    expect(await screen.findByText('Nowe podsumowanie.')).toBeInTheDocument()
    expect(f).toHaveBeenCalledWith('/api/asystent/odprawa', { method: 'POST' })
  })

  it('błąd odświeżenia zostawia starą odprawę i mówi po ludzku', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'Darmowy limit Gemini na tę chwilę wyczerpany - spróbuj za minutę.' }), { status: 429 },
    )))
    await panel(ZAPIS)
    rozwin()
    fireEvent.click(screen.getByRole('button', { name: /Odśwież/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/limit Gemini/)
    expect(screen.getByText(/retencja słabnie/)).toBeInTheDocument()
  })

  it('bez zapisanej odprawy - zachęta i fakty', async () => {
    await panel(null, [{ etykieta: 'Analytics', tresc: '2 alerty', link: '/analytics/alerty' }])
    expect(screen.getByText(/Pierwsza odprawa/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /2 alerty/ })).toHaveAttribute('href', '/analytics/alerty')
  })
})
