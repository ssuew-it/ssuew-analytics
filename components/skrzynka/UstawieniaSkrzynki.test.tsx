import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UstawieniaSkrzynki } from '@/components/skrzynka/UstawieniaSkrzynki'

const refresh = vi.fn()
const klient = { ustawienia: vi.fn(), zapiszUstawienia: vi.fn(), rozlacz: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: {
    ustawienia: (...a: unknown[]) => klient.ustawienia(...a),
    zapiszUstawienia: (...a: unknown[]) => klient.zapiszUstawienia(...a),
    rozlacz: (...a: unknown[]) => klient.rozlacz(...a),
  },
}))

const U = { stopka: '-- \nSamorząd', pomijaneAdresy: ['news@sklep.pl'], pomijaneDomeny: ['reklama.pl'] }
const pokaz = (kalendarz = false) =>
  act(async () => {
    render(<UstawieniaSkrzynki kalendarz={kalendarz} />)
  })
const klik = (nazwa: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nazwa }))
  })

beforeEach(() => {
  refresh.mockReset()
  Object.values(klient).forEach((f) => f.mockReset())
  klient.ustawienia.mockResolvedValue(U)
})
afterEach(() => vi.restoreAllMocks())

describe('UstawieniaSkrzynki', () => {
  it('stopka: zapis po zmianie', async () => {
    await pokaz()
    expect(screen.getByLabelText('Stopka')).toHaveValue('-- \nSamorząd')
    expect(screen.getByRole('button', { name: 'Zapisz stopkę' })).toBeDisabled()
    klient.zapiszUstawienia.mockResolvedValue({ ...U, stopka: 'Pozdrawiamy' })
    fireEvent.change(screen.getByLabelText('Stopka'), { target: { value: 'Pozdrawiamy' } })
    await klik('Zapisz stopkę')
    expect(klient.zapiszUstawienia).toHaveBeenCalledWith({ stopka: 'Pozdrawiamy' })
    expect(screen.getByRole('status')).toHaveTextContent('Zapisano.')
  })

  it('pomijani: usunięcie i dodanie zapisują całą listę; odmowa serwera widoczna, wpis zostaje', async () => {
    await pokaz()
    klient.zapiszUstawienia.mockResolvedValueOnce({ ...U, pomijaneAdresy: [] })
    await klik('Usuń news@sklep.pl')
    expect(klient.zapiszUstawienia).toHaveBeenLastCalledWith({ pomijaneAdresy: [] })
    expect(screen.queryByRole('list', { name: 'Pomijane adresy' })).toBeNull()
    klient.zapiszUstawienia.mockRejectedValueOnce(new Error('Domeny gmail.com nie można pominąć w całości - dodaj pojedyncze adresy.'))
    fireEvent.change(screen.getByLabelText('Domena do pomijania'), { target: { value: 'gmail.com' } })
    await klik('Dodaj domenę')
    expect(klient.zapiszUstawienia).toHaveBeenLastCalledWith({ pomijaneDomeny: ['reklama.pl', 'gmail.com'] })
    expect(screen.getByRole('alert')).toHaveTextContent('gmail.com')
    expect(screen.getByLabelText('Domena do pomijania')).toHaveValue('gmail.com')
  })

  it('stopka HTML: wklejenie z formatowaniem daje HTML, podgląd na żywo, zapis i usunięcie', async () => {
    await pokaz()
    const pole = screen.getByLabelText('Stopka HTML')
    fireEvent.paste(pole, { clipboardData: { getData: (t: string) => (t === 'text/html' ? '<html><body><!--StartFragment--><p>Mikołaj</p><!--EndFragment--></body></html>' : 'Mikołaj') } })
    expect(pole).toHaveValue('<p>Mikołaj</p>')
    expect(screen.getByTitle('Podgląd stopki HTML').getAttribute('srcdoc')).toContain('<p>Mikołaj</p>')
    klient.zapiszUstawienia.mockResolvedValue({ ...U, stopkaHtml: '<p>Mikołaj</p>' })
    await klik('Zapisz stopkę HTML')
    expect(klient.zapiszUstawienia).toHaveBeenLastCalledWith({ stopkaHtml: '<p>Mikołaj</p>' })
    klient.zapiszUstawienia.mockResolvedValue({ ...U, stopkaHtml: '' })
    await klik('Usuń stopkę HTML')
    expect(klient.zapiszUstawienia).toHaveBeenLastCalledWith({ stopkaHtml: '' })
  })

  it('stopka HTML z obrazkiem wklejonym jako dane - ostrzeżenie', async () => {
    await pokaz()
    fireEvent.change(screen.getByLabelText('Stopka HTML'), { target: { value: '<img src="data:image/png;base64,AAA">' } })
    expect(screen.getByText(/obrazki wklejone jako dane/i)).toBeInTheDocument()
  })

  it('listy pomijanych podpisane - Adresy i Domeny, także gdy puste', async () => {
    klient.ustawienia.mockResolvedValue({ ...U, pomijaneAdresy: [], pomijaneDomeny: [] })
    await pokaz()
    expect(screen.getByRole('heading', { name: 'Adresy' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Domeny' })).toBeInTheDocument()
    expect(screen.getByText('Brak pomijanych adresów.')).toBeInTheDocument()
    expect(screen.getByText('Brak pomijanych domen.')).toBeInTheDocument()
  })

  it('rozłączenie: tylko po potwierdzeniu; z usuwaniem danych, gdy zaznaczone; potem odświeżenie strony', async () => {
    await pokaz()
    const potwierdz = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await klik('Rozłącz skrzynkę')
    expect(klient.rozlacz).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Usuń też sprawy, kontakty i organizacje z D.E.C.K.'))
    potwierdz.mockReturnValueOnce(true)
    klient.rozlacz.mockResolvedValue({ ok: true })
    await klik('Rozłącz skrzynkę')
    expect(potwierdz).toHaveBeenLastCalledWith(expect.stringContaining('Tego nie da się cofnąć'))
    expect(klient.rozlacz).toHaveBeenCalledWith(true)
    expect(refresh).toHaveBeenCalled()
  })

  it('kalendarz niepołączony - link Połącz kalendarz; połączony - napis Połączony', async () => {
    await pokaz(false)
    const sekcja = screen.getByRole('region', { name: 'Kalendarz Samorządowicza' })
    expect(within(sekcja).getByRole('link', { name: 'Połącz kalendarz' })).toHaveAttribute('href', '/api/skrzynka/kalendarz')
    expect(sekcja).toHaveTextContent('Komisje, SSUEW, Projekty i Wydarzenia UE')
    cleanup()
    await pokaz(true)
    const polaczony = screen.getByRole('region', { name: 'Kalendarz Samorządowicza' })
    expect(polaczony).toHaveTextContent('Połączony')
    expect(within(polaczony).queryByRole('link', { name: 'Połącz kalendarz' })).toBeNull()
    expect(within(polaczony).getByRole('link', { name: 'Połącz ponownie' })).toHaveAttribute('href', '/api/skrzynka/kalendarz')
  })
})
