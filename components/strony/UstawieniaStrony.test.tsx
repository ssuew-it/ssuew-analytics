import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UstawieniaStrony } from '@/components/strony/UstawieniaStrony'

const refresh = vi.fn()
const ustaw = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/lib/strony/klient', () => ({ klientStron: { ustaw: (...a: unknown[]) => ustaw(...a) } }))

const W = 'sc-domain:dniadaptacyjne.pl'

beforeEach(() => {
  refresh.mockReset()
  ustaw.mockReset().mockResolvedValue({ ok: true })
})

describe('UstawieniaStrony', () => {
  it('przesuwa wcześniej / później i odświeża; na brzegu przycisk zablokowany', async () => {
    render(<UstawieniaStrony witryna={W} nazwa="DA" sezonowa={false} pierwsza={false} ostatnia />)
    expect(screen.getByRole('button', { name: 'Później' })).toBeDisabled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Wcześniej' })))
    expect(ustaw).toHaveBeenCalledWith(W, { przesun: -1 })
    expect(refresh).toHaveBeenCalled()
  })

  it('oznaczenie sezonowej z wyjaśnieniem, co to zmienia', async () => {
    render(<UstawieniaStrony witryna={W} nazwa="DA" sezonowa={false} pierwsza ostatnia={false} />)
    expect(screen.getByRole('button', { name: 'Wcześniej' })).toBeDisabled()
    const pole = screen.getByRole('checkbox', { name: /Sezonowa/ })
    expect(screen.getByText(/nie liczy się do sumy, kafelka w kokpicie ani alertów/)).toBeInTheDocument()
    await act(async () => fireEvent.click(pole))
    expect(ustaw).toHaveBeenCalledWith(W, { sezonowa: true })
  })

  it('błąd serwera widoczny', async () => {
    ustaw.mockRejectedValue(new Error('Strony chwilowo niedostępne'))
    render(<UstawieniaStrony witryna={W} nazwa="DA" sezonowa pierwsza={false} ostatnia={false} />)
    await act(async () => fireEvent.click(screen.getByRole('checkbox', { name: /Sezonowa/ })))
    expect(ustaw).toHaveBeenCalledWith(W, { sezonowa: false })
    expect(screen.getByRole('alert')).toHaveTextContent('Strony chwilowo niedostępne')
  })
})
