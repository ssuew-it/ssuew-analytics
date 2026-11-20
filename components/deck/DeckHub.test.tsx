import { act, cleanup, render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DeckHub, type DaneAnalityki, type DaneDziennika, type DanePlanera } from '@/components/deck/DeckHub'
import type { ZapisanaOdprawa } from '@/lib/asystent/odprawa'
import type { Fakt } from '@/lib/asystent/fakty'
import type { PodsumowanieStron } from '@/lib/strony/model'
import type { LicznikiSkrzynki } from '@/lib/skrzynka/typy'
import type { ObrazOrbity } from '@/lib/orbita/obraz'

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

const ANALITYKA: DaneAnalityki = {
  konwersja: 24.04, edycja: "J'26", retencja: 3.81, kpiWzrosty: 13, kpiPorownywalne: 20, kpiRazem: 28, alerty: 2, czasArkuszaMs: 420,
}
const PLANER: DanePlanera = { propozycje: 0, sesja: { wlaczony: false, od: null, przez: null }, najblizsze: [], ok: true }
const STRONY: PodsumowanieStron = {
  stron: 2, klikniecia: 125, wyswietlenia: 4000, poprzednieKlikniecia: 100, poprzednieWyswietlenia: 3000, alerty: 1, bledy: 0,
}
const SKRZYNKA: LicznikiSkrzynki = {
  stan: 'polaczona', doOdpowiedzi: 7, poTerminie: 2, doPrzejrzenia: 4, czekaNaNich: 3, wToku: 1, zalatwione: 0, pominiete: 0, ostatniaSynchronizacja: 1,
}
const DZIENNIK: DaneDziennika = {
  otwarta: true,
  pozycje: [
    { tytul: 'Sprawozdanie dla KR', termin: '15.12.2026', przygotowaniaOd: '01.12.2026', obowiazkowe: true, rozlicza: ['KR'] },
    { tytul: 'Budżet na lato', termin: '20.12.2026', przygotowaniaOd: '06.12.2026', obowiazkowe: false, rozlicza: [] },
    { tytul: 'Trzecia sprawa', termin: '21.12.2026', przygotowaniaOd: '07.12.2026', obowiazkowe: true, rozlicza: ['RUSS'] },
  ],
}
const ORBITA: ObrazOrbity = {
  dzis: [{ zadanie: 'Zarządzenie ws. uchwał', etap: 'Koncepcja', zapasDni: -2, termin: '10.12.2026' }],
  podpowiedz: false,
  czekam: [{ zadanie: 'Standard Workspace', etap: 'Konsultacje', czekaNa: ['RUSS', 'KR'], do: '28.11.2026' }],
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
  dziennik?: DaneDziennika | null | Promise<DaneDziennika | null>
  orbita?: ObrazOrbity | null | Promise<ObrazOrbity | null>
} = {}) {
  const rola = nadpisz.rola ?? 'owner'
  const analityka = nadpisz.analityka instanceof Promise ? nadpisz.analityka : Promise.resolve({ ...ANALITYKA, ...nadpisz.analityka })
  const planer = nadpisz.planer instanceof Promise ? nadpisz.planer : Promise.resolve({ ...PLANER, ...nadpisz.planer })
  const odprawa = rola === 'owner' ? obietnica(nadpisz.odprawa === undefined ? ZAPIS : nadpisz.odprawa) : null
  const strony = rola === 'owner' ? obietnica(nadpisz.strony === undefined ? STRONY : nadpisz.strony) : null
  const skrzynka = rola === 'owner' ? obietnica(nadpisz.skrzynka === undefined ? SKRZYNKA : nadpisz.skrzynka) : null
  const dziennik = rola === 'owner' ? obietnica(nadpisz.dziennik === undefined ? DZIENNIK : nadpisz.dziennik) : null
  const orbita = rola === 'owner' ? obietnica(nadpisz.orbita === undefined ? ORBITA : nadpisz.orbita) : null
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
        dziennik={dziennik}
        orbita={orbita}
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
    expect(screen.getByRole('link', { name: /Analityka/ })).toHaveAttribute('href', '/analytics')
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
    // Odprawa jest domyślnie zwinięta - widać jej nagłówek, treść po „rozwiń”.
    expect(await screen.findByRole('heading', { name: 'Odprawa D.E.C.K.' })).toBeInTheDocument()
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

  it('kafelek Analytics: konwersja podpisana edycją, KPI wzrosty na tle porównywalnych serii - jak w Analityce', async () => {
    await hub()
    expect(await screen.findByText("% konwersji · J'26")).toBeInTheDocument()
    expect(screen.getByText('24,0')).toBeInTheDocument()
    expect(screen.getByText('/ 20 porównywalnych')).toBeInTheDocument()
  })

  it('siatka bez dziur: u właściciela każdy kafelek po pół rzędu (3 pełne rzędy); zarząd - Sesja obok Analityki na pół', async () => {
    const szeroki = (nazwa: RegExp) => screen.getByRole('link', { name: nazwa }).className.includes('sm:col-span-2')
    await hub()
    expect(szeroki(/Strony/)).toBe(true)
    expect(szeroki(/Skrzynka/)).toBe(true)
    expect(szeroki(/Sesja Operacyjna/)).toBe(true)
    expect(szeroki(/Dziennik Stratega/)).toBe(true)
    expect(szeroki(/Orbita/)).toBe(true)
    cleanup()
    await hub({ rola: 'board' })
    expect(szeroki(/Sesja Operacyjna/)).toBe(true)
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

  it('kafelek Dziennika: najwyżej dwie pozycje, obowiązkowe z podmiotem, odznaka liczby obowiązkowych', async () => {
    await hub()
    const kafelek = screen.getByRole('link', { name: /Dziennik Stratega/ })
    expect(kafelek).toHaveAttribute('href', '/dziennik')
    expect(await screen.findByText('Sprawozdanie dla KR')).toBeInTheDocument()
    expect(screen.getByText('Budżet na lato')).toBeInTheDocument()
    expect(screen.queryByText('Trzecia sprawa')).toBeNull()
    expect(kafelek).toHaveTextContent('OBOWIĄZKOWE · KR')
    expect(kafelek).toHaveTextContent('2 obowiązkowe')
  })

  it('kafelek Dziennika bez kadencji, pusty i po błędzie', async () => {
    await hub({ dziennik: { otwarta: false, pozycje: [] } })
    expect(await screen.findByText('Rozpocznij kadencję, żeby zacząć księgę.')).toBeInTheDocument()
    cleanup()
    await hub({ dziennik: { otwarta: true, pozycje: [] } })
    expect(await screen.findByText('Nic z kalendarza pracy w 30 dniach.')).toBeInTheDocument()
    cleanup()
    await hub({ dziennik: null })
    expect(await screen.findByText('Księgi nie dało się odczytać.')).toBeInTheDocument()
  })

  it('kafelek Orbity: pierwsza pozycja na dziś, spóźnienie, czekające i odznaka', async () => {
    await hub()
    const kafelek = screen.getByRole('link', { name: /Orbita/ })
    expect(kafelek).toHaveAttribute('href', '/orbita')
    expect(await screen.findByText('Zarządzenie ws. uchwał · Koncepcja')).toBeInTheDocument()
    expect(kafelek).toHaveTextContent('spóźnione o 2 dni')
    expect(kafelek).toHaveTextContent('czeka: 1')
    expect(kafelek).toHaveTextContent('1 spóźnione')
  })

  it('kafelek Orbity: podpowiedź, pusto i błąd', async () => {
    await hub({ orbita: { dzis: [{ zadanie: 'Strategia', etap: 'Projekt', zapasDni: 4, termin: '30.12.2026' }], podpowiedz: true, czekam: [] } })
    const kafelek = screen.getByRole('link', { name: /Orbita/ })
    expect(await screen.findByText(/najbliżej:/)).toBeInTheDocument()
    expect(kafelek).toHaveTextContent('zapas 4 dni')
    expect(kafelek).not.toHaveTextContent('spóźnione')
    cleanup()
    await hub({ orbita: { dzis: [], podpowiedz: false, czekam: [] } })
    expect(await screen.findByText('Nic na dziś. Dodaj zadanie, które czeka na pierwszy krok.')).toBeInTheDocument()
    cleanup()
    await hub({ orbita: null })
    expect(await screen.findByText('Zadań nie dało się odczytać.')).toBeInTheDocument()
  })

  it('zarząd nie widzi kafelka Dziennika', async () => {
    await hub({ rola: 'board', email: 'Jula' })
    expect(screen.queryByRole('heading', { name: 'Dziennik Stratega' })).toBeNull()
  })
})
