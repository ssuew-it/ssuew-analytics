'use client'
import { useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { rozmiar } from '@/lib/skrzynka/widok'
import { MAKS_ZALACZNIKOW, type Sprawa } from '@/lib/skrzynka/typy'

/**
 * Odpowiedź w wątku z kontakt@. Błąd wysyłki zostawia tekst i załączniki -
 * nic nie trzeba pisać od nowa. Limit 4 MB sprawdzany tu i na serwerze.
 */
export function OknoOdpowiedzi({ sprawaId, adresat, stopka, onWyslano }: {
  sprawaId: string
  adresat: string | null
  stopka: string
  onWyslano: (s: Sprawa) => void
}) {
  const [tekst, setTekst] = useState('')
  const [pliki, setPliki] = useState<File[]>([])
  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const wybor = useRef<HTMLInputElement>(null)
  const razem = pliki.reduce((s, p) => s + p.size, 0)
  const zaDuzo = razem > MAKS_ZALACZNIKOW

  if (!adresat) return <p className="text-[12px] text-deck-muted">W tym wątku nie ma do kogo odpowiedzieć - napisz z Gmaila.</p>

  async function wyslij() {
    setTrwa(true)
    setBlad(null)
    try {
      const s = await klientSkrzynki.odpowiedz(sprawaId, tekst, pliki)
      setTekst('')
      setPliki([])
      onWyslano(s)
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  const przycisk = 'deck-chip inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] transition hover:text-deck-text disabled:opacity-50'

  return (
    <section aria-label="Odpowiedź" className="space-y-2 rounded-md border border-white/10 p-3 text-[12px]">
      <p className="text-deck-muted">
        Do: <span className="text-deck-text">{adresat}</span>
      </p>
      <textarea
        aria-label="Treść odpowiedzi"
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={6}
        className="deck-input w-full rounded-md px-2.5 py-2 text-[12.5px] leading-relaxed"
      />
      <input
        ref={wybor}
        type="file"
        multiple
        hidden
        aria-label="Wybierz pliki"
        onChange={(e) => {
          const nowe = [...(e.target.files ?? [])]
          setPliki((l) => [...l, ...nowe])
          // Ten sam plik wybrany drugi raz też ma wywołać zmianę.
          e.target.value = ''
        }}
      />
      {pliki.length > 0 && (
        <>
          <ul aria-label="Załączniki odpowiedzi" className="flex flex-wrap gap-1.5">
            {pliki.map((p, i) => (
              <li key={`${p.name}-${i}`} className="deck-chip inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]">
                {p.name} · {rozmiar(p.size)}
                <button type="button" aria-label={`Usuń ${p.name}`} onClick={() => setPliki((l) => l.filter((_, j) => j !== i))}>
                  <X size={11} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <p className={zaDuzo ? 'text-deck-danger' : 'text-deck-muted'}>
            Załączniki: {rozmiar(razem)} z 4 MB{zaDuzo ? ' - za dużo, usuń część plików' : ''}
          </p>
        </>
      )}
      {stopka && (
        <pre aria-label="Stopka" className="whitespace-pre-wrap font-sans text-[11.5px] text-deck-muted">
          {stopka}
        </pre>
      )}
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => wybor.current?.click()} disabled={trwa} className={przycisk}>
          <Paperclip size={12} aria-hidden="true" />
          Dodaj załączniki
        </button>
        <button type="button" onClick={wyslij} disabled={trwa || !tekst.trim() || zaDuzo} className={przycisk}>
          <Send size={12} aria-hidden="true" />
          {trwa ? 'Wysyłam…' : 'Wyślij'}
        </button>
      </div>
    </section>
  )
}
