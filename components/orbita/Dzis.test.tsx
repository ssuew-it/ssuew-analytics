import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Dzis } from './Dzis'
import { planDnia } from '@/lib/orbita/zapas'
import { DZIS, etap, zadanie } from './test-dane'

vi.mock('@/lib/orbita/klient', () => ({ klientOrbity: {} }))

const pokaz = (zadania: Parameters<typeof planDnia>[0]) => render(<Dzis plan={planDnia(zadania, DZIS)} odswiez={vi.fn()} />)

describe('Dzis', () => {
  it('trzy pozycje od razu, reszta pod „i jeszcze n”', () => {
    pokaz(['A', 'B', 'C', 'D', 'E'].map((id) => zadanie(id, '2026-11-25', [etap({ dni: 10 })])))
    expect(screen.getAllByRole('article')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'i jeszcze 2' }))
    expect(screen.getAllByRole('article')).toHaveLength(5)
  })

  it('podpowiedź, gdy nic nie musi ruszyć dziś', () => {
    pokaz([zadanie('A', '2027-01-30', [etap({ dni: 3 })])])
    expect(screen.getByText('Nic nie musi ruszyć dziś - najbliżej:')).toBeInTheDocument()
  })

  it('czekam z podmiotami i datą', () => {
    pokaz([zadanie('K', '2027-01-30', [etap({ zamkniety: 1 }), etap({ nazwa: 'Konsultacje', rodzaj: 'czekanie', czekaNa: ['RUSS', 'KR'], czekamDo: '2026-11-28' })])])
    expect(screen.getByText(/Konsultacje \(RUSS, KR\) do 28\.11/)).toBeInTheDocument()
  })

  it('zadanie z Dziennika ma dopisek', () => {
    pokaz([zadanie('A', '2026-11-25', [etap({ dni: 10 })], { zrodlo: { typ: 'dziennik', wpisId: 'w', termin: '2026-11-25' } })])
    expect(screen.getByText(/\(z Dziennika\)/)).toBeInTheDocument()
  })

  it('zadanie bez terminu da się rozwinąć do karty etapu z kopiowaniem', () => {
    pokaz([zadanie('E', null, [etap({ nazwa: 'Szkic standardu' })])])
    expect(screen.queryByRole('button', { name: 'Kopiuj do Claude' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż etap: Zadanie E' }))
    expect(screen.getByRole('button', { name: 'Kopiuj do Claude' })).toBeInTheDocument()
    expect(screen.getByText('kiedyś')).toBeInTheDocument()
  })

  it('pusto - zachęta', () => {
    pokaz([])
    expect(screen.getByText('Nic tu jeszcze nie ma. Dodaj zadanie, które czeka na pierwszy krok.')).toBeInTheDocument()
  })
})
