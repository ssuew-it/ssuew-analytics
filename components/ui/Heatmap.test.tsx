import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Heatmap } from '@/components/ui/Heatmap'
import type { CorrCell } from '@/lib/stats'

describe('Heatmap', () => {
  it('renderuje wartości r komórek', () => {
    const cells: CorrCell[] = [
      { a: 'x', b: 'x', r: 1, significant: true },
      { a: 'x', b: 'y', r: 0.5, significant: false },
      { a: 'y', b: 'x', r: 0.5, significant: false },
      { a: 'y', b: 'y', r: 1, significant: true },
    ]
    render(<Heatmap vars={['x', 'y']} cells={cells} />)
    expect(screen.getAllByText('0,50').length).toBeGreaterThan(0)
  })
})
