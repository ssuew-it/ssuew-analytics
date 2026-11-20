'use client'
import { useState } from 'react'
import { klientOrbity } from '@/lib/orbita/klient'
import { krotkaData, opisZapasu } from '@/lib/orbita/format'
import type { Zadanie } from '@/lib/orbita/typy'
import { biezacy, zapas } from '@/lib/orbita/zapas'
import { zIso, type Data } from '@/lib/planer/trwanie'
import { PRZYCISK_CICHY, PRZYCISK_GROZNY } from '@/components/dziennik/style'
import { FormularzZadania } from './FormularzZadania'

/** Otwarte po zapasie, bez terminu na końcu. */
function posortuj(zadania: Zadanie[], dzis: Data): Zadanie[] {
  const klucz = (z: Zadanie) => zapas(z, dzis) ?? Number.POSITIVE_INFINITY
  return [...zadania].sort((a, b) => klucz(a) - klucz(b) || a.tytul.localeCompare(b.tytul, 'pl'))
}

function Wiersz({ z, dzis, odswiez }: { z: Zadanie; dzis: Data; odswiez: () => void }) {
  const [poprawiam, setPoprawiam] = useState(false)
  const [usuwam, setUsuwam] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const k = biezacy(z)
  const ostatniZamkniety = (k ?? z.etapy.length) - 1
  const z0 = zapas(z, dzis)
  const t = z.termin ? zIso(z.termin) : null

  async function wykonaj(f: () => Promise<unknown>) {
    setBlad(null)
    try {
      await f()
      odswiez()
    } catch (e) {
      setBlad((e as Error).message)
    }
  }

  if (poprawiam) {
    return (
      <li data-zadanie={z.id}>
        <FormularzZadania dzis={dzis} zadanie={z} onGotowe={() => { setPoprawiam(false); odswiez() }} onAnuluj={() => setPoprawiam(false)} />
      </li>
    )
  }

  return (
    <li data-zadanie={z.id} className="deck-chip rounded-xl px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[14px] font-medium text-deck-text">
          {z.tytul}
          {z.zrodlo && <>{' '}<span className="text-deck-muted">(z Dziennika)</span></>}
        </span>
        <span className="font-mono text-[11px] text-deck-muted">
          {t ? `do ${krotkaData(t)}.${t.rok}` : 'kiedyś'}
          {z0 !== null && ` · ${opisZapasu(z0)}`}
        </span>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[12px] text-deck-muted">Etapy ({z.etapy.length})</summary>
        <ol className="mt-2 space-y-1">
          {z.etapy.map((e, i) => (
            <li key={e.id} className="text-[12.5px]">
              <span className={e.zamkniety !== null ? 'text-deck-muted line-through decoration-white/20' : i === k ? 'text-deck-accent' : 'text-deck-text'}>
                {i + 1}. {e.nazwa}
              </span>
              <span className="font-mono text-[10.5px] text-deck-muted"> · {e.dni} dni{e.rodzaj === 'czekanie' ? ' czekania' : ''}</span>
              {e.wynik && <p className="ml-4 whitespace-pre-line text-[12px] text-deck-muted">{e.wynik}</p>}
              {i === ostatniZamkniety && e.zamkniety !== null && (
                <button type="button" className="ml-2 text-[11.5px] text-deck-accent underline-offset-2 hover:underline" onClick={() => wykonaj(() => klientOrbity.otworz(z.id, e.id))}>
                  Otwórz ponownie
                </button>
              )}
            </li>
          ))}
        </ol>
      </details>
      {blad && <p role="alert" className="mt-2 text-[12px] text-deck-danger">{blad}</p>}
      {usuwam ? (
        <div className="mt-3 rounded-lg border border-deck-danger-border p-3 text-[12.5px] text-deck-text">
          <p>Usunąć zadanie „{z.tytul}”? Tego nie da się cofnąć.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={PRZYCISK_GROZNY} onClick={() => wykonaj(() => klientOrbity.usun(z.id))}>Tak, usuń</button>
            <button type="button" className={PRZYCISK_CICHY} onClick={() => setUsuwam(false)}>Anuluj</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" className={PRZYCISK_CICHY} onClick={() => setPoprawiam(true)}>Popraw</button>
          <button type="button" className={PRZYCISK_CICHY} onClick={() => setUsuwam(true)}>Usuń</button>
        </div>
      )}
    </li>
  )
}

/** Wszystkie zadania do przeglądania i edycji; zamknięte zwinięte na dole. */
export function Lista({ zadania, dzis, odswiez }: { zadania: Zadanie[]; dzis: Data; odswiez: () => void }) {
  const otwarte = posortuj(zadania.filter((z) => z.zamkniete === null), dzis)
  const zamkniete = zadania.filter((z) => z.zamkniete !== null).sort((a, b) => (b.zamkniete ?? 0) - (a.zamkniete ?? 0))
  if (zadania.length === 0) {
    return <p className="deck-chip rounded-xl p-4 text-[13px] text-deck-muted">Nic tu jeszcze nie ma. Dodaj zadanie, które czeka na pierwszy krok.</p>
  }
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {otwarte.map((z) => <Wiersz key={z.id} z={z} dzis={dzis} odswiez={odswiez} />)}
      </ul>
      {zamkniete.length > 0 && (
        <details>
          <summary className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.2em] text-deck-muted">Zamknięte ({zamkniete.length})</summary>
          <ul className="mt-2 space-y-2">
            {zamkniete.map((z) => <Wiersz key={z.id} z={z} dzis={dzis} odswiez={odswiez} />)}
          </ul>
        </details>
      )}
    </div>
  )
}
