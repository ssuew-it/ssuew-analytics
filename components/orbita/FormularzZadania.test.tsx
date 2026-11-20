import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { FormularzZadania } from './FormularzZadania'
import { BladKlienta } from '@/lib/asystent/klient'
import { DZIS, etap, zadanie } from './test-dane'

const k = vi.hoisted(() => ({ dodaj: vi.fn(), zmien: vi.fn() }))
vi.mock('@/lib/orbita/klient', () => ({ klientOrbity: k }))

const dniEtapu = (n: number) => (screen.getByLabelText(`Dni etapu ${n}`) as HTMLInputElement).value

describe('FormularzZadania', () => {
  beforeEach(() => {
    k.dodaj.mockReset().mockResolvedValue({})
    k.zmien.mockReset()
  })

  it('szkielet dokumentu za długi - ostrzeżenie, Dopasuj nie rusza konsultacji, zapis', async () => {
    const gotowe = vi.fn()
    render(<FormularzZadania dzis={DZIS} onGotowe={gotowe} onAnuluj={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Tytuł'), { target: { value: 'Zarządzenie' } })
    fireEvent.change(screen.getByLabelText('Termin'), { target: { value: '2026-12-10' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Dokument normatywny' }))
    expect(screen.getByText('Etapy trwają 34 dni, do terminu zostało 20')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dopasuj' }))
    expect(screen.queryByText(/Etapy trwają/)).toBeNull()
    expect(dniEtapu(3)).toBe('14')
    expect(dniEtapu(1)).toBe('1')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zapisz' })))
    expect(k.dodaj).toHaveBeenCalledTimes(1)
    expect(k.dodaj.mock.calls[0][0]).toMatchObject({ tytul: 'Zarządzenie', termin: '2026-12-10', zrodlo: null })
    expect(k.dodaj.mock.calls[0][0].etapy).toHaveLength(5)
    expect(gotowe).toHaveBeenCalled()
  })

  it('nawet po skróceniu brakuje - mówi ile', () => {
    render(<FormularzZadania dzis={DZIS} onGotowe={vi.fn()} onAnuluj={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Termin'), { target: { value: '2026-11-30' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Dokument normatywny' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dopasuj' }))
    expect(screen.getByText('Nawet po skróceniu brakuje 8 dni - przesuń termin albo skróć konsultacje')).toBeInTheDocument()
  })

  it('termin w przeszłości - mówi, że minął, bez ujemnej liczby dni', () => {
    render(<FormularzZadania dzis={DZIS} onGotowe={vi.fn()} onAnuluj={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Termin'), { target: { value: '2026-11-15' } })
    expect(screen.getByText('Termin już minął - przesuń go albo zapisz zadanie jako spóźnione')).toBeInTheDocument()
    expect(screen.queryByText(/zostało -/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dopasuj' })).toBeNull()
  })

  it('edycja: kolizja z drugą kartą pokazuje komunikat', async () => {
    k.zmien.mockRejectedValue(new BladKlienta('Zadanie zmieniło się w innej karcie - odśwież', null, 409))
    const z = zadanie('A', null, [etap({ nazwa: 'Koncepcja' })], { zmieniono: 7 })
    render(<FormularzZadania dzis={DZIS} zadanie={z} onGotowe={vi.fn()} onAnuluj={vi.fn()} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zapisz' })))
    expect(k.zmien.mock.calls[0][0]).toBe('A')
    expect(k.zmien.mock.calls[0][2]).toBe(7)
    expect(screen.getByRole('alert')).toHaveTextContent('Zadanie zmieniło się w innej karcie - odśwież')
  })

  it('zamknięty etap: tylko do odczytu, bez przesuwania i usuwania; pierwszy otwarty nie idzie wyżej', () => {
    const z = zadanie('A', null, [etap({ nazwa: 'Koncepcja', zamkniety: 1 }), etap({ nazwa: 'Projekt' }), etap({ nazwa: 'Poprawki' })])
    render(<FormularzZadania dzis={DZIS} zadanie={z} onGotowe={vi.fn()} onAnuluj={vi.fn()} />)
    expect(screen.getByLabelText('Nazwa etapu 1')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'Usuń etap 1' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Przesuń etap 1 wyżej' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Przesuń etap 2 wyżej' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Przesuń etap 3 wyżej' }))
    expect((screen.getByLabelText('Nazwa etapu 2') as HTMLInputElement).value).toBe('Poprawki')
  })

  it('czekanie: RUSS, KR i inni po przecinku', async () => {
    const z = zadanie('A', null, [etap({ nazwa: 'Konsultacje', rodzaj: 'czekanie' })])
    k.zmien.mockResolvedValue({})
    render(<FormularzZadania dzis={DZIS} zadanie={z} onGotowe={vi.fn()} onAnuluj={vi.fn()} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'KR' }))
    fireEvent.change(screen.getByLabelText('Inni (po przecinku) 1'), { target: { value: 'Senat, Rektor' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zapisz' })))
    expect(k.zmien.mock.calls[0][1].etapy[0].czekaNa).toEqual(['KR', 'Senat', 'Rektor'])
  })
})
