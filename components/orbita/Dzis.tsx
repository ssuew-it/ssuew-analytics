'use client'
import { useState } from 'react'
import { krotkaData, opisZapasu } from '@/lib/orbita/format'
import { WIDOCZNE_DZIS } from '@/lib/orbita/typy'
import type { Zadanie } from '@/lib/orbita/typy'
import { biezacy, type PlanDnia } from '@/lib/orbita/zapas'
import { KartaEtapu } from './KartaEtapu'

/** Zadanie bez terminu - rozwijane do karty, żeby dało się nad nim pracować także na telefonie. */
function WierszKiedys({ z, odswiez }: { z: Zadanie; odswiez: () => void }) {
  const [otwarte, setOtwarte] = useState(false)
  const k = biezacy(z)
  return (
    <li className="px-4 py-1 text-[13px] text-deck-muted">
      <button
        type="button"
        aria-label={`Pokaż etap: ${z.tytul}`}
        aria-expanded={otwarte}
        className="text-left hover:text-deck-text"
        onClick={() => setOtwarte((x) => !x)}
      >
        {z.tytul}
      </button>
      {otwarte && k !== null && (
        <div className="mt-2">
          <KartaEtapu pozycja={{ zadanie: z, etap: k, zapas: null, poCzekaniu: false }} odswiez={odswiez} />
        </div>
      )}
    </li>
  )
}

const NAGLOWEK = 'font-mono text-[10.5px] uppercase tracking-[0.2em] text-deck-muted'

/** Widok domyślny: co dziś, na co czekam, co najbliżej (spec sekcja 5). */
export function Dzis({ plan, odswiez }: { plan: PlanDnia; odswiez: () => void }) {
  const [wszystkie, setWszystkie] = useState(false)
  const pusto = plan.dzis.length + plan.czekam.length + plan.najblizej.length + plan.kiedys.length + plan.zamkniete.length === 0
  if (pusto) {
    return <p className="deck-chip rounded-xl p-4 text-[13px] text-deck-muted">Nic tu jeszcze nie ma. Dodaj zadanie, które czeka na pierwszy krok.</p>
  }
  const widoczne = wszystkie ? plan.dzis : plan.dzis.slice(0, WIDOCZNE_DZIS)
  const ukryte = plan.dzis.length - widoczne.length

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className={NAGLOWEK}>Dziś</h2>
        {plan.podpowiedz && <p className="text-[12.5px] text-deck-muted">Nic nie musi ruszyć dziś - najbliżej:</p>}
        {plan.dzis.length === 0 && <p className="text-[12.5px] text-deck-muted">Nic na dziś.</p>}
        {widoczne.map((p) => (
          <KartaEtapu key={p.zadanie.id} pozycja={p} odswiez={odswiez} />
        ))}
        {ukryte > 0 && (
          <button type="button" className="text-[12.5px] text-deck-accent underline-offset-2 hover:underline" onClick={() => setWszystkie(true)}>
            i jeszcze {ukryte}
          </button>
        )}
      </section>

      {plan.czekam.length > 0 && (
        <section className="space-y-2">
          <h2 className={NAGLOWEK}>Czekam</h2>
          <ul className="space-y-1">
            {plan.czekam.map(({ zadanie: z, etap, do: data }) => {
              const e = z.etapy[etap]
              return (
                <li key={z.id} className="deck-chip rounded-lg px-4 py-2 text-[13px] text-deck-muted">
                  <span className="text-deck-text">{z.tytul}</span> · {e.nazwa}
                  {e.czekaNa.length > 0 && ` (${e.czekaNa.join(', ')})`} do {krotkaData(data)}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {plan.najblizej.length > 0 && (
        <section className="space-y-2">
          <h2 className={NAGLOWEK}>Najbliżej</h2>
          <ul className="space-y-1">
            {plan.najblizej.map(({ zadanie: z, etap, zapas }) => (
              <li key={z.id} className="flex flex-wrap justify-between gap-x-3 rounded-lg px-4 py-2 text-[13px]">
                <span className="text-deck-text">
                  {z.tytul}
                  {z.zrodlo && <>{' '}<span className="text-deck-muted">(z Dziennika)</span></>}
                  {' '}<span className="text-deck-muted">· {z.etapy[etap].nazwa}</span>
                </span>
                <span className="font-mono text-[11px] text-deck-muted">{opisZapasu(zapas)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.kiedys.length > 0 && (
        <details>
          <summary className={`${NAGLOWEK} cursor-pointer`}>Kiedyś ({plan.kiedys.length})</summary>
          <ul className="mt-2 space-y-1">
            {plan.kiedys.map((z) => (
              <WierszKiedys key={z.id} z={z} odswiez={odswiez} />
            ))}
          </ul>
        </details>
      )}

      {plan.zamkniete.length > 0 && (
        <details>
          <summary className={`${NAGLOWEK} cursor-pointer`}>Zamknięte ({plan.zamkniete.length})</summary>
          <ul className="mt-2 space-y-1">
            {plan.zamkniete.map((z) => (
              <li key={z.id} className="px-4 py-1 text-[13px] text-deck-muted line-through decoration-white/20">{z.tytul}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
