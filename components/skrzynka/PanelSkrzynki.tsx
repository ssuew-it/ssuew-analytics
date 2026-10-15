'use client'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Search } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_STATUSOW, ZAKLADKI } from '@/lib/skrzynka/widok'
import type { LicznikiSkrzynki, PostepImportu, Status } from '@/lib/skrzynka/typy'
import { ImportSkrzynki } from './ImportSkrzynki'
import { ListaSpraw } from './ListaSpraw'
import { WidokSprawy } from './WidokSprawy'

const BLEDY: Record<string, string> = {
  'inne-konto': 'Zgoda przyszła z innego konta niż kontakt@samorzad.ue.wroc.pl - zaloguj się w Google jako kontakt@ i spróbuj ponownie.',
  odmowa: 'Zgoda w Google nie została udzielona.',
  stan: 'Link połączenia wygasł albo jest nieprawidłowy - spróbuj jeszcze raz.',
  polaczenie: 'Nie udało się połączyć ze skrzynką - spróbuj ponownie.',
  konfiguracja: 'Skrzynka nie jest skonfigurowana na serwerze (zmienne SKRZYNKA_* na Vercelu).',
}

const LICZBA: Record<Status, (l: LicznikiSkrzynki) => number> = {
  'do-odpowiedzi': (l) => l.doOdpowiedzi,
  'w-toku': (l) => l.wToku,
  'czeka-na-nich': (l) => l.czekaNaNich,
  'do-przejrzenia': (l) => l.doPrzejrzenia,
  zalatwiona: (l) => l.zalatwione,
  pominieta: (l) => l.pominiete,
}

const kiedy = (ms: number) =>
  new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' }).format(ms)

export function PanelSkrzynki({ liczniki, postep, blad, sklad, email }: {
  liczniki: LicznikiSkrzynki | null
  postep: PostepImportu | null
  blad: string | null
  sklad: string[]
  email: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('do-odpowiedzi')
  const [wpisane, setWpisane] = useState('')
  const [szukane, setSzukane] = useState('')
  const [wybrana, setWybrana] = useState<string | null>(null)
  const [wersja, setWersja] = useState(0)
  const [trwa, setTrwa] = useState(false)
  const [bladDociagania, setBladDociagania] = useState<string | null>(null)

  // Zmiana sprawy przesuwa ją między zakładkami: lista wczytuje się ponownie, liczby odświeża serwer.
  const poZmianie = useCallback(() => {
    setWersja((v) => v + 1)
    router.refresh()
  }, [router])

  async function dociagnij() {
    setTrwa(true)
    setBladDociagania(null)
    try {
      await klientSkrzynki.synchronizuj()
      poZmianie()
    } catch (e) {
      setBladDociagania((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  function zakladka(s: Status) {
    setStatus(s)
    setSzukane('')
    setWpisane('')
    setWybrana(null)
  }

  const komunikat = blad ? (BLEDY[blad] ?? BLEDY.polaczenie) : null
  const alert = 'rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger'

  return (
    <div className="space-y-4">
      {komunikat && <p role="alert" className={alert}>{komunikat}</p>}

      {liczniki === null ? (
        <p role="alert" className={alert}>Nie udało się odczytać stanu skrzynki - odśwież stronę za chwilę.</p>
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

          <div className="flex flex-wrap items-center gap-3 text-[12px] text-deck-muted">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSzukane(wpisane.trim())
                setWybrana(null)
              }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                value={wpisane}
                onChange={(e) => setWpisane(e.target.value)}
                aria-label="Szukaj w skrzynce"
                placeholder="Szukaj w skrzynce (jak w Gmailu: from:, has:attachment…)"
                className="deck-input min-w-0 flex-1 rounded-md px-2.5 py-1.5"
              />
              <button type="submit" disabled={wpisane.trim().length < 2} className="deck-button inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
                <Search size={12} aria-hidden="true" />
                Szukaj
              </button>
            </form>
            <span>Synchronizacja: {liczniki.ostatniaSynchronizacja ? kiedy(liczniki.ostatniaSynchronizacja) : 'jeszcze nie było'}</span>
            <button type="button" onClick={dociagnij} disabled={trwa} className="deck-button inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
              <RefreshCw size={12} aria-hidden="true" className={trwa ? 'animate-spin' : ''} />
              Dociągnij
            </button>
            {bladDociagania && <span role="alert" className="text-deck-danger">{bladDociagania}</span>}
          </div>

          {szukane ? (
            <div className="flex items-center gap-3 text-[12.5px]">
              <span className="text-deck-text">Wyniki dla „{szukane}”</span>
              <button
                type="button"
                onClick={() => {
                  setSzukane('')
                  setWpisane('')
                }}
                className="text-deck-muted hover:underline"
              >
                Wyczyść
              </button>
            </div>
          ) : (
            <div role="tablist" aria-label="Statusy spraw" className="flex flex-wrap gap-1.5">
              {ZAKLADKI.map((z) => (
                <button
                  key={z}
                  type="button"
                  role="tab"
                  aria-selected={z === status}
                  onClick={() => zakladka(z)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition ${
                    z === status ? 'border-deck-accent/50 bg-deck-accent/10 text-deck-text' : 'border-white/10 text-deck-muted hover:text-deck-text'
                  }`}
                >
                  {ETYKIETY_STATUSOW[z]}
                  <span className={`font-mono text-[11px] ${z === 'do-odpowiedzi' && liczniki.poTerminie > 0 ? 'text-deck-danger' : ''}`}>
                    {LICZBA[z](liczniki)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
            <div className={wybrana ? 'hidden lg:block' : ''}>
              <ListaSpraw key={`${status}|${szukane}`} status={status} szukane={szukane} wybrana={wybrana} onWybierz={setWybrana} wersja={wersja} />
            </div>
            {wybrana ? (
              <WidokSprawy key={wybrana} id={wybrana} sklad={sklad} email={email} onZmiana={poZmianie} onZamknij={() => setWybrana(null)} />
            ) : (
              <p className="hidden text-[12.5px] text-deck-muted lg:block">Wybierz sprawę z listy.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
