'use client'
import type { KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { KATEGORIE, numerRangi, type Wydarzenie } from '@/lib/planer/typy'
import { opisCzasu, opisMiejsca } from '@/lib/planer/opis'
import type { Odcinek } from '@/lib/planer/pasy'

type Props = {
  odcinek: Odcinek
  /** Wiersz siatki tygodnia: pod numerami dni, każdy pas niżej. */
  wiersz?: number
  onOtworz: (w: Wydarzenie) => void
  przeciagalne: boolean
  onPrzeciagnij?: (id: string) => void
  onPrzesun?: (id: string, oDni: number) => void
  /** Tryb zaznaczania (eksport do CRA): `undefined` = tryb wyłączony. */
  zaznaczone?: boolean
}

/**
 * Wydarzenie wielodniowe jako jeden pasek przez dni, jak w kalendarzu Google.
 * Przeciągnięcie i strzałki przesuwają start; długość zostaje.
 */
export function PasekWielodniowy({ odcinek, wiersz = 1, onOtworz, przeciagalne, onPrzeciagnij, onPrzesun, zaznaczone }: Props) {
  const w = odcinek.wydarzenie
  const s = KATEGORIE[w.kategoria]
  const numer = numerRangi(w.kategoria)
  const pelny = s.ranga === 1
  const opis = [opisCzasu(w), opisMiejsca(w)].filter(Boolean).join(' · ')

  function naKlawisz(e: KeyboardEvent<HTMLButtonElement>) {
    if (!przeciagalne || !onPrzesun) return
    const oDni = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (oDni === undefined) return
    e.preventDefault()
    onPrzesun(w.id, oDni)
  }

  return (
    <button
      type="button"
      data-pasek
      data-ranga={s.ranga}
      aria-pressed={zaznaczone}
      draggable={przeciagalne || undefined}
      onDragStart={przeciagalne ? () => onPrzeciagnij?.(w.id) : undefined}
      onClick={() => onOtworz(w)}
      onKeyDown={naKlawisz}
      title={`${w.tytul}${opis ? `\n${opis}` : ''}`}
      style={{
        // Jawny wiersz: bez niego siatka mogłaby zepchnąć pasek do nowego rzędu.
        gridRow: wiersz,
        gridColumn: `${odcinek.kolOd + 1} / ${odcinek.kolDo + 2}`,
        ...(pelny ? { background: s.obrys } : { background: s.tlo, borderColor: s.obrys }),
      }}
      className={`relative z-10 flex h-[22px] min-w-0 items-center ${odcinek.ciagnieSieZLewej ? '' : 'ml-1'} ${odcinek.ciagnieSieWPrawo ? '' : 'mr-1'} gap-1 border px-1.5 text-left text-[10.5px] transition hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-deck-accent ${
        pelny ? 'border-transparent font-semibold text-deck-bg-deep' : 'text-deck-text'
      } ${odcinek.ciagnieSieZLewej ? '' : 'rounded-l'} ${odcinek.ciagnieSieWPrawo ? '' : 'rounded-r'} ${
        zaznaczone ? 'ring-2 ring-deck-accent' : zaznaczone === false ? 'opacity-60' : ''
      }`}
    >
      {odcinek.ciagnieSieZLewej && <ChevronLeft size={11} aria-label="zaczęło się wcześniej" className="shrink-0" />}
      {numer !== null && <span className="shrink-0 font-mono text-[8.5px] font-bold">{numer}</span>}
      <span className="truncate">{w.tytul}</span>
      {opis && <span className="truncate font-mono text-[9.5px] opacity-75">· {opis}</span>}
      {odcinek.ciagnieSieWPrawo && <ChevronRight size={11} aria-label="trwa dalej" className="ml-auto shrink-0" />}
    </button>
  )
}
