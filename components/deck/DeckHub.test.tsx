import { act, render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DeckHub, type DaneAnalityki, type DanePlanera } from '@/components/deck/DeckHub'
import type { ZapisanaOdprawa } from '@/lib/asystent/odprawa'
import type { Fakt } from '@/lib/asystent/fakty'
import type { PodsumowanieStron } from '@/lib/strony/model'
import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const wyloguj = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('@/lib/auth/useAuth', () => ({ useAuth: () => ({ wyloguj }) }))

const ANALITYKA: DaneAnalityki = { konwersja: 61.1, retencja: 3.81, kpiWzrosty: 20, kpiRazem: 28, alerty: 2, czasArkuszaMs: 420 }
const PLANER: DanePlanera = { propozycje: 0, sesja: { wlaczony: false, od: null, przez: null }, najblizsze: [], ok: true }
const STRONY: PodsumowanieStron = {
  stron: 2, klikniecia: 125, wyswietlenia: 4000, poprzednieKlikniecia: 100, poprzednieWyswietlenia: 3000, alerty: 1, bledy: 0,
}
const SKRZYNKA: LicznikiSkrzynki = {
  stan: 'polaczona', doOdpowiedzi: 7, poTerminie: 2, doPrzejrzenia: 4, czekaNaNich: 3, wToku: 1, ostatniaSynchronizacja: 1,
}
const ZAPIS: ZapisanaOdprawa = {
  slad: 's', dzien: '02.10.2026', utworzono: Date.UTC(2026, 9, 2, 12, 32), model: 'm',
  odprawa: { podsumowanie: 'Rekrutacja trzyma poziom, retencja słabnie.', zagrozenia: [], dzis: [] },
}

/** Obietnica, która nigdy się nie spełnia - arkusz, który jeszcze nie odpowiedział. */
const nigdy = <T,>() => new Promise<T>(() => {})

const obietnica = <T,>(x: T | Promise<T>) => (x instanceof Promise ? x : Promise.resolve(x))

async function hub(nadpisz: {
  rola?: 'owner' | 'board'
  email?: string
  kodem?: boolean
  analityka?: Partial<DaneAnalityki> | Promise<DaneAnalityki>
  planer?: Partial<DanePlanera> | Promise<DanePlanera>
  fakty?: Fakt[] | Promise<Fakt[]>
  odprawa?: ZapisanaOdprawa | null | Promise<ZapisanaOdprawa | null>
  strony?: PodsumowanieStron | null | Promise<PodsumowanieStron | null>
  skrzynka?: LicznikiSkrzynki | null | Promise<LicznikiSkrzynki | null>
} = {}) {
  const rola = nadpisz.rola ?? 'owner'
  const analityka = nadpisz.analityka instanceof Promise ? nadpisz.analityka : Promise.resolve({ ...ANALITYKA, ...nadpisz.analityka })
  const planer = nadpisz.planer instanceof Promise ? nadpisz.planer : Promise.resolve({ ...PLANER, ...nadpisz.planer })
  const odprawa = rola === 'owner' ? obietnica(nadpisz.odprawa === undefined ? ZAPIS : nadpisz.odprawa) : null
  const strony = rola === 'owner' ? obietnica(nadpisz.strony === undefined ? STRONY : nadpisz.strony) : null
  const skrzynka = rola === 'owner' ? obietnica(nadpisz.skrzynka === undefined ? SKRZYNKA : nadpisz.skrzynka) : null
  // Dane ze strumienia (use + Suspense) dopływają w mikrozadaniach - bez
  // asynchronicznego act React nie zdąży podmienić wersji zastępczej.
  return act(async () => {
    render(
      <DeckHub
        rola={rola}
        email={nadpisz.email ?? 'ja@e.com'}
        kodem={nadpisz.kodem ?? false}
        godzina="14:32"
        analityka={analityka}
        planer={planer}
        fakty={obietnica(nadpisz.fakty ?? [])}
        odprawa={odprawa}
        strony={strony}
        skrzynka={skrzynka}
      />,
    )
  })
}

