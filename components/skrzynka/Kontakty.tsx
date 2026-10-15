'use client'
import { useEffect, useState } from 'react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import type { KartaKontaktu, StronaKontaktow } from '@/lib/skrzynka/typy'
import { useTeraz } from '@/lib/useTeraz'
import { WierszSprawy } from './WierszSprawy'

/** Zakładka Kontakty: lista osób stronami, a po kliknięciu karta osoby z jej sprawami. Sprawa otwiera się obok. */
export function Kontakty({ wybrana, onWybierz }: { wybrana: string | null; onWybierz: (id: string) => void }) {
  const teraz = useTeraz(60_000)
  const [strona, setStrona] = useState<StronaKontaktow | null>(null)
  const [karta, setKarta] = useState<KartaKontaktu | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [laduje, setLaduje] = useState(false)

  useEffect(() => {
    let aktywny = true
    klientSkrzynki
      .kontakty(null)
      .then((s) => {
        if (aktywny) setStrona(s)
      })
      .catch((e: Error) => {
        if (aktywny) setBlad(e.message)
      })
    return () => {
      aktywny = false
    }
  }, [])

  async function wczytaj<T>(f: () => Promise<T>, po: (x: T) => void) {
    setLaduje(true)
    setBlad(null)
    try {
      po(await f())
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setLaduje(false)
    }
  }

  const alert = blad && <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p>

  if (karta) {
    const k = karta.kontakt
    return (
      <section aria-label={`Kontakt: ${k.email}`} className="space-y-2 text-[12.5px]">
        <button type="button" onClick={() => setKarta(null)} className="text-[11.5px] text-deck-muted hover:underline">
          ← Kontakty
        </button>
        <h3 className="text-[14px] font-semibold text-deck-text">{k.imie || k.email}</h3>
        <p className="text-deck-muted">
          {k.email}
          {k.organizacja && ` · ${k.organizacja}`}
          {k.typ === 'student' && ' · student'}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-deck-muted">Sprawy: {karta.sprawy.length}</p>
        <ul aria-label="Sprawy osoby" className="space-y-1.5">
          {karta.sprawy.map((s) => (
            <WierszSprawy key={s.id} s={s} teraz={teraz} wybrana={s.id === wybrana} onWybierz={onWybierz} zStatusem />
          ))}
        </ul>
        {alert}
      </section>
    )
  }

  if (!strona) return alert || <p className="font-mono text-[11px] text-deck-muted">Wczytuję kontakty…</p>
  if (!strona.kontakty.length) return <p className="text-[12.5px] text-deck-muted">Brak kontaktów - pojawią się po imporcie skrzynki.</p>

  return (
    <div className="space-y-2">
      <ul aria-label="Kontakty" className="space-y-1">
        {strona.kontakty.map((k) => (
          <li key={k.email}>
            <button
              type="button"
              disabled={laduje}
              onClick={() => wczytaj(() => klientSkrzynki.kontakt(k.email), setKarta)}
              className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-[12px] transition hover:bg-white/[0.06]"
            >
              <span className="text-deck-text">{k.imie || k.email}</span>
              <span className="text-deck-muted">
                {k.imie && ` · ${k.email}`}
                {k.organizacja && ` · ${k.organizacja}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {alert}
      {strona.nastepna && (
        <button
          type="button"
          disabled={laduje}
          onClick={() =>
            wczytaj(
              () => klientSkrzynki.kontakty(strona.nastepna),
              (s) => setStrona({ kontakty: [...strona.kontakty, ...s.kontakty], nastepna: s.nastepna }),
            )
          }
          className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50"
        >
          Pokaż więcej
        </button>
      )}
    </div>
  )
}
