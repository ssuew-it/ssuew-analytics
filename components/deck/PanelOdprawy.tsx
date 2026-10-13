'use client'
import { Suspense, use, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { ODNOSNIK_OBSZARU, type Obszar, type Odprawa, type Waga, type ZapisanaOdprawa } from '@/lib/asystent/odprawa'
import { godzinaWarszawa } from '@/lib/czas'
import type { Fakt } from '@/lib/asystent/fakty'
import { ListaFaktow, SzkieletFaktow } from './PanelFaktow'

const ETYKIETA_OBSZARU: Record<Obszar, string> = {
  kpi: 'KPI', rekrutacja: 'Rekrutacja', retencja: 'Retencja', projekty: 'Projekty', planer: 'Sesja Operacyjna', zespol: 'Zespół', strony: 'Strony',
}

const STYL_WAGI: Record<Waga, string> = {
  wysoka: 'border-l-deck-danger text-deck-danger',
  srednia: 'border-l-deck-warn text-deck-warn',
  niska: 'border-l-white/25 text-deck-muted',
}

const NAZWA_WAGI: Record<Waga, string> = { wysoka: 'wysokie', srednia: 'średnie', niska: 'niskie' }

function Naglowek({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-deck-accent">asystent · gemini</div>
        <h2 id="odprawa-tytul" className="mt-1 text-[17px] font-semibold tracking-[-0.015em]">Odprawa D.E.C.K.</h2>
      </div>
      {children}
    </div>
  )
}

/** To samo miejsce, zanim Firestore odda zapisaną odprawę. */
export function SzkieletOdprawy() {
  return (
    <section aria-labelledby="odprawa-tytul" className="deck-card rounded-lg p-[18px]">
      <Naglowek />
      <div className="mt-4 space-y-2" aria-hidden="true">
        <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.06]" />
      </div>
    </section>
  )
}

/**
 * Odprawa czytana z Firestore - nigdy nie czeka na Gemini. „Odśwież” pyta
 * model od razu; błąd zostawia poprzednią odprawę na ekranie.
 */
export function PanelOdprawy({ odprawa, fakty }: { odprawa: Promise<ZapisanaOdprawa | null>; fakty: Promise<Fakt[]> }) {
  const zapisana = use(odprawa)
  const [biezaca, setBiezaca] = useState(zapisana)
  const [odswieza, setOdswieza] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)

  async function odswiez() {
    setOdswieza(true)
    setBlad(null)
    try {
      const res = await fetch('/api/asystent/odprawa', { method: 'POST' })
      const dane = await res.json().catch(() => ({}))
      if (res.ok) setBiezaca(dane as ZapisanaOdprawa)
      else setBlad(dane.error ?? 'Nie udało się odświeżyć odprawy.')
    } catch {
      setBlad('Brak połączenia - spróbuj ponownie.')
    } finally {
      setOdswieza(false)
    }
  }

  return (
    <section aria-labelledby="odprawa-tytul" className="deck-card rounded-lg p-[18px]">
      <Naglowek>
        <div className="flex items-center gap-3 font-mono text-[10.5px] text-deck-muted">
          {biezaca && <span>{biezaca.dzien} · {godzinaWarszawa(new Date(biezaca.utworzono))}</span>}
          <button
            type="button"
            onClick={odswiez}
            disabled={odswieza}
            className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 transition hover:border-deck-accent/40 hover:text-deck-accent disabled:opacity-60"
          >
            <RefreshCw size={12} className={odswieza ? 'animate-spin' : ''} aria-hidden="true" />
            {odswieza ? 'Analizuję...' : 'Odśwież'}
          </button>
        </div>
      </Naglowek>

      {blad && (
        <p role="alert" className="mt-3 rounded-md border border-deck-danger-border bg-deck-danger-bg/70 px-3 py-2 text-[11.5px] text-deck-danger">
          {blad}
        </p>
      )}

      {biezaca ? (
        <TrescOdprawy odprawa={biezaca.odprawa} />
      ) : (
        <>
          <p className="mt-3 text-[12.5px] leading-relaxed text-deck-muted">
            Pierwsza odprawa jeszcze nie powstała - kliknij „Odśwież” albo wróć za chwilę. Do tego czasu fakty:
          </p>
          <Suspense fallback={<SzkieletFaktow />}>
            <ListaFaktow fakty={fakty} />
          </Suspense>
        </>
      )}
    </section>
  )
}

function TrescOdprawy({ odprawa }: { odprawa: Odprawa }) {
  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="text-[13.5px] leading-relaxed text-deck-text">{odprawa.podsumowanie}</p>
        {odprawa.zagrozenia.length > 0 && (
          <ul className="mt-3 space-y-2">
            {odprawa.zagrozenia.map((z) => (
              <li key={`${z.obszar}-${z.tytul}`}>
                <Link
                  href={ODNOSNIK_OBSZARU[z.obszar]}
                  data-waga={z.waga}
                  className={`block rounded-md border border-l-[3px] border-white/10 bg-white/[0.03] px-3 py-2 transition hover:bg-white/[0.06] ${STYL_WAGI[z.waga]}`}
                >
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.16em]">
                    {ETYKIETA_OBSZARU[z.obszar]} · ryzyko {NAZWA_WAGI[z.waga]}
                  </span>
                  <b className="mt-0.5 block text-[13px] font-semibold text-deck-text">{z.tytul}</b>
                  <span className="block text-[11.5px] leading-relaxed text-deck-muted">{z.uzasadnienie}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {odprawa.dzis.length > 0 && (
        <div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-deck-muted/70">dziś</div>
          <ul className="mt-2 space-y-1.5 text-[12.5px] text-deck-text">
            {odprawa.dzis.map((d) => (
              <li key={d} className="border-l border-deck-accent/40 pl-2.5">{d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
