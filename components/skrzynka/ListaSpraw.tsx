'use client'
import { useEffect, useState } from 'react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { poTerminie } from '@/lib/skrzynka/statusy'
import { kiedyKrotko } from '@/lib/skrzynka/widok'
import type { Status, StronaSpraw } from '@/lib/skrzynka/typy'
import { useTeraz } from '@/lib/useTeraz'

/**
 * Jedna zakładka albo wyniki wyszukiwania. Stan zaczyna się od zera przy
 * zmianie zakładki, bo rodzic podaje `key` - tu tylko wczytujemy.
 * `wersja` rośnie po zmianie sprawy i wymusza ponowne wczytanie.
 */
export function ListaSpraw({ status, szukane, wybrana, onWybierz, wersja }: {
  status: Status
  szukane: string
  wybrana: string | null
  onWybierz: (id: string) => void
  wersja: number
}) {
  const teraz = useTeraz(60_000)
  const [strona, setStrona] = useState<StronaSpraw | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [laduje, setLaduje] = useState(false)

  useEffect(() => {
    let aktywny = true
    ;(szukane ? klientSkrzynki.szukaj(szukane) : klientSkrzynki.sprawy(status, null))
      .then((s) => {
        if (aktywny) setStrona(s)
      })
      .catch((e: Error) => {
        if (aktywny) setBlad(e.message)
      })
    return () => {
      aktywny = false
    }
  }, [status, szukane, wersja])

  async function wiecej() {
    if (!strona?.nastepna) return
    setLaduje(true)
    try {
      const s = await klientSkrzynki.sprawy(status, strona.nastepna)
      setStrona({ sprawy: [...strona.sprawy, ...s.sprawy], nastepna: s.nastepna })
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setLaduje(false)
    }
  }

  function wybierz(id: string) {
    // Znacznik „nowa” znika od razu - serwer zdejmie go przy otwarciu.
    setStrona((s) => s && { ...s, sprawy: s.sprawy.map((x) => (x.id === id ? { ...x, nowa: false } : x)) })
    onWybierz(id)
  }

  if (blad) return <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p>
  if (!strona) return <p className="font-mono text-[11px] text-deck-muted">Wczytuję sprawy…</p>
  if (!strona.sprawy.length) {
    return <p className="text-[12.5px] text-deck-muted">{szukane ? 'Nic nie znaleziono.' : 'Brak spraw w tej zakładce.'}</p>
  }

  return (
    <div className="space-y-2">
      <ul aria-label="Sprawy" className="space-y-1.5">
        {strona.sprawy.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => wybierz(s.id)}
              aria-pressed={s.id === wybrana}
              className={`w-full rounded-md border px-3 py-2 text-left transition ${
                s.id === wybrana ? 'border-deck-accent/50 bg-deck-accent/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className={`truncate ${s.nowa ? 'font-semibold text-deck-text' : 'text-deck-text'}`}>
                  {s.kontakt ?? '(bez nadawcy)'}
                  {s.organizacja && <span className="font-normal text-deck-muted"> · {s.organizacja}</span>}
                </span>
                <span className="flex-none font-mono text-[10.5px] text-deck-muted">{kiedyKrotko(s.ostatnia.kiedy, teraz)}</span>
              </div>
              <div className="truncate text-[12.5px] text-deck-text">{s.temat}</div>
              <div className="truncate text-[11.5px] text-deck-muted">{s.ostatnia.fragment}</div>
              {(poTerminie(s.oczekujeOd, teraz) || s.nowa || s.przypisana) && (
                <div className="mt-1 flex flex-wrap gap-2 font-mono text-[9.5px] uppercase tracking-[0.12em]">
                  {poTerminie(s.oczekujeOd, teraz) && <span className="text-deck-danger">po terminie</span>}
                  {s.nowa && <span className="text-deck-accent">nowa</span>}
                  {s.przypisana && <span className="text-deck-muted">{s.przypisana}</span>}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
      {strona.nastepna && (
        <button type="button" onClick={wiecej} disabled={laduje} className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
          Pokaż więcej
        </button>
      )}
    </div>
  )
}
