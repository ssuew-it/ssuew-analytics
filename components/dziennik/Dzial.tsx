'use client'
import { useState } from 'react'
import { uporzadkuj } from '@/lib/dziennik/eksport'
import { MIESIACE } from '@/lib/dziennik/etykiety'
import { klientDziennika } from '@/lib/dziennik/klient'
import { otwarty, stanWpisu } from '@/lib/dziennik/stan'
import type { Dzial as TypDzialu, Ksiega, Wpis } from '@/lib/dziennik/typy'
import type { Data } from '@/lib/planer/trwanie'
import { FormularzWpisu } from './FormularzWpisu'
import { KartaWpisu } from './KartaWpisu'
import { PRZYCISK } from './style'

const PODPOWIEDZ: Record<TypDzialu, string> = {
  cykl: 'Co i kiedy trzeba przygotować w roku - obowiązki z terminem i kto z nich rozlicza.',
  luka: 'Gdzie coś kuleje i ile czasu trzeba, żeby to naprawić.',
  watek: 'Rozpoczęte koncepcje i mechanizmy, które wymagają kontynuacji.',
  innowacja: 'Gdzie widzisz miejsce na coś nowego.',
  strategia: 'Strategie Samorządu: dokument, okres, status i cele.',
  przemyslenie: 'Myśli o Samorządzie, ludziach i przyszłości - dla następców.',
}

type Props = { dzial: TypDzialu; ksiega: Ksiega; odswiez: () => void; dzis: Data }

export function Dzial({ dzial, ksiega, odswiez, dzis }: Props) {
  const [dodaje, setDodaje] = useState(false)
  const [poprawia, setPoprawia] = useState<string | null>(null)
  const wpisy = uporzadkuj(ksiega.wpisy.filter((w) => w.dzial === dzial))
  const otwarte = wpisy.filter((w) => otwarty(stanWpisu(w)))
  const zamkniete = wpisy.filter((w) => !otwarty(stanWpisu(w)))

  const poZapisie = () => {
    setDodaje(false)
    setPoprawia(null)
    odswiez()
  }

  const karta = (w: Wpis) =>
    poprawia === w.id ? (
      <FormularzWpisu key={w.id} dzial={dzial} wpis={w} onAnuluj={() => setPoprawia(null)}
        onZapisz={async (pola) => {
          await klientDziennika.zmienWpis(w.id, pola)
          poZapisie()
        }} />
    ) : (
      <KartaWpisu key={w.id} wpis={w} ksiega={ksiega} odswiez={odswiez} onPopraw={() => setPoprawia(w.id)} />
    )

  // Kalendarz pracy jako oś roku od bieżącego miesiąca - widać też miesiące bez niczego.
  const osRoku = Array.from({ length: 12 }, (_, i) => ((dzis.miesiac - 1 + i) % 12) + 1)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-deck-muted">{PODPOWIEDZ[dzial]}</p>
        {ksiega.otwartaKadencjaId && !dodaje && (
          <button type="button" className={PRZYCISK} onClick={() => setDodaje(true)}>Dodaj wpis</button>
        )}
      </div>

      {dodaje && (
        <FormularzWpisu dzial={dzial} onAnuluj={() => setDodaje(false)}
          onZapisz={async (pola) => {
            await klientDziennika.dodajWpis(pola)
            poZapisie()
          }} />
      )}

      {dzial === 'cykl'
        ? osRoku.map((m) => {
            const wMiesiacu = otwarte.filter((w) => w.dzial === 'cykl' && w.miesiac === m)
            return (
              <section key={m} aria-label={MIESIACE[m - 1]} className="space-y-2">
                <h3 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-deck-muted">{MIESIACE[m - 1]}</h3>
                {wMiesiacu.length ? wMiesiacu.map(karta) : <p className="text-[12px] text-deck-muted/50">-</p>}
              </section>
            )
          })
        : otwarte.map(karta)}

      {zamkniete.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.14em] text-deck-muted">Zamknięte ({zamkniete.length})</summary>
          <div className="mt-2 space-y-2">{zamkniete.map(karta)}</div>
        </details>
      )}
    </div>
  )
}
