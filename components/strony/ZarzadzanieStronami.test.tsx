import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DodajStrone } from '@/components/strony/DodajStrone'
import { UsunStrone } from '@/components/strony/UsunStrone'

const refresh = vi.fn()
const klient = { dostepne: vi.fn(), dodaj: vi.fn(), usun: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/lib/strony/klient', () => ({
  klientStron: {
    dostepne: (...a: unknown[]) => klient.dostepne(...a),
    dodaj: (...a: unknown[]) => klient.dodaj(...a),
    usun: (...a: unknown[]) => klient.usun(...a),
  },
}))

const EMAIL = 'deck@p.iam.gserviceaccount.com'

beforeEach(() => {
  refresh.mockReset()
  Object.values(klient).forEach((f) => f.mockReset())
})

async function otworz() {
  render(<DodajStrone />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Dodaj stronę/ }))
  })
}

describe('DodajStrone', () => {
  it('wybór z listy Search Console, nazwa podpowiedziana, po dodaniu odświeża panel', async () => {
    klient.dostepne.mockResolvedValue({
      email: EMAIL,
      witryny: [
        { witryna: 'sc-domain:jwk26.pl', nazwa: 'jwk26.pl' },
        { witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'samorzad.ue.wroc.pl' },
      ],
      blad: null,
    })
    klient.dodaj.mockResolvedValue({ witryna: 'https://samorzad.ue.wroc.pl/', nazwa: 'Samorząd' })
    await otworz()
    expect(screen.getByLabelText('Nazwa w panelu')).toHaveValue('jwk26.pl')
    fireEvent.change(screen.getByLabelText('Witryna z Search Console'), { target: { value: 'https://samorzad.ue.wroc.pl/' } })
    expect(screen.getByLabelText('Nazwa w panelu')).toHaveValue('samorzad.ue.wroc.pl')
    fireEvent.change(screen.getByLabelText('Nazwa w panelu'), { target: { value: 'Samorząd' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }))
    })
    expect(klient.dodaj).toHaveBeenCalledWith('https://samorzad.ue.wroc.pl/', 'Samorząd')
    expect(refresh).toHaveBeenCalled()
  })

  it('pusta lista - instrukcja z adresem konta serwisowego', async () => {
    klient.dostepne.mockResolvedValue({ email: EMAIL, witryny: [], blad: null })
    await otworz()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    expect(screen.getByText(/Ograniczone/)).toBeInTheDocument()
  })

  it('błąd Search Console i błąd dodawania widać, panel się nie odświeża', async () => {
    klient.dostepne.mockResolvedValue({ email: EMAIL, witryny: [], blad: 'Google Search Console API jest wyłączone.' })
    await otworz()
    expect(screen.getByRole('alert')).toHaveTextContent('Google Search Console API jest wyłączone.')

    klient.dostepne.mockResolvedValue({ email: EMAIL, witryny: [{ witryna: 'sc-domain:jwk26.pl', nazwa: 'jwk26.pl' }], blad: null })
    klient.dodaj.mockRejectedValue(new Error('Konto serwisowe nie ma dostępu do tej witryny w Search Console.'))
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Dodaj stronę/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/nie ma dostępu/)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('UsunStrone', () => {
  it('pyta o potwierdzenie, usuwa po „Tak” i odświeża', async () => {
    klient.usun.mockResolvedValue({ ok: true })
    render(<UsunStrone witryna="https://samorzad.ue.wroc.pl/" nazwa="Samorząd" />)
    fireEvent.click(screen.getByRole('button', { name: /Usuń z listy/ }))
    expect(screen.getByText('Usunąć Samorząd z listy?')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tak, usuń' }))
    })
    expect(klient.usun).toHaveBeenCalledWith('https://samorzad.ue.wroc.pl/')
    expect(refresh).toHaveBeenCalled()
  })

  it('„Nie” wraca bez usuwania', () => {
    render(<UsunStrone witryna="w" nazwa="W" />)
    fireEvent.click(screen.getByRole('button', { name: /Usuń z listy/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Nie' }))
    expect(klient.usun).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Usuń z listy/ })).toBeInTheDocument()
  })
})
