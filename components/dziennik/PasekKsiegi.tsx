'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { dzisWarszawa } from '@/lib/czas'
import { klientDziennika } from '@/lib/dziennik/klient'
import type { Ksiega } from '@/lib/dziennik/typy'
import { PRZYCISK, PRZYCISK_CICHY, PRZYCISK_GROZNY } from './style'

const dwie = (n: number) => String(n).padStart(2, '0')
const data = (ms: number) => {
  const d = dzisWarszawa(new Date(ms))
  return `${dwie(d.dzien)}.${dwie(d.miesiac)}.${d.rok}`
}

/** Nagłówek księgi: kto ją teraz prowadzi, kopia na Dysku i przekazanie następcy. */
export function PasekKsiegi({ ksiega, onZmiana }: { ksiega: Ksiega; onZmiana: () => void }) {
  const biezaca = ksiega.kadencje.find((k) => k.id === ksiega.otwartaKadencjaId) ?? null
  const [pytam, setPytam] = useState(false)
  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  async function wykonaj(f: () => Promise<{ link: string }>) {
    setTrwa(true)
    setBlad(null)
    setLink(null)
    try {
      setLink((await f()).link)
      setPytam(false)
      onZmiana()
    } catch (e) {
      setBlad((e as Error).message)
      setPytam(false)
    } finally {
      setTrwa(false)
    }
  }

  const ostatnia = [...ksiega.kadencje].filter((k) => k.kopia).sort((a, b) => b.kopia!.kiedy - a.kopia!.kiedy)[0]?.kopia ?? null

  return (
    <header className="mb-4 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted transition hover:text-deck-text">
            <ArrowLeft size={12} /> DECK
          </Link>
          <h1 className="text-lg font-semibold text-deck-text">Dziennik Stratega</h1>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted/70">
            {biezaca ? `kadencja ${biezaca.nazwa} · ${biezaca.autor}` : 'brak otwartej kadencji'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ostatnia && (
            <a href={ostatnia.link} target="_blank" rel="noopener noreferrer" className="font-mono text-[10.5px] text-deck-muted underline-offset-2 hover:text-deck-text hover:underline">
              Ostatnia kopia: {data(ostatnia.kiedy)}
            </a>
          )}
          <button type="button" className={PRZYCISK_CICHY} disabled={trwa} onClick={() => wykonaj(klientDziennika.kopia)}>
            {trwa && !pytam ? 'Zapisuję…' : 'Zapisz kopię'}
          </button>
          {biezaca && (
            <button type="button" className={PRZYCISK} disabled={trwa} onClick={() => setPytam(true)}>
              Przekaż księgę
            </button>
          )}
        </div>
      </div>

      {pytam && biezaca && (
        <div role="dialog" aria-label="Przekazanie księgi" className="rounded-xl border border-deck-danger-border bg-deck-danger-bg p-4 text-[13px] text-deck-text">
          <p>
            Księga zostanie zapisana na Dysku, a kadencja {biezaca.nazwa} zamknięta. Jej wpisów nie będzie można już zmieniać - tylko komentować. Tego nie da się cofnąć.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={PRZYCISK_GROZNY} disabled={trwa} onClick={() => wykonaj(() => klientDziennika.przekaz(biezaca.id))}>
              {trwa ? 'Przekazuję…' : 'Przekaż'}
            </button>
            <button type="button" className={PRZYCISK_CICHY} disabled={trwa} onClick={() => setPytam(false)}>
              Anuluj
            </button>
          </div>
        </div>
      )}

      {blad && (
        <p role="alert" className="rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger">
          {blad}. Możesz też{' '}
          <a href="/api/dziennik/kopia" className="underline underline-offset-2">pobrać plik</a>.
        </p>
      )}
      {link && (
        <p role="status" className="text-[12.5px] text-deck-accent">
          <a href={link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Kopia na Dysku</a> zapisana.
        </p>
      )}
    </header>
  )
}
