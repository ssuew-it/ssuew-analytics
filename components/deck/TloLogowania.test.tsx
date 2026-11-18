import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SCENY } from '@/lib/deck/ekranLogowania'
import { TloLogowania } from './TloLogowania'

describe('TloLogowania', () => {
  it.each(SCENY)('scena %s: płótno ozdobne, ukryte przed czytnikami', (scena) => {
    const { container } = render(<TloLogowania scena={scena} />)
    const c = container.querySelector('canvas')!
    expect(c.getAttribute('aria-hidden')).toBe('true')
    expect(c.dataset.scena).toBe(scena)
  })
})
