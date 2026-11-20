'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { MatrixRain } from '@/components/deck/MatrixRain'
import { klientOrbity } from '@/lib/orbita/klient'
import { naglowekDnia } from '@/lib/orbita/format'
import type { Zadanie } from '@/lib/orbita/typy'
import { planDnia } from '@/lib/orbita/zapas'
import type { Data } from '@/lib/planer/trwanie'
import { PRZYCISK, PRZYCISK_CICHY } from '@/components/dziennik/style'
import { Dzis } from './Dzis'
import { NoweZadanie } from './FormularzZadania'
import { Lista } from './Lista'

export type Widok = 'dzis' | 'radar' | 'lista'

const WIDOKI: { klucz: Widok; etykieta: string }[] = [
  { klucz: 'dzis', etykieta: 'Dziś' },
  { klucz: 'radar', etykieta: 'Radar' },
  { klucz: 'lista', etykieta: 'Lista' },
]

export type RenderWidok = (widok: Exclude<Widok, 'dzis'>, zadania: Zadanie[], odswiez: () => void) => ReactNode
/** Formularz nowego zadania; `szkicZ` - id wpisu Dziennika, z którego zadanie powstaje. */
export type RenderFormularz = (p: { zDziennika: string | null; onGotowe: () => void; onAnuluj: () => void }) => ReactNode

export function OrbitaClient({ dzis, widok: widokStartowy, zDziennika, renderWidok, renderFormularz }: {
  dzis: Data
  widok: Widok
  zDziennika: string | null
  renderWidok?: RenderWidok
  renderFormularz?: RenderFormularz
}) {
  const [zadania, setZadania] = useState<Zadanie[] | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [widok, setWidok] = useState<Widok>(widokStartowy)
  const [nowe, setNowe] = useState(zDziennika !== null)
  const widokDomyslny: RenderWidok = (_, z, o) => <Lista zadania={z} dzis={dzis} odswiez={o} />
  const formularzDomyslny: RenderFormularz = (p) => <NoweZadanie dzis={dzis} {...p} />
  const pokazWidok = renderWidok ?? widokDomyslny
  const pokazFormularz = renderFormularz ?? formularzDomyslny

  const odswiez = useCallback(() => {
    klientOrbity
      .zadania()
      .then((z) => {
        setZadania(z)
        setBlad(null)
      })
      .catch((e: Error) => setBlad(e.message))
  }, [])

  useEffect(odswiez, [odswiez])

  function wybierz(w: Widok) {
    setWidok(w)
    try {
      const u = new URL(window.location.href)
      if (w === 'dzis') u.searchParams.delete('widok')
      else u.searchParams.set('widok', w)
      window.history.replaceState(null, '', u)
    } catch {
      // bez historii widok i tak działa
    }
  }

  function zamknijFormularz() {
    setNowe(false)
    try {
      const u = new URL(window.location.href)
      u.searchParams.delete('zDziennika')
      window.history.replaceState(null, '', u)
    } catch {
      // jw.
    }
  }

  return (
    <>
      <MatrixRain moc={0.12} />
      <main className="relative z-10 mx-auto w-full max-w-[1100px] p-[clamp(16px,2.4vw,34px)]">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-deck-muted hover:text-deck-text">
              <ArrowLeft size={12} aria-hidden="true" /> DECK
            </Link>
            <h1 className="mt-2 text-[20px] font-semibold text-deck-text">Orbita</h1>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-deck-muted">{naglowekDnia(dzis)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Widok" className="deck-chip flex gap-1 rounded-lg p-1">
              {WIDOKI.map((w) => (
                <button
                  key={w.klucz}
                  type="button"
                  role="tab"
                  aria-selected={widok === w.klucz}
                  onClick={() => wybierz(w.klucz)}
                  className={`rounded-md px-3 py-1 text-[12px] transition ${widok === w.klucz ? 'bg-deck-accent/12 text-deck-accent' : 'text-deck-muted hover:text-deck-text'}`}
                >
                  {w.etykieta}
                </button>
              ))}
            </div>
            <button type="button" className={PRZYCISK} onClick={() => setNowe(true)} disabled={nowe}>+ Zadanie</button>
          </div>
        </header>

        {nowe && <div className="mb-6">{pokazFormularz({ zDziennika, onGotowe: () => { zamknijFormularz(); odswiez() }, onAnuluj: zamknijFormularz })}</div>}

        {blad && !zadania ? (
          <div className="deck-chip rounded-xl p-4 text-[13px]">
            <p className="text-deck-danger">{blad}</p>
            <button type="button" className={`${PRZYCISK_CICHY} mt-3`} onClick={odswiez}>Spróbuj ponownie</button>
          </div>
        ) : !zadania ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-deck-muted">Wczytuję zadania…</p>
        ) : widok === 'dzis' ? (
          <Dzis plan={planDnia(zadania, dzis)} odswiez={odswiez} />
        ) : (
          pokazWidok(widok, zadania, odswiez)
        )}
      </main>
    </>
  )
}
