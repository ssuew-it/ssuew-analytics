import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OknoOdpowiedzi } from '@/components/skrzynka/OknoOdpowiedzi'
import { MAKS_ZALACZNIKOW } from '@/lib/skrzynka/typy'

const klient = { odpowiedz: vi.fn(), asystent: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: {
    odpowiedz: (...a: unknown[]) => klient.odpowiedz(...a),
    asystent: (...a: unknown[]) => klient.asystent(...a),
  },
}))

const plik = (nazwa: string, bajty: number) => new File([new Uint8Array(bajty)], nazwa, { type: 'application/pdf' })
const okno = (adresat: string | null = 'anna@firma.pl') => {
  const onWyslano = vi.fn()
  render(<OknoOdpowiedzi sprawaId="t1" adresat={adresat} stopka={'-- \nSamorząd Studentów UEW'} onWyslano={onWyslano} />)
  return onWyslano
}
const wpisz = (t: string) => fireEvent.change(screen.getByLabelText('Treść odpowiedzi'), { target: { value: t } })
const dodaj = (...p: File[]) => fireEvent.change(screen.getByLabelText('Wybierz pliki'), { target: { files: p } })
const wyslij = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }))
  })

beforeEach(() => Object.values(klient).forEach((f) => f.mockReset()))
afterEach(() => vi.restoreAllMocks())

describe('OknoOdpowiedzi', () => {
  it('adresat i podgląd stopki; pusta treść nie wysyła', () => {
    okno()
    expect(screen.getByText('anna@firma.pl')).toBeInTheDocument()
    expect(screen.getByLabelText('Stopka')).toHaveTextContent('Samorząd Studentów UEW')
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
  })

  it('stopka HTML - podgląd w ramce zamiast tekstowej', () => {
    render(<OknoOdpowiedzi sprawaId="t1" adresat="anna@firma.pl" stopka="-- tekst" stopkaHtml='<p>Mikołaj</p><img src="https://a.pl/l.png">' onWyslano={vi.fn()} />)
    const ramka = screen.getByTitle('Podgląd stopki')
    expect(ramka.getAttribute('srcdoc')).toContain('<p>Mikołaj</p>')
    expect(ramka.getAttribute('sandbox')).not.toContain('allow-scripts')
    expect(screen.queryByText('-- tekst')).not.toBeInTheDocument()
  })

  it('wysyłka z załącznikiem; po sukcesie okno puste, rodzic dostaje sprawę', async () => {
    klient.odpowiedz.mockResolvedValue({ id: 't1', status: 'czeka-na-nich' })
    const onWyslano = okno()
    wpisz('Dziękujemy za ofertę.')
    const umowa = plik('Umowa.pdf', 2048)
    dodaj(umowa)
    expect(screen.getByRole('list', { name: 'Załączniki odpowiedzi' })).toHaveTextContent('Umowa.pdf · 2 KB')
    await wyslij()
    expect(klient.odpowiedz).toHaveBeenCalledWith('t1', 'Dziękujemy za ofertę.', [umowa])
    expect(onWyslano).toHaveBeenCalledWith({ id: 't1', status: 'czeka-na-nich' })
    expect(screen.getByLabelText('Treść odpowiedzi')).toHaveValue('')
    expect(screen.queryByRole('list', { name: 'Załączniki odpowiedzi' })).toBeNull()
  })

  it('błąd wysyłki zostawia tekst i załączniki', async () => {
    klient.odpowiedz.mockRejectedValueOnce(new Error('Gmail nie odpowiedział - spróbuj ponownie.'))
    const onWyslano = okno()
    wpisz('Treść, której szkoda')
    dodaj(plik('Skan.pdf', 10))
    await wyslij()
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail nie odpowiedział')
    expect(screen.getByLabelText('Treść odpowiedzi')).toHaveValue('Treść, której szkoda')
    expect(screen.getByRole('list', { name: 'Załączniki odpowiedzi' })).toHaveTextContent('Skan.pdf')
    expect(onWyslano).not.toHaveBeenCalled()
  })

  it('w trakcie wysyłki treść i załączniki są zablokowane, a drugie kliknięcie nie wysyła drugi raz', async () => {
    let zakoncz: (s: unknown) => void = () => {}
    klient.odpowiedz.mockReturnValue(new Promise((r) => { zakoncz = r }))
    okno()
    wpisz('Raz wystarczy')
    dodaj(plik('Skan.pdf', 10))
    const przycisk = screen.getByRole('button', { name: 'Wyślij' })
    await act(async () => {
      fireEvent.click(przycisk)
      fireEvent.click(przycisk)
    })
    expect(klient.odpowiedz).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Treść odpowiedzi')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Usuń Skan.pdf' })).toBeDisabled()
    await act(async () => zakoncz({ id: 't1', status: 'czeka-na-nich' }))
    expect(screen.getByLabelText('Treść odpowiedzi')).toBeEnabled()
  })

  it('ponad 4 MB łącznie - ostrzeżenie i blokada; usunięcie pliku odblokowuje', () => {
    okno()
    wpisz('x')
    dodaj(plik('a.pdf', MAKS_ZALACZNIKOW - 10), plik('b.pdf', 11))
    expect(screen.getByText(/za dużo, usuń część plików/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Usuń b.pdf' }))
    expect(screen.queryByText(/za dużo/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled()
  })

  it('szkic od D.E.C.K. trafia do okna; miejsca do uzupełnienia blokują wysyłkę, dopóki zostały', async () => {
    // Model nie zawsze trzyma się zapisu z instrukcji - luka z podpowiedzią i wielką literą też blokuje.
    klient.asystent.mockResolvedValueOnce({ tekst: 'Dzień dobry,\nstoisko kosztuje [Do uzupełnienia: kwota].' })
    okno()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Szkic odpowiedzi' }))
    })
    expect(klient.asystent).toHaveBeenCalledWith('t1', 'szkic')
    expect(screen.getByLabelText('Treść odpowiedzi')).toHaveValue('Dzień dobry,\nstoisko kosztuje [Do uzupełnienia: kwota].')
    expect(screen.getByText(/Uzupełnij miejsca \[do uzupełnienia\]/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
    wpisz('Dzień dobry,\nstoisko kosztuje 500 zł.')
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled()
  })

  it('szkic zastępuje wpisany tekst tylko po potwierdzeniu; błąd szkicu widoczny, tekst zostaje', async () => {
    okno()
    wpisz('Mój tekst')
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Szkic odpowiedzi' }))
    })
    expect(klient.asystent).not.toHaveBeenCalled()
    klient.asystent.mockRejectedValueOnce(new Error('Darmowy limit Gemini na tę chwilę wyczerpany - spróbuj za minutę.'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Szkic odpowiedzi' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('limit Gemini')
    expect(screen.getByLabelText('Treść odpowiedzi')).toHaveValue('Mój tekst')
  })

  it('bez adresata - komunikat zamiast okna', () => {
    okno(null)
    expect(screen.getByText(/nie ma do kogo odpowiedzieć/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Treść odpowiedzi')).toBeNull()
  })
})
