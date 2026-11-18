'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { DNI_STAREJ, ETYKIETY_STATUSOW, grupyDoOdpowiedzi } from '@/lib/skrzynka/widok'
import type { Sprawa, Status, StronaSpraw } from '@/lib/skrzynka/typy'

/** Dokąd można przenieść zaznaczone sprawy jednym kliknięciem. */
const ZBIORCZO: Status[] = ['zalatwiona', 'pominieta', 'do-przejrzenia']
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
  const [zaznaczone, setZaznaczone] = useState<Set<string>>(new Set())
  const [zmienia, setZmienia] = useState(false)
  const [pokazStarsze, setPokazStarsze] = useState(false)

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

  function przelacz(id: string) {
    setZaznaczone((z) => {
      const n = new Set(z)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  /** Zaznaczone sprawy jednym żądaniem do innej zakładki - np. stare „Do odpowiedzi” do Załatwionych. */
  async function przeniesZaznaczone(s: Status) {
    const ids = strona?.sprawy.filter((x) => zaznaczone.has(x.id)).map((x) => x.id) ?? []
    if (!ids.length) return
    setZmienia(true)
    try {
      await klientSkrzynki.zmienWiele(ids, s)
      setStrona((st) => st && { ...st, sprawy: st.sprawy.filter((x) => !zaznaczone.has(x.id)) })
      setZaznaczone(new Set())
      setBlad(null)
      onZmiana?.()
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setZmienia(false)
    }
  }

  const alert = blad && <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p>
  if (!strona) return alert || <p className="font-mono text-[11px] text-deck-muted">Wczytuję sprawy…</p>
  if (!strona.sprawy.length) {
    return <p className="text-[12.5px] text-deck-muted">{szukane ? 'Nic nie znaleziono.' : 'Brak spraw w tej zakładce.'}</p>
  }

  const szybkie = status === 'do-przejrzenia' && !szukane
  const maly = 'deck-chip rounded-md px-2 py-0.5 text-[10.5px] transition hover:text-deck-text'
  const zZaznaczaniem = !szukane
  const widoczne = strona.sprawy
  const ileZaznaczonych = widoczne.filter((x) => zaznaczone.has(x.id)).length
  const wszystkie = ileZaznaczonych === widoczne.length
  const grupy = status === 'do-odpowiedzi' && !szukane ? grupyDoOdpowiedzi(strona.sprawy, teraz) : null

  const wiersz = (s: Sprawa) => (
    <WierszSprawy
      key={s.id}
      s={s}
      teraz={teraz}
      wybrana={s.id === wybrana}
      onWybierz={wybierz}
      bezTerminu={!!grupy}
      zaznaczenie={zZaznaczaniem ? { zaznaczona: zaznaczone.has(s.id), onPrzelacz: () => przelacz(s.id) } : undefined}
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
  )

  return (
    <div className="space-y-2">
      {zZaznaczaniem && (
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-deck-muted">
          <label className="flex cursor-pointer items-center gap-1.5 px-0.5">
            <input
              type="checkbox"
              aria-label={`Zaznacz wszystkie (${widoczne.length})`}
              checked={wszystkie}
              onChange={() => setZaznaczone(wszystkie ? new Set() : new Set(widoczne.map((x) => x.id)))}
            />
            {ileZaznaczonych ? `Zaznaczone: ${ileZaznaczonych}` : 'Zaznacz wszystkie'}
          </label>
          {ileZaznaczonych > 0 &&
            ZBIORCZO.filter((z) => z !== status).map((z) => (
              <button key={z} type="button" disabled={zmienia} onClick={() => przeniesZaznaczone(z)} className={`${maly} disabled:opacity-50`}>
                {ETYKIETY_STATUSOW[z]} ({ileZaznaczonych})
              </button>
            ))}
        </div>
      )}
      {grupy ? (
        <>
          {grupy.wTerminie.length > 0 && <Grupa tytul="W terminie" ile={grupy.wTerminie.length}>{grupy.wTerminie.map(wiersz)}</Grupa>}
          {grupy.poTerminie.length > 0 && (
            <Grupa tytul="Po terminie" ile={grupy.poTerminie.length} ton="uwaga">
              {grupy.poTerminie.map(wiersz)}
            </Grupa>
          )}
          {grupy.starsze.length > 0 && (
            <section aria-label={`Starsze niż ${DNI_STAREJ} dni`} className="space-y-1.5 pt-1">
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-deck-muted">
                  Starsze niż {DNI_STAREJ} dni · {grupy.starsze.length}
                </h3>
                <button type="button" aria-expanded={pokazStarsze} onClick={() => setPokazStarsze((p) => !p)} className={maly}>
                  {pokazStarsze ? 'Zwiń' : 'Pokaż'}
                </button>
                <button
                  type="button"
                  onClick={() => setZaznaczone((z) => new Set([...z, ...grupy.starsze.map((x) => x.id)]))}
                  className={maly}
                >
                  Zaznacz wszystkie starsze
                </button>
              </div>
              {pokazStarsze ? (
                <ul aria-label="Sprawy starsze" className="space-y-1.5">{grupy.starsze.map(wiersz)}</ul>
              ) : (
                <p className="text-[11.5px] text-deck-muted">
                  Zwykle już nieaktualne. Jeśli tak, zaznacz je i przenieś do Załatwionych.
                </p>
              )}
            </section>
          )}
        </>
      ) : (
        <ul aria-label="Sprawy" className="space-y-1.5">{strona.sprawy.map(wiersz)}</ul>
      )}
      {alert}
      {strona.nastepna && (
        <button type="button" onClick={wiecej} disabled={laduje} className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
          Pokaż więcej
        </button>
      )}
    </div>
  )
}

function Grupa({ tytul, ile, ton, children }: { tytul: string; ile: number; ton?: 'uwaga'; children: ReactNode }) {
  return (
    <section aria-label={tytul} className="space-y-1.5">
      <h3 className={`font-mono text-[10px] uppercase tracking-[0.14em] ${ton === 'uwaga' ? 'text-deck-warn' : 'text-deck-muted'}`}>
        {tytul} · {ile}
      </h3>
      <ul aria-label={`Sprawy: ${tytul.toLowerCase()}`} className="space-y-1.5">{children}</ul>
    </section>
  )
}
