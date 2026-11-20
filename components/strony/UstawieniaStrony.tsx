'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { klientStron } from '@/lib/strony/klient'

const PRZYCISK = 'inline-flex items-center gap-1 text-deck-muted transition hover:text-deck-text disabled:opacity-30 disabled:hover:text-deck-muted'

/** Kolejność zakładek i oznaczenie strony sezonowej - obok „Usuń z listy”. */
export function UstawieniaStrony({ witryna, nazwa, sezonowa, pierwsza, ostatnia }: {
  witryna: string
  nazwa: string
  sezonowa: boolean
  pierwsza: boolean
  ostatnia: boolean
}) {
  const router = useRouter()
  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)

  async function zmien(zmiana: { przesun: -1 | 1 } | { sezonowa: boolean }) {
    setTrwa(true)
    setBlad(null)
    try {
      await klientStron.ustaw(witryna, zmiana)
      router.refresh()
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  return (
    <div className="space-y-1 text-[11.5px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-deck-muted">Kolejność {nazwa}:</span>
        <button type="button" className={PRZYCISK} disabled={trwa || pierwsza} onClick={() => zmien({ przesun: -1 })}>
          <ArrowLeft size={12} aria-hidden="true" /> Wcześniej
        </button>
        <button type="button" className={PRZYCISK} disabled={trwa || ostatnia} onClick={() => zmien({ przesun: 1 })}>
          Później <ArrowRight size={12} aria-hidden="true" />
        </button>
        <label className="inline-flex items-center gap-1.5 text-deck-text">
          <input
            type="checkbox"
            className="accent-[var(--color-deck-accent)]"
            checked={sezonowa}
            disabled={trwa}
            onChange={(e) => zmien({ sezonowa: e.target.checked })}
          />
          Sezonowa
        </label>
      </div>
      <p className="text-deck-muted">Sezonowa strona ma swoją zakładkę, ale nie liczy się do sumy, kafelka w kokpicie ani alertów.</p>
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}
    </div>
  )
}