describe('DeckHub', () => {
  it('nagłówek, kafelki, odprawa i pasek są od razu - nie czekają na dane', async () => {
    await hub({ analityka: nigdy(), planer: nigdy(), fakty: nigdy(), odprawa: nigdy(), strony: nigdy(), skrzynka: nigdy() })
    expect(screen.getByRole('heading', { level: 1, name: 'D.E.C.K.' })).toBeInTheDocument()
    expect(screen.getByText('Diagnostic Evaluation of Change & KPIs')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Odprawa D.E.C.K.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /SSUEW Analytics/ })).toHaveAttribute('href', '/analytics')
    expect(screen.getByRole('link', { name: /Sesja Operacyjna/ })).toHaveAttribute('href', '/planer')
    expect(screen.getByRole('button', { name: /wyloguj/i })).toBeInTheDocument()
    expect(screen.getAllByText('łączę…').length).toBeGreaterThan(0)
  })

  it('pokazuje Orbitę właścicielowi', async () => {
    await hub()
    expect(screen.getByText('Orbita')).toBeInTheDocument()
  })

  it('ukrywa Orbitę przed zarządem - nie wyszarza, tylko nie renderuje', async () => {
    await hub({ rola: 'board', email: 'z@e.com' })
    expect(screen.queryByText('Orbita')).toBeNull()
  })

  it('właściciel widzi odprawę, nie panel faktów', async () => {
    await hub()
    expect(await screen.findByText(/retencja słabnie/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Na teraz' })).toBeNull()
  })

  it('zarząd widzi fakty, nigdy odprawy', async () => {
    await hub({ rola: 'board', email: 'Jula', kodem: true, fakty: [{ etykieta: 'Jutro 18:00', tresc: 'Zebranie Zarządu', link: '/planer' }] })
    expect(screen.getByRole('heading', { name: 'Na teraz' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Jutro 18:00/ })).toHaveAttribute('href', '/planer')
    expect(screen.queryByRole('heading', { name: 'Odprawa D.E.C.K.' })).toBeNull()
  })

  it('pokazuje liczbę alertów na kafelku Analytics, gdy arkusz odpowie', async () => {
    await hub()
    expect(await screen.findByText('2 alerty')).toBeInTheDocument()
  })

  it('nie pokazuje odznaki alertów, gdy alertów nie ma', async () => {
    await hub({ analityka: { alerty: 0 } })
    await screen.findByText('420 ms')
    expect(screen.queryByText(/\d+ alerty/)).toBeNull()
  })

  it('pokazuje adres i rolę zalogowanego', async () => {
    await hub({ rola: 'board', email: 'zarzad@e.com' })
    expect(screen.getByText('zarzad@e.com')).toBeInTheDocument()
    expect(screen.getByText('board')).toBeInTheDocument()
  })

  it('ma przycisk wylogowania', async () => {
    // Kokpit jest ekranem, na ktorym sie laduje po zalogowaniu. Bez tego
    // przycisku nie da sie z niego wyjsc - powloka z sidebarem obejmuje
    // wylacznie /analytics/*, wiec tam wylogowania po prostu nie widac.
    await hub()
    fireEvent.click(screen.getByRole('button', { name: /wyloguj/i }))
    expect(wyloguj).toHaveBeenCalled()
  })

  it('kafelek Sesji Operacyjnej: odznaka propozycji i najbliższe wydarzenia', async () => {
    await hub({ planer: { propozycje: 3, najblizsze: [{ id: 'a', kiedy: 'dziś 18:00', tytul: 'Zebranie Zarządu' }] } })
    expect(await screen.findByText('3 do decyzji')).toBeInTheDocument()
    expect(screen.getByText('Zebranie Zarządu')).toBeInTheDocument()
    expect(screen.getByText('dziś 18:00')).toBeInTheDocument()
  })

  it('pokazuje baner trwającej Sesji Operacyjnej z odnośnikiem do Planera', async () => {
    await hub({
      rola: 'board',
      email: 'Jula',
      planer: { sesja: { wlaczony: true, od: Date.now() - 5 * 60_000, przez: 'ja' } },
    })
    expect(await screen.findByRole('link', { name: /Sesja Operacyjna trwa/ })).toHaveAttribute('href', '/planer')
  })

  it('baner sesji nie czeka na arkusz', async () => {
    await hub({ analityka: nigdy(), planer: { sesja: { wlaczony: true, od: null, przez: 'ja' } } })
    expect(await screen.findByText(/Sesja Operacyjna trwa/)).toBeInTheDocument()
  })

  it('bez sesji baneru nie ma', async () => {
    await hub()
    await screen.findByText('420 ms')
    expect(screen.queryByText(/Sesja Operacyjna trwa/)).toBeNull()
  })

  it('właściciel ma czat z asystentem', async () => {
    await hub()
    expect(screen.getByRole('button', { name: /Zapytaj D\.E\.C\.K\./ })).toBeInTheDocument()
  })

  it('zarząd nie ma czatu', async () => {
    await hub({ rola: 'board', email: 'Jula' })
    expect(screen.queryByRole('button', { name: /Zapytaj D\.E\.C\.K\./ })).toBeNull()
  })

  it('pasek statusu zna sposób wejścia', async () => {
    await hub({ rola: 'board', email: 'Jula', kodem: true })
    expect(screen.getByText('kod')).toBeInTheDocument()
  })

  it('właściciel ma żywy kafelek Stron: kliknięcia, zmiana i alert', async () => {
    await hub()
    expect(screen.getByRole('link', { name: /Strony/ })).toHaveAttribute('href', '/strony')
    expect(await screen.findByText('+25%')).toBeInTheDocument()
    expect(screen.getByText('1 alert')).toBeInTheDocument()
  })

  it('kafelek Stron bez stron zachęca do dodania pierwszej', async () => {
    await hub({ strony: { ...STRONY, stron: 0, klikniecia: 0, poprzednieKlikniecia: 0, alerty: 0 } })
    expect(await screen.findByText(/Dodaj pierwszą stronę/)).toBeInTheDocument()
  })

  it('kafelek Stron, gdy Search Console zawiódł', async () => {
    await hub({ strony: null })
    expect(await screen.findByText(/Search Console nie odpowiada/)).toBeInTheDocument()
  })

  it('zarząd nie widzi kafelka Stron', async () => {
    await hub({ rola: 'board', email: 'Jula' })
    expect(screen.queryByRole('heading', { name: 'Strony' })).toBeNull()
  })

  it('kafelek Skrzynki: do odpowiedzi, po terminie i reszta statusów', async () => {
    await hub()
    expect(screen.getByRole('link', { name: /Skrzynka/ })).toHaveAttribute('href', '/skrzynka')
    expect(await screen.findByText('2 po terminie')).toBeInTheDocument()
    expect(screen.getByText('do przejrzenia 4 · czeka na nich 3')).toBeInTheDocument()
  })

  it('kafelek Skrzynki bez połączenia i po rozłączeniu', async () => {
    await hub({ skrzynka: { ...SKRZYNKA, stan: 'brak' } })
    expect(await screen.findByText(/Połącz skrzynkę kontakt@/)).toBeInTheDocument()
  })

  it('kafelek Skrzynki rozłączonej', async () => {
    await hub({ skrzynka: { ...SKRZYNKA, stan: 'rozlaczona' } })
    expect(await screen.findByText('Skrzynka rozłączona - połącz ponownie.')).toBeInTheDocument()
  })

  it('zarząd nie widzi kafelka Skrzynki', async () => {
    await hub({ rola: 'board', email: 'Jula' })
    expect(screen.queryByRole('heading', { name: 'Skrzynka' })).toBeNull()
  })
})
