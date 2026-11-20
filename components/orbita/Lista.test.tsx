import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Lista } from './Lista'
import { DZIS, etap, zadanie } from './test-dane'

const k = vi.hoisted(() => ({ usun: vi.fn(), otworz: vi.fn(), dodaj: vi.fn(), zmien: vi.fn() }))
vi.mock('@/lib/orbita/klient', () => ({ klientOrbity: k }))

const A = zadanie('A', '2026-12-20', [etap({ id: 'a1', nazwa: 'Koncepcja', zamkniety: 1 }), etap({ id: 'a2', nazwa: 'Projekt', zamkniety: 2 }), etap({ id: 'a3', nazwa: 'Konsultacje' })])
const B = zadanie('B', null, [etap({ nazwa: 'Krok' })])

describe('Lista', () => {
  beforeEach(() => Object.values(k).forEach((f) => f.mockReset().mockResolvedValue({})))

  it('po zapasie, bez terminu na końcu', () => {
    const { container } = render(<Lista zadania={[B, A]} dzis={DZIS} odswiez={vi.fn()} />)
    expect([...container.querySelectorAll('[data-zadanie]')].map((li) => li.getAttribute('data-zadanie'))).toEqual(['A', 'B'])
  })

  it('„Otwórz ponownie” tylko przy ostatnim zamkniętym etapie', async () => {
    const odswiez = vi.fn()
    render(<Lista zadania={[A]} dzis={DZIS} odswiez={odswiez} />)
    const przyciski = screen.getAllByRole('button', { name: 'Otwórz ponownie' })
    expect(przyciski).toHaveLength(1)
    await act(async () => fireEvent.click(przyciski[0]))
    expect(k.otworz).toHaveBeenCalledWith('A', 'a2')
    expect(odswiez).toHaveBeenCalled()
  })

  it('usunięcie dopiero po potwierdzeniu', async () => {
    render(<Lista zadania={[B]} dzis={DZIS} odswiez={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Usuń' }))
    expect(k.usun).not.toHaveBeenCalled()
    expect(screen.getByText('Usunąć zadanie „Zadanie B”? Tego nie da się cofnąć.')).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tak, usuń' })))
    expect(k.usun).toHaveBeenCalledWith('B')
  })
})
