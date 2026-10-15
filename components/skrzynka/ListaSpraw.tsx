'use client'
import { useEffect, useState } from 'react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import type { Status, StronaSpraw } from '@/lib/skrzynka/typy'
import { useTeraz } from '@/lib/useTeraz'
import { WierszSprawy } from './WierszSprawy'

/**
 * Jedna zakładka albo wyniki wyszukiwania. Stan zaczyna się od zera przy
 * zmianie zakładki, bo rodzic podaje `key` - tu tylko wczytujemy.
 * `wersja` rośnie po zmianie sprawy i wymusza ponowne wczytanie.
 */
export function ListaSpraw({ status, szukane, wybrana, onWybierz, wersja, onZmiana }: {
  status: Status
  szukane: string
  wybrana: string | null
  onWybierz: (id: string) => void
  wersja: number
  /** Po szybkiej zmianie statusu z listy - rodzic odświeża liczby. */
  onZmiana?: () => void
}) {
  const teraz = useTeraz(60_000)
  const [strona, setStrona] = useState<StronaSpraw | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [laduje, setLaduje] = useState(false)

  useEffect(() => {
    let aktywny = true
    ;(szukane ? klientSkrzynki.szukaj(szukane) : klientSkrzynki.sprawy(status, null))
      .then((s) => {
        if (!aktywny) return
        setStrona(s)
        setBlad(null)
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
      setBlad(null)
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

  /** Do przejrzenia: jednym kliknięciem do odpowiedzi albo do pominiętych - sprawa znika z tej zakładki. */
  async function przenies(id: string, s: Status) {
    try {
      await klientSkrzynki.zmien(id, { status: s })
      setStrona((st) => st && { ...st, sprawy: st.sprawy.filter((x) => x.id !== id) })
      onZmiana?.()
    } catch (e) {
      setBlad((e as Error).message)
    }
  }

  const alert = blad && <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p>
  if (!strona) return alert || <p className="font-mono text-[11px] text-deck-muted">Wczytuję sprawy…</p>
  if (!strona.sprawy.length) {
    return <p className="text-[12.5px] text-deck-muted">{szukane ? 'Nic nie znaleziono.' : 'Brak spraw w tej zakładce.'}</p>
  }

  const szybkie = status === 'do-przejrzenia' && !szukane
  const maly = 'deck-chip rounded-md px-2 py-0.5 text-[10.5px] transition hover:text-deck-text'

  return (
    <div className="space-y-2">
      <ul aria-label="Sprawy" className="space-y-1.5">
        {strona.sprawy.map((s) => (
          <WierszSprawy
            key={s.id}
            s={s}
            teraz={teraz}
            wybrana={s.id === wybrana}
            onWybierz={wybierz}
            akcje={
              szybkie && (
                <>
                  <button type="button" aria-label={`Do odpowiedzi: ${s.temat}`} onClick={() => przenies(s.id, 'do-odpowiedzi')} className={maly}>
                    Do odpowiedzi
                  </button>
                  <button type="button" aria-label={`Pomiń: ${s.temat}`} onClick={() => przenies(s.id, 'pominieta')} className={maly}>
                    Pomiń
                  </button>
                </>
              )
            }
          />
        ))}
      </ul>
      {alert}
      {strona.nastepna && (
        <button type="button" onClick={wiecej} disabled={laduje} className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
          Pokaż więcej
        </button>
      )}
    </div>
  )
}
