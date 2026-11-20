'use client'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { MatrixRain } from '@/components/deck/MatrixRain'
import { ETYKIETY_DZIALOW } from '@/lib/dziennik/etykiety'
import { klientDziennika } from '@/lib/dziennik/klient'
import { DZIALY, type Dzial, type Ksiega } from '@/lib/dziennik/typy'
import { klientOrbity } from '@/lib/orbita/klient'
import type { ZrodloOtwarte } from '@/lib/orbita/typy'
import type { Data } from '@/lib/planer/trwanie'
import { Dzial as WidokDzialu } from './Dzial'
import { Najblizsze } from './Najblizsze'
import { PasekKsiegi } from './PasekKsiegi'
import { RozpocznijKadencje } from './RozpocznijKadencje'
import { PRZYCISK_CICHY } from './style'

type Klucz = 'najblizsze' | Dzial

export const ZAKLADKI: { klucz: Klucz; etykieta: string }[] = [
  { klucz: 'najblizsze', etykieta: 'Najbliższe' },
  ...DZIALY.map((d) => ({ klucz: d, etykieta: ETYKIETY_DZIALOW[d] })),
]

export type RenderDzial = (dzial: Dzial, ksiega: Ksiega, odswiez: () => void) => ReactNode

export function DziennikClient({ dzis, komunikat, dzialStartowy, renderDzial }: {
  dzis: Data
  /** Powrót ze zgody na Dysk - sukces albo powód porażki. */
  komunikat: string | null
  dzialStartowy: Dzial | null
  renderDzial?: RenderDzial
}) {
  const [ksiega, setKsiega] = useState<Ksiega | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [zakladka, setZakladka] = useState<Klucz>(dzialStartowy ?? 'najblizsze')
  const [zrodla, setZrodla] = useState<ZrodloOtwarte[] | null>(null)

  const odswiez = useCallback(() => {
    // Które obowiązki są już w Orbicie - błąd nie blokuje księgi, przyciski wtedy bez oznaczeń.
    klientOrbity
      .zrodla()
      .then(setZrodla)
      .catch(() => setZrodla(null))
    klientDziennika
      .ksiega()
      .then((k) => {
        setKsiega(k)
        setBlad(null)
      })
      .catch((e: Error) => setBlad(e.message))
  }, [])

  useEffect(odswiez, [odswiez])

  function wybierz(k: Klucz) {
    setZakladka(k)
    // Adres pamięta zakładkę (odświeżenie, link z kokpitu) bez przeładowania strony.
    try {
      const u = new URL(window.location.href)
      if (k === 'najblizsze') u.searchParams.delete('dzial')
      else u.searchParams.set('dzial', k)
      u.searchParams.delete('dysk')
      u.searchParams.delete('blad')
      window.history.replaceState(null, '', u)
    } catch {
      // bez historii zakładka i tak działa
    }
  }

  return (
    <>
      <MatrixRain moc={0.12} />
      <main className="relative z-10 mx-auto w-full max-w-[1360px] p-[clamp(16px,2.4vw,34px)]">
        {ksiega && <PasekKsiegi ksiega={ksiega} onZmiana={odswiez} />}
        {komunikat && (
          <p role="status" className="deck-chip mb-4 rounded-lg px-4 py-3 text-[12.5px] text-deck-text">{komunikat}</p>
        )}

        {blad && !ksiega ? (
          <div className="deck-chip rounded-xl p-4 text-[13px]">
            <p className="text-deck-danger">{blad}</p>
            <button type="button" className={`${PRZYCISK_CICHY} mt-3`} onClick={odswiez}>Spróbuj ponownie</button>
          </div>
        ) : !ksiega ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-deck-muted">Wczytuję księgę…</p>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <nav aria-label="Działy księgi" className="-mx-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:w-52 lg:shrink-0">
              <div role="tablist" aria-orientation="vertical" className="flex gap-1 px-1 lg:flex-col lg:px-0">
                {ZAKLADKI.map((z) => (
                  <button
                    key={z.klucz}
                    type="button"
                    role="tab"
                    aria-selected={zakladka === z.klucz}
                    onClick={() => wybierz(z.klucz)}
                    className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[12.5px] transition ${
                      zakladka === z.klucz ? 'bg-deck-accent/12 text-deck-accent' : 'text-deck-muted hover:bg-white/[0.04] hover:text-deck-text'
                    }`}
                  >
                    {z.etykieta}
                  </button>
                ))}
              </div>
            </nav>
            <section role="tabpanel" className="min-w-0 flex-1">
              {ksiega.otwartaKadencjaId === null && <RozpocznijKadencje ksiega={ksiega} onGotowe={odswiez} />}
              {zakladka === 'najblizsze' ? (
                <Najblizsze ksiega={ksiega} dzis={dzis} onIdzDo={wybierz} zrodla={zrodla} />
              ) : (
                (renderDzial ?? ((d, k, o) => <WidokDzialu key={d} dzial={d} ksiega={k} odswiez={o} dzis={dzis} zrodla={zrodla} />))(zakladka, ksiega, odswiez)
              )}
            </section>
          </div>
        )}
      </main>
    </>
  )
}
