import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { Radar } from './Radar'
import { planDnia } from '@/lib/orbita/zapas'
import { DZIS, etap, zadanie } from './test-dane'

const spoznione = zadanie('A', '2026-11-25', [etap({ dni: 10 })])
const luz = zadanie('B', '2027-02-01', [etap({ dni: 3 })])
const czeka = zadanie('C', '2027-02-01', [etap({ zamkniety: 1 }), etap({ rodzaj: 'czekanie', czekamDo: '2026-11-28' })])
const zamkniete = zadanie('D', null, [etap({ zamkniety: 1 })], { zamkniete: 1 })

describe('Radar', () => {
  it('punkt na każde otwarte zadanie, spóźnione alarmowe, czekające puste, klik wybiera', () => {
    const onWybierz = vi.fn()
    const { container } = render(<Radar plan={planDnia([spoznione, luz, czeka, zamkniete], DZIS)} dzis={DZIS} onWybierz={onWybierz} />)
    const punkty = [...container.querySelectorAll('[data-zadanie]')]
    expect(punkty.map((p) => p.getAttribute('data-zadanie')).sort()).toEqual(['A', 'B', 'C'])
    const a = container.querySelector('[data-zadanie="A"] circle')!
    expect(a.getAttribute('class')).toContain('deck-danger')
    const c = container.querySelector('[data-zadanie="C"] circle')!
    expect(c.getAttribute('fill')).toBe('none')
    fireEvent.click(container.querySelector('[data-zadanie="B"]')!)
    expect(onWybierz).toHaveBeenCalledWith('B')
  })
})
