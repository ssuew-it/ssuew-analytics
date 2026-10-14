'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import type { LicznikiSkrzynki, PostepImportu } from '@/lib/skrzynka/typy'
import { ImportSkrzynki } from './ImportSkrzynki'

const BLEDY: Record<string, string> = {
  'inne-konto': 'Zgoda przyszła z innego konta niż kontakt@samorzad.ue.wroc.pl - zaloguj się w Google jako kontakt@ i spróbuj ponownie.',
  odmowa: 'Zgoda w Google nie została udzielona.',
  stan: 'Link połączenia wygasł albo jest nieprawidłowy - spróbuj jeszcze raz.',
  polaczenie: 'Nie udało się połączyć ze skrzynką - spróbuj ponownie.',
  konfiguracja: 'Skrzynka nie jest skonfigurowana na serwerze (zmienne SKRZYNKA_* na Vercelu).',
}

const kiedy = (ms: number) =>
  new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' }).format(ms)

export function PanelSkrzynki({ liczniki, postep, blad }: {
  liczniki: LicznikiSkrzynki | null
  postep: PostepImportu | null
  blad: string | null
}) {
  const router = useRouter()
  const [trwa, setTrwa] = useState(false)
  const [bladDociagania, setBladDociagania] = useState<string | null>(null)

  async function dociagnij() {
    setTrwa(true)
    setBladDociagania(null)
    try {
      await klientSkrzynki.synchronizuj()
      router.refresh()
    } catch (e) {
      setBladDociagania((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  const komunikat = blad ? (BLEDY[blad] ?? BLEDY.polaczenie) : null

  return (
    <div className="space-y-4">
      {komunikat && (
        <p role="alert" className="rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger">
          {komunikat}
        </p>
      )}

      {liczniki === null ? (
        <p role="alert" className="rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger">
          Nie udało się odczytać stanu skrzynki - odśwież stronę za chwilę.
        </p>
      ) : liczniki.stan !== 'polaczona' ? (
        <section className="deck-card max-w-[640px] space-y-3 rounded-lg p-5 text-[12.5px]">
          {liczniki.stan === 'rozlaczona' ? (
            <p role="alert" className="text-deck-danger">Skrzynka jest rozłączona - Google odwołał dostęp. Sprawy w D.E.C.K. zostają; po połączeniu dociągnę zmiany.</p>
          ) : (
            <p className="text-deck-muted">
              D.E.C.K. będzie czytać skrzynkę kontakt@, nadawać mailom statusy i wysyłać odpowiedzi z tego adresu. Zgodę daje się raz, zalogowanym w Google jako kontakt@samorzad.ue.wroc.pl.
            </p>
          )}
          <a href="/api/skrzynka/polacz" className="deck-button inline-flex rounded-md px-3 py-1.5 text-[12px]">
            {liczniki.stan === 'rozlaczona' ? 'Połącz ponownie' : 'Połącz skrzynkę'}
          </a>
        </section>
      ) : (
        <>
          {postep?.trwa && <ImportSkrzynki start={postep} />}
          <section aria-label="Sprawy według statusu" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Liczba etykieta="Do odpowiedzi" wartosc={liczniki.doOdpowiedzi} />
            <Liczba etykieta="Po terminie" wartosc={liczniki.poTerminie} alarm={liczniki.poTerminie > 0} />
            <Liczba etykieta="Do przejrzenia" wartosc={liczniki.doPrzejrzenia} />
            <Liczba etykieta="Czeka na nich" wartosc={liczniki.czekaNaNich} />
            <Liczba etykieta="W toku" wartosc={liczniki.wToku} />
          </section>
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-deck-muted">
            <span>
              Ostatnia synchronizacja: {liczniki.ostatniaSynchronizacja ? kiedy(liczniki.ostatniaSynchronizacja) : 'jeszcze nie było'}
            </span>
            <button type="button" onClick={dociagnij} disabled={trwa} className="deck-button inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
              <RefreshCw size={12} aria-hidden="true" className={trwa ? 'animate-spin' : ''} />
              Dociągnij
            </button>
            {bladDociagania && <span role="alert" className="text-deck-danger">{bladDociagania}</span>}
          </div>
          <p className="text-[12px] text-deck-muted">Lista spraw, odpowiedzi i kontakty pojawią się w kolejnym etapie.</p>
        </>
      )}
    </div>
  )
}

function Liczba({ etykieta, wartosc, alarm = false }: { etykieta: string; wartosc: number; alarm?: boolean }) {
  return (
    <div className="deck-card rounded-lg p-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-deck-muted/70">{etykieta}</div>
      <div className={`mt-1.5 text-[24px] font-semibold tabular-nums ${alarm ? 'text-deck-danger' : 'text-deck-text'}`}>{wartosc}</div>
    </div>
  )
}
