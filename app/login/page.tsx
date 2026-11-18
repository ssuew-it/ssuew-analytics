'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { KodInput } from '@/components/deck/KodInput'
import { Telemetria } from '@/components/deck/Telemetria'
import { TekstDekodowany } from '@/components/deck/TekstDekodowany'
import { TloLogowania } from '@/components/deck/TloLogowania'
import { LiveDigits } from '@/components/ui/LiveDigits'
import { LogoMark } from '@/components/ui/LogoMark'
import { NAGLOWKI, losujEkran, type EkranLogowania } from '@/lib/deck/ekranLogowania'

export default function LoginPage() {
  const router = useRouter()
  const { rola, laduje, blad, zalogujHaslem, zalogujKodem } = useAuth()
  const [droga, setDroga] = useState<'kod' | 'haslo'>('kod')
  const [email, setEmail] = useState('')
  const [haslo, setHaslo] = useState('')
  const [zajety, setZajety] = useState(false)
  const [udalo, setUdalo] = useState(false)
  // Losujemy po zamontowaniu, jak motyw kodu w KodInput: serwer i przeglądarka
  // wylosowałyby co innego i React zgłosiłby niezgodność drzewa.
  const [ekran, setEkran] = useState<EkranLogowania | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- patrz wyżej
    setEkran(losujEkran())
  }, [])
  // Przejście startuje razem z przekierowaniem i trwa, gdy kokpit się wczytuje.
  const wchodzi = udalo || Boolean(rola)

  useEffect(() => {
    if (rola) {
      router.push('/')
      router.refresh()
    }
  }, [rola, router])

  const stanKodu = udalo ? 'ok' : zajety ? 'sprawdzanie' : blad ? 'blad' : 'wpisywanie'

  async function sprawdzKod(wpisany: string) {
    setZajety(true)
    const ok = await zalogujKodem(wpisany)
    setZajety(false)
    setUdalo(ok)
  }

  async function wyslij(e: React.FormEvent) {
    e.preventDefault()
    setZajety(true)
    await zalogujHaslem(email, haslo)
    setZajety(false)
  }

  return (
    <main className={`relative min-h-screen overflow-hidden bg-deck-bg-deep ${wchodzi ? 'deck-wejscie' : ''}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(46,230,166,0.16),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(217,176,106,0.13),transparent_32%)]" />
      <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-deck-accent/10 bg-deck-accent/5 blur-3xl" />
      {ekran && <TloLogowania scena={ekran.scena} moc={0.3} przyspiesz={wchodzi} />}
      {/* Gdy kokpit wczytuje się dłużej, pusty ekran wyglądałby na zawieszony. */}
      {wchodzi && (
        <div className="deck-wejscie__napis pointer-events-none fixed inset-0 z-20 grid place-items-center font-mono text-xs uppercase tracking-[0.3em] text-deck-accent" role="status">
          <span className="deck-caret">Otwieram kokpit</span>
        </div>
      )}
      {/* Do 1100 px jedna kolumna: sztywne 420 px obok elastycznej reszty
          rozjeżdżało się na laptopie i było nieczytelne na telefonie. */}
      <div className="deck-wejscie__tresc relative z-10 grid min-h-screen grid-cols-1 gap-8 px-5 py-8 lg:grid-cols-[1fr_420px] lg:gap-10 lg:px-10">
        <section className="flex flex-col justify-between gap-8">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <div className="deck-glitch text-sm font-extrabold tracking-[0.26em] text-deck-text" data-tekst="D.E.C.K.">
                D.E.C.K.
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-deck-muted">
                {'Diagnostic Evaluation of Change & KPIs'}
              </div>
            </div>
          </div>

          <div className="max-w-3xl">
            <div className="deck-chip inline-flex items-center gap-2 rounded-lg px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-deck-accent">
              <Sparkles size={13} />
              kokpit szyfrowany
            </div>
            {ekran ? (
              <TekstDekodowany
                key={ekran.naglowek}
                as="h1"
                tekst={ekran.naglowek}
                tempo={26}
                className="mt-6 text-4xl font-semibold leading-[1.05] tracking-normal text-deck-text sm:text-5xl xl:text-6xl"
              />
            ) : (
              // Do wylosowania nagłówek tylko trzyma miejsce - inaczej mignąłby inny.
              <h1 className="invisible mt-6 text-4xl font-semibold leading-[1.05] sm:text-5xl xl:text-6xl">{NAGLOWKI[0]}</h1>
            )}
            <p className="mt-5 max-w-xl text-base leading-7 text-deck-muted">
              Wejdź do prywatnego kokpitu strategii SSUEW. W tle już pulsują rekrutacje, retencja i KPI rok-do-roku.
            </p>

            {/* Ozdoba, nie dane: prawdziwe liczby są za logowaniem. */}
            <div className="mt-8 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
              <LiveDigits label="sygnał" value="-42 dBm" />
              <LiveDigits label="szyfrowanie" value="256 bit" speed={110} />
              <LiveDigits label="węzły" value="12/12" speed={125} />
            </div>
          </div>

          <div className="hidden max-w-3xl grid-cols-2 gap-3 lg:grid">
            <div className="deck-card deck-scan rounded-lg p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-deck-accent">
                <ShieldCheck size={14} />
                telemetria systemu
              </div>
              <div className="mt-3">{ekran && <Telemetria linie={ekran.telemetria} />}</div>
            </div>
            <div className="deck-card deck-orbit rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-deck-muted">warstwa dostępu</div>
              <div className="mt-4 h-2 rounded-full bg-deck-bg-deep/70">
                <div className="deck-meter-fill h-full w-[82%] rounded-full bg-gradient-to-r from-deck-accent to-deck-warn" />
              </div>
              <p className="mt-4 text-[11px] leading-5 text-deck-muted">
                Nazwiska członków i zapis danych są za sesją - kod otwiera podgląd, hasło otwiera edycję.
              </p>
            </div>
          </div>
        </section>

        <aside className="grid place-items-center">
          <form onSubmit={wyslij} className="deck-card w-full rounded-lg p-6">
            <div className="mb-6">
              <div className="grid h-12 w-12 place-items-center rounded-lg border border-deck-accent/35 bg-deck-accent/12 text-deck-accent shadow-[0_0_28px_rgba(46,230,166,0.24)]">
                {droga === 'kod' ? <KeyRound size={22} /> : <LockKeyhole size={22} />}
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-deck-text">Autoryzacja</h2>
              <p className="mt-1 text-[11px] leading-5 text-deck-muted">
                {droga === 'kod'
                  ? 'Kod zwiąże się z tą przeglądarką przy pierwszym użyciu.'
                  : 'Konto z hasłem - tylko dla dwóch osób.'}
              </p>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
              {(['kod', 'haslo'] as const).map((opcja) => (
                <button
                  key={opcja}
                  type="button"
                  onClick={() => setDroga(opcja)}
                  className={`rounded-md px-3 py-2 text-[11px] font-medium transition ${
                    droga === opcja
                      ? 'bg-deck-accent/15 text-deck-accent shadow-[inset_0_0_0_1px_rgba(46,230,166,0.3)]'
                      : 'text-deck-muted hover:text-deck-text'
                  }`}
                >
                  {opcja === 'kod' ? 'Kod dostępu' : 'E-mail i hasło'}
                </button>
              ))}
            </div>

            {droga === 'kod' ? (
              <KodInput onKomplet={sprawdzKod} stan={stanKodu} />
            ) : (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-deck-muted">E-mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    className="deck-input w-full rounded-lg px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-deck-muted">Hasło</span>
                  <input
                    type="password"
                    value={haslo}
                    onChange={(event) => setHaslo(event.target.value)}
                    autoComplete="current-password"
                    className="deck-input w-full rounded-lg px-3 py-2.5 text-sm"
                  />
                </label>
              </div>
            )}

            {blad && (
              <div className="mt-4 rounded-lg border border-deck-danger-border bg-deck-danger-bg/70 px-3 py-2 text-[11px] leading-5 text-deck-danger">
                {blad}
              </div>
            )}

            {droga === 'haslo' ? (
              <button
                type="submit"
                disabled={laduje || zajety}
                className="deck-button mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {laduje ? 'Sprawdzanie sesji...' : zajety ? 'Sprawdzam...' : 'Wejdź do kokpitu'}
                <ArrowRight size={16} />
              </button>
            ) : (
              // Kod nie ma przycisku: wpisanie szóstej cyfry samo go wysyła.
              <p className="mt-1 text-center text-[11px] text-deck-muted">
                {zajety ? 'Sprawdzam...' : udalo ? 'Wchodzę...' : 'Sześć cyfr - wysyła się samo'}
              </p>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {['KOD', 'URZĄDZENIE', 'NA ŻYWO'].map((item) => (
                <div key={item} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-2 text-[10px] text-deck-muted">
                  {item}
                </div>
              ))}
            </div>
          </form>
        </aside>
      </div>
    </main>
  )
}
