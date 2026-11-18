import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { WiadomoscPelna } from '@/lib/skrzynka/typy'
import { TrescWiadomosci } from './TrescWiadomosci'

const W = (n: Partial<WiadomoscPelna> = {}): WiadomoscPelna => ({
  id: 'm1', kiedy: 1, od: null, do: [], temat: 'Oferta', tekst: null, html: '<p>Hej</p>', zalaczniki: [], ...n,
})
const ramka = () => screen.getByTitle('Treść: Oferta') as HTMLIFrameElement
const srcdoc = () => ramka().getAttribute('srcdoc') ?? ''

describe('TrescWiadomosci', () => {
  it('ramka bez skryptów, z pomiarem wysokości i bez pasków CRT nad mailem', () => {
    render(<TrescWiadomosci w={W()} sprawaId="t1" />)
    const sandbox = ramka().getAttribute('sandbox') ?? ''
    expect(sandbox).toContain('allow-same-origin')
    expect(sandbox).not.toContain('allow-scripts')
    expect(ramka()).toHaveAttribute('data-bez-crt')
    expect(ramka().className).not.toMatch(/h-\[420px\]/)
  })

  it('obrazki wklejone w treść: adres załącznika w D.E.C.K. i dane wprost', () => {
    render(<TrescWiadomosci sprawaId="t1" w={W({
      html: '<img src="cid:logo@x"><img src="cid:ikona">',
      zalaczniki: [{ id: 'ATT9', wiadomoscId: 'm1', nazwa: 'image001.png', typ: 'image/png', rozmiar: 5000, cid: 'logo@x' }],
      wbudowane: { ikona: 'data:image/gif;base64,R0lG' },
    })} />)
    expect(srcdoc()).toContain(`<img src="${window.location.origin}/api/skrzynka/sprawy/t1/zalacznik/ATT9?w=m1&amp;nazwa=image001.png&amp;typ=image%2Fpng">`.replace(/&amp;/g, '&'))
    expect(srcdoc()).toContain('<img src="data:image/gif;base64,R0lG">')
  })

  it('obrazki z internetu ukryte do kliknięcia „Pokaż obrazki”', () => {
    render(<TrescWiadomosci w={W({ html: '<img src="https://firma.pl/logo.png">' })} sprawaId="t1" />)
    expect(srcdoc()).not.toMatch(/img-src[^;]*https:;/)
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż obrazki' }))
    expect(srcdoc()).toMatch(/img-src[^;]* https: http:;/)
    expect(screen.queryByRole('button', { name: 'Pokaż obrazki' })).not.toBeInTheDocument()
  })

  it('bez obrazków z internetu - bez paska', () => {
    render(<TrescWiadomosci w={W()} sprawaId="t1" />)
    expect(screen.queryByRole('button', { name: 'Pokaż obrazki' })).not.toBeInTheDocument()
  })

  it('sam tekst - bez ramki', () => {
    render(<TrescWiadomosci w={W({ html: null, tekst: 'Dzień dobry' })} sprawaId="t1" />)
    expect(screen.getByText('Dzień dobry')).toBeInTheDocument()
    expect(screen.queryByTitle('Treść: Oferta')).not.toBeInTheDocument()
  })
})
