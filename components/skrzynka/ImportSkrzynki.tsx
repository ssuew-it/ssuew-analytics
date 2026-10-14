'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { klientSkrzynki } from '@/lib/skrzynka/klient'

/**
 * Import 12 miesięcy prowadzi przeglądarka, strona po stronie - żadne
 * wywołanie serwera nie trwa długo. Ponowienie zaczyna od początku: zapis
 * jest idempotentny, więc powtórzone strony niczego nie psują.
 */
export function ImportSkrzynki({ start }: { start: { zrobione: number; razem: number } }) {
  const router = useRouter()
  const [postep, setPostep] = useState(start)
  const [blad, setBlad] = useState<string | null>(null)
  const [proba, setProba] = useState(0)
  const [gotowe, setGotowe] = useState(false)

  useEffect(() => {
    let aktywny = true
    void (async () => {
      let strona: string | null = null
      try {
        do {
          const w = await klientSkrzynki.importuj(strona)
          if (!aktywny) return
          setPostep({ zrobione: w.zrobione, razem: w.razem })
          strona = w.nastepnaStrona
        } while (strona)
        if (aktywny) setGotowe(true)
      } catch (e) {
        if (aktywny) setBlad((e as Error).message)
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
