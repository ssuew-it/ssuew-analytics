'use client'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Search, Settings } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_STATUSOW, ZAKLADKI } from '@/lib/skrzynka/widok'
import type { LicznikiSkrzynki, PostepImportu, Status } from '@/lib/skrzynka/typy'
import { DNI_ALARMU } from '@/lib/skrzynka/statusy'
import { ImportSkrzynki } from './ImportSkrzynki'
import { Kontakty } from './Kontakty'
import { ListaSpraw } from './ListaSpraw'
import { Organizacje } from './Organizacje'
import { UstawieniaSkrzynki } from './UstawieniaSkrzynki'
import { WidokSprawy } from './WidokSprawy'

const BLEDY: Record<string, string> = {
  'inne-konto': 'Zgoda przyszła z innego konta niż kontakt@samorzad.ue.wroc.pl - zaloguj się w Google jako kontakt@ i spróbuj ponownie.',
  odmowa: 'Zgoda w Google nie została udzielona.',
  stan: 'Link połączenia wygasł albo jest nieprawidłowy - spróbuj jeszcze raz.',
  polaczenie: 'Nie udało się połączyć ze skrzynką - spróbuj ponownie.',
  konfiguracja: 'Skrzynka nie jest skonfigurowana na serwerze (zmienne SKRZYNKA_* na Vercelu).',
  'brak-wysylki': 'Zgoda Google nie obejmuje wysyłki maili - połącz skrzynkę jeszcze raz i zaznacz wszystkie uprawnienia.',
  niepolaczona: 'Najpierw połącz skrzynkę - kalendarz korzysta z tej samej zgody Google.',
  'brak-kalendarza': 'Zgoda Google nie obejmuje kalendarza - kliknij „Połącz kalendarz” jeszcze raz i zaznacz uprawnienie do wydarzeń.',
  'niepelna-zgoda': 'Przy zgodzie na kalendarz zostaw zaznaczone także uprawnienia Gmaila - inaczej skrzynka straciłaby dostęp. Skrzynka działa jak dotąd; spróbuj ponownie.',
}

/** Zakładki statusów i dwie kartoteki - bez liczb, bo liczenie osób i organizacji to dodatkowe odczyty przy każdym wejściu. */
type Zakladka = Status | 'kontakty' | 'organizacje'
const KARTOTEKI: { z: Zakladka; nazwa: string }[] = [
  { z: 'kontakty', nazwa: 'Kontakty' },
  { z: 'organizacje', nazwa: 'Organizacje' },
]
const czyStatus = (z: Zakladka): z is Status => z !== 'kontakty' && z !== 'organizacje'

const LICZBA: Record<Status, (l: LicznikiSkrzynki) => number> = {
  'do-odpowiedzi': (l) => l.doOdpowiedzi,
  'w-toku': (l) => l.wToku,
  'czeka-na-nich': (l) => l.czekaNaNich,
  'do-przejrzenia': (l) => l.doPrzejrzenia,
  zalatwiona: (l) => l.zalatwione,
  pominieta: (l) => l.pominiete,
}

/**
 * Prawy panel, zanim wybierze się sprawę: stan skrzynki w liczbach i co z nim
 * zrobić - zamiast pustej połowy ekranu z jednym zdaniem.
 */
function Podsumowanie({ l }: { l: LicznikiSkrzynki }) {
  const wTerminie = Math.max(0, l.doOdpowiedzi - l.poTerminie)
  const pozycje = [
    { nazwa: 'Do odpowiedzi w terminie', ile: wTerminie, ton: 'text-deck-text' },
    { nazwa: 'Po terminie', ile: l.poTerminie, ton: l.poTerminie ? 'text-deck-warn' : 'text-deck-text' },
    { nazwa: 'Do przejrzenia', ile: l.doPrzejrzenia, ton: 'text-deck-text' },
    { nazwa: 'Czeka na ich odpowiedź', ile: l.czekaNaNich, ton: 'text-deck-muted' },
  ]
  return (
    <section aria-label="Stan skrzynki" className="hidden rounded-lg border border-white/8 bg-white/[0.02] p-5 lg:block">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-deck-muted">Stan skrzynki</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {pozycje.map((p) => (
          <div key={p.nazwa} className="rounded-md border border-white/8 bg-white/[0.02] px-3 py-2">
            <dt className="text-[11px] text-deck-muted">{p.nazwa}</dt>
            <dd className={`mt-1 font-mono text-2xl ${p.ton}`}>{p.ile}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 space-y-1.5 text-[12px] leading-relaxed text-deck-muted">
        <li>Kliknij sprawę po lewej, żeby zobaczyć cały wątek i odpowiedzieć stąd.</li>
        <li>Termin to {DNI_ALARMU} dni robocze od pierwszej wiadomości, na którą nikt nie odpisał.</li>
        <li>Sprawy sprzed ponad 30 dni są zwinięte na dole listy - zwykle można je przenieść do Załatwionych.</li>
      </ul>
    </section>
  )
}

const kiedy = (ms: number) =>
  new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' }).format(ms)

