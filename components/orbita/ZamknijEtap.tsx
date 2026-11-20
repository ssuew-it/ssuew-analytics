'use client'
import { useState } from 'react'
import { klientOrbity } from '@/lib/orbita/klient'
import { LIMITY, type Zadanie } from '@/lib/orbita/typy'
import { POLE, PRZYCISK, PRZYCISK_CICHY } from '@/components/dziennik/style'

/** Zamknięcie etapu z wynikiem - wynik trafia do wstępu kolejnych etapów. */
export function ZamknijEtap({ zadanie, etapId, onGotowe, onAnuluj }: {
  zadanie: Zadanie
  etapId: string
  onGotowe: () => void
  onAnuluj: () => void
}) {
  const [wynik, setWynik] = useState('')
  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)

  async function zamknij() {
    setTrwa(true)
    setBlad(null)
    try {
      await klientOrbity.zamknij(zadanie.id, etapId, wynik)
      onGotowe()
    } catch (e) {
      setBlad((e as Error).message)
      setTrwa(false)
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-white/10 p-3">
      <label className="block text-[12px] text-deck-muted">
        Wynik
        <textarea
          className={`${POLE} mt-1 min-h-20`}
          value={wynik}
          maxLength={LIMITY.wynik}
          placeholder="Link do projektu, krótkie ustalenia"
          onChange={(e) => setWynik(e.target.value)}
        />
      </label>
      <p className="text-right font-mono text-[10px] text-deck-muted">{wynik.length} / {LIMITY.wynik}</p>
      {blad && <p role="alert" className="text-[12px] text-deck-danger">{blad}</p>}
      <div className="flex gap-2">
        <button type="button" className={PRZYCISK} disabled={trwa} onClick={zamknij}>Zamknij</button>
        <button type="button" className={PRZYCISK_CICHY} disabled={trwa} onClick={onAnuluj}>Anuluj</button>
      </div>
    </div>
  )
}
