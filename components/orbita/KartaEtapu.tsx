'use client'
import { useState } from 'react'
import { opisZapasu } from '@/lib/orbita/format'
import { wstepDoClaude } from '@/lib/orbita/wstep'
import type { PozycjaDnia } from '@/lib/orbita/zapas'
import { PRZYCISK, PRZYCISK_CICHY } from '@/components/dziennik/style'
import { ZamknijEtap } from './ZamknijEtap'

/** Karta bieżącego etapu: od czego zacząć, kopiowanie wstępu do Claude, zamknięcie. */
export function KartaEtapu({ pozycja, odswiez }: { pozycja: PozycjaDnia; odswiez: () => void }) {
  const { zadanie: z, etap: k, zapas, poCzekaniu } = pozycja
  const e = z.etapy[k]
  const [skopiowano, setSkopiowano] = useState(false)
  const [doRecznego, setDoRecznego] = useState<string | null>(null)
  const [zamykam, setZamykam] = useState(false)

  async function kopiuj() {
    const tekst = wstepDoClaude(z)
    try {
      if (!navigator.clipboard) throw new Error('brak schowka')
      await navigator.clipboard.writeText(tekst)
      setSkopiowano(true)
      setDoRecznego(null)
    } catch {
      // Schowek bywa zablokowany - tekst do ręcznego skopiowania.
      setDoRecznego(tekst)
    }
  }

  return (
    <article className="deck-chip rounded-xl px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[14px] font-medium text-deck-text">
          {z.tytul}
          {z.zrodlo && <>{' '}<span className="text-deck-muted">(z Dziennika)</span></>}
          {' '}<span className="text-deck-muted">· etap {k + 1}/{z.etapy.length} {e.nazwa}</span>
        </h3>
        <span className={`font-mono text-[11px] ${zapas < 0 ? 'text-deck-danger' : 'text-deck-accent'}`}>{opisZapasu(zapas)}</span>
      </div>
      {poCzekaniu && <p className="mt-1 text-[12px] text-deck-warn">Termin konsultacji minął - zamknij etap albo przedłuż</p>}
      {e.cel && <p className="mt-1 text-[12.5px] text-deck-muted">Cel: {e.cel}</p>}
      {e.zacznijOd && <p className="text-[12.5px] text-deck-muted">Zacznij od: {e.zacznijOd}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={PRZYCISK} onClick={kopiuj}>Kopiuj do Claude</button>
        <button type="button" className={PRZYCISK_CICHY} onClick={() => setZamykam(true)} disabled={zamykam}>Zamknij etap</button>
        {skopiowano && <span role="status" className="text-[12px] text-deck-accent">Skopiowano - wklej w Claude</span>}
      </div>
      {doRecznego !== null && (
        <div className="mt-3">
          <p className="text-[12px] text-deck-muted">Schowek niedostępny - zaznacz tekst i skopiuj ręcznie:</p>
          <textarea
            readOnly
            className="mt-1 h-40 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 font-mono text-[11px] text-deck-text"
            value={doRecznego}
            onFocus={(x) => x.currentTarget.select()}
            autoFocus
          />
        </div>
      )}
      {zamykam && (
        <ZamknijEtap
          zadanie={z}
          etapId={e.id}
          onAnuluj={() => setZamykam(false)}
          onGotowe={() => {
            setZamykam(false)
            odswiez()
          }}
        />
      )}
    </article>
  )
}
