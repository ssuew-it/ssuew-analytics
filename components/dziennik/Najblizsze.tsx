'use client'
import { odmiana } from '@/lib/asystent/fakty'
import { dzienIMiesiac, opisTerminu } from '@/lib/dziennik/etykiety'
import { otwarty, stanWpisu } from '@/lib/dziennik/stan'
import { najblizsze } from '@/lib/dziennik/terminy'
import type { Dzial, Ksiega } from '@/lib/dziennik/typy'
import type { ZrodloOtwarte } from '@/lib/orbita/typy'
import type { Data } from '@/lib/planer/trwanie'
import { WezDoOrbity } from './WezDoOrbity'

export function Najblizsze({ ksiega, dzis, onIdzDo, zrodla = null }: {
  ksiega: Ksiega
  dzis: Data
  onIdzDo: (d: Dzial) => void
  /** Obowiązki już w Orbicie; `null` - nie wiadomo (błąd odczytu). */
  zrodla?: ZrodloOtwarte[] | null
}) {
  const pozycje = najblizsze(ksiega.wpisy, dzis)
  const otwarte = (d: Dzial) => ksiega.wpisy.filter((w) => w.dzial === d && otwarty(stanWpisu(w))).length

  return (
    <div className="space-y-4">
      {pozycje.length === 0 ? (
        <div className="deck-chip rounded-xl p-4 text-[13px] text-deck-muted">
          <p>W ciągu 30 dni nic z kalendarza pracy.</p>
          <button type="button" onClick={() => onIdzDo('cykl')} className="mt-2 text-deck-accent underline-offset-2 hover:underline">
            Otwórz kalendarz pracy
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {pozycje.map(({ wpis, termin, od, trwa }) => (
            <li key={wpis.id} className="deck-chip rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {wpis.obowiazkowe && (
                  <span className="rounded-full border border-deck-danger-border bg-deck-danger-bg px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-deck-danger">
                    OBOWIĄZKOWE
                  </span>
                )}
                <span className="text-[14px] font-medium text-deck-text">{wpis.tytul}</span>
                {trwa && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-deck-accent">trwa</span>}
                <span className="ml-auto"><WezDoOrbity wpis={wpis} dzis={dzis} zrodla={zrodla} /></span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-deck-muted">
                do {wpis.dzien === null ? opisTerminu(wpis) : dzienIMiesiac(termin)} · przygotuj od {dzienIMiesiac(od)}
                {wpis.rozlicza.length > 0 && ` · ${wpis.rozlicza.join(' · ')}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="font-mono text-[11px] text-deck-muted">
        W toku: {odmiana(otwarte('watek'), ['wątek', 'wątki', 'wątków'])}, {odmiana(otwarte('luka'), ['luka', 'luki', 'luk'])}
      </p>
    </div>
  )
}
