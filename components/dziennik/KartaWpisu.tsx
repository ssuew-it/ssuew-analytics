'use client'
import { useState } from 'react'
import { ETYKIETY_STANU, ETYKIETY_STANU_CELU, ETYKIETY_STATUSU, opisTerminu } from '@/lib/dziennik/etykiety'
import { klientDziennika } from '@/lib/dziennik/klient'
import { stanCelu, stanWpisu } from '@/lib/dziennik/stan'
import type { Ksiega, Wpis } from '@/lib/dziennik/typy'
import type { ZrodloOtwarte } from '@/lib/orbita/typy'
import type { Data } from '@/lib/planer/trwanie'
import { Adnotacje } from './Adnotacje'
import { WezDoOrbity } from './WezDoOrbity'
import { TekstZLinkami } from './TekstZLinkami'
import { PRZYCISK_CICHY, PRZYCISK_GROZNY } from './style'

function Pola({ wpis }: { wpis: Wpis }) {
  const klasa = 'font-mono text-[11px] text-deck-muted'
  switch (wpis.dzial) {
    case 'cykl':
      return (
        <p className={klasa}>
          {wpis.obowiazkowe && <span className="mr-2 text-deck-danger">OBOWIĄZKOWE</span>}
          {opisTerminu(wpis)} · przygotowania {wpis.wyprzedzenieTygodni} tyg. wcześniej
          {wpis.rozlicza.length > 0 && ` · rozlicza: ${wpis.rozlicza.join(' · ')}`}
        </p>
      )
    case 'luka':
      return wpis.ileCzasu ? <p className={klasa}>Ile czasu: {wpis.ileCzasu}</p> : null
    case 'strategia':
      return (
        <div className="space-y-1">
          <p className={klasa}>
            {wpis.okresOd}-{wpis.okresDo} · {ETYKIETY_STATUSU[wpis.status]}{wpis.uchwala && ` · ${wpis.uchwala}`}
          </p>
          {wpis.link && (
            <a href={wpis.link} target="_blank" rel="noopener noreferrer" className="break-all text-[12px] text-deck-accent underline-offset-2 hover:underline">
              {wpis.link}
            </a>
          )}
          {wpis.cele.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-deck-text">
              {wpis.cele.map((c) => {
                const s = stanCelu(wpis, c.id)
                return (
                  <li key={c.id}>
                    {c.tresc}
                    {s && <span className="text-deck-muted"> - {ETYKIETY_STANU_CELU[s]}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )
    default:
      return null
  }
}

export function KartaWpisu({ wpis, ksiega, odswiez, onPopraw, orbita }: {
  wpis: Wpis
  ksiega: Ksiega
  odswiez: () => void
  onPopraw: () => void
  /** Przejście do Orbity przy wpisach kalendarza pracy; bez tego - brak przycisku. */
  orbita?: { dzis: Data; zrodla: ZrodloOtwarte[] | null }
}) {
  const kadencja = ksiega.kadencje.find((k) => k.id === wpis.kadencjaId)
  const wlasny = ksiega.otwartaKadencjaId !== null && wpis.kadencjaId === ksiega.otwartaKadencjaId
  const stan = stanWpisu(wpis)
  const [pytam, setPytam] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)

  async function usun() {
    try {
      await klientDziennika.usunWpis(wpis.id)
      odswiez()
    } catch (e) {
      setBlad((e as Error).message)
      setPytam(false)
    }
  }

  return (
    <article aria-label={wpis.tytul} className="deck-chip rounded-xl px-4 py-3 text-[13px] text-deck-text">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[14px] font-medium">{wpis.tytul}</h4>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-deck-muted/80">
            {kadencja ? `${kadencja.nazwa} · ${kadencja.autor}` : 'nieznana kadencja'}
            {stan !== 'aktualne' && ` · ${ETYKIETY_STANU[stan]}`}
          </p>
        </div>
        {wlasny && !pytam && (
          <div className="flex gap-2">
            <button type="button" className={PRZYCISK_CICHY} onClick={onPopraw}>Popraw</button>
            <button type="button" className={PRZYCISK_CICHY} onClick={() => setPytam(true)}>Usuń</button>
          </div>
        )}
        {pytam && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-deck-muted">Usunąć wpis?</span>
            <button type="button" className={PRZYCISK_GROZNY} onClick={usun}>Tak, usuń</button>
            <button type="button" className={PRZYCISK_CICHY} onClick={() => setPytam(false)}>Nie</button>
          </div>
        )}
      </div>
      <div className="mt-2 space-y-2">
        <Pola wpis={wpis} />
        {wpis.dzial === 'cykl' && orbita && <WezDoOrbity wpis={wpis} dzis={orbita.dzis} zrodla={orbita.zrodla} />}
        <TekstZLinkami tekst={wpis.tresc} />
        {wpis.dzial === 'watek' && wpis.zostalo && (
          <div className="text-deck-muted">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em]">Co zostało: </span>
            <TekstZLinkami tekst={wpis.zostalo} />
          </div>
        )}
      </div>
      {blad && <p role="alert" className="mt-2 text-deck-danger">{blad}</p>}
      <Adnotacje wpis={wpis} ksiega={ksiega} odswiez={odswiez} />
    </article>
  )
}
