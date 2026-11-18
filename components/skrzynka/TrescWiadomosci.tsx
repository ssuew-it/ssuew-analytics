'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { bezpiecznyHtml, zewnetrzneObrazki } from '@/lib/skrzynka/html'
import type { WiadomoscPelna } from '@/lib/skrzynka/typy'
import { adresZalacznika } from '@/lib/skrzynka/widok'

const MIN_WYSOKOSC = 80
const RAMKA_PX = 2
/** Obrazki z sieci doczytują się po `load` ramki - mierzymy jeszcze raz chwilę później. */
const POMIARY_PO_MS = [400, 1500, 4000]

/**
 * HTML maila w ramce bez skryptów (`allow-same-origin` bez `allow-scripts` -
 * treść nic nie wykona, a D.E.C.K. może zmierzyć jej wysokość i wysłać ciasteczko
 * po obrazki wklejone w treść). Linki otwierają się w nowej karcie. Obrazki z
 * internetu dopiero po „Pokaż obrazki” - mogą zdradzić nadawcy, że mail został otwarty.
 */
export function TrescWiadomosci({ w, sprawaId }: { w: WiadomoscPelna; sprawaId: string }) {
  const [zSieci, setZSieci] = useState(false)
  const [wysokosc, setWysokosc] = useState(240)
  const ref = useRef<HTMLIFrameElement>(null)

  const srcDoc = useMemo(() => {
    if (!w.html) return ''
    // Treść wczytuje się w przeglądarce po pobraniu wątku - `window` już jest.
    const zrodlo = typeof window === 'undefined' ? '' : window.location.origin
    const obrazki: Record<string, string> = { ...w.wbudowane }
    for (const z of w.zalaczniki) if (z.cid) obrazki[z.cid] = `${zrodlo}${adresZalacznika(sprawaId, z)}`
    return bezpiecznyHtml(w.html, { obrazki, zrodlo, zSieci })
  }, [w, sprawaId, zSieci])

  const zmierz = useCallback(() => {
    const doc = ref.current?.contentDocument
    if (!doc?.documentElement) return
    // + obramowanie ramki (2 × 1 px) - bez tego zostaje cienki pasek przewijania.
    setWysokosc(Math.max(MIN_WYSOKOSC, doc.documentElement.scrollHeight + RAMKA_PX))
  }, [])

  /** Po wczytaniu i przy każdym doczytanym obrazku ramka rośnie do treści - bez drugiego paska przewijania. */
  const poWczytaniu = useCallback(() => {
    zmierz()
    for (const ms of POMIARY_PO_MS) setTimeout(zmierz, ms)
    const doc = ref.current?.contentDocument
    if (!doc?.body || typeof ResizeObserver === 'undefined') return
    new ResizeObserver(zmierz).observe(doc.body)
  }, [zmierz])

  if (!w.html) {
    return (
      <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-deck-text">
        {w.tekst ?? '(brak treści)'}
      </pre>
    )
  }

  return (
    <div className="space-y-1.5">
      {!zSieci && zewnetrzneObrazki(w.html) && (
        <p className="flex flex-wrap items-center gap-2 text-[11.5px] text-deck-muted">
          <ImageOff size={12} aria-hidden="true" />
          Obrazki z internetu są ukryte - mogą zdradzić nadawcy, że mail został otwarty.
          <button type="button" onClick={() => setZSieci(true)} className="text-deck-accent hover:underline">
            Pokaż obrazki
          </button>
        </p>
      )}
      <iframe
        ref={ref}
        title={`Treść: ${w.temat || 'wiadomość'}`}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        onLoad={poWczytaniu}
        data-bez-crt=""
        style={{ height: wysokosc }}
        className="w-full rounded-md border border-white/10 bg-white"
      />
    </div>
  )
}
