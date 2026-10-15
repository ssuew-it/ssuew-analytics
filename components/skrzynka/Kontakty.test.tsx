import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Kontakty } from '@/components/skrzynka/Kontakty'
import { Organizacje } from '@/components/skrzynka/Organizacje'
import type { Sprawa } from '@/lib/skrzynka/typy'

const klient = { kontakty: vi.fn(), kontakt: vi.fn(), organizacje: vi.fn(), organizacja: vi.fn(), zmienOrganizacje: vi.fn() }
vi.mock('@/lib/skrzynka/klient', () => ({
  klientSkrzynki: {
    kontakty: (...a: unknown[]) => klient.kontakty(...a),
    kontakt: (...a: unknown[]) => klient.kontakt(...a),
    organizacje: (...a: unknown[]) => klient.organizacje(...a),
    organizacja: (...a: unknown[]) => klient.organizacja(...a),
    zmienOrganizacje: (...a: unknown[]) => klient.zmienOrganizacje(...a),
  },
}))

const S = (id: string, n: Partial<Sprawa> = {}): Sprawa => ({
  id, temat: `Temat ${id}`, status: 'w-toku', oczekujeOd: null, nowa: false, kontakt: 'anna@firma.pl', organizacja: 'firma.pl',
  ostatnia: { kiedy: Date.UTC(2026, 8, 2), kierunek: 'oni', fragment: '' }, wiadomosci: 1, przypisana: null, kategoriaGmail: null, zmieniono: 1, ...n,
})
const ANNA = { email: 'anna@firma.pl', imie: 'Anna Kowalska', organizacja: 'firma.pl', typ: null }
const klik = (nazwa: string | RegExp) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nazwa }))
  })

beforeEach(() => Object.values(klient).forEach((f) => f.mockReset()))

describe('Kontakty', () => {
  it('lista z imieniem i organizacją; kolejna strona po kursorze', async () => {
    klient.kontakty
      .mockResolvedValueOnce({ kontakty: [ANNA], nastepna: 'anna@firma.pl' })
      .mockResolvedValueOnce({ kontakty: [{ email: 'jan@x.pl', imie: '', organizacja: null, typ: 'student' }], nastepna: null })
    await act(async () => {
      render(<Kontakty wybrana={null} onWybierz={vi.fn()} />)
    })
    expect(screen.getByRole('button', { name: /Anna Kowalska/ })).toHaveTextContent('Anna Kowalska · anna@firma.pl · firma.pl')
    await klik('Pokaż więcej')
    expect(klient.kontakty).toHaveBeenLastCalledWith('anna@firma.pl')
    expect(screen.getByRole('button', { name: 'jan@x.pl' })).toBeInTheDocument()
  })

  it('karta osoby ze sprawami i statusami; wybór sprawy; powrót do listy', async () => {
    klient.kontakty.mockResolvedValue({ kontakty: [ANNA], nastepna: null })
    klient.kontakt.mockResolvedValue({ kontakt: ANNA, sprawy: [S('t1'), S('t2', { status: 'zalatwiona' })] })
    const onWybierz = vi.fn()
    await act(async () => {
      render(<Kontakty wybrana={null} onWybierz={onWybierz} />)
    })
    await klik(/Anna Kowalska/)
    expect(klient.kontakt).toHaveBeenCalledWith('anna@firma.pl')
    expect(screen.getByRole('heading', { name: 'Anna Kowalska' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Temat t2/ })).toHaveTextContent('Załatwione')
    fireEvent.click(screen.getByRole('button', { name: /Temat t1/ }))
    expect(onWybierz).toHaveBeenCalledWith('t1')
    fireEvent.click(screen.getByRole('button', { name: '← Kontakty' }))
    expect(screen.getByRole('list', { name: 'Kontakty' })).toBeInTheDocument()
  })
})

describe('Organizacje', () => {
  const ORG = [
    { domena: 'firma.pl', nazwa: 'firma.pl', typ: 'inne' as const },
    { domena: 'ue.wroc.pl', nazwa: 'Uniwersytet Ekonomiczny', typ: 'uczelnia' as const },
  ]

  it('filtr typu', async () => {
    klient.organizacje.mockResolvedValue({ organizacje: ORG })
    await act(async () => {
      render(<Organizacje wybrana={null} onWybierz={vi.fn()} />)
    })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    fireEvent.change(screen.getByLabelText('Filtr typu'), { target: { value: 'uczelnia' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Uniwersytet Ekonomiczny/ })).toHaveTextContent('Uczelnia')
  })

  it('karta: osoby i sprawy; zmiana nazwy i typu zapisuje i aktualizuje listę', async () => {
    klient.organizacje.mockResolvedValue({ organizacje: ORG })
    klient.organizacja.mockResolvedValue({ organizacja: ORG[0], kontakty: [ANNA], sprawy: [S('t1')] })
    klient.zmienOrganizacje.mockResolvedValue({ domena: 'firma.pl', nazwa: 'Firma S.A.', typ: 'sponsor' })
    await act(async () => {
      render(<Organizacje wybrana={null} onWybierz={vi.fn()} />)
    })
    await klik(/^firma\.pl/)
    expect(screen.getByRole('list', { name: 'Osoby organizacji' })).toHaveTextContent('Anna Kowalska · anna@firma.pl')
    expect(screen.getByRole('button', { name: /Temat t1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Nazwa organizacji'), { target: { value: ' Firma S.A. ' } })
    fireEvent.change(screen.getByLabelText('Typ organizacji'), { target: { value: 'sponsor' } })
    await klik('Zapisz')
    expect(klient.zmienOrganizacje).toHaveBeenCalledWith('firma.pl', { nazwa: 'Firma S.A.', typ: 'sponsor' })
    expect(screen.getByRole('heading', { name: 'Firma S.A.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Organizacje' }))
    expect(screen.getByRole('button', { name: /Firma S\.A\./ })).toHaveTextContent('Sponsor')
  })
})
