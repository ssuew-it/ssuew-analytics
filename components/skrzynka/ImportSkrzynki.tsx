'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { klientSkrzynki } from '@/lib/skrzynka/klient'

/** Strona to ok. 1000 jednostek Gmaila; co 6 s daje 10 000 na minutę przy limicie 15 000 - zapas na bieżącą synchronizację. */
export const ODSTEP_STRON_MS = 6_000
/** Limit Gmaila liczy się na minutę - po minucie import rusza sam. */
export const PRZERWA_LIMITU_MS = 60_000
const czekaj = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Import 12 miesięcy prowadzi przeglądarka, strona po stronie - żadne
 * wywołanie serwera nie trwa długo. Po błędzie albo zamknięciu karty rusza
 * od strony, na której stanął: powtarzanie całości zjadałoby limit Gmaila
 * i dzienny budżet zapisów Firestore.
 */
export function ImportSkrzynki({ start }: { start: { zrobione: number; razem: number; strona: string | null } }) {
  const router = useRouter()
  const [postep, setPostep] = useState({ zrobione: start.zrobione, razem: start.razem })
  const strona = useRef<string | null>(start.strona)
  const [blad, setBlad] = useState<string | null>(null)
  const [proba, setProba] = useState(0)
  const [gotowe, setGotowe] = useState(false)
  const [limit, setLimit] = useState(false)

  useEffect(() => {
    let aktywny = true
    void (async () => {
      try {
        do {
          const poczatek = Date.now()
          const w = await klientSkrzynki.importuj(strona.current)
          if (!aktywny) return
          setPostep({ zrobione: w.zrobione, razem: w.razem })
          strona.current = w.nastepnaStrona
          if (strona.current) await czekaj(Math.max(0, ODSTEP_STRON_MS - (Date.now() - poczatek)))
          if (!aktywny) return
        } while (strona.current)
        setGotowe(true)
      } catch (e) {
        if (!aktywny) return
        if ((e as { status?: number }).status === 429) {
          setLimit(true)
          await czekaj(PRZERWA_LIMITU_MS)
          if (!aktywny) return
          setLimit(false)
          setProba((p) => p + 1)
          return
        }
        setBlad((e as Error).message)
      }
    })()
    return () => {
      aktywny = false
    }
    // Tylko `proba`: import nie może ruszać od nowa przy każdym nowym renderze rodzica.
  }, [proba])

  useEffect(() => {
    if (gotowe) router.refresh()
  }, [gotowe, router])

  const procent = postep.razem ? Math.min(100, Math.round((postep.zrobione / postep.razem) * 100)) : 0
  return (
    <section aria-label="Import skrzynki" className="deck-card space-y-3 rounded-lg p-5 text-[12.5px]">
      <p className="font-semibold text-deck-text">Importuję {postep.zrobione} z ok. {postep.razem} wątków</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="deck-meter-fill h-full" style={{ width: `${procent}%` }} />
      </div>
      <p className="text-deck-muted">Ostatnie 12 miesięcy. Wątki starsze niż 30 dni trafiają od razu do archiwum. Nie zamykaj tej karty.</p>
      {limit && (
        <p role="status" className="text-deck-warn">Gmail chwilowo ogranicza tempo - wznowię import za minutę.</p>
      )}
      {blad && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-deck-danger">{blad}</p>
          <button
            type="button"
            onClick={() => {
              setBlad(null)
              setProba((p) => p + 1)
            }}
            className="deck-button rounded-md px-3 py-1 text-[11.5px]"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}
    </section>
  )
}
