import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { KartaEtapu } from './KartaEtapu'
import { DZIS, etap, zadanie } from './test-dane'
import { planDnia } from '@/lib/orbita/zapas'

const k = vi.hoisted(() => ({ zamknij: vi.fn() }))
vi.mock('@/lib/orbita/klient', () => ({ klientOrbity: k }))

const z = zadanie('A', '2026-11-28', [etap({ id: 'a1', nazwa: 'Koncepcja', dni: 10 }), etap({ nazwa: 'Projekt', dni: 3 })])
const pozycja = () => planDnia([z], DZIS).dzis[0]
const pisz = vi.fn()

describe('KartaEtapu', () => {
  beforeEach(() => {
    k.zamknij.mockReset().mockResolvedValue(z)
    pisz.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: pisz }, configurable: true })
  })

  it('tytuł, etap, spóźnienie i cel', () => {
    render(<KartaEtapu pozycja={pozycja()} odswiez={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Zadanie A · etap 1/2 Koncepcja' })).toBeInTheDocument()
    expect(screen.getByText('spóźnione o 5 dni')).toBeInTheDocument()
    expect(screen.getByText(/Cel etapu/)).toBeInTheDocument()
  })

  it('kopiuje wstęp do schowka i potwierdza', async () => {
    render(<KartaEtapu pozycja={pozycja()} odswiez={vi.fn()} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Kopiuj do Claude' })))
    expect(pisz.mock.calls[0][0]).toMatch(/^Pracuję nad: Zadanie A/)
    expect(screen.getByText('Skopiowano - wklej w Claude')).toBeInTheDocument()
  })

  it('bez schowka - okno z tekstem do skopiowania', async () => {
    pisz.mockRejectedValue(new Error('brak'))
    render(<KartaEtapu pozycja={pozycja()} odswiez={vi.fn()} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Kopiuj do Claude' })))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toMatch(/^Pracuję nad: Zadanie A/)
  })

  it('zamknięcie etapu z wynikiem', async () => {
    const odswiez = vi.fn()
    render(<KartaEtapu pozycja={pozycja()} odswiez={odswiez} />)
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij etap' }))
    fireEvent.change(screen.getByLabelText('Wynik'), { target: { value: 'link' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zamknij' })))
    expect(k.zamknij).toHaveBeenCalledWith('A', 'a1', 'link')
    expect(odswiez).toHaveBeenCalled()
  })

  it('po czekaniu - dopisek o terminie konsultacji', () => {
    const c = zadanie('C', '2027-01-30', [etap({ zamkniety: 1 }), etap({ nazwa: 'Konsultacje', rodzaj: 'czekanie', czekamDo: '2026-11-19' })])
    render(<KartaEtapu pozycja={planDnia([c], DZIS).dzis[0]} odswiez={vi.fn()} />)
    expect(screen.getByText('Termin konsultacji minął - zamknij etap albo przedłuż')).toBeInTheDocument()
    expect(screen.getByText(/zapas \d+ dni/)).toBeInTheDocument()
  })
})
