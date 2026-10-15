import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WidokSprawy } from '@/components/skrzynka/WidokSprawy'
import type { Sprawa, SzczegolySprawy } from '@/lib/skrzynka/typy'

const klient = { sprawa: vi.fn(), zmien: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: { sprawa: (...a: unknown[]) => klient.sprawa(...a), zmien: (...a: unknown[]) => klient.zmien(...a) },
}))

const EMAIL = 'kontakt@samorzad.ue.wroc.pl'
const S = (n: Partial<Sprawa> = {}): Sprawa => ({
  id: 't1', temat: 'Sponsoring Juwenaliów', status: 'do-odpowiedzi', oczekujeOd: 100, nowa: false, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
  ostatnia: { kiedy: 100, kierunek: 'oni', fragment: '' }, wiadomosci: 2, przypisana: null, kategoriaGmail: null, zmieniono: 1, ...n,
})
const D = (n: Partial<Sprawa> = {}): SzczegolySprawy => ({
  sprawa: S(n),
  wiadomosci: [
    {
      id: 'm1', kiedy: Date.UTC(2026, 9, 1, 8), od: { email: 'anna@firma.pl', imie: 'Anna' }, do: [], temat: 'Sponsoring Juwenaliów',
      tekst: 'tekst', html: '<p>Oferta</p><script>alert(1)</script>',
      zalaczniki: [{ id: 'A1', wiadomoscId: 'm1', nazwa: 'Oferta.pdf', typ: 'application/pdf', rozmiar: 120_000 }],
    },
    { id: 'm2', kiedy: Date.UTC(2026, 9, 2, 8), od: { email: EMAIL, imie: '' }, do: [], temat: 'Re: Sponsoring', tekst: 'Dziękujemy, wrócimy z odpowiedzią.', html: null, zalaczniki: [] },
  ],
})

async function widok(d: SzczegolySprawy = D()) {
  klient.sprawa.mockResolvedValue(d)
  const onZmiana = vi.fn()
  const onZamknij = vi.fn()
  await act(async () => {
    render(<WidokSprawy id="t1" sklad={['Jula', 'Kuba']} email={EMAIL} onZmiana={onZmiana} onZamknij={onZamknij} />)
  })
  return { onZmiana, onZamknij }
}

beforeEach(() => Object.values(klient).forEach((f) => f.mockReset()))

describe('WidokSprawy', () => {
  it('nagłówek, link do Gmaila, wiadomości: HTML w izolowanej ramce, tekst jako tekst, załącznik do pobrania', async () => {
    await widok()
    expect(klient.sprawa).toHaveBeenCalledWith('t1')
    expect(screen.getByRole('heading', { name: 'Sponsoring Juwenaliów' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Otwórz w Gmailu' })).toHaveAttribute('href', 'https://mail.google.com/mail/?authuser=kontakt%40samorzad.ue.wroc.pl#all/t1')
    const ramka = screen.getByTitle(/Treść/)
    expect(ramka.getAttribute('sandbox')).toBe('allow-popups allow-popups-to-escape-sandbox')
    expect(ramka.getAttribute('srcdoc')).toContain("default-src 'none'")
    expect(ramka.getAttribute('srcdoc')).not.toContain('<script')
    expect(screen.getByText('Dziękujemy, wrócimy z odpowiedzią.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Oferta\.pdf · 117 KB/ })).toHaveAttribute('href', '/api/skrzynka/sprawy/t1/zalacznik/A1?w=m1&nazwa=Oferta.pdf&typ=application%2Fpdf')
  })

  it('zmiana statusu i przypisanie - zapis i powiadomienie rodzica', async () => {
    const { onZmiana } = await widok()
    klient.zmien.mockResolvedValueOnce(S({ status: 'w-toku', oczekujeOd: null }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'W toku' }))
    })
    expect(klient.zmien).toHaveBeenLastCalledWith('t1', { status: 'w-toku' })
    expect(onZmiana).toHaveBeenCalledWith(expect.objectContaining({ status: 'w-toku' }))
    expect(screen.queryByRole('button', { name: 'W toku' })).toBeNull()
    klient.zmien.mockResolvedValueOnce(S({ status: 'w-toku', oczekujeOd: null, przypisana: 'Jula' }))
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Przypisz'), { target: { value: 'Jula' } })
    })
    expect(klient.zmien).toHaveBeenLastCalledWith('t1', { przypisana: 'Jula' })
  })

  it('pomiń zawsze: adres; domena tylko dla organizacji', async () => {
    await widok()
    klient.zmien.mockResolvedValueOnce(S({ status: 'pominieta', oczekujeOd: null }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pomiń zawsze domenę firma.pl' }))
    })
    expect(klient.zmien).toHaveBeenLastCalledWith('t1', { pomin: 'domena' })
  })

  it('nadawca z gmail.com - bez pomijania domeny', async () => {
    await widok(D({ kontakt: 'ktos@gmail.com', organizacja: null }))
    expect(screen.getByRole('button', { name: 'Pomiń zawsze ten adres' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pomiń zawsze domenę/ })).toBeNull()
  })

  it('błąd wczytania i powrót do listy', async () => {
    klient.sprawa.mockRejectedValue(new Error('Skrzynka jest rozłączona - połącz ją ponownie.'))
    const onZamknij = vi.fn()
    await act(async () => {
      render(<WidokSprawy id="t1" sklad={[]} email={EMAIL} onZmiana={vi.fn()} onZamknij={onZamknij} />)
    })
    expect(screen.getByRole('alert')).toHaveTextContent('rozłączona')
    fireEvent.click(screen.getByRole('button', { name: '← Lista' }))
    expect(onZamknij).toHaveBeenCalled()
  })
})
