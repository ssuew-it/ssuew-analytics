import { act, fireEvent, render, screen } from '@testing-library/react'
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
const pokaz = () =>
  act(async () => {
    render(<UstawieniaSkrzynki />)
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
})
