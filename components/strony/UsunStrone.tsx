'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { klientStron } from '@/lib/strony/klient'
import type { WpisStrony } from '@/lib/strony/model'

export function UsunStrone({ witryna, nazwa }: WpisStrony) {
  const router = useRouter()
  const [pyta, setPyta] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)

  async function usun() {
    setBlad(null)
    try {
      await klientStron.usun(witryna)
      router.refresh()
    } catch (e) {
      setBlad((e as Error).message)
      setPyta(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
      {blad && <span role="alert" className="text-deck-danger">{blad}</span>}
      {pyta ? (
        <>
          <span className="text-deck-muted">Usunąć {nazwa} z listy?</span>
          <button type="button" onClick={usun} className="text-deck-danger hover:underline">
            Tak, usuń
          </button>
          <button type="button" onClick={() => setPyta(false)} className="text-deck-muted hover:underline">
            Nie
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setPyta(true)}
          className="inline-flex items-center gap-1 text-deck-muted transition hover:text-deck-danger"
        >
          <Trash2 size={12} aria-hidden="true" /> Usuń z listy
        </button>
      )}
    </div>
  )
}