export function PanelSkrzynki({ liczniki, postep, blad, sklad, email, kalendarz = false, kalendarzPolaczony = false, otworzUstawienia = false }: {
  liczniki: LicznikiSkrzynki | null
  postep: PostepImportu | null
  blad: string | null
  sklad: string[]
  email: string
  /** Token obejmuje kalendarz - Ustawienia pokażą „Połączony”. */
  kalendarz?: boolean
  /** Powrót ze zgody na kalendarz (`?kalendarz=ok`). */
  kalendarzPolaczony?: boolean
  /** `?ustawienia=1` - odnośnik z Planera prowadzi prosto do Ustawień. */
  otworzUstawienia?: boolean
}) {
  const router = useRouter()
  const [zakladka, setZakladka] = useState<Zakladka>('do-odpowiedzi')
  const [ustawienia, setUstawienia] = useState(otworzUstawienia)
  const [wpisane, setWpisane] = useState('')
  const [szukane, setSzukane] = useState('')
  const [wybrana, setWybrana] = useState<string | null>(null)
  /** Prawy panel na kartę osoby albo organizacji (portal z zakładek-kartotek). */
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const [kartaOtwarta, setKartaOtwarta] = useState(false)
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

  function wybierzZakladke(s: Zakladka) {
    setZakladka(s)
    setSzukane('')
    setWpisane('')
    setWybrana(null)
    setKartaOtwarta(false)
  }

  const komunikat = blad ? (BLEDY[blad] ?? BLEDY.polaczenie) : null
  const alert = 'rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger'

  return (
    <div className="space-y-4">
      {komunikat && <p role="alert" className={alert}>{komunikat}</p>}
      {kalendarzPolaczony && !komunikat && (
        <p role="status" className="rounded-lg border border-deck-border px-4 py-3 text-[12.5px] text-deck-text">
          Kalendarz Samorządowicza połączony - wysyłkę uruchomisz przyciskiem w Planerze.
        </p>
      )}

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
            <button type="button" onClick={dociagnij} disabled={trwa} className="deck-chip inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] text-deck-muted transition hover:text-deck-text disabled:opacity-50">
              <RefreshCw size={12} aria-hidden="true" className={trwa ? 'animate-spin' : ''} />
              Dociągnij
            </button>
            <button
              type="button"
              aria-pressed={ustawienia}
              onClick={() => setUstawienia((u) => !u)}
              className="deck-chip inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] text-deck-muted transition hover:text-deck-text aria-pressed:text-deck-accent"
            >
              <Settings size={12} aria-hidden="true" />
              Ustawienia
            </button>
            {bladDociagania && <span role="alert" className="text-deck-danger">{bladDociagania}</span>}
          </div>

          {ustawienia ? (
            <UstawieniaSkrzynki kalendarz={kalendarz} />
          ) : (
            <>
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
                  {[...ZAKLADKI.map((z) => ({ z: z as Zakladka, nazwa: ETYKIETY_STATUSOW[z] })), ...KARTOTEKI].map(({ z, nazwa }) => (
                    <button
                      key={z}
                      type="button"
                      role="tab"
                      aria-selected={z === zakladka}
                      onClick={() => wybierzZakladke(z)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition ${
                        z === zakladka ? 'border-deck-accent/50 bg-deck-accent/10 text-deck-text' : 'border-white/10 text-deck-muted hover:text-deck-text'
                      }`}
                    >
                      {nazwa}
                      {czyStatus(z) && (
                        <span className={`font-mono text-[11px] ${z === 'do-odpowiedzi' && liczniki.poTerminie > 0 ? 'text-deck-danger' : ''}`}>
                          {LICZBA[z](liczniki)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* grid-cols-1 = minmax(0, 1fr): bez tego długi temat (truncate) rozpychał
                  jedyną kolumnę na telefonie do ok. 1150 px. */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
                <div className={`min-w-0 ${wybrana ? 'hidden lg:block' : ''}`}>
                  {szukane || czyStatus(zakladka) ? (
                    <ListaSpraw
                      key={`${zakladka}|${szukane}`}
                      status={czyStatus(zakladka) ? zakladka : 'do-odpowiedzi'}
                      szukane={szukane}
                      wybrana={wybrana}
                      onWybierz={setWybrana}
                      wersja={wersja}
                      onZmiana={poZmianie}
                    />
                  ) : zakladka === 'kontakty' ? (
                    <Kontakty wybrana={wybrana} onWybierz={setWybrana} panel={panel} onKarta={setKartaOtwarta} />
                  ) : (
                    <Organizacje wybrana={wybrana} onWybierz={setWybrana} panel={panel} onKarta={setKartaOtwarta} />
                  )}
                </div>
                <div className="min-w-0">
                  {wybrana && (
                    <WidokSprawy key={wybrana} id={wybrana} sklad={sklad} email={email} onZmiana={poZmianie} onZamknij={() => setWybrana(null)} />
                  )}
                  {!czyStatus(zakladka) && !szukane && <div ref={setPanel} hidden={!!wybrana} />}
                  {!wybrana && !szukane && czyStatus(zakladka) && <Podsumowanie l={liczniki} />}
                  {!wybrana && (szukane || (!czyStatus(zakladka) && !kartaOtwarta)) && (
                    <p className="hidden text-[12.5px] text-deck-muted lg:block">
                      {szukane ? 'Wybierz sprawę z listy.' : zakladka === 'kontakty' ? 'Wybierz osobę z listy.' : 'Wybierz organizację z listy.'}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
