'use client'
import { useEffect, useState } from 'react'
import { MessageSquare, Plus, ChevronDown } from 'lucide-react'
import { CzatRozmowa } from './CzatRozmowa'
import { CzatWatki } from './CzatWatki'
import { CzatNotatki } from './CzatNotatki'

const KLUCZ = 'deck-rozmowa'
type Widok = 'rozmowa' | 'watki' | 'notatki'
const ZAKLADKI: { widok: Widok; etykieta: string }[] = [
  { widok: 'rozmowa', etykieta: 'Rozmowa' },
  { widok: 'watki', etykieta: 'Wątki' },
  { widok: 'notatki', etykieta: 'Notatki' },
]

/** Ostatni wątek tej przeglądarki - sama treść rozmowy jest w bazie. */
function wczytajId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(KLUCZ)
  } catch {
    return null
  }
}

/**
 * „Zapytaj D.E.C.K.” - rozmowy zapisane w bazie, notatki z ustaleniami.
 * `wersja` przemontowuje rozmowę przy zmianie wątku z zewnątrz (nowa,
 * otwarta z listy); id nadane przez serwer w trakcie rozmowy jej nie
 * przemontowuje, żeby nie zgubić propozycji notatki.
 */
export function CzatDeck() {
  const [otwarty, setOtwarty] = useState(false)
  const [widok, setWidok] = useState<Widok>('rozmowa')
  const [rozmowaId, setRozmowaId] = useState<string | null>(wczytajId)
  const [wersja, setWersja] = useState(0)

  useEffect(() => {
    try {
      if (rozmowaId) localStorage.setItem(KLUCZ, rozmowaId)
      else localStorage.removeItem(KLUCZ)
    } catch {
      // Tryb prywatny bez miejsca - po odświeżeniu zacznie się nowa rozmowa.
    }
  }, [rozmowaId])

  function przelacz(id: string | null) {
    setRozmowaId(id)
    setWersja((w) => w + 1)
    setWidok('rozmowa')
  }

  /** Usunięty bieżący wątek (albo wszystkie): zapominamy go, ale zostajemy na liście. */
  function zapomnij(id: string | null) {
    if (id !== null && id !== rozmowaId) return
    setRozmowaId(null)
    setWersja((w) => w + 1)
  }

  return (
    <section className="deck-card rounded-lg">
      <button
        type="button"
        onClick={() => setOtwarty((o) => !o)}
        aria-expanded={otwarty}
        className="flex w-full items-center gap-2.5 px-[18px] py-3 text-left text-[13px] font-semibold text-deck-text"
      >
        <MessageSquare size={15} className="text-deck-accent" aria-hidden="true" />
        Zapytaj D.E.C.K.
        <span className="ml-auto flex items-center gap-1 font-mono text-[10.5px] font-normal text-deck-accent/85">
          {otwarty ? 'zwiń' : 'rozwiń'}
          <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${otwarty ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {otwarty && (
        <div className="border-t border-white/8 px-[18px] pb-[18px]">
          <div className="flex flex-wrap items-center gap-2 py-3">
            <div role="tablist" aria-label="Asystent" className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
              {ZAKLADKI.map((z) => (
                <button
                  key={z.widok}
                  type="button"
                  role="tab"
                  aria-selected={widok === z.widok}
                  onClick={() => setWidok(z.widok)}
                  className={`rounded-md px-2.5 py-1 font-mono text-[10.5px] transition ${
                    widok === z.widok ? 'bg-deck-accent/15 text-deck-accent' : 'text-deck-muted hover:text-deck-text'
                  }`}
                >
                  {z.etykieta}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => przelacz(null)}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 font-mono text-[10.5px] text-deck-muted transition hover:border-deck-accent/40 hover:text-deck-accent"
            >
              <Plus size={11} aria-hidden="true" />
              Nowa rozmowa
            </button>
          </div>

          {widok === 'rozmowa' && <CzatRozmowa key={wersja} poczatkowaId={rozmowaId} onRozmowa={setRozmowaId} />}
          {widok === 'watki' && (
            <CzatWatki aktywna={rozmowaId} onOtworz={przelacz} onUsunieto={zapomnij} />
          )}
          {widok === 'notatki' && <CzatNotatki />}
        </div>
      )}
    </section>
  )
}
